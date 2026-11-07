import * as PhaserNS from "phaser";

const phaserModule = PhaserNS as typeof PhaserNS & {
  default?: typeof PhaserNS;
};
const Phaser = phaserModule["default"] ?? PhaserNS;
import { GameState } from "./game-state";
import {
  CHECK_ALPHA, colorHex, DEFAULT_THEME, PIECE_SHADOW, PROMOTION_STYLE,
  SELECTED_ALPHA, type ResolvedTheme,
} from "./theme";
import { BoardSyncController } from "./board-sync-controller";
import type { PlayerColor, GameOutcome, EndReason } from "@avaclash/shared";

// Solid glyphs for both sides to allow stroke + color differentiation
const SOLID_PIECE_GLYPHS: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};


export interface ChessSceneConfig {
  boardSize: number;
  theme?: ResolvedTheme;
  flipBoard: boolean;
  moves?: string[];
  playerColor?: "w" | "b" | "spectator";
  canMove?: boolean;
  onMove?: (uci: string, san: string) => void;
  onGameOver?: (outcome: GameOutcome, reason: EndReason) => void;
  onClockTick?: (whiteMs: number, blackMs: number) => void;
  onTurnChange?: (turn: PlayerColor) => void;
  onBlockedInteraction?: () => void;
}

export class ChessScene extends Phaser.Scene {
  private theme = DEFAULT_THEME;
  private controller!: BoardSyncController;
  private gameState!: GameState;
  private config_!: ChessSceneConfig;
  private tileSize = 0;
  private offsetX = 0;
  private offsetY = 0;

  // Graphics layers
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private pieceTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private coordTexts: Phaser.GameObjects.Text[] = [];

  // State
  private selectedSquare: string | null = null;
  private legalTargets: string[] = [];
  private lastMoveFrom: string | null = null;
  private lastMoveTo: string | null = null;
  private checkSquare: string | null = null;
  private showPromotionDialog = false;
  private pendingPromoFrom = "";
  private pendingPromoTo = "";
  private promotionButtons: (
    Phaser.GameObjects.Text | Phaser.GameObjects.Graphics
  )[] = [];

  constructor() {
    super({ key: "ChessScene" });
  }

  init(data: ChessSceneConfig) {
    this.config_ = data;
    this.theme = data.theme ?? DEFAULT_THEME;
    this.controller = new BoardSyncController({
      playerColor: data.playerColor,
      canMove: data.canMove,
      onMove: (uci, san) => {
        this.config_.onMove?.(uci, san);
      },
    });

    if (data.moves && data.moves.length > 0) {
      this.controller.syncMoves(data.moves);
      const last = this.controller.getLastMove();
      if (last) {
        this.lastMoveFrom = last.from;
        this.lastMoveTo = last.to;
      }
    }
  }

  create() {
    const size = this.config_.boardSize || 464;
    this.tileSize = Math.floor(size / 8);
    this.offsetX = Math.floor((this.scale.width - size) / 2);
    this.offsetY = Math.floor((this.scale.height - size) / 2);

    // Create gameState synchronized with controller moves
    this.gameState = new GameState(5 * 60 * 1000, {
      onGameOver: (outcome, reason) => {
        this.config_.onGameOver?.(outcome, reason);
      },
      onTurnChange: (turn) => {
        this.config_.onTurnChange?.(turn);
      },
      onClockTick: (whiteMs, blackMs) => {
        this.config_.onClockTick?.(whiteMs, blackMs);
      },
    });

    if (this.config_.moves) {
      for (const m of this.config_.moves) {
        this.gameState.tryMove(
          m.slice(0, 2),
          m.slice(2, 4),
          m.slice(4) || undefined,
        );
      }
    }

    // Graphics layers
    this.boardGraphics = this.add.graphics().setDepth(1);
    this.highlightGraphics = this.add.graphics().setDepth(2);

    this.updateCheckSquare();
    this.drawBoard();
    this.drawCoordinatesInsideBoard();
    this.drawPieces();

    // Input handling
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.showPromotionDialog) return;
      this.handleClick(pointer.worldX, pointer.worldY);
    });
  }

  public setTheme(theme = DEFAULT_THEME) {
    if (this.theme === theme) return;
    this.theme = theme;
    if (!this.boardGraphics) return;
    this.drawBoard();
    this.drawCoordinatesInsideBoard();
    this.drawPieces();
    if (this.showPromotionDialog) {
      this.clearPromotionDialog();
      this.showPromotionChoice(this.pendingPromoFrom, this.pendingPromoTo);
    }
  }

  public syncMoves(moves: string[]) {
    this.controller.syncMoves(moves);

    // Call destroy() on old GameState instance to stop active intervals and prevent memory leak
    if (this.gameState) {
      this.gameState.destroy();
    }

    // Replay moves into this.gameState so getGameState().getMaterialStats() stays in sync
    this.gameState = new GameState(5 * 60 * 1000);
    for (const m of moves) {
      this.gameState.tryMove(
        m.slice(0, 2),
        m.slice(2, 4),
        m.slice(4) || undefined,
      );
    }

    const last = this.controller.getLastMove();
    if (last) {
      this.lastMoveFrom = last.from;
      this.lastMoveTo = last.to;
    } else {
      this.lastMoveFrom = null;
      this.lastMoveTo = null;
    }

    this.selectedSquare = null;
    this.legalTargets = [];
    this.updateCheckSquare();
    this.drawBoard();
    this.drawPieces();
  }

  public setCanMove(canMove: boolean) {
    this.config_.canMove = canMove;
    this.controller.setCanMove(canMove);
    if (!canMove) {
      this.selectedSquare = null;
      this.legalTargets = [];
      this.drawBoard();
    }
  }

  public setPlayerColor(color: "w" | "b" | "spectator") {
    this.config_.playerColor = color;
    this.controller.setPlayerColor(color);
    this.selectedSquare = null;
    this.legalTargets = [];
    this.drawBoard();
  }

  private updateCheckSquare() {
    if (this.controller.isCheck() || this.controller.isCheckmate()) {
      const turn = this.controller.turn();
      const board = this.controller.getBoard();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r]?.[c];
          if (piece && piece.type === "k" && piece.color === turn) {
            const file = String.fromCharCode(97 + c);
            const rank = String(8 - r);
            this.checkSquare = file + rank;
          }
        }
      }
    } else {
      this.checkSquare = null;
    }
  }

  private handleClick(x: number, y: number) {
    const square = this.pixelToSquare(x, y);
    if (!square) return;

    if (this.selectedSquare) {
      // A piece is already selected — try to move
      if (this.legalTargets.includes(square)) {
        // Check if promotion needed
        if (this.needsPromotion(this.selectedSquare, square)) {
          this.showPromotionChoice(this.selectedSquare, square);
          return;
        }
        // User attempted legal move:
        // Do NOT execute optimistic move on board!
        // handleUserMoveAttempt triggers onMove(uci, san) and keeps board state until relay confirms
        this.controller.handleUserMoveAttempt(this.selectedSquare, square);
        this.deselectSquare();
      } else if (this.controller.canSelectSquare(square)) {
        // Click on own piece — select it instead
        this.selectSquare(square);
      } else {
        // Click on empty/opponent square — deselect
        this.deselectSquare();
      }
    } else {
      // No piece selected — try to select
      if (this.controller.canSelectSquare(square)) {
        this.selectSquare(square);
      } else {
        const piece = this.controller.getPieceAt(square);
        if (piece) {
          if (
            !this.config_.canMove ||
            this.config_.playerColor === "spectator" ||
            this.controller.turn() !== this.config_.playerColor
          ) {
            this.config_.onBlockedInteraction?.();
          }
        }
      }
    }
  }

  private selectSquare(square: string) {
    this.selectedSquare = square;
    this.legalTargets = this.controller.getLegalTargets(square);
    this.drawBoard();
  }

  private deselectSquare() {
    this.selectedSquare = null;
    this.legalTargets = [];
    this.drawBoard();
  }

  private needsPromotion(from: string, to: string): boolean {
    const piece = this.controller.getPieceAt(from);
    if (!piece || piece.type !== "p") return false;
    const rank = to[1];
    return (
      (piece.color === "w" && rank === "8") ||
      (piece.color === "b" && rank === "1")
    );
  }

  private showPromotionChoice(from: string, to: string) {
    this.showPromotionDialog = true;
    this.pendingPromoFrom = from;
    this.pendingPromoTo = to;

    const turn = this.controller.turn();
    const style = turn === "w" ? this.theme.white : this.theme.black;
    const pieces = ["q", "r", "b", "n"];

    const { px, py } = this.squareToPixel(to);
    const dialogWidth = this.tileSize * 4;
    const dialogX = Math.max(0, Math.min(px, this.scale.width - dialogWidth));
    const dialogY = py;

    // Background card
    const bg = this.add.graphics().setDepth(20);
    bg.fillStyle(PROMOTION_STYLE.background, 0.95);
    bg.lineStyle(2, PROMOTION_STYLE.border, 0.8);
    bg.fillRoundedRect(
      dialogX - 4,
      dialogY - 4,
      dialogWidth + 8,
      this.tileSize + 8,
      8,
    );
    bg.strokeRoundedRect(
      dialogX - 4,
      dialogY - 4,
      dialogWidth + 8,
      this.tileSize + 8,
      8,
    );

    this.promotionButtons = [bg];
    pieces.forEach((piece, i) => {
      const glyph = SOLID_PIECE_GLYPHS[piece]!;
      const btn = this.add.text(
        dialogX + i * this.tileSize + this.tileSize / 2,
        dialogY + this.tileSize / 2,
        glyph,
        {
          fontFamily:
            "'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', sans-serif",
          fontSize: `${Math.floor(this.tileSize * 0.72)}px`,
          color: colorHex(style.fill),
          stroke: colorHex(style.stroke),
          strokeThickness: style.width,
          backgroundColor: colorHex(PROMOTION_STYLE.button).toLowerCase(),
          padding: { left: 4, right: 4, top: 2, bottom: 2 },
        },
      );
      btn.setOrigin(0.5, 0.52);
      btn.setDepth(21);
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        this.controller.handleUserMoveAttempt(from, to, piece);
        this.clearPromotionDialog();
        this.deselectSquare();
      });
      btn.on("pointerover", () => btn.setBackgroundColor(colorHex(PROMOTION_STYLE.hover).toLowerCase()));
      btn.on("pointerout", () => btn.setBackgroundColor(colorHex(PROMOTION_STYLE.button).toLowerCase()));
      this.promotionButtons.push(btn);
    });
  }

  private clearPromotionDialog() {
    this.showPromotionDialog = false;
    this.promotionButtons.forEach((btn) => btn.destroy());
    this.promotionButtons = [];
  }

  private drawBoard() {
    this.boardGraphics.clear();
    this.highlightGraphics.clear();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const displayRow = this.config_.flipBoard ? 7 - row : row;
        const displayCol = this.config_.flipBoard ? 7 - col : col;
        const x = this.offsetX + displayCol * this.tileSize;
        const y = this.offsetY + displayRow * this.tileSize;

        const file = String.fromCharCode(97 + col);
        const rank = String(8 - row);
        const square = file + rank;

        // Base square color
        let color = isLight ? this.theme.board.lightSquare : this.theme.board.darkSquare;

        // Last move highlight
        if (square === this.lastMoveFrom || square === this.lastMoveTo) {
          color = isLight
            ? this.theme.board.lastMoveLight
            : this.theme.board.lastMoveDark;
        }

        this.boardGraphics.fillStyle(color, 1);
        this.boardGraphics.fillRect(x, y, this.tileSize, this.tileSize);

        // Selected square highlight
        if (square === this.selectedSquare) {
          this.boardGraphics.fillStyle(this.theme.board.selectedSquare, SELECTED_ALPHA);
          this.boardGraphics.fillRect(x, y, this.tileSize, this.tileSize);
        }

        // Check / Checkmate highlight on King's square
        if (square === this.checkSquare) {
          this.boardGraphics.fillStyle(this.theme.board.checkGlow, CHECK_ALPHA);
          this.boardGraphics.fillRect(x, y, this.tileSize, this.tileSize);

          this.boardGraphics.lineStyle(3, this.theme.board.checkGlow, 1);
          this.boardGraphics.strokeRect(
            x + 1.5,
            y + 1.5,
            this.tileSize - 3,
            this.tileSize - 3,
          );
        }

        // Legal move indicators
        if (this.legalTargets.includes(square)) {
          const hasPiece = this.controller.getPieceAt(square) !== null;
          const centerX = x + this.tileSize / 2;
          const centerY = y + this.tileSize / 2;

          if (hasPiece) {
            // Ring for captures
            this.highlightGraphics.lineStyle(4, this.theme.board.captureRing, 0.85);
            this.highlightGraphics.strokeCircle(
              centerX,
              centerY,
              this.tileSize * 0.42,
            );
          } else {
            // Dot for empty target
            this.highlightGraphics.fillStyle(this.theme.board.legalMoveDot, 0.75);
            this.highlightGraphics.fillCircle(
              centerX,
              centerY,
              this.tileSize * 0.16,
            );
          }
        }
      }
    }
  }

  /**
   * Draw inside-board coordinates 1-8 and a-h on the outer edge squares.
   */
  private drawCoordinatesInsideBoard() {
    this.coordTexts.forEach((text) => text.destroy());
    this.coordTexts = [];

    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

    // Ranks 8 -> 1 on left-most column
    for (let row = 0; row < 8; row++) {
      const displayRow = this.config_.flipBoard ? 7 - row : row;
      const isLight = displayRow % 2 === 0;
      const textColor = colorHex(isLight ? this.theme.board.darkSquare : this.theme.board.lightSquare).toLowerCase();
      const rankLabel = this.config_.flipBoard ? ranks[7 - row]! : ranks[row]!;

      const label = this.add.text(
        this.offsetX + 4,
        this.offsetY + row * this.tileSize + 3,
        rankLabel,
        {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "11px",
          fontStyle: "bold",
          color: textColor,
        },
      );
      label.setDepth(5);
      this.coordTexts.push(label);
    }

    // Files a -> h on bottom-most row
    for (let col = 0; col < 8; col++) {
      const displayCol = this.config_.flipBoard ? 7 - col : col;
      const isLight = (7 + displayCol) % 2 === 0;
      const textColor = colorHex(isLight ? this.theme.board.darkSquare : this.theme.board.lightSquare).toLowerCase();
      const fileLabel = this.config_.flipBoard ? files[7 - col]! : files[col]!;

      const label = this.add
        .text(
          this.offsetX + (col + 1) * this.tileSize - 4,
          this.offsetY + 8 * this.tileSize - 3,
          fileLabel,
          {
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "11px",
            fontStyle: "bold",
            color: textColor,
          },
        )
        .setOrigin(1, 1);
      label.setDepth(5);
      this.coordTexts.push(label);
    }
  }

  /**
   * Draw solid pieces with high-contrast outline and 3D shadow.
   */
  private drawPieces() {
    // Remove old piece texts
    this.pieceTexts.forEach((text) => text.destroy());
    this.pieceTexts.clear();

    const board = this.controller.getBoard();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row]?.[col];
        if (!piece) continue;

        const glyph = SOLID_PIECE_GLYPHS[piece.type] ?? "♟";
        const style = piece.color === "w" ? this.theme.white : this.theme.black;

        const displayRow = this.config_.flipBoard ? 7 - row : row;
        const displayCol = this.config_.flipBoard ? 7 - col : col;
        const centerX =
          this.offsetX + displayCol * this.tileSize + this.tileSize / 2;
        const centerY =
          this.offsetY + displayRow * this.tileSize + this.tileSize / 2;

        const text = this.add.text(centerX, centerY, glyph, {
          fontFamily:
            "'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', sans-serif",
          fontSize: `${Math.floor(this.tileSize * 0.74)}px`,
          color: colorHex(style.fill),
          stroke: colorHex(style.stroke),
          strokeThickness: style.width,
          shadow: this.theme.shadow ? PIECE_SHADOW : undefined,
        });

        text.setOrigin(0.5, 0.52);
        text.setDepth(10);

        const file = String.fromCharCode(97 + col);
        const rank = String(8 - row);
        this.pieceTexts.set(file + rank, text);
      }
    }
  }

  private pixelToSquare(px: number, py: number): string | null {
    const col = Math.floor((px - this.offsetX) / this.tileSize);
    const row = Math.floor((py - this.offsetY) / this.tileSize);

    if (col < 0 || col > 7 || row < 0 || row > 7) return null;

    const actualCol = this.config_.flipBoard ? 7 - col : col;
    const actualRow = this.config_.flipBoard ? 7 - row : row;

    const file = String.fromCharCode(97 + actualCol);
    const rank = String(8 - actualRow);
    return file + rank;
  }

  private squareToPixel(square: string): { px: number; py: number } {
    const col = square.charCodeAt(0) - 97;
    const row = 8 - parseInt(square[1]!);

    const displayCol = this.config_.flipBoard ? 7 - col : col;
    const displayRow = this.config_.flipBoard ? 7 - row : row;

    return {
      px: this.offsetX + displayCol * this.tileSize,
      py: this.offsetY + displayRow * this.tileSize,
    };
  }

  // Public methods for external control

  getGameState(): GameState {
    return this.gameState;
  }

  resign(color: PlayerColor) {
    this.gameState.resign(color);
  }

  offerDraw() {
    this.gameState.acceptDraw();
  }

  deductTime(color: PlayerColor, penaltyMs: number) {
    this.gameState.deductTime(color, penaltyMs);
  }

  forfeit(violatorColor: PlayerColor, reason: EndReason = "timeout") {
    this.gameState.forfeit(violatorColor, reason);
  }

  shutdown() {
    this.gameState.destroy();
    this.pieceTexts.forEach((t) => t.destroy());
    this.pieceTexts.clear();
    this.coordTexts.forEach((t) => t.destroy());
    this.coordTexts = [];
  }
}
