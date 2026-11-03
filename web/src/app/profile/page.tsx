"use client";

import { Suspense, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { CHAIN_ID, tournamentEnabled } from "@/config/env";

type Profile = {
  rating: number;
  rank: number | null;
  ratedGames: number;
  titles: { id: string; title: string; shared: boolean }[];
  games: {
    id: string;
    title: string;
    room: string;
    opponent: string;
    outcome: string | null;
    status: string;
    movesHash: string | null;
  }[];
};

function PlayerProfile() {
  const params = useSearchParams();
  const router = useRouter();
  const { address } = useAccount();
  const selected = (params.get("wallet") ?? address)?.toLowerCase();
  const wallet = selected && isAddress(selected) ? selected : undefined;
  const profile = useQuery({
    queryKey: ["cup-profile", CHAIN_ID, wallet],
    enabled: tournamentEnabled && !!wallet,
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<Profile> => {
      const response = await fetch(
        `/api/tournaments/profile?wallet=${wallet}`,
        { signal },
      );
      if (!response.ok) throw new Error("Profile unavailable");
      return response.json();
    },
  });
  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("wallet"))
      .trim()
      .toLowerCase();
    if (isAddress(value)) router.push(`/profile?wallet=${value}`);
  }
  const data = profile.data;
  return (
    <div className="grid gap-4">
      <form
        className="surface-card flex flex-wrap items-end gap-3"
        onSubmit={find}
        key={wallet ?? "guest"}
      >
        <label className="min-w-0 grow">
          Địa chỉ ví kỳ thủ
          <input
            className="mt-1 block w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 font-mono"
            name="wallet"
            defaultValue={wallet}
            placeholder="0x…"
            pattern="0[xX][a-fA-F0-9]{40}"
            required
          />
        </label>
        <button className="button-primary">Xem hồ sơ</button>
      </form>
      {!tournamentEnabled ? (
        <p>Chưa cấu hình AvaClash Cup trên mạng này.</p>
      ) : !wallet ? (
        <p role="status">
          Kết nối ví để xem hồ sơ của bạn hoặc nhập địa chỉ của một kỳ thủ.
        </p>
      ) : profile.isPending ? (
        <p role="status">Đang đọc hồ sơ giải đấu…</p>
      ) : null}
      {profile.isError && (
        <p role="status">
          Chưa tải được hồ sơ.{" "}
          <button
            className="text-link"
            type="button"
            onClick={() => void profile.refetch()}
          >
            Thử lại
          </button>
        </p>
      )}
      {data && (
        <>
          <section className="surface-card grid gap-3">
            <h2 className="section-title">Thành tích AvaClash Cup</h2>
            <p className="break-all font-mono text-xs text-slate-400">
              {wallet}
            </p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt>Elo Cup</dt>
                <dd className="text-2xl font-bold text-amber-200">
                  {data.rating}
                </dd>
              </div>
              <div>
                <dt>Xếp hạng</dt>
                <dd className="text-xl font-semibold">
                  {data.rank ?? "Chưa xếp hạng"}
                </dd>
              </div>
              <div>
                <dt>Ván tính Elo</dt>
                <dd className="text-2xl font-bold">{data.ratedGames}</dd>
              </div>
              <div>
                <dt>Giải vô địch</dt>
                <dd className="text-2xl font-bold">{data.titles.length}</dd>
              </div>
            </dl>
            {data.titles.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {data.titles.map((title) => (
                  <li key={title.id}>
                    <Link
                      className="button-secondary"
                      href={`/tournaments?id=${title.id}`}
                    >
                      {title.shared ? "Đồng vô địch" : "Vô địch"} ·{" "}
                      {title.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="surface-card grid gap-3">
            <h2 className="section-title">Lịch sử ván đấu</h2>
            {data.games.length === 0 ? (
              <p className="text-slate-400">Chưa có ván đấu Cup cho ví này.</p>
            ) : (
              <ul className="grid gap-2">
                {data.games.map((game) => (
                  <li
                    key={game.room}
                    className="grid gap-1 rounded-lg border border-white/10 p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <p>
                        {game.title} · Ván #{game.room}
                      </p>
                      <Link
                        className="text-link"
                        href={`/tournaments/play?id=${game.id}&room=${game.room}`}
                      >
                        {game.movesHash ? "Mở biên bản" : "Mở ván"}
                      </Link>
                    </div>
                    <p className="text-sm text-slate-300">
                      Đối thủ{" "}
                      <Link
                        className="text-link font-mono"
                        href={`/profile?wallet=${game.opponent}`}
                      >
                        {game.opponent.slice(0, 8)}…{game.opponent.slice(-4)}
                      </Link>{" "}
                      · {game.outcome ? `${game.outcome} · ` : ""}
                      {game.status}
                    </p>
                    {game.movesHash && (
                      <p className="break-all font-mono text-xs text-slate-400">
                        Hash nước đi: {game.movesHash}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="app-shell">
      <AppHeader active="profile" />
      <main className="site-container play-page">
        <section className="page-intro">
          <div>
            <p className="eyebrow">AVACLASH CUP</p>
            <h1>
              Hồ sơ <span>kỳ thủ.</span>
            </h1>
            <p className="intro-description">
              Xem Elo Cup, danh hiệu và biên bản các ván của một ví.
            </p>
          </div>
          <Link className="text-link" href="/tournaments#elo-cup">
            Bảng Elo
          </Link>
        </section>
        <Suspense fallback={<p role="status">Đang mở hồ sơ…</p>}>
          <PlayerProfile />
        </Suspense>
      </main>
      <AppFooter />
    </div>
  );
}
