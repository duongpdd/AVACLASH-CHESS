import { TOURNAMENT_ABI } from "@avaclash/shared";
import { decodeErrorResult, isHex, type Hex } from "viem";
import type { UiKey } from "@/i18n/ui-copy";

const messages: Record<string, UiKey> = {
  InvalidInput: "messageTournamentInvalidInput",
  WrongPhase: "messageTournamentWrongPhase",
  Unauthorized: "messageTournamentUnauthorized",
  NotReady: "messageTournamentNotReady",
  TransferFailed: "messageTournamentTransferFailed",
};

function revertData(error: unknown): Hex | undefined {
  let current = error as { data?: unknown; cause?: unknown } | undefined;
  for (let depth = 0; current && depth < 10; depth++) {
    const data = current.data;
    const hex =
      typeof data === "object" && data !== null
        ? (data as { data?: unknown }).data
        : data;
    if (typeof hex === "string" && isHex(hex) && hex.length >= 10) return hex;
    current = current.cause as typeof current;
  }
}

/** Gas estimation is not ABI-aware, so viem reports custom errors as "unknown". */
export function tournamentRevertMessage(error: unknown): UiKey | undefined {
  const data = revertData(error);
  if (!data) return;
  try {
    return messages[decodeErrorResult({ abi: TOURNAMENT_ABI, data }).errorName];
  } catch {
    return;
  }
}
