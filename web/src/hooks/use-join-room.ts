import { useUiCopy } from "@/i18n/use-ui-copy";
import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import { formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS, CHAIN_ID } from "@/config/env";
import { decodeContractError } from "@/utils/errors";
import {
  getJoinerColor,
  isRoomJoinable,
  getRoomJoinableError,
  doesRoomExist,
} from "@/utils/room";
import { TxStep } from "./use-create-room";

export function useJoinRoom(roomId?: bigint | number) {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const [step, setStep] = useState<TxStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedRoomId = roomId !== undefined ? BigInt(roomId) : undefined;

  // Read nextRoomId from contract to verify existence
  const { data: nextRoomId } = useReadContract({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    functionName: "nextRoomId",
    query: {
      refetchInterval: 5000,
    },
  });

  // Read room info for preview before confirmation
  const {
    data: room,
    isLoading: isLoadingRoom,
    refetch: refetchRoom,
  } = useReadContract({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    functionName: "getRoom",
    args: parsedRoomId !== undefined ? [parsedRoomId] : undefined,
    query: {
      enabled: parsedRoomId !== undefined,
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

  const exists = doesRoomExist(room, nextRoomId, parsedRoomId);
  const joinerColor = getJoinerColor(room);
  const joinable = isRoomJoinable(room, nextRoomId, address, parsedRoomId);
  const joinableError = getRoomJoinableError(
    room,
    nextRoomId,
    address,
    parsedRoomId,
  );
  const stakeFormatted = room && exists ? formatEther(room.stake) : null;
  const isCreator =
    address && room && exists
      ? address.toLowerCase() === room.playerA.toLowerCase()
      : false;
  const isOpen = room && exists ? room.status === 0 : false;

  const joinRoom = async (targetId?: bigint | number) => {
    resetWrite();
    setErrorMessage(null);
    const idToJoin = targetId !== undefined ? BigInt(targetId) : parsedRoomId;

    if (idToJoin === undefined) {
      setErrorMessage(uiText("messageEnterAValidRoomId"));
      setStep("error");
      return;
    }

    if (idToJoin !== parsedRoomId) {
      setErrorMessage(uiText("messageLoadTheCorrectRoomBeforeConfirming"));
      setStep("error");
      return;
    }

    if (!exists || !room) {
      setErrorMessage(uiText("messageRoomDoesNotExist"));
      setStep("error");
      return;
    }

    if (!joinable) {
      setErrorMessage(joinableError ?? uiText("messageCannotJoinThisRoom"));
      setStep("error");
      return;
    }

    // Never send transaction with value = 0
    if (room.stake <= BigInt(0)) {
      setErrorMessage(uiText("messageInvalidRoomStakeATransactionWith"));
      setStep("error");
      return;
    }

    try {
      setStep("waiting_wallet");
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        chainId: CHAIN_ID,
        abi: CHESS_ESCROW_ABI,
        functionName: "joinRoom",
        args: [idToJoin],
        value: room.stake,
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
    joinRoom,
    room,
    exists,
    joinable,
    joinableError,
    isLoadingRoom,
    refetchRoom,
    joinerColor,
    stakeFormatted,
    isCreator,
    isOpen,
    step: effectiveStep,
    errorMessage: effectiveError,
    txHash,
    receipt,
    reset,
  };
}
