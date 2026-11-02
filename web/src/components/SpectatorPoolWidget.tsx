"use client";
import { CURRENCY_SYMBOL } from "@/config/env";

import { formatEther } from "viem";

export interface SpectatorPoolProps {
  whitePool?: bigint;
  blackPool?: bigint;
  drawPool?: bigint;
  bettingLocked?: boolean;
}

/** Read-only pool display. Transaction controls require the on-chain betting flow. */
export default function SpectatorPoolWidget({
  whitePool,
  blackPool,
  drawPool,
  bettingLocked = true,
}: SpectatorPoolProps) {
  const available =
    whitePool !== undefined &&
    blackPool !== undefined &&
    drawPool !== undefined;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-300 space-y-2">
      <div className="flex justify-between gap-2 font-bold">
        <span>Dự đoán khán giả</span>
        <span>
          {!available
            ? "Chưa có dữ liệu"
            : bettingLocked
              ? "Đã khóa"
              : "Đang mở"}
        </span>
      </div>
      {available ? (
        <div className="grid grid-cols-3 gap-2 font-mono">
          <span>
            Trắng: {formatEther(whitePool)} {CURRENCY_SYMBOL}
          </span>
          <span>
            Đen: {formatEther(blackPool)} {CURRENCY_SYMBOL}
          </span>
          <span>
            Hòa: {formatEther(drawPool)} {CURRENCY_SYMBOL}
          </span>
        </div>
      ) : (
        <p>Giao diện giao dịch dự đoán chưa được tích hợp.</p>
      )}
    </div>
  );
}
