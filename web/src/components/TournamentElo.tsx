"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { CHAIN_ID, tournamentEnabled } from "@/config/env";
import type { CupRating } from "@/utils/tournament-elo";

export default function TournamentElo() {
  const { address } = useAccount();
  const [showAll, setShowAll] = useState(false);
  const board = useQuery({
    queryKey: ["tournament-elo", CHAIN_ID],
    enabled: tournamentEnabled,
    queryFn: async ({
      signal,
    }): Promise<{ startingElo: number; ratings: CupRating[] }> => {
      const response = await fetch("/api/tournaments/elo", { signal });
      if (!response.ok) throw new Error("Cup ratings unavailable");
      return response.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
  if (!tournamentEnabled) return null;

  const ratings = board.data?.ratings ?? [];
  const player = ratings.find((row) => row.address === address?.toLowerCase());
  return (
    <section className="surface-card grid gap-3" id="elo-cup">
      <div>
        <h2 className="section-title">Bảng Elo AvaClash Cup</h2>
        <p className="text-sm text-slate-400">
          {board.data && `Mỗi ví bắt đầu ở ${board.data.startingElo}. `}
          Elo tích lũy qua các giải, dựa trên kết quả đã duyệt và có nước đi do
          relay ghi nhận. Điểm cập nhật sau khi chốt bảng thưởng.
        </p>
      </div>
      {address && board.data && (
        <p className="rounded-lg border border-amber-200/25 bg-amber-200/5 p-3">
          Elo của bạn ·{" "}
          <strong>{player?.rating ?? board.data.startingElo}</strong>
          {player
            ? ` · Hạng ${player.rank} · ${player.games} ván tính Elo`
            : " · Chưa xếp hạng"}
        </p>
      )}
      {board.isPending && <p role="status">Đang tải bảng Elo…</p>}
      {board.isError && (
        <div className="flex flex-wrap items-center gap-3" role="status">
          <p>Chưa cập nhật được bảng Elo.</p>
          <button
            type="button"
            className="button-secondary"
            disabled={board.isFetching}
            onClick={() => void board.refetch()}
          >
            Thử lại
          </button>
        </div>
      )}
      {board.data && ratings.length === 0 && (
        <p className="text-sm text-slate-400">
          Chưa có ván đủ điều kiện Elo trong các giải đã chốt.
        </p>
      )}
      {ratings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th scope="col">Hạng</th>
                <th scope="col">Kỳ thủ</th>
                <th scope="col">Elo</th>
                <th scope="col">Số ván</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? ratings : ratings.slice(0, 10)).map((row) => (
                <tr key={row.address} className="border-t border-white/10">
                  <td className="py-2">{row.rank}</td>
                  <td className="font-mono" title={row.address}>
                    {row.address.slice(0, 8)}…{row.address.slice(-4)}
                    {row.address === player?.address && " · Bạn"}
                  </td>
                  <td className="font-semibold text-amber-200">{row.rating}</td>
                  <td>{row.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ratings.length > 10 && (
        <button
          type="button"
          className="button-secondary w-fit"
          onClick={() => setShowAll(!showAll)}
          aria-expanded={showAll}
        >
          {showAll ? "Thu gọn" : `Xem cả ${ratings.length} kỳ thủ`}
        </button>
      )}
    </section>
  );
}
