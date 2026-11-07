"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { CardCustom } from "@/components/ui/card-custom";
import { Button } from "@/components/ui/button";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createPublicClient, formatEther, http } from "viem";
import { usePublicClient } from "wagmi";
import { TOURNAMENT_ABI } from "@avaclash/shared";
import {
  CHAIN_ID,
  CURRENCY_SYMBOL,
  FUJI_EXPLORER_URL,
  TOURNAMENT_ADDRESS,
} from "@/config/env";

const fujiHistoryClient = createPublicClient({
  // The default Fuji RPC allows only 100 blocks per log query.
  transport: http("https://avalanche-fuji-c-chain-rpc.publicnode.com", {
    timeout: 8_000,
    retryCount: 0,
  }),
});
const events = TOURNAMENT_ABI.filter(
  (item) =>
    item.type === "event" &&
    (item.name === "Funded" ||
      item.name === "Reviewed" ||
      item.name === "Finalized" ||
      item.name === "Claimed" ||
      item.name === "Refunded"),
);
const labels = {
  Funded: "messageFundPrizePool",
  Reviewed: "messageApproveResult",
  Finalized: "messageFinalizePrizes",
  Claimed: "messageClaimReward",
  Refunded: "messageSponsorRefund",
} as const;
const outcomes = [
  "messageWhiteWins",
  "messageBlackWins",
  "messageDraw2",
] as const;
const pageSize = 10_000n;
const firstBlock =
  CHAIN_ID === 43113 &&
  TOURNAMENT_ADDRESS.toLowerCase() ===
    "0x268f6034175750791aaaa20fd04f658bddacb9f9"
    ? 60_444_402n // Deployment block of the public Cup contract.
    : 0n;

export default function TournamentHistory({
  id,
  roomIds,
}: {
  id: bigint;
  roomIds: bigint[];
}) {
  const uiText = useUiCopy();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const client = CHAIN_ID === 43113 ? fujiHistoryClient : publicClient;
  const history = useInfiniteQuery({
    queryKey: [
      "tournament-history",
      CHAIN_ID,
      TOURNAMENT_ADDRESS,
      id.toString(),
    ],
    enabled: !!client,
    initialPageParam: null as bigint | null,
    queryFn: async ({ pageParam }) => {
      if (!client) throw new Error("RPC unavailable");
      const toBlock = pageParam ?? (await client.getBlockNumber());
      const fromBlock =
        toBlock >= firstBlock + pageSize ? toBlock - pageSize + 1n : firstBlock;
      const logs = await client.getLogs({
        address: TOURNAMENT_ADDRESS,
        events,
        strict: true,
        fromBlock,
        toBlock,
      });
      return { logs: logs.reverse(), fromBlock };
    },
    getNextPageParam: ({ fromBlock }) =>
      fromBlock > firstBlock ? fromBlock - 1n : undefined,
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const rooms = new Set(roomIds);
  const rows =
    history.data?.pages.flatMap(({ logs }) =>
      logs.filter((log) =>
        log.eventName === "Reviewed"
          ? rooms.has(log.args.roomId)
          : log.args.id === id,
      ),
    ) ?? [];

  return (
    <CardCustom className="grid gap-3" id="lich-su">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-description font-semibold">
            {uiText("messageFundingAndResultsHistory")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {uiText("messageTransactionsForFundingMatchReviewsFinalization")}
          </p>
        </div>
        <Button
          type="button"
          disabled={history.isFetching}
          onClick={() => void history.refetch()}
        >
          {uiText("messageRefresh")}
        </Button>
      </div>
      {history.isPending && (
        <p role="status">{uiText("messageLoadingHistory")}</p>
      )}
      {history.isError && (
        <p role="status" className="text-status-warning">
          {uiText("messageCouldNotLoadTheLatestHistory")}
        </p>
      )}
      {!history.isPending && !history.isError && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {history.hasNextPage
            ? uiText("messageNoTransactionsInTheScannedBlocks")
            : uiText("messageThisTournamentHasNoTransactionsOf")}
        </p>
      )}
      {rows.length > 0 && (
        <ol className="grid gap-2">
          {rows.map((log) => {
            const args = log.args;
            const actor =
              "sponsor" in args
                ? args.sponsor
                : "player" in args
                  ? args.player
                  : undefined;
            const detail =
              "amount" in args
                ? `${formatEther(args.amount)} ${CURRENCY_SYMBOL} test`
                : "roomId" in args
                  ? uiText("messageMatch3", {
                      p0: String(args.roomId),
                      p1: uiText(outcomes[args.outcome] ?? "messageUnknown"),
                    })
                  : undefined;
            return (
              <li
                key={`${log.transactionHash}:${log.logIndex}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 p-3 text-sm"
              >
                <div>
                  <p className="font-semibold">
                    {uiText(labels[log.eventName])}
                    {detail && ` · ${detail}`}
                  </p>
                  {actor && (
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {actor}
                    </p>
                  )}
                </div>
                {CHAIN_ID === 43113 ? (
                  <a
                    className="text-link"
                    href={`${FUJI_EXPLORER_URL}/tx/${log.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {uiText("messageViewTransaction")}
                  </a>
                ) : (
                  <span className="break-all font-mono text-xs text-muted-foreground">
                    {log.transactionHash}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {history.hasNextPage && (
        <Button
          type="button"
          className="w-fit"
          disabled={history.isFetching}
          onClick={() => void history.fetchNextPage()}
        >
          {uiText("messageViewOlderTransactions")}
        </Button>
      )}
    </CardCustom>
  );
}
