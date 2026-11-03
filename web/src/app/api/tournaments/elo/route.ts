import { connection } from "next/server";
import { createPublicClient, http } from "viem";
import { TOURNAMENT_ABI } from "@avaclash/shared";
import {
  CHAIN_ID,
  RPC_URL,
  TOURNAMENT_ADDRESS,
  tournamentEnabled,
} from "@/config/env";
import {
  calculateCupRatings,
  CUP_STARTING_ELO,
  type FinishedCup,
} from "@/utils/tournament-elo";

const client = createPublicClient({
  transport: http(RPC_URL, { retryCount: 1, timeout: 8_000 }),
});
const contract = { address: TOURNAMENT_ADDRESS, abi: TOURNAMENT_ABI } as const;
const batchSize = 8n;

export async function GET() {
  await connection();
  if (!tournamentEnabled) {
    return Response.json({ error: "Cup is unavailable" }, { status: 503 });
  }

  try {
    const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
    const snapshot = { ...contract, blockNumber };
    const count = await client.readContract({
      ...snapshot,
      functionName: "nextTournamentId",
    });
    const cups: FinishedCup[] = [];

    for (let first = 0n; first < count; first += batchSize) {
      const size = Number(
        count - first < batchSize ? count - first : batchSize,
      );
      const tournaments = await Promise.all(
        Array.from({ length: size }, async (_, index) => {
          const id = first + BigInt(index);
          const tournament = await client.readContract({
            ...snapshot,
            functionName: "getTournament",
            args: [id],
          });
          return { id, tournament };
        }),
      );
      const finished = await Promise.all(
        tournaments
          .filter(({ tournament }) => tournament.phase === 2)
          .map(async ({ id, tournament }) => ({
            id,
            claimUntil: tournament.claimUntil,
            matches: await client.readContract({
              ...snapshot,
              functionName: "getMatchViews",
              args: [id],
            }),
          })),
      );
      cups.push(...finished);
    }

    return Response.json(
      { startingElo: CUP_STARTING_ELO, ratings: calculateCupRatings(cups) },
      {
        headers: {
          "Cache-Control":
            CHAIN_ID === 43113 ? "public, s-maxage=30" : "no-store",
        },
      },
    );
  } catch {
    return Response.json({ error: "Cup ratings unavailable" }, { status: 503 });
  }
}
