import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import { formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS } from "@/config/env";
import { decodeContractError } from "@/utils/errors";
import {
  getJoinerColor,
  isRoomJoinable,
  getRoomJoinableError,
  doesRoomExist,
} from "@/utils/room";
import { TxStep } from "./useCreateRoom";

export function useJoinRoom(roomId?: bigint | number) {
  const { address } = useAccount();
  const [step, setStep] = useState<TxStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedRoomId = roomId !== undefined ? BigInt(roomId) : undefined;

  // Read nextRoomId from contract to verify existence
  const { data: nextRoomId } = useReadContract({
    address: ESCROW_ADDRESS,
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
    abi: CHESS_ESCROW_ABI,
    functionName: "getRoom",
    args: parsedRoomId !== undefined ? [parsedRoomId] : undefined,
    query: {
      enabled: parsedRoomId !== undefined,
    },
  });

  const { writeContractAsync, data: txHash } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const exists = doesRoomExist(room, nextRoomId, parsedRoomId);
  const joinerColor = getJoinerColor(room);
  const joinable = isRoomJoinable(room, nextRoomId, address, parsedRoomId);
  const joinableError = getRoomJoinableError(room, nextRoomId, address, parsedRoomId);
  const stakeFormatted = room && exists ? formatEther(room.stake) : null;
  const isCreator =
    address && room && exists
      ? address.toLowerCase() === room.playerA.toLowerCase()
      : false;
  const isOpen = room && exists ? room.status === 0 : false;

  const joinRoom = async (targetId?: bigint | number) => {
    setErrorMessage(null);
    const idToJoin =
      targetId !== undefined ? BigInt(targetId) : parsedRoomId;

    if (idToJoin === undefined) {
      setErrorMessage("Vui lòng nhập ID phòng hợp lệ");
      setStep("error");
      return;
    }

    if (!exists || !room) {
      setErrorMessage("Phòng không tồn tại");
      setStep("error");
      return;
    }

    if (!joinable) {
      setErrorMessage(joinableError ?? "Không thể vào phòng này");
      setStep("error");
      return;
    }

    // Never send transaction with value = 0
    if (room.stake <= BigInt(0)) {
      setErrorMessage("Mức cược phòng không hợp lệ (không bao giờ gửi giao dịch với value = 0).");
      setStep("error");
      return;
    }

    try {
      setStep("waiting_wallet");
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: CHESS_ESCROW_ABI,
        functionName: "joinRoom",
        args: [idToJoin],
        value: room.stake,
      });

      setStep("confirming");
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
  };

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
    step: isSuccess ? "success" : isConfirming ? "confirming" : step,
    errorMessage,
    txHash,
    receipt,
    reset,
  };
}
