"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS, CHAIN_ID } from "@/config/env";
import { decodeContractError } from "@/utils/errors";

interface AbortRefundWidgetProps {
  roomId: bigint | number;
  room: {
    status: number;
    gameStarted: boolean;
    startedAt?: bigint | number;
    joinedAt?: bigint | number;
    gameStartedAt?: bigint | number;
    singleSignedAt?: bigint | number;
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
  const uiText = useUiCopy();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [isSending, setIsSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<`0x${string}` | undefined>(
    undefined,
  );

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, data: receipt } =
    useWaitForTransactionReceipt({
      chainId: CHAIN_ID,
      hash: pendingTx,
    });

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (receipt?.status === "success" && onSuccess) {
      onSuccess();
    }
  }, [receipt, onSuccess]);

  const joinedAt = Number(room.startedAt || room.joinedAt || 0);
  const abortEligibleAt = joinedAt + 180; // 3 minutes
  const refundEligibleAt =
    Math.max(joinedAt, Number(room.gameStartedAt ?? 0)) + 3600;

  const abortSecondsLeft = Math.max(0, abortEligibleAt - now);
  const refundSecondsLeft = Math.max(0, refundEligibleAt - now);

  const hasSingleSigned = Number(room.singleSignedAt ?? 0) > 0;
  const canAbort =
    !hasSingleSigned &&
    !room.gameStarted &&
    room.status === 1 &&
    abortSecondsLeft === 0;
  const canRefund =
    !hasSingleSigned && room.status === 1 && refundSecondsLeft === 0;

  const handleAbort = async () => {
    setActionError(null);
    setIsSending(true);
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        chainId: CHAIN_ID,
        abi: CHESS_ESCROW_ABI,
        functionName: "abortRoom",
        args: [BigInt(roomId)],
      });
      setPendingTx(hash);
    } catch (err) {
      setActionError(decodeContractError(err).message);
    } finally {
      setIsSending(false);
    }
  };

  const handleRefund = async () => {
    setActionError(null);
    setIsSending(true);
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        chainId: CHAIN_ID,
        abi: CHESS_ESCROW_ABI,
        functionName: "refundOnTimeout",
        args: [BigInt(roomId)],
      });
      setPendingTx(hash);
    } catch (err) {
      setActionError(decodeContractError(err).message);
    } finally {
      setIsSending(false);
    }
  };

  // Only show when room is Active (status === 1) and game has not started yet
  if (room.status !== 1) return null;

  return (
    <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-foreground shadow-lg space-y-3">
      <div className="flex items-center gap-2 text-status-warning font-bold text-sm">
        <span>⏱️</span>
        <span>{uiText("messageRoomManagementAndPlayerProtection")}</span>
      </div>

      <div className="text-xs text-foreground space-y-1">
        {!room.gameStarted && (
          <p>
            {uiText("messageNoOpeningMoveHasBeenPlayed")}{" "}
            <code className="text-status-warning">abortRoom</code>{" "}
            {uiText("messageToCancelTheRoomAndRecover")}
          </p>
        )}
        <p>
          {uiText("messageIfTheGameCannotFinishOr")}{" "}
          <code className="text-status-warning">refundOnTimeout</code>{" "}
          {uiText("messageToRefundTheFullStakes")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Abort Section */}
        {!room.gameStarted && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-card/60 p-2.5 border border-foreground/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {uiText("messageCancelRoomEarlyAbort")}
              </span>
              <span className="font-mono font-bold text-status-warning">
                {canAbort
                  ? uiText("messageReady")
                  : formatCountdown(abortSecondsLeft)}
              </span>
            </div>
            <button
              onClick={handleAbort}
              disabled={!canAbort || isSending || isConfirming}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                canAbort
                  ? "bg-status-warning hover:bg-status-warning text-background shadow-md shadow-status-warning/20"
                  : "bg-muted text-muted-foreground cursor-not-allowed border border-foreground/5"
              }`}
            >
              {isConfirming
                ? uiText("messageProcessing")
                : uiText("messageCancelRoomAbortroom")}
            </button>
          </div>
        )}

        {/* Refund Section */}
        <div className="flex flex-col gap-1.5 rounded-lg bg-card/60 p-2.5 border border-foreground/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {uiText("messageTimeoutRefund")}
            </span>
            <span className="font-mono font-bold text-status-warning">
              {canRefund
                ? uiText("messageReady")
                : formatCountdown(refundSecondsLeft)}
            </span>
          </div>
          <button
            onClick={handleRefund}
            disabled={!canRefund || isSending || isConfirming}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              canRefund
                ? "bg-status-danger hover:bg-status-danger text-background shadow-md shadow-status-danger/20"
                : "bg-muted text-muted-foreground cursor-not-allowed border border-foreground/5"
            }`}
          >
            {isConfirming
              ? uiText("messageProcessing")
              : uiText("messageRefundRefundontimeout")}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg bg-status-danger/20 border border-status-danger/40 p-2 text-status-danger text-xs">
          ⚠️ {uiText.existing(actionError)}
        </div>
      )}
      {receipt?.status === "reverted" && (
        <p role="alert" className="text-xs text-status-danger">
          {uiText("messageTheRefundTransactionRevertedTryAgain")}
        </p>
      )}
      {hasSingleSigned && (
        <p className="text-xs text-status-warning">
          {uiText("messageAUnilateralResultIsPendingThe")}
        </p>
      )}
    </div>
  );
}
