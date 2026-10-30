"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS } from "@/config/env";
import { decodeContractError } from "@/utils/errors";

interface AbortRefundWidgetProps {
  roomId: bigint | number;
  room: {
    status: number;
    gameStarted: boolean;
    startedAt?: bigint | number;
    joinedAt?: bigint | number;
  };
  onSuccess?: () => void;
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AbortRefundWidget({
  roomId,
  room,
  onSuccess,
}: AbortRefundWidgetProps) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<`0x${string}` | undefined>(undefined);

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: pendingTx,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isSuccess && onSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  const joinedAt = Number(room.startedAt || room.joinedAt || 0);
  const abortEligibleAt = joinedAt + 180; // 3 minutes
  const refundEligibleAt = joinedAt + 3600; // 60 minutes

  const abortSecondsLeft = Math.max(0, abortEligibleAt - now);
  const refundSecondsLeft = Math.max(0, refundEligibleAt - now);

  const canAbort = !room.gameStarted && room.status === 1 && abortSecondsLeft === 0;
  const canRefund = room.status === 1 && refundSecondsLeft === 0;

  const handleAbort = async () => {
    setActionError(null);
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: CHESS_ESCROW_ABI,
        functionName: "abortRoom",
        args: [BigInt(roomId)],
      });
      setPendingTx(hash);
    } catch (err: any) {
      setActionError(decodeContractError(err).message);
    }
  };

  const handleRefund = async () => {
    setActionError(null);
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: CHESS_ESCROW_ABI,
        functionName: "refundOnTimeout",
        args: [BigInt(roomId)],
      });
      setPendingTx(hash);
    } catch (err: any) {
      setActionError(decodeContractError(err).message);
    }
  };

  // Only show when room is Active (status === 1) and game has not started yet
  if (room.status !== 1) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-slate-100 shadow-lg space-y-3">
      <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
        <span>⏱️</span>
        <span>Quản Lý Phòng Thi Đấu (Bảo Vệ Người Chơi)</span>
      </div>

      <div className="text-xs text-slate-300 space-y-1">
        {!room.gameStarted && (
          <p>
            Phòng chưa có nước đi đầu tiên. Sau 3 phút nếu máy chủ relay chưa kích hoạt trận, bạn có thể gọi{" "}
            <code className="text-amber-400">abortRoom</code> để hủy phòng và nhận lại 100% tiền cược.
          </p>
        )}
        <p>
          Sau 60 phút nếu ván đấu không thể hoàn thành hoặc bị gián đoạn, người chơi có thể gọi{" "}
          <code className="text-amber-400">refundOnTimeout</code> để hoàn trả toàn bộ số tiền cược.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Abort Section */}
        {!room.gameStarted && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-slate-900/60 p-2.5 border border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Hủy phòng sớm (Abort):</span>
              <span className="font-mono font-bold text-amber-300">
                {canAbort ? "Sẵn sàng" : formatCountdown(abortSecondsLeft)}
              </span>
            </div>
            <button
              onClick={handleAbort}
              disabled={!canAbort || isConfirming}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                canAbort
                  ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
              }`}
            >
              {isConfirming ? "Đang xử lý..." : "Hủy phòng (abortRoom)"}
            </button>
          </div>
        )}

        {/* Refund Section */}
        <div className="flex flex-col gap-1.5 rounded-lg bg-slate-900/60 p-2.5 border border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Hoàn tiền quá hạn (Timeout):</span>
            <span className="font-mono font-bold text-amber-300">
              {canRefund ? "Sẵn sàng" : formatCountdown(refundSecondsLeft)}
            </span>
          </div>
          <button
            onClick={handleRefund}
            disabled={!canRefund || isConfirming}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              canRefund
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
            }`}
          >
            {isConfirming ? "Đang xử lý..." : "Hoàn tiền (refundOnTimeout)"}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg bg-rose-500/20 border border-rose-500/40 p-2 text-rose-300 text-xs">
          ⚠️ {actionError}
        </div>
      )}
    </div>
  );
}
