import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { puzzles, type Solution } from "@/utils/practice-puzzles";

function verifyLines(game: Chess, solution: Solution, remaining: number) {
  expect(remaining).toBeGreaterThan(0);
  expect(Object.keys(solution).length).toBeGreaterThan(0);
  for (const [uci, continuation] of Object.entries(solution)) {
    expect(game.turn()).toBe("w");
    game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    if (continuation) {
      expect(game.turn()).toBe("b");
      const { reply } = continuation;
      game.move({ from: reply.slice(0, 2), to: reply.slice(2, 4) });
      verifyLines(game, continuation.next, remaining - 1);
      game.undo();
    } else {
      expect(game.isCheckmate()).toBe(true);
      expect(game.turn()).toBe("b");
    }
    game.undo();
  }
}

describe("thế cờ AvaClash", () => {
  it("provides distinct positions across all three levels", () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(15);
    expect(new Set(puzzles.map(({ fen }) => fen)).size).toBe(puzzles.length);
    expect(new Set(puzzles.map(({ mateIn }) => mateIn))).toEqual(
      new Set([1, 2, 3]),
    );
  });

  it.each(puzzles)(
    "checks every supplied line for $title",
    ({ fen, solution, mateIn }) => {
      verifyLines(new Chess(fen), solution, mateIn);
    },
  );
});
