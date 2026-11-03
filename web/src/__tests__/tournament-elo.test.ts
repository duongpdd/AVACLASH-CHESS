import { describe, expect, it } from "vitest";
import { computeMovesHash } from "@avaclash/shared";
import { zeroHash, type Address } from "viem";
import { calculateCupRatings, type FinishedCup } from "@/utils/tournament-elo";

const white: Address = "0x0000000000000000000000000000000000000001";
const black: Address = "0x0000000000000000000000000000000000000002";
const movesHash = computeMovesHash(["e2e4", "e7e5"]);

function cup(
  id: bigint,
  claimUntil: bigint,
  ...matches: FinishedCup["matches"]
): FinishedCup {
  return { id, claimUntil, matches };
}

function game(roomId: bigint, outcome: number) {
  return {
    roomId,
    white,
    black,
    result: { approved: true, outcome, movesHash },
  };
}

describe("AvaClash Cup Elo", () => {
  it("splits a draw and gives equal ratings the same rank", () => {
    expect(calculateCupRatings([cup(0n, 1n, game(0n, 2))])).toEqual([
      { address: white, rating: 1200, games: 1, rank: 1 },
      { address: black, rating: 1200, games: 1, rank: 1 },
    ]);
  });

  it("rates in finalization order and rewards an upset more than a win between equals", () => {
    const first = cup(4n, 10n, game(5n, 0));
    const second = cup(1n, 20n, game(6n, 1));
    expect(calculateCupRatings([second, first])).toEqual([
      { address: black, rating: 1201, games: 2, rank: 1 },
      { address: white, rating: 1199, games: 2, rank: 2 },
    ]);
  });

  it("excludes unapproved, manual and empty games and counts each room once", () => {
    const win = game(0n, 0);
    const unapproved = {
      ...game(1n, 1),
      result: { ...win.result, approved: false },
    };
    const manual = {
      ...game(2n, 1),
      result: { ...win.result, movesHash: zeroHash },
    };
    const empty = {
      ...game(3n, 1),
      result: { ...win.result, movesHash: computeMovesHash([]) },
    };
    expect(
      calculateCupRatings([cup(0n, 1n, win, unapproved, manual, empty, win)]),
    ).toEqual([
      { address: white, rating: 1216, games: 1, rank: 1 },
      { address: black, rating: 1184, games: 1, rank: 2 },
    ]);
  });
});
