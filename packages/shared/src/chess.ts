import { Chess, type Move } from "chess.js";
import type { GameOutcome, EndReason } from "./types.js";

/**
 * Wrapper around chess.js providing a clean API for game operations.
 * Moves are represented in UCI format (e.g., "e2e4", "e7e8q").
 */
export class ChessGame {
  private game: Chess;

  constructor(fen?: string) {
    this.game = new Chess(fen);
  }

  /**
   * Attempt to make a move in UCI format.
   * Returns the Move object if valid, or null if invalid.
   */
  makeMove(uci: string): Move | null {
    const parsed = ChessGame.parseUci(uci);
    if (!parsed) return null;

    try {
      return this.game.move(parsed);
    } catch {
      return null;
    }
  }

  /**
   * Get all legal moves in UCI format.
   */
  getLegalMoves(): string[] {
    return this.game.moves({ verbose: true }).map((m) => ChessGame.toUci(m));
  }

  /**
   * Check if the game is over (checkmate, stalemate, draw, etc.).
   */
  isGameOver(): boolean {
    return this.game.isGameOver();
  }

  isCheckmate(): boolean {
    return this.game.isCheckmate();
  }

  isStalemate(): boolean {
    return this.game.isStalemate();
  }

  isDraw(): boolean {
    return this.game.isDraw();
  }

  isThreefoldRepetition(): boolean {
    return this.game.isThreefoldRepetition();
  }

  isInsufficientMaterial(): boolean {
    return this.game.isInsufficientMaterial();
  }

  /**
   * Check if fifty-move rule draw applies.
   * chess.js tracks this via halfMoves counter in FEN.
   */
  isDrawByFiftyMoves(): boolean {
    // chess.js halfMoves >= 100 means 50 full moves without pawn move or capture
    return this.game.fen().split(" ")[4] !== undefined &&
      Number(this.game.fen().split(" ")[4]) >= 100;
  }

  /**
   * Get game outcome based on board state.
   */
  getOutcome(): GameOutcome {
    if (this.game.isCheckmate()) {
      return this.game.turn() === "w" ? "black" : "white";
    }
    if (this.game.isDraw() || this.isDrawByFiftyMoves()) {
      return "draw";
    }
    return "ongoing";
  }

  /**
   * Get specific end reason if game is over.
   */
  getEndReason(): EndReason | undefined {
    if (this.game.isCheckmate()) return "checkmate";
    if (this.game.isStalemate()) return "stalemate";
    if (this.game.isThreefoldRepetition()) return "repetition";
    if (this.game.isInsufficientMaterial()) return "insufficient";
    if (this.isDrawByFiftyMoves()) return "fifty";
    return undefined;
  }

  isCheck(): boolean {
    return this.game.isCheck();
  }

  /**
   * Current turn: "w" or "b".
   */
  turn(): "w" | "b" {
    return this.game.turn();
  }

  /**
   * Current FEN string.
   */
  fen(): string {
    return this.game.fen();
  }

  /**
   * Get the full move history in SAN format (for display).
   */
  historySan(): string[] {
    return this.game.history();
  }

  /**
   * Get the full move history as verbose Move objects.
   */
  historyVerbose(): Move[] {
    return this.game.history({ verbose: true });
  }

  /**
   * Reset the board to starting position.
   */
  reset(): void {
    this.game.reset();
  }

  /**
   * Undo the last move.
   */
  undo(): Move | null {
    return this.game.undo();
  }

  /**
   * Get the board as 2D array.
   */
  board() {
    return this.game.board();
  }

  /**
   * Parse UCI string (e.g., "e2e4", "e7e8q") to chess.js move object.
   */
  static parseUci(uci: string): { from: string; to: string; promotion?: string } | null {
    if (uci.length < 4 || uci.length > 5) return null;

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;

    // Validate squares
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return null;
    if (promotion && !/^[qrbn]$/.test(promotion)) return null;

    return { from, to, promotion };
  }

  /**
   * Convert a chess.js Move to UCI string.
   */
  static toUci(move: Move): string {
    return move.from + move.to + (move.promotion ?? "");
  }
}
