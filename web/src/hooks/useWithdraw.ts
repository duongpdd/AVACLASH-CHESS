import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS } from "@/config/env";
import { decodeContractError } from "@/utils/errors";
import { TxStep } from "./useCreateRoom";

export function useWithdraw() {
  const { address } = useAccount();
  const [step, setStep] = useState<TxStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: pendingBalance,
    refetch: refetchPending,
    isLoading: isLoadingPending,
  } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    functionName: "pendingWithdrawals",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 4000,
    },
  });

  const { writeContractAsync, reset: resetWrite, data: txHash } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Handle reverted status from receipt
  useEffect(() => {
    if (receipt?.status === "reverted") {
      setStep("error");
      setErrorMessage(
        "Giao dịch đã bị hoàn tác (reverted) trên blockchain. Vui lòng kiểm tra trên Explorer."
      );
    }
  }, [receipt]);

  const withdraw = async () => {
    setErrorMessage(null);
    if (!pendingBalance || pendingBalance === BigInt(0)) {
      setErrorMessage("Không có số dư khả dụng để rút tiền.");
      setStep("error");
      return;
    }

    try {
      setStep("waiting_wallet");
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: CHESS_ESCROW_ABI,
        functionName: "withdraw",
      });

      setStep("confirming");
      return hash;
    } catch (err) {
      const decoded = decodeContractError(err);
      setErrorMessage(decoded.message);
      setStep("error");
      throw err;
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
    ? "Giao dịch đã bị hoàn tác (reverted) trên blockchain. Vui lòng kiểm tra trên Explorer."
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
