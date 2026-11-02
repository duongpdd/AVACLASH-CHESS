"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { GameState } from "@/game/GameState";
import BoardPerformance from "@/components/BoardPerformance";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import Icon from "@/components/Icon";
import Dialog from "@/components/Dialog";
import type { ChessScene } from "@/game/ChessScene";

const PhaserGame = dynamic(() => import("@/components/PhaserGame"), {
  ssr: false,
});
const time = (ms: number) =>
  `${Math.floor(Math.ceil(ms / 1000) / 60)}:${String(Math.ceil(ms / 1000) % 60).padStart(2, "0")}`;

export default function HotseatPage() {
  const game = useRef<GameState | null>(null);
  const scene = useRef<ChessScene | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [sans, setSans] = useState<string[]>([]);
  const [clocks, setClocks] = useState({ whiteMs: 300000, blackMs: 300000 });
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState("");
  const [round, setRound] = useState(0);
  const [drawOffered, setDrawOffered] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [resigning, setResigning] = useState<"white" | "black" | null>(null);
  useEffect(() => {
    const current = new GameState(300000, {
      onMove: () => {
        setMoves(current.getMoves());
        setSans(current.getSans());
        setDrawOffered(false);
      },
      onClockTick: (whiteMs, blackMs) => setClocks({ whiteMs, blackMs }),
      onGameOver: (outcome, reason) =>
        setResult(
          `${outcome === "draw" ? "Hòa" : outcome === "white" ? "Trắng thắng" : "Đen thắng"} · ${({ checkmate: "Chiếu hết", stalemate: "Hết nước đi", repetition: "Lặp lại thế cờ", fifty: "Quy tắc 50 nước", insufficient: "Không đủ quân chiếu hết", draw_agreed: "Đồng ý hòa", resign: "Đầu hàng", timeout: "Hết giờ" } as Record<string, string>)[reason] || "Ván đấu kết thúc"}`,
        ),
    });
    game.current = current;
    return () => {
      current.destroy();
      game.current = null;
    };
  }, [round]);
  function reset() {
    setStarted(false);
    setResigning(null);
    setResult("");
    setMoves([]);
    setSans([]);
    setDrawOffered(false);
    setClocks({ whiteMs: 300000, blackMs: 300000 });
    setRound((r) => r + 1);
  }
  const turn = moves.length % 2 === 0 ? "w" : "b";
  function clockCard(color: "w" | "b") {
    const active = started && !result && turn === color;
    return (
      <div className={`local-player-card ${active ? "is-active" : ""}`}>
        <span className="local-piece" aria-hidden="true">
          {color === "w" ? "♔" : "♚"}
        </span>
        <div>
          <strong>{color === "w" ? "Trắng" : "Đen"}</strong>
          <span>{active ? "Đang suy nghĩ" : "5 phút · Không cộng giờ"}</span>
        </div>
        <time>{time(color === "w" ? clocks.whiteMs : clocks.blackMs)}</time>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <AppHeader showWallet={false} />
      <main
        className={`site-container play-page hotseat-page ${started ? "is-playing" : ""}`}
      >
        <section className="page-intro">
          <div>
            <p className="eyebrow">CÙNG MỘT BÀN CỜ</p>
            <h1>
              Chơi cùng <span>thiết bị.</span>
            </h1>
            <p className="intro-description">
              Hai người thay phiên đi quân. Không cần ví hoặc tiền cược.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 shrink-0">
            {!started && (
              <button
                className="button-primary"
                onClick={() => {
                  game.current?.startClock();
                  setStarted(true);
                }}
              >
                Bắt đầu
                <Icon name="arrow" />
              </button>
            )}

            <Link href="/" className="text-link">
              Chơi đối kháng
              <Icon name="arrow" />
            </Link>
          </div>
        </section>
        <div className="hotseat-layout">
          <div className="game-board-column w-full space-y-2">
            {clockCard(flipped ? "w" : "b")}
            <div className="rounded-xl border border-white/10 bg-slate-900 p-2">
              <PhaserGame
                key={round}
                boardSize={560}
                moves={moves}
                canMove={started && !result}
                playerColor={turn}
                flipBoard={flipped}
                onSceneReady={(current) => {
                  scene.current = current;
                }}
                onMove={(uci) =>
                  game.current?.tryMove(
                    uci.slice(0, 2),
                    uci.slice(2, 4),
                    uci.slice(4) || undefined,
                  )
                }
              />
            </div>
            {clockCard(flipped ? "b" : "w")}
          </div>
          <aside className="hotseat-sidebar space-y-4">
            <section className="surface-card">
              <h2 className="section-title">Ván cờ của bạn</h2>
              <p role="status" className="mt-4 text-sm text-amber-100">
                {result ||
                  (started
                    ? `Lượt ${turn === "w" ? "Trắng" : "Đen"}`
                    : "Bấm Bắt đầu khi cả hai đã sẵn sàng.")}
              </p>
              <div className="mt-5 grid gap-3">
                {started && !result && (
                  <>
                    <button
                      className="button-secondary w-full"
                      onClick={() => setDrawOffered(true)}
                    >
                      Đề nghị hòa
                    </button>
                    {drawOffered && (
                      <div className="space-y-2 rounded-lg border border-white/10 p-3">
                        <p className="helper-text">
                          Đối thủ có đồng ý kết thúc hòa?
                        </p>
                        <button
                          className="button-primary w-full"
                          onClick={() => game.current?.acceptDraw()}
                        >
                          Đối thủ đồng ý hòa
                        </button>
                        <button
                          className="button-quiet w-full"
                          onClick={() => setDrawOffered(false)}
                        >
                          Từ chối hòa
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button
                  className="button-secondary w-full"
                  onClick={() => setFlipped((value) => !value)}
                >
                  <Icon name="refresh" />
                  Xoay bàn
                </button>
                {result && (
                  <button className="button-quiet w-full" onClick={reset}>
                    Ván mới
                  </button>
                )}
                {started && !result && (
                  <button
                    className="button-quiet mt-3 !text-rose-300/80"
                    onClick={() =>
                      setResigning(turn === "w" ? "white" : "black")
                    }
                  >
                    Đầu hàng ({turn === "w" ? "Trắng" : "Đen"})
                  </button>
                )}
              </div>
            </section>
            <section className="surface-card">
              <h2 className="section-title mb-4">Lịch sử nước đi</h2>
              <p className="move-transcript" aria-label="Lịch sử nước đi">
                {sans
                  .map(
                    (san, i) => `${i % 2 === 0 ? `${i / 2 + 1}. ` : ""}${san}`,
                  )
                  .join(" ")}
              </p>
              {!sans.length && (
                <p className="helper-text">
                  Nước đi sẽ xuất hiện khi ván bắt đầu.
                </p>
              )}
            </section>
            <div className="px-2">
              <BoardPerformance
                getFps={() => scene.current?.game?.loop.actualFps}
              />
            </div>
          </aside>
        </div>
      </main>
      <AppFooter />
      {resigning && (
        <Dialog titleId="local-resign-title" onClose={() => setResigning(null)}>
          <div className="surface-card w-full max-w-sm space-y-4">
            <h2 id="local-resign-title" className="section-title">
              Xác nhận đầu hàng
            </h2>
            <p className="helper-text">
              {resigning === "white" ? "Trắng" : "Đen"} sẽ đầu hàng và kết thúc
              ván cờ.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="button-secondary"
                onClick={() => setResigning(null)}
              >
                Tiếp tục chơi
              </button>
              <button
                className="button-primary !border-rose-500 !bg-rose-500 !text-white"
                onClick={() => {
                  game.current?.resign(resigning);
                  setResigning(null);
                }}
              >
                Đồng ý đầu hàng
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
