import { useUiCopy } from "@/i18n/use-ui-copy";
import { useState, useMemo } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import { parseEther, formatEther, parseEventLogs } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS, UI_MAX_STAKE, CHAIN_ID } from "@/config/env";
import { decodeContractError } from "@/utils/errors";
import { validateStake } from "@/utils/room";

export type TxStep =
  "idle" | "waiting_wallet" | "confirming" | "success" | "error";

export function useCreateRoom() {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const [step, setStep] = useState<TxStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Read MIN_STAKE and MAX_STAKE from contract
  const { data: minStake } = useReadContract({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    functionName: "MIN_STAKE",
  });

  const { data: maxStake } = useReadContract({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    functionName: "MAX_STAKE",
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

  // Extract createdRoomId from receipt RoomCreated event and handle reverted status
  const createdRoomId = useMemo(() => {
    if (receipt?.status === "success") {
      try {
        const logs = parseEventLogs({
          abi: CHESS_ESCROW_ABI,
          eventName: "RoomCreated",
          logs: receipt.logs,
        });
        const myLog = logs.find((l) =>
          address
            ? l.args?.creator?.toLowerCase() === address.toLowerCase()
            : true,
        );
        if (myLog && myLog.args?.roomId !== undefined) {
          return myLog.args.roomId;
        }
      } catch {
        // Fallback if parsing logs fails
      }
    }
    return null;
  }, [receipt, address]);

  const checkStake = (stakeStr: string): string | null => {
    return validateStake(stakeStr, minStake, maxStake, UI_MAX_STAKE);
  };

  const createRoom = async (creatorIsWhite: boolean, stakeStr: string) => {
    resetWrite();
    setErrorMessage(null);

    const validationError = checkStake(stakeStr);
    if (validationError) {
      setErrorMessage(validationError);
      setStep("error");
      return;
    }

    try {
      setStep("waiting_wallet");
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        chainId: CHAIN_ID,
        abi: CHESS_ESCROW_ABI,
        functionName: "createRoom",
        args: [creatorIsWhite],
        value: parseEther(stakeStr),
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
    createRoom,
    step: effectiveStep,
    errorMessage: effectiveError,
    txHash,
    receipt,
    createdRoomId,
    minStake: minStake ? formatEther(minStake) : "0.01",
    maxStake: maxStake ? formatEther(maxStake) : "1.0",
    uiMaxStake: UI_MAX_STAKE,
    validateStake: checkStake,
    reset,
  };
}
