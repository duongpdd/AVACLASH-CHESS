"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

export type VictoryModalProps = {
  open: boolean;
  winner: string;
  method: string;
  movesCount: number;
  timeRemaining: string;
  avaxWager?: string;
  transactionStatus?: "pending" | "confirmed" | "failed" | "not-started";
  transactionUrl?: string;
  onPlayAgain: () => void;
  onClose?: () => void;
};

export default function VictoryModal({
  open,
  winner,
  method,
  movesCount,
  timeRemaining,
  avaxWager,
  transactionStatus = "not-started",
  transactionUrl,
  onPlayAgain,
  onClose,
}: VictoryModalProps) {
  const isDraw = winner.toLowerCase() === "draw" || method.toLowerCase().includes("draw");

  useEffect(() => {
    if (!open || isDraw) return;

    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    const endAt = Date.now() + 2200;
    let frameId = 0;

    const burst = () => {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0.05, y: 0.68 },
        colors: ["#fbbf24", "#f97316", "#a78bfa", "#34d399"],
        ticks: 160,
        gravity: 0.9,
        scalar: 0.9,
      });
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 0.95, y: 0.68 },
        colors: ["#fbbf24", "#f97316", "#a78bfa", "#34d399"],
        ticks: 160,
        gravity: 0.9,
        scalar: 0.9,
      });

      if (Date.now() < endAt) {
        frameId = requestAnimationFrame(burst);
      }
    };

    burst();

    return () => {
      cancelAnimationFrame(frameId);
      confetti.reset();
    };
  }, [open, isDraw]);

  if (!open) return null;

  const statusLabel = {
    pending: "Transaction pending",
    confirmed: "Transaction confirmed",
    failed: "Transaction failed",
    "not-started": "No transaction submitted",
  }[transactionStatus];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
    >
      <div className="w-full max-w-md animate-[victory-in_280ms_ease-out] rounded-3xl border border-amber-300/30 bg-slate-900 p-6 text-center shadow-[0_0_60px_rgba(251,191,36,0.16)] sm:p-8">
        <div className="mb-3 text-5xl" aria-hidden="true">
          {isDraw ? "🤝" : "🏆"}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">
          AvaClash Chess
        </p>
        <h2 id="victory-title" className="mt-2 text-3xl font-black text-white">
          {isDraw ? "Draw Game" : "Victory!"}
        </h2>
        <p className="mt-2 text-slate-300">
          {isDraw ? (
            <>
              Game ended in a draw by <span className="font-semibold text-amber-200">{method}</span>.
            </>
          ) : (
            <>
              <span className="font-semibold text-amber-200">{winner}</span> wins by {method}.
            </>
          )}
        </p>

        <div className="my-6 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-800 p-3">
            <p className="text-xs text-slate-400">Moves</p>
            <p className="mt-1 font-bold text-white">{movesCount}</p>
          </div>
          <div className="rounded-xl bg-slate-800 p-3">
            <p className="text-xs text-slate-400">Time left</p>
            <p className="mt-1 font-bold text-white">{timeRemaining}</p>
          </div>
          <div className="rounded-xl bg-slate-800 p-3">
            <p className="text-xs text-slate-400">Wager</p>
            <p className="mt-1 break-words font-bold text-white">
              {avaxWager ?? "—"}
            </p>
          </div>
        </div>

        <p className="mb-4 text-xs text-slate-400" aria-live="polite">
          {statusLabel}
          {transactionStatus === "confirmed" && " · On-chain result confirmed"}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 rounded-xl bg-amber-300 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-200 active:scale-[0.98]"
          >
            PLAY AGAIN
          </button>

          {transactionUrl ? (
            <a
              href={transactionUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl border border-slate-600 px-4 py-3 font-bold text-white transition hover:bg-slate-800"
            >
              VIEW TRANSACTION
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Transaction URL is not available yet"
              className="flex-1 cursor-not-allowed rounded-xl border border-slate-700 px-4 py-3 font-bold text-slate-500"
            >
              VIEW TRANSACTION
            </button>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline transition-colors"
          >
            Close & Review Board
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes victory-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
