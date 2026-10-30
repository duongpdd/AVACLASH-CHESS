import { useState, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import { parseEther, formatEther, parseEventLogs } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS, UI_MAX_STAKE } from "@/config/env";
import { decodeContractError } from "@/utils/errors";
import { validateStake } from "@/utils/room";

export type TxStep =
  | "idle"
  | "waiting_wallet"
  | "confirming"
  | "success"
  | "error";

export function useCreateRoom() {
  const { address } = useAccount();
  const [step, setStep] = useState<TxStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState<bigint | null>(null);

  // Read MIN_STAKE and MAX_STAKE from contract
  const { data: minStake } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    functionName: "MIN_STAKE",
  });

  const { data: maxStake } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    functionName: "MAX_STAKE",
  });

  const { writeContractAsync, reset: resetWrite, data: txHash } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Extract createdRoomId from receipt RoomCreated event and handle reverted status
  useEffect(() => {
    if (receipt) {
      if (receipt.status === "reverted") {
        setStep("error");
        setErrorMessage(
          "Giao dịch đã bị hoàn tác (reverted) trên blockchain. Vui lòng kiểm tra trên Explorer."
        );
      } else if (receipt.status === "success") {
        try {
          const logs = parseEventLogs({
            abi: CHESS_ESCROW_ABI,
            eventName: "RoomCreated",
            logs: receipt.logs,
          });
          const myLog = logs.find((l: any) =>
            address
              ? l.args?.creator?.toLowerCase() === address.toLowerCase()
              : true
          );
          if (myLog && myLog.args?.roomId !== undefined) {
            setCreatedRoomId(myLog.args.roomId);
          }
        } catch {
          // Fallback if parsing logs fails
        }
      }
    }
  }, [receipt, address]);

  const checkStake = (stakeStr: string): string | null => {
    return validateStake(stakeStr, minStake, maxStake, UI_MAX_STAKE);
  };

  const createRoom = async (creatorIsWhite: boolean, stakeStr: string) => {
    setErrorMessage(null);
    setCreatedRoomId(null);

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
      throw err;
    }
  };

  const reset = () => {
    setStep("idle");
    setErrorMessage(null);
    setCreatedRoomId(null);
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
