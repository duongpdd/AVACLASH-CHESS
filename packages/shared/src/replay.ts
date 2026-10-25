import { ChessGame } from "./chess.js";
import type { ReplayResult, EndReason } from "./types.js";

/**
 * Replay a list of UCI moves from the starting position.
 *
 * Creates a fresh chess.js instance, applies each move sequentially,
 * and determines the game outcome.
 *
 * @param moves - Array of UCI move strings (e.g., ["e2e4", "e7e5", "g1f3"])
 * @returns ReplayResult with validity, outcome, optional reason, and moveCount
 */
export function replay(moves: string[]): ReplayResult {
  const game = new ChessGame();

  // Apply each move; if any move is invalid, return invalid result
  for (const uci of moves) {
    const result = game.makeMove(uci);
    if (result === null) {
      return { valid: false, outcome: "ongoing", moveCount: moves.length };
    }
  }

  const moveCount = moves.length;

  // Determine outcome after all moves applied
  if (game.isCheckmate()) {
    // The side that just moved delivered checkmate
    const winner = game.turn() === "w" ? "black" : "white";
    return { valid: true, outcome: winner, reason: "checkmate", moveCount };
  }

  if (game.isStalemate()) {
    return { valid: true, outcome: "draw", reason: "stalemate", moveCount };
  }

  if (game.isThreefoldRepetition()) {
    return { valid: true, outcome: "draw", reason: "repetition", moveCount };
  }

  if (game.isInsufficientMaterial()) {
    return { valid: true, outcome: "draw", reason: "insufficient", moveCount };
  }

  if (game.isDrawByFiftyMoves()) {
    return { valid: true, outcome: "draw", reason: "fifty", moveCount };
  }

  // Game is still ongoing
  return { valid: true, outcome: "ongoing", moveCount };
}

/**
 * Validate that a replay result matches the claimed winner address.
 *
 * For rule-based endings (checkmate, stalemate, etc.), the replay outcome
 * must match the claimed winner.
 *
 * For agreement-based endings (resign, timeout, draw_agreed), we only
 * verify that all moves are valid and the game hasn't ended by rules yet.
 *
 * @param moves - Array of UCI move strings
 * @param claimedWinner - "white", "black", or "draw"
 * @param endReason - The reason the game ended
 * @returns true if the claim is consistent with the replay
 */
export function validateResult(
  moves: string[],
  claimedWinner: "white" | "black" | "draw",
  endReason: EndReason,
): boolean {
  const result = replay(moves);

  if (!result.valid) return false;

  // Rule-based endings: replay must match
  const ruleBasedReasons: EndReason[] = [
    "checkmate",
    "stalemate",
    "repetition",
    "fifty",
    "insufficient",
  ];

  if (ruleBasedReasons.includes(endReason)) {
    return result.outcome === claimedWinner;
  }

  // Agreement-based endings (resign, timeout, draw_agreed):
  // Just verify moves are valid and game is still ongoing (not ended by rules)
  return result.outcome === "ongoing";
}
