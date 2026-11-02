"use client";

import { TxStep } from "@/hooks/useCreateRoom";
import { CHAIN_ID } from "@/config/env";

export default function TxStatusAlert({
  step,
  errorMessage,
  txHash,
  onReset,
  successMessage = "Giao dịch thành công!",
}: {
  step: TxStep;
  errorMessage?: string | null;
  txHash?: `0x${string}` | string;
  onReset?: () => void;
  successMessage?: string;
}) {
  if (step === "idle") return null;

  return (
    <div className="w-full mt-3 rounded-xl p-3.5 text-xs font-semibold flex flex-col gap-2 animate-fade-in">
      {step === "waiting_wallet" && (
        <div className="flex items-center gap-2.5 text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg">
          <span className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span>
            Đang chờ bạn xác nhận giao dịch trong ví (MetaMask / Core)...
          </span>
        </div>
      )}

      {step === "confirming" && (
        <div className="flex flex-col gap-1 text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>
              Giao dịch đã được gửi lên blockchain! Đang chờ xác nhận...
            </span>
          </div>
          {txHash && (
            <span className="font-mono text-[11px] text-cyan-400/80 break-all pl-5">
              Tx: {txHash}
            </span>
          )}
        </div>
      )}

      {step === "success" && (
        <div className="flex items-center justify-between gap-2 text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-base">✓</span>
            <span>{successMessage}</span>
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-emerald-400 underline hover:text-emerald-200"
            >
              Đóng
            </button>
          )}
        </div>
      )}

      {step === "error" && (
        <div className="flex items-center justify-between gap-2 text-rose-300 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-base">✕</span>
            <span>
              {errorMessage || "Đã xảy ra lỗi khi thực hiện giao dịch."}
            </span>
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-rose-400 underline hover:text-rose-200"
            >
              Thử lại
            </button>
          )}
        </div>
      )}
      {txHash && CHAIN_ID === 43113 && (
        <a
          href={`https://testnet.snowtrace.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cyan-300 underline break-all"
        >
          Xem giao dịch trên Fuji Explorer
        </a>
      )}
    </div>
  );
}
