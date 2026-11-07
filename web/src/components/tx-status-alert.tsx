"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { TxStep } from "@/hooks/use-create-room";
import { CHAIN_ID, FUJI_EXPLORER_URL } from "@/config/env";

export default function TxStatusAlert({
  step,
  errorMessage,
  txHash,
  onReset,
  successMessage,
}: {
  step: TxStep;
  errorMessage?: string | null;
  txHash?: `0x${string}` | string;
  onReset?: () => void;
  successMessage?: string;
}) {
  const uiText = useUiCopy();
  if (step === "idle") return null;

  return (
    <div className="w-full mt-3 rounded-xl p-3.5 text-xs font-semibold flex flex-col gap-2 animate-fade-in">
      {step === "waiting_wallet" && (
        <div className="flex items-center gap-2.5 text-status-warning bg-status-warning/10 border border-status-warning/30 p-2.5 rounded-lg">
          <span className="h-3 w-3 rounded-full border-2 border-status-warning border-t-transparent animate-spin" />
          <span>{uiText("messageConfirmTheTransactionInYourWallet2")}</span>
        </div>
      )}

      {step === "confirming" && (
        <div className="flex flex-col gap-1 text-status-info bg-status-info/10 border border-status-info/30 p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-status-info border-t-transparent animate-spin" />
            <span>
              {uiText("messageTransactionSubmittedWaitingForOnChain")}
            </span>
          </div>
          {txHash && (
            <span className="font-mono text-[11px] text-status-info/80 break-all pl-5">
              Tx: {txHash}
            </span>
          )}
        </div>
      )}

      {step === "success" && (
        <div className="flex items-center justify-between gap-2 text-status-success bg-status-success/10 border border-status-success/30 p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-base">✓</span>
            <span>
              {successMessage
                ? uiText.existing(successMessage)
                : uiText("messageTransactionSuccessful")}
            </span>
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-status-success underline hover:text-status-success"
            >
              {uiText("messageClose")}
            </button>
          )}
        </div>
      )}

      {step === "error" && (
        <div className="flex items-center justify-between gap-2 text-status-danger bg-status-danger/10 border border-status-danger/30 p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-base">✕</span>
            <span>
              {errorMessage
                ? uiText.existing(errorMessage)
                : uiText("messageTheTransactionFailed")}
            </span>
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-status-danger underline hover:text-status-danger"
            >
              {uiText("messageRetry")}
            </button>
          )}
        </div>
      )}
      {txHash && CHAIN_ID === 43113 && (
        <a
          href={`${FUJI_EXPLORER_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-status-info underline break-all"
        >
          {uiText("messageViewTransactionOnFujiExplorer")}
        </a>
      )}
    </div>
  );
}
