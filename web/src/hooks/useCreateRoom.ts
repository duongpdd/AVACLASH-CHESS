import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS, UI_MAX_STAKE } from "@/config/env";
import { decodeContractError } from "@/utils/errors";

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

  const { data: nextRoomId, refetch: refetchNextRoomId } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    functionName: "nextRoomId",
  });

  const { writeContractAsync, data: txHash } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const validateStake = (stakeStr: string): string | null => {
    try {
      const stakeVal = parseEther(stakeStr);
      if (minStake && stakeVal < minStake) {
        return `Mức cược tối thiểu là ${formatEther(minStake)} AVAX`;
      }
      if (maxStake && stakeVal > maxStake) {
        return `Mức cược vượt quá tối đa ${formatEther(maxStake)} AVAX của hợp đồng`;
      }
      const uiMax = parseEther(UI_MAX_STAKE);
      if (stakeVal > uiMax) {
        return `Giao diện giới hạn cược tối đa ${UI_MAX_STAKE} AVAX (chế độ an toàn)`;
      }
      return null;
    } catch {
      return "Số tiền cược không hợp lệ";
    }
  };

  const createRoom = async (creatorIsWhite: boolean, stakeStr: string) => {
    setErrorMessage(null);
    setCreatedRoomId(null);

    const validationError = validateStake(stakeStr);
    if (validationError) {
      setErrorMessage(validationError);
      setStep("error");
      return;
    }

    try {
      setStep("waiting_wallet");
      const currentNextId = nextRoomId;
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: CHESS_ESCROW_ABI,
        functionName: "createRoom",
        args: [creatorIsWhite],
        value: parseEther(stakeStr),
      });

      setStep("confirming");
      if (currentNextId !== undefined) {
        setCreatedRoomId(currentNextId);
      }
      return hash;
    } catch (err) {
      const decoded = decodeContractError(err);
      setErrorMessage(decoded);
      setStep("error");
      throw err;
    }
  };

  const reset = () => {
    setStep("idle");
    setErrorMessage(null);
    setCreatedRoomId(null);
  };

  return {
    createRoom,
    step: isSuccess ? "success" : isConfirming ? "confirming" : step,
    errorMessage,
    txHash,
    receipt,
    createdRoomId,
    minStake: minStake ? formatEther(minStake) : "0.01",
    maxStake: maxStake ? formatEther(maxStake) : "1.0",
    uiMaxStake: UI_MAX_STAKE,
    validateStake,
    reset,
  };
}
