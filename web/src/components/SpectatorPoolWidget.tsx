"use client";

import { useState } from "react";

export interface SpectatorPoolProps {
  currentMoveNumber: number;
  isMatchActive?: boolean;
  onBetPlaced?: (option: 1 | 2 | 3, amountAvax: string) => void;
}

export default function SpectatorPoolWidget({
  currentMoveNumber,
  isMatchActive = false,
  onBetPlaced,
}: SpectatorPoolProps) {
  // Parimutuel pool state in AVAX (Options: 1=White, 2=Black, 3=Draw)
  const [whitePool, setWhitePool] = useState(1.20);
  const [blackPool, setBlackPool] = useState(0.85);
  const [drawPool, setDrawPool] = useState(0.45);
  const [selectedOption, setSelectedOption] = useState<1 | 2 | 3>(1);
  const [betAmount, setBetAmount] = useState("0.1");
  const [hasBet, setHasBet] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Per Q4 decision: Betting locks before match starts (when room is joined/active)
  const isLocked = isMatchActive || currentMoveNumber > 0;

  const totalPool = whitePool + blackPool + drawPool;
  const whitePercent = Math.max(1, Math.round((whitePool / totalPool) * 100));
  const blackPercent = Math.max(1, Math.round((blackPool / totalPool) * 100));
  const drawPercent = Math.max(1, 100 - whitePercent - blackPercent);

  const handlePlaceBet = () => {
    if (isLocked) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (selectedOption === 1) {
      setWhitePool((prev) => +(prev + amount * 0.95).toFixed(3));
    } else if (selectedOption === 2) {
      setBlackPool((prev) => +(prev + amount * 0.95).toFixed(3));
    } else {
      setDrawPool((prev) => +(prev + amount * 0.95).toFixed(3));
    }

    const optionLabel = selectedOption === 1 ? "White" : selectedOption === 2 ? "Black" : "Draw";
    setHasBet(true);
    setFeedback(`Placed ${betAmount} AVAX on ${optionLabel}! (5% fee to Season Vault)`);
    onBetPlaced?.(selectedOption, betAmount);

    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs shadow-xl backdrop-blur-md flex flex-col gap-2.5">
      {/* Header Widget */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-slate-200">
          <span className="text-amber-400">📊</span>
          <span>Spectator Prediction Pool</span>
        </div>
        {isLocked ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            🔒 Locked (Match In Progress)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Open (Pre-Match Betting)
          </span>
        )}
      </div>

      {/* Tỷ lệ thanh trực quan Parimutuel (White / Black / Draw) */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[11px] text-slate-400 font-medium">
          <span className="text-amber-300">White {whitePercent}% ({whitePool.toFixed(2)} AVAX)</span>
          <span className="text-cyan-300">Black {blackPercent}% ({blackPool.toFixed(2)} AVAX)</span>
          <span className="text-emerald-300">Draw {drawPercent}% ({drawPool.toFixed(2)} AVAX)</span>
        </div>
        <div className="h-2 w-full flex overflow-hidden rounded-full bg-slate-800">
          <div style={{ width: `${whitePercent}%` }} className="bg-amber-400 transition-all duration-300" title={`White: ${whitePercent}%`} />
          <div style={{ width: `${blackPercent}%` }} className="bg-cyan-400 transition-all duration-300" title={`Black: ${blackPercent}%`} />
          <div style={{ width: `${drawPercent}%` }} className="bg-emerald-400 transition-all duration-300" title={`Draw: ${drawPercent}%`} />
        </div>
      </div>

      {/* Giao diện đặt cược khán giả khi chưa khóa */}
      {!isLocked ? (
        <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedOption(1)}
              className={`rounded-lg px-2 py-1.5 font-semibold text-[11px] transition-all border ${
                selectedOption === 1
                  ? "bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-sm"
                  : "bg-slate-900/60 text-slate-400 border-white/5 hover:bg-slate-800"
              }`}
            >
              ♔ White
            </button>
            <button
              type="button"
              onClick={() => setSelectedOption(2)}
              className={`rounded-lg px-2 py-1.5 font-semibold text-[11px] transition-all border ${
                selectedOption === 2
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-sm"
                  : "bg-slate-900/60 text-slate-400 border-white/5 hover:bg-slate-800"
              }`}
            >
              ♚ Black
            </button>
            <button
              type="button"
              onClick={() => setSelectedOption(3)}
              className={`rounded-lg px-2 py-1.5 font-semibold text-[11px] transition-all border ${
                selectedOption === 3
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-sm"
                  : "bg-slate-900/60 text-slate-400 border-white/5 hover:bg-slate-800"
              }`}
            >
              ⚖ Draw
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-slate-100 font-mono text-xs focus:border-amber-400 focus:outline-none"
                placeholder="AVAX"
              />
              <span className="absolute right-2 top-1 text-[10px] text-slate-400 font-mono">AVAX</span>
            </div>
            <button
              type="button"
              onClick={handlePlaceBet}
              className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 font-bold text-slate-950 text-xs shadow-md transition hover:from-amber-400 hover:to-orange-400 active:scale-95"
            >
              Predict
            </button>
          </div>

          {feedback && (
            <p className="text-[10px] text-emerald-400 text-center animate-fade-in font-medium">
              ✓ {feedback}
            </p>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-slate-400 text-center py-1">
          <span>Odds locked at match start. Payout settles upon match completion.</span>
        </div>
      )}
    </div>
  );
}
