import { ChessGame } from "@avaclash/shared";
import type { GameOutcome, EndReason, PlayerColor } from "@avaclash/shared";

/**
 * Game state manager — separates chess logic from Phaser rendering.
 * Handles move validation, turn management, clocks, and game outcome.
 */
export interface GameStateEvents {
  onMove: (uci: string, san: string, fen: string) => void;
  onGameOver: (outcome: GameOutcome, reason: EndReason) => void;
  onTurnChange: (turn: PlayerColor) => void;
  onCheck: (color: PlayerColor) => void;
  onClockTick: (whiteMs: number, blackMs: number) => void;
}

export class GameState {
  private game: ChessGame;
  private moves: string[] = [];
  private sans: string[] = [];
  private events: Partial<GameStateEvents>;
  private whiteMs: number;
  private blackMs: number;
  private clockInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = 0;
  private gameOver = false;

  constructor(
    initialTimeMs: number = 5 * 60 * 1000,
    events: Partial<GameStateEvents> = {},
  ) {
    this.game = new ChessGame();
    this.events = events;
    this.whiteMs = initialTimeMs;
    this.blackMs = initialTimeMs;
  }

  /**
   * Try to make a move. Returns true if valid.
   */
  tryMove(from: string, to: string, promotion?: string): boolean {
    if (this.gameOver) return false;

    const uci = from + to + (promotion ?? "");
    const move = this.game.makeMove(uci);
    if (!move) return false;

    this.moves.push(uci);
    this.sans.push(move.san);

    this.events.onMove?.(uci, move.san, this.game.fen());

    // Check game-ending conditions
    this.checkGameOver();

    if (!this.gameOver) {
      const turn = this.currentTurn();
      this.events.onTurnChange?.(turn);

      if (this.game.isCheck()) {
        this.events.onCheck?.(turn);
      }
    }

    return true;
  }

  /**
   * Get legal moves for a square.
   */
  getLegalMovesFrom(square: string): string[] {
    return this.game
      .getLegalMoves()
      .filter((uci) => uci.startsWith(square))
      .map((uci) => uci.slice(2, 4));
  }

  /**
   * Check if a square has a piece that can move (belongs to current turn).
   */
  canSelectSquare(square: string): boolean {
    if (this.gameOver) return false;
    return this.getLegalMovesFrom(square).length > 0;
  }

  /**
   * Check if promotion is needed for a move.
   */
  needsPromotion(from: string, to: string): boolean {
    const piece = this.getBoardPiece(from);
    if (!piece || piece.type !== "p") return false;
    const rank = to[1];
    return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
  }

  /**
   * Get piece at a square.
   */
  getBoardPiece(square: string): { type: string; color: "w" | "b" } | null {
    const file = square.charCodeAt(0) - 97; // a=0
    const rank = parseInt(square[1]!) - 1;   // 1=0
    const board = this.game.board();
    const row = board[7 - rank];
    if (!row) return null;
    const cell = row[file];
    return cell ? { type: cell.type, color: cell.color } : null;
  }

  currentTurn(): PlayerColor {
    return this.game.turn() === "w" ? "white" : "black";
  }

  getFen(): string {
    return this.game.fen();
  }

  getMoves(): string[] {
    return [...this.moves];
  }

  getSans(): string[] {
    return [...this.sans];
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  getClocks(): { whiteMs: number; blackMs: number } {
    return { whiteMs: this.whiteMs, blackMs: this.blackMs };
  }

  /**
   * Start the clock.
   */
  startClock(): void {
    this.lastTickTime = Date.now();
    this.clockInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastTickTime;
      this.lastTickTime = now;

      if (this.currentTurn() === "white") {
        this.whiteMs = Math.max(0, this.whiteMs - elapsed);
      } else {
        this.blackMs = Math.max(0, this.blackMs - elapsed);
      }

      this.events.onClockTick?.(this.whiteMs, this.blackMs);

      // Check timeout
      if (this.whiteMs <= 0 && !this.gameOver) {
        this.gameOver = true;
        this.stopClock();
        this.events.onGameOver?.("black", "timeout");
      } else if (this.blackMs <= 0 && !this.gameOver) {
        this.gameOver = true;
        this.stopClock();
        this.events.onGameOver?.("white", "timeout");
      }
    }, 100);
  }

  /**
   * Stop the clock.
   */
  stopClock(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  /**
   * Handle resignation.
   */
  resign(color: PlayerColor): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.stopClock();
    const winner = color === "white" ? "black" : "white";
    this.events.onGameOver?.(winner, "resign");
  }

  /**
   * Handle draw agreement.
   */
  acceptDraw(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.stopClock();
    this.events.onGameOver?.("draw", "draw_agreed");
  }

  /**
   * Get the board as a 2D array for rendering.
   */
  getBoard() {
    return this.game.board();
  }

  /**
   * Destroy/cleanup.
   */
  destroy(): void {
    this.stopClock();
  }

  private checkGameOver(): void {
    if (this.game.isCheckmate()) {
      this.gameOver = true;
      this.stopClock();
      const winner = this.game.turn() === "w" ? "black" : "white";
      this.events.onGameOver?.(winner, "checkmate");
    } else if (this.game.isStalemate()) {
      this.gameOver = true;
      this.stopClock();
      this.events.onGameOver?.("draw", "stalemate");
    } else if (this.game.isThreefoldRepetition()) {
      this.gameOver = true;
      this.stopClock();
      this.events.onGameOver?.("draw", "repetition");
    } else if (this.game.isInsufficientMaterial()) {
      this.gameOver = true;
      this.stopClock();
      this.events.onGameOver?.("draw", "insufficient");
    } else if (this.game.isDrawByFiftyMoves()) {
      this.gameOver = true;
      this.stopClock();
      this.events.onGameOver?.("draw", "fifty");
    }
  }
}
