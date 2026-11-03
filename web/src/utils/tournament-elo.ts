import { computeMovesHash } from "@avaclash/shared";
import { zeroHash, type Address, type Hex } from "viem";

export const CUP_STARTING_ELO = 1200;
const K = 32;
const emptyMovesHash = computeMovesHash([]);

type CupMatch = {
  roomId: bigint;
  white: Address;
  black: Address;
  result: { approved: boolean; outcome: number; movesHash: Hex };
};

export type FinishedCup = {
  id: bigint;
  claimUntil: bigint;
  matches: readonly CupMatch[];
};

export type CupRating = {
  address: Address;
  rating: number;
  games: number;
  rank: number;
};

export function calculateCupRatings(cups: readonly FinishedCup[]): CupRating[] {
  const ratings = new Map<Address, { rating: number; games: number }>();
  const ratedRooms = new Set<bigint>();
  // All Cups use the same claim window. Its end orders Cups by finalization.
  const ordered = [...cups].sort(
    (a, b) => Number(a.claimUntil - b.claimUntil) || Number(a.id - b.id),
  );

  for (const cup of ordered) {
    for (const { roomId, white, black, result } of [...cup.matches].sort(
      (a, b) => Number(a.roomId - b.roomId),
    )) {
      const movesHash = result.movesHash.toLowerCase();
      if (
        !result.approved ||
        movesHash === zeroHash ||
        movesHash === emptyMovesHash ||
        ratedRooms.has(roomId)
      ) {
        continue;
      }
      ratedRooms.add(roomId);
      const whiteKey = white.toLowerCase() as Address;
      const blackKey = black.toLowerCase() as Address;
      const a = ratings.get(whiteKey) ?? { rating: CUP_STARTING_ELO, games: 0 };
      const b = ratings.get(blackKey) ?? { rating: CUP_STARTING_ELO, games: 0 };
      const whiteScore = [1, 0, 0.5][result.outcome];
      const expected = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
      const change = K * (whiteScore - expected);
      ratings.set(whiteKey, { rating: a.rating + change, games: a.games + 1 });
      ratings.set(blackKey, { rating: b.rating - change, games: b.games + 1 });
    }
  }

  const rows = [...ratings]
    .map(([address, { rating, games }]) => ({
      address,
      rating: Math.round(rating),
      games,
    }))
    .sort((a, b) => b.rating - a.rating || a.address.localeCompare(b.address));
  let rank = 0;
  return rows.map((row, index) => {
    if (rows[index - 1]?.rating !== row.rating) rank = index + 1;
    return { ...row, rank };
  });
}
