export interface ApplyRelayMovesResult {
  kind: "append" | "reset";
  moves: string[];
}

/**
 * Pure function to determine how to synchronize the chess board state
 * when receiving a new list of moves from the relay server.
 *
 * - "append": newMoves extends currentMoves (delta moves to play)
 * - "reset": newMoves diverges, is shorter, or is completely rebuilt
 */
export function applyRelayMoves(
  currentMoves: string[],
  newMoves: string[],
): ApplyRelayMovesResult {
  // 1. Equal length
  if (currentMoves.length === newMoves.length) {
    let identical = true;
    for (let i = 0; i < currentMoves.length; i++) {
      if (currentMoves[i] !== newMoves[i]) {
        identical = false;
        break;
      }
    }
    if (identical) {
      return { kind: "append", moves: [] };
    }
    return { kind: "reset", moves: [...newMoves] };
  }

  // 2. New moves extends current moves
  if (newMoves.length > currentMoves.length) {
    let isPrefix = true;
    for (let i = 0; i < currentMoves.length; i++) {
      if (currentMoves[i] !== newMoves[i]) {
        isPrefix = false;
        break;
      }
    }
    if (isPrefix) {
      return { kind: "append", moves: newMoves.slice(currentMoves.length) };
    }
    return { kind: "reset", moves: [...newMoves] };
  }

  // 3. Shorter than currentMoves (e.g. room re-initialized or roll back)
  return { kind: "reset", moves: [...newMoves] };
}
