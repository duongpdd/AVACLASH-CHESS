"use client";

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
  Funded: "Nạp quỹ thưởng",
  Reviewed: "Duyệt kết quả",
  Finalized: "Chốt bảng thưởng",
  Claimed: "Nhận thưởng",
  Refunded: "Hoàn tiền tài trợ",
};
const outcomes = ["Trắng thắng", "Đen thắng", "Hòa"];
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
    <section className="surface-card grid gap-3" id="lich-su">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">Lịch sử quỹ và kết quả</h2>
          <p className="text-sm text-slate-400">
            Các giao dịch nạp quỹ, duyệt ván, chốt bảng, nhận thưởng và hoàn tài
            trợ.
          </p>
        </div>
        <button
          type="button"
          className="button-secondary"
          disabled={history.isFetching}
          onClick={() => void history.refetch()}
        >
          Cập nhật
        </button>
      </div>
      {history.isPending && <p role="status">Đang tải lịch sử…</p>}
      {history.isError && (
        <p role="status" className="text-amber-200">
          Chưa tải được lịch sử mới nhất. Hãy thử lại.
        </p>
      )}
      {!history.isPending && !history.isError && rows.length === 0 && (
        <p className="text-sm text-slate-400">
          {history.hasNextPage
            ? "Chưa có giao dịch trong các block đã xem."
            : "Giải chưa có giao dịch thuộc các mục trên."}
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
                  ? `Ván #${args.roomId} · ${outcomes[args.outcome]}`
                  : undefined;
            return (
              <li
                key={`${log.transactionHash}:${log.logIndex}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3 text-sm"
              >
                <div>
                  <p className="font-semibold">
                    {labels[log.eventName]}
                    {detail && ` · ${detail}`}
                  </p>
                  {actor && (
                    <p className="break-all font-mono text-xs text-slate-400">
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
                    Xem giao dịch
                  </a>
                ) : (
                  <span className="break-all font-mono text-xs text-slate-400">
                    {log.transactionHash}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {history.hasNextPage && (
        <button
          type="button"
          className="button-secondary w-fit"
          disabled={history.isFetching}
          onClick={() => void history.fetchNextPage()}
        >
          Xem giao dịch cũ hơn
        </button>
      )}
    </section>
  );
}
