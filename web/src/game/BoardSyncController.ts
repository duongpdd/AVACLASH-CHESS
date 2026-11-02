import { ChessGame } from "@avaclash/shared";
import { applyRelayMoves } from "./applyRelayMoves";

export interface BoardSyncControllerOptions {
  playerColor?: "w" | "b" | "spectator";
  canMove?: boolean;
  onMove?: (uci: string, san: string) => void;
}

export class BoardSyncController {
  private game: ChessGame;
  private appliedMoves: string[] = [];
  private playerColor: "w" | "b" | "spectator";
  private canMove: boolean;
  private onMove?: (uci: string, san: string) => void;
  private selectedSquare: string | null = null;
  private lastMove: { from: string; to: string } | null = null;

  constructor(options: BoardSyncControllerOptions = {}) {
    this.game = new ChessGame();
    this.playerColor = options.playerColor ?? "spectator";
    this.canMove = options.canMove ?? false;
    this.onMove = options.onMove;
  }

  setPlayerColor(color: "w" | "b" | "spectator") {
    this.playerColor = color;
  }

  setCanMove(canMove: boolean) {
    this.canMove = canMove;
    if (!canMove) {
      this.selectedSquare = null;
    }
  }

  setSelectedSquare(square: string | null) {
    this.selectedSquare = square;
  }

  getSelectedSquare(): string | null {
    return this.selectedSquare;
  }

  getLastMove(): { from: string; to: string } | null {
    return this.lastMove;
  }

  getAppliedMoves(): string[] {
    return [...this.appliedMoves];
  }

  getPieceAt(square: string): { type: string; color: "w" | "b" } | null {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1]!) - 1;
    const board = this.game.board();
    const row = board[7 - rank];
    if (!row) return null;
    const cell = row[file];
    return cell ? { type: cell.type, color: cell.color } : null;
  }

  canSelectSquare(square: string): boolean {
    if (!this.canMove || this.playerColor === "spectator") return false;
    const piece = this.getPieceAt(square);
    if (!piece) return false;
    if (piece.color !== this.playerColor) return false;
    if (this.game.turn() !== this.playerColor) return false;
    return this.game.getLegalMoves().some((uci) => uci.startsWith(square));
  }

  getLegalTargets(square: string): string[] {
    if (!this.canSelectSquare(square)) return [];
    return this.game
      .getLegalMoves()
      .filter((uci) => uci.startsWith(square))
      .map((uci) => uci.slice(2, 4));
  }

  handleUserMoveAttempt(
    from: string,
    to: string,
    promotion?: string,
  ): { valid: boolean; error?: string } {
    if (!this.canMove || this.playerColor === "spectator") {
      this.selectedSquare = null;
      return {
        valid: false,
        error: "Not allowed to move (canMove is false or spectator)",
      };
    }

    const piece = this.getPieceAt(from);
    if (!piece || piece.color !== this.playerColor) {
      this.selectedSquare = null;
      return { valid: false, error: "Cannot move opponent piece" };
    }

    if (this.game.turn() !== this.playerColor) {
      this.selectedSquare = null;
      return { valid: false, error: "Not your turn" };
    }

    const uci = from + to + (promotion ?? "");
    const legalMoves = this.game.getLegalMoves();
    const isLegal = legalMoves.includes(uci);
    if (!isLegal) {
      this.selectedSquare = null;
      return { valid: false, error: "Illegal move" };
    }

    // Move is valid locally.
    // CRITICAL: DO NOT apply optimistic move to this.game!
    // The piece will only move once relay echoes the confirmed move.
    this.selectedSquare = null;

    // Calculate SAN for callback
    const tempGame = new ChessGame();
    for (const m of this.appliedMoves) {
      tempGame.makeMove(m);
    }
    const moveResult = tempGame.makeMove(uci);
    const san = moveResult ? moveResult.san : uci;

    this.onMove?.(uci, san);
    return { valid: true };
  }

  syncMoves(newMoves: string[]) {
    const diff = applyRelayMoves(this.appliedMoves, newMoves);
    if (diff.kind === "append") {
      for (const uci of diff.moves) {
        this.applyConfirmedMove(uci);
      }
    } else {
      this.rebuildFromMoves(diff.moves);
    }
  }

  applyConfirmedMove(uci: string) {
    const move = this.game.makeMove(uci);
    if (move) {
      this.appliedMoves.push(uci);
      this.lastMove = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    }
  }

  rebuildFromMoves(moves: string[]) {
    this.game = new ChessGame();
    this.appliedMoves = [];
    this.lastMove = null;
    for (const uci of moves) {
      const move = this.game.makeMove(uci);
      if (move) {
        this.appliedMoves.push(uci);
        this.lastMove = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
      }
    }
  }

  getBoard() {
    return this.game.board();
  }

  isCheck(): boolean {
    return this.game.isCheck();
  }

  isCheckmate(): boolean {
    return this.game.isCheckmate();
  }

  turn(): "w" | "b" {
    return this.game.turn();
  }

  getGame() {
    return this.game;
  }
}
