import Phaser from "phaser";
import { GameState } from "./GameState";
import type { PlayerColor, GameOutcome, EndReason } from "@avaclash/shared";

// Unicode chess pieces
const PIECE_CHARS: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

const LIGHT_COLOR = 0xf0d9b5;
const DARK_COLOR = 0xb58863;
const HIGHLIGHT_COLOR = 0x7fc97f;
const SELECTED_COLOR = 0xffff44;
const LAST_MOVE_COLOR = 0xcdd26a;
const CHECK_COLOR = 0xff4444;

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

  // State
  private selectedSquare: string | null = null;
  private legalTargets: string[] = [];
  private lastMoveFrom: string | null = null;
  private lastMoveTo: string | null = null;
  private checkSquare: string | null = null;
  private showPromotionDialog = false;
  private pendingPromoFrom = "";
  private pendingPromoTo = "";
  private promotionButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "ChessScene" });
  }

  init(data: ChessSceneConfig) {
    this.config_ = data;
  }

  create() {
    const size = this.config_.boardSize;
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
        const kingChar = turn === "white" ? "K" : "k";
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

    // Draw board and pieces
    this.boardGraphics = this.add.graphics();
    this.highlightGraphics = this.add.graphics();

    this.drawBoard();
    this.drawPieces();

    // Start clock
    this.gameState.startClock();

    // Input handling
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.showPromotionDialog) return;
      this.handleClick(pointer.x, pointer.y);
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
    const colorPrefix = turn === "white" ? "w" : "b";
    const pieces = ["q", "r", "b", "n"];
    const labels = [
      PIECE_CHARS[colorPrefix + "q"]!,
      PIECE_CHARS[colorPrefix + "r"]!,
      PIECE_CHARS[colorPrefix + "b"]!,
      PIECE_CHARS[colorPrefix + "n"]!,
    ];

    // Show a simple promotion dialog
    const { px, py } = this.squareToPixel(to);
    const dialogWidth = this.tileSize * 4;
    const dialogX = Math.min(px, this.scale.width - dialogWidth);
    const dialogY = py;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 0.95);
    bg.fillRoundedRect(dialogX - 5, dialogY - 5, dialogWidth + 10, this.tileSize + 10, 8);

    this.promotionButtons = [];
    pieces.forEach((piece, i) => {
      const btn = this.add.text(dialogX + i * this.tileSize, dialogY, labels[i]!, {
        fontSize: `${this.tileSize - 8}px`,
        fixedWidth: this.tileSize,
        fixedHeight: this.tileSize,
        align: "center",
        backgroundColor: "#555555",
        padding: { top: 4 },
      });
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        this.gameState.tryMove(from, to, piece);
        this.clearPromotionDialog(bg);
      });
      btn.on("pointerover", () => btn.setBackgroundColor("#777777"));
      btn.on("pointerout", () => btn.setBackgroundColor("#555555"));
      this.promotionButtons.push(btn);
    });

    // Store bg reference for cleanup
    this.promotionButtons.push(bg as unknown as Phaser.GameObjects.Text);
  }

  private clearPromotionDialog(bg: Phaser.GameObjects.Graphics) {
    this.showPromotionDialog = false;
    bg.destroy();
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

        // Base color
        let color = isLight ? LIGHT_COLOR : DARK_COLOR;

        // Highlight last move
        if (square === this.lastMoveFrom || square === this.lastMoveTo) {
          color = LAST_MOVE_COLOR;
        }

        // Highlight selected
        if (square === this.selectedSquare) {
          color = SELECTED_COLOR;
        }

        // Check highlight
        if (square === this.checkSquare) {
          color = CHECK_COLOR;
        }

        this.boardGraphics.fillStyle(color);
        this.boardGraphics.fillRect(x, y, this.tileSize, this.tileSize);

        // Legal move dots
        if (this.legalTargets.includes(square)) {
          const hasPiece = this.gameState.getBoardPiece(square) !== null;
          this.highlightGraphics.fillStyle(HIGHLIGHT_COLOR, 0.7);
          if (hasPiece) {
            // Ring for captures
            this.highlightGraphics.fillCircle(
              x + this.tileSize / 2,
              y + this.tileSize / 2,
              this.tileSize / 2 - 2,
            );
            this.highlightGraphics.fillStyle(color);
            this.highlightGraphics.fillCircle(
              x + this.tileSize / 2,
              y + this.tileSize / 2,
              this.tileSize / 2 - 6,
            );
          } else {
            // Dot for moves
            this.highlightGraphics.fillCircle(
              x + this.tileSize / 2,
              y + this.tileSize / 2,
              this.tileSize / 6,
            );
          }
        }
      }
    }

    // File and rank labels
    for (let i = 0; i < 8; i++) {
      const fileChar = this.config_.flipBoard
        ? String.fromCharCode(104 - i) // h-a
        : String.fromCharCode(97 + i);  // a-h
      const rankChar = this.config_.flipBoard
        ? String(i + 1)  // 1-8
        : String(8 - i); // 8-1

      // File labels (bottom)
      const existingFile = this.children.getByName(`file-${i}`);
      if (!existingFile) {
        this.add.text(
          this.offsetX + i * this.tileSize + this.tileSize - 12,
          this.offsetY + 8 * this.tileSize + 2,
          fileChar,
          { fontSize: "12px", color: "#666" },
        ).setName(`file-${i}`);
      }

      // Rank labels (left)
      const existingRank = this.children.getByName(`rank-${i}`);
      if (!existingRank) {
        this.add.text(
          this.offsetX - 14,
          this.offsetY + i * this.tileSize + 2,
          rankChar,
          { fontSize: "12px", color: "#666" },
        ).setName(`rank-${i}`);
      }
    }
  }

  private drawPieces() {
    // Remove old pieces
    this.pieceTexts.forEach((text) => text.destroy());
    this.pieceTexts.clear();

    const board = this.gameState.getBoard();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row]?.[col];
        if (!piece) continue;

        const key = piece.color + piece.type;
        const char = PIECE_CHARS[key];
        if (!char) continue;

        const displayRow = this.config_.flipBoard ? 7 - row : row;
        const displayCol = this.config_.flipBoard ? 7 - col : col;
        const x = this.offsetX + displayCol * this.tileSize;
        const y = this.offsetY + displayRow * this.tileSize;

        const text = this.add.text(x, y, char, {
          fontSize: `${this.tileSize - 8}px`,
          fixedWidth: this.tileSize,
          fixedHeight: this.tileSize,
          align: "center",
          padding: { top: 4 },
        });

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
    // In hot-seat mode, draw is immediately accepted
    this.gameState.acceptDraw();
  }

  shutdown() {
    this.gameState.destroy();
    this.pieceTexts.forEach((t) => t.destroy());
    this.pieceTexts.clear();
  }
}
