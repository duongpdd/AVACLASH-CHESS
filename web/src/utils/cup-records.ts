import { TOURNAMENT_ABI } from "@avaclash/shared";
import {
  createPublicClient,
  http,
  type ContractFunctionReturnType,
} from "viem";
import { CHAIN_ID, RPC_URL, TOURNAMENT_ADDRESS } from "@/config/env";
import type { FinishedCup } from "./tournament-elo";

const client = createPublicClient({
  transport: http(RPC_URL, { retryCount: 1, timeout: 8_000 }),
});
const contract = { address: TOURNAMENT_ADDRESS, abi: TOURNAMENT_ABI } as const;
const batchSize = 8n;

export type CupRecord = Omit<FinishedCup, "matches"> & {
  title: string;
  phase: number;
  matches: ContractFunctionReturnType<
    typeof TOURNAMENT_ABI,
    "view",
    "getMatchViews"
  >;
};

export const cupReadCache = {
  "Cache-Control": CHAIN_ID === 43113 ? "public, s-maxage=30" : "no-store",
};

export async function readCupRecords(
  includeActive = false,
): Promise<CupRecord[]> {
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const snapshot = { ...contract, blockNumber };
  const count = await client.readContract({
    ...snapshot,
    functionName: "nextTournamentId",
  });
  const cups: CupRecord[] = [];
  for (let first = 0n; first < count; first += batchSize) {
    const size = Number(count - first < batchSize ? count - first : batchSize);
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
    const batch = await Promise.all(
      tournaments
        .filter(
          ({ tournament }) =>
            tournament.phase === 2 || (includeActive && tournament.phase === 1),
        )
        .map(async ({ id, tournament }) => ({
          id,
          title: tournament.title,
          phase: tournament.phase,
          claimUntil: tournament.claimUntil,
          matches: await client.readContract({
            ...snapshot,
            functionName: "getMatchViews",
            args: [id],
          }),
        })),
    );
    cups.push(...batch);
  }
  return cups;
}
