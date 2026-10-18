import Phaser from "phaser";
import { GameState } from "./GameState";
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

// Premium board theme
const BOARD_THEME = {
  lightSquare: 0xeAD9B5,        // Kem gỗ sáng ấm
  darkSquare: 0xb58863,         // Nâu gỗ cổ điển
  lastMoveLight: 0xf7ec59,      // Highlight nước vừa đi (ô sáng)
  lastMoveDark: 0xdac331,       // Highlight nước vừa đi (ô tối)
  selectedSquare: 0x38bdf8,     // Xanh dương sáng cho ô đang chọn (alpha 0.45)
  legalMoveDot: 0x10b981,       // Xanh ngọc cho chấm gợi ý nước đi
  captureRing: 0xef4444,        // Vòng đỏ cảnh báo ô bắt quân
  checkGlow: 0xdc2626,          // Đỏ đậm khi Vua bị chiếu
};

export interface ChessSceneConfig {
  boardSize: number;
  flipBoard: boolean;
  onMove?: (uci: string, san: string) => void;
  onGameOver?: (outcome: GameOutcome, reason: EndReason) => void;
  onClockTick?: (whiteMs: number, blackMs: number) => void;
  onTurnChange?: (turn: PlayerColor) => void;
}

export class ChessScene extends Phaser.Scene {
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
  private promotionButtons: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = [];

  constructor() {
    super({ key: "ChessScene" });
  }

  init(data: ChessSceneConfig) {
    this.config_ = data;
  }

  create() {
    const size = this.config_.boardSize || 464;
    this.tileSize = Math.floor(size / 8);
    this.offsetX = Math.floor((this.scale.width - size) / 2);
    this.offsetY = Math.floor((this.scale.height - size) / 2);

    // Create game state
    this.gameState = new GameState(5 * 60 * 1000, {
      onMove: (uci, san, _fen) => {
        this.lastMoveFrom = uci.slice(0, 2);
        this.lastMoveTo = uci.slice(2, 4);
        this.checkSquare = null;
        this.selectedSquare = null;
        this.legalTargets = [];
        this.drawBoard();
        this.drawPieces();
        this.config_.onMove?.(uci, san);
      },
      onGameOver: (outcome, reason) => {
        this.gameState.stopClock();
        this.config_.onGameOver?.(outcome, reason);
      },
      onTurnChange: (turn) => {
        this.config_.onTurnChange?.(turn);
      },
      onCheck: (_color) => {
        // Find the king in check
        const turn = this.gameState.currentTurn();
        const board = this.gameState.getBoard();
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = board[r]?.[c];
            if (piece && piece.type === "k" && piece.color === (turn === "white" ? "w" : "b")) {
              const file = String.fromCharCode(97 + c);
              const rank = String(8 - r);
              this.checkSquare = file + rank;
            }
          }
        }
        this.drawBoard();
      },
      onClockTick: (whiteMs, blackMs) => {
        this.config_.onClockTick?.(whiteMs, blackMs);
      },
    });

    // Graphics layers
    this.boardGraphics = this.add.graphics().setDepth(1);
    this.highlightGraphics = this.add.graphics().setDepth(2);

    this.drawBoard();
    this.drawCoordinatesInsideBoard();
    this.drawPieces();

    // Start clock
    this.gameState.startClock();

    // Input handling
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.showPromotionDialog) return;
      this.handleClick(pointer.worldX, pointer.worldY);
    });
  }

  private handleClick(x: number, y: number) {
    const square = this.pixelToSquare(x, y);
    if (!square) return;

    if (this.selectedSquare) {
      // A piece is already selected — try to move
      if (this.legalTargets.includes(square)) {
        // Check if promotion needed
        if (this.gameState.needsPromotion(this.selectedSquare, square)) {
          this.showPromotionChoice(this.selectedSquare, square);
          return;
        }
        this.gameState.tryMove(this.selectedSquare, square);
      } else if (this.gameState.canSelectSquare(square)) {
        // Click on own piece — select it instead
        this.selectSquare(square);
      } else {
        // Click on empty/opponent square — deselect
        this.deselectSquare();
      }
    } else {
      // No piece selected — try to select
      if (this.gameState.canSelectSquare(square)) {
        this.selectSquare(square);
      }
    }
  }

  private selectSquare(square: string) {
    this.selectedSquare = square;
    this.legalTargets = this.gameState.getLegalMovesFrom(square);
    this.drawBoard();
  }

  private deselectSquare() {
    this.selectedSquare = null;
    this.legalTargets = [];
    this.drawBoard();
  }

  private showPromotionChoice(from: string, to: string) {
    this.showPromotionDialog = true;
    this.pendingPromoFrom = from;
    this.pendingPromoTo = to;

    const turn = this.gameState.currentTurn();
    const isWhite = turn === "white";
    const pieces = ["q", "r", "b", "n"];

    const { px, py } = this.squareToPixel(to);
    const dialogWidth = this.tileSize * 4;
    const dialogX = Math.max(0, Math.min(px, this.scale.width - dialogWidth));
    const dialogY = py;

    // Background card
    const bg = this.add.graphics().setDepth(20);
    bg.fillStyle(0x0f172a, 0.95);
    bg.lineStyle(2, 0xf59e0b, 0.8);
    bg.fillRoundedRect(dialogX - 4, dialogY - 4, dialogWidth + 8, this.tileSize + 8, 8);
    bg.strokeRoundedRect(dialogX - 4, dialogY - 4, dialogWidth + 8, this.tileSize + 8, 8);

    this.promotionButtons = [bg];
    pieces.forEach((piece, i) => {
      const glyph = SOLID_PIECE_GLYPHS[piece]!;
      const btn = this.add.text(
        dialogX + i * this.tileSize + this.tileSize / 2,
        dialogY + this.tileSize / 2,
        glyph,
        {
          fontFamily: "'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', sans-serif",
          fontSize: `${Math.floor(this.tileSize * 0.72)}px`,
          color: isWhite ? "#FFFBEB" : "#1E293B",
          stroke: isWhite ? "#0F172A" : "#F8FAFC",
          strokeThickness: isWhite ? 4 : 2.5,
          backgroundColor: "#1e293b",
          padding: { left: 4, right: 4, top: 2, bottom: 2 },
        }
      );
      btn.setOrigin(0.5, 0.52);
      btn.setDepth(21);
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        this.gameState.tryMove(from, to, piece);
        this.clearPromotionDialog();
      });
      btn.on("pointerover", () => btn.setBackgroundColor("#334155"));
      btn.on("pointerout", () => btn.setBackgroundColor("#1e293b"));
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
        let color = isLight ? BOARD_THEME.lightSquare : BOARD_THEME.darkSquare;

        // Last move highlight
        if (square === this.lastMoveFrom || square === this.lastMoveTo) {
          color = isLight ? BOARD_THEME.lastMoveLight : BOARD_THEME.lastMoveDark;
        }

        this.boardGraphics.fillStyle(color, 1);
        this.boardGraphics.fillRect(x, y, this.tileSize, this.tileSize);

        // Selected square highlight
        if (square === this.selectedSquare) {
          this.boardGraphics.fillStyle(BOARD_THEME.selectedSquare, 0.45);
          this.boardGraphics.fillRect(x, y, this.tileSize, this.tileSize);
        }

        // Check / Checkmate highlight on King's square
        if (square === this.checkSquare) {
          this.boardGraphics.fillStyle(0xef4444, 0.35);
          this.boardGraphics.fillRect(x, y, this.tileSize, this.tileSize);

          this.boardGraphics.lineStyle(3, 0xef4444, 1);
          this.boardGraphics.strokeRect(x + 1.5, y + 1.5, this.tileSize - 3, this.tileSize - 3);
        }

        // Legal move indicators
        if (this.legalTargets.includes(square)) {
          const hasPiece = this.gameState.getBoardPiece(square) !== null;
          const centerX = x + this.tileSize / 2;
          const centerY = y + this.tileSize / 2;

          if (hasPiece) {
            // Ring for captures
            this.highlightGraphics.lineStyle(4, BOARD_THEME.captureRing, 0.85);
            this.highlightGraphics.strokeCircle(centerX, centerY, this.tileSize * 0.42);
          } else {
            // Dot for empty target
            this.highlightGraphics.fillStyle(BOARD_THEME.legalMoveDot, 0.75);
            this.highlightGraphics.fillCircle(centerX, centerY, this.tileSize * 0.16);
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
      const textColor = isLight ? "#b58863" : "#ead9b5";
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
        }
      );
      label.setDepth(5);
      this.coordTexts.push(label);
    }

    // Files a -> h on bottom-most row
    for (let col = 0; col < 8; col++) {
      const displayCol = this.config_.flipBoard ? 7 - col : col;
      const isLight = (7 + displayCol) % 2 === 0;
      const textColor = isLight ? "#b58863" : "#ead9b5";
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
          }
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

    const board = this.gameState.getBoard();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row]?.[col];
        if (!piece) continue;

        const glyph = SOLID_PIECE_GLYPHS[piece.type] ?? "♟";
        const isWhite = piece.color === "w";

        const displayRow = this.config_.flipBoard ? 7 - row : row;
        const displayCol = this.config_.flipBoard ? 7 - col : col;
        const centerX = this.offsetX + displayCol * this.tileSize + this.tileSize / 2;
        const centerY = this.offsetY + displayRow * this.tileSize + this.tileSize / 2;

        const text = this.add.text(centerX, centerY, glyph, {
          fontFamily:
            "'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', sans-serif",
          fontSize: `${Math.floor(this.tileSize * 0.74)}px`,
          color: isWhite ? "#FFFBEB" : "#1E293B",
          stroke: isWhite ? "#0F172A" : "#F8FAFC",
          strokeThickness: isWhite ? 4 : 2.5,
          shadow: {
            offsetX: 0,
            offsetY: 3,
            color: "rgba(0, 0, 0, 0.45)",
            blur: 4,
            fill: true,
          },
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

  shutdown() {
    this.gameState.destroy();
    this.pieceTexts.forEach((t) => t.destroy());
    this.pieceTexts.clear();
    this.coordTexts.forEach((t) => t.destroy());
    this.coordTexts = [];
  }
}
