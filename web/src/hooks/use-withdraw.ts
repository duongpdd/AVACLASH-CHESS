import { useUiCopy } from "@/i18n/use-ui-copy";
import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS, CHAIN_ID } from "@/config/env";
import { decodeContractError } from "@/utils/errors";
import { TxStep } from "./use-create-room";

export function useWithdraw() {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const [step, setStep] = useState<TxStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: pendingBalance,
    refetch: refetchPending,
    isLoading: isLoadingPending,
  } = useReadContract({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    functionName: "pendingWithdrawals",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 4000,
    },
  });

  const {
    writeContractAsync,
    reset: resetWrite,
    data: txHash,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    chainId: CHAIN_ID,
    hash: txHash,
  });

  const withdraw = async () => {
    resetWrite();
    setErrorMessage(null);
    if (!pendingBalance || pendingBalance === BigInt(0)) {
      setErrorMessage(uiText("messageNoBalanceIsAvailableToWithdraw"));
      setStep("error");
      return;
    }

    try {
      setStep("waiting_wallet");
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        chainId: CHAIN_ID,
        abi: CHESS_ESCROW_ABI,
        functionName: "withdraw",
      });

      setStep("confirming");
      return hash;
    } catch (err) {
      const decoded = decodeContractError(err);
      setErrorMessage(decoded.message);
      setStep("error");
      return;
    }
  };

  const reset = () => {
    setStep("idle");
    setErrorMessage(null);
    resetWrite();
  };

  const isReverted = receipt?.status === "reverted";
  const isTxSuccess = isSuccess && receipt?.status === "success";

  const effectiveStep: TxStep = isReverted
    ? "error"
    : isTxSuccess
      ? "success"
      : isConfirming
        ? "confirming"
        : step;

  const effectiveError = isReverted
    ? uiText("messageTheOnChainTransactionRevertedCheck")
    : errorMessage;

  return {
    withdraw,
    pendingBalance: pendingBalance ?? BigInt(0),
    pendingBalanceFormatted: pendingBalance
      ? formatEther(pendingBalance)
      : "0.0",
    isLoadingPending,
    refetchPending,
    step: effectiveStep,
    errorMessage: effectiveError,
    txHash,
    receipt,
    reset,
  };
}
