"use client";
import { useUiCopy } from "@/i18n/use-ui-copy";
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
  const uiText = useUiCopy();
  const available =
    whitePool !== undefined &&
    blackPool !== undefined &&
    drawPool !== undefined;
  return (
    <div className="rounded-xl border border-foreground/10 bg-background/80 p-3 text-xs text-foreground space-y-2">
      <div className="flex justify-between gap-2 font-bold">
        <span>{uiText("messageSpectatorPredictions")}</span>
        <span>
          {!available
            ? uiText("messageNoDataYet")
            : bettingLocked
              ? uiText("messageLocked")
              : uiText("messageOpen")}
        </span>
      </div>
      {available ? (
        <div className="grid grid-cols-3 gap-2 font-mono">
          <span>
            {uiText("messageWhite3")} {formatEther(whitePool)} {CURRENCY_SYMBOL}
          </span>
          <span>
            {uiText("messageBlack3")} {formatEther(blackPool)} {CURRENCY_SYMBOL}
          </span>
          <span>
            {uiText("messageDraw3")} {formatEther(drawPool)} {CURRENCY_SYMBOL}
          </span>
        </div>
      ) : (
        <p>{uiText("messagePredictionTransactionsAreUnavailableInThis")}</p>
      )}
    </div>
  );
}
