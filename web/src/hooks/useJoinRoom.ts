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
import { TxStep } from "./useCreateRoom";

export function useJoinRoom(roomId?: bigint | number) {
  const { address } = useAccount();
  const [step, setStep] = useState<TxStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedRoomId = roomId !== undefined ? BigInt(roomId) : undefined;

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

  // Calculate joiner's color and room details
  // creatorIsWhite = true -> joiner plays Black
  // creatorIsWhite = false -> joiner plays White
  const joinerColor = room
    ? !room.creatorIsWhite
      ? "White"
      : "Black"
    : null;
  const stakeFormatted = room ? formatEther(room.stake) : null;
  const isCreator =
    address && room
      ? address.toLowerCase() === room.playerA.toLowerCase()
      : false;
  const isOpen = room ? room.status === 0 : false;

  const joinRoom = async (targetId?: bigint | number) => {
    setErrorMessage(null);
    const idToJoin =
      targetId !== undefined ? BigInt(targetId) : parsedRoomId;

    if (idToJoin === undefined) {
      setErrorMessage("Vui lòng nhập ID phòng hợp lệ");
      setStep("error");
      return;
    }

    if (!room) {
      setErrorMessage("Không thể tải thông tin phòng");
      setStep("error");
      return;
    }

    if (isCreator) {
      setErrorMessage("Không thể tự vào phòng do chính bạn tạo.");
      setStep("error");
      return;
    }

    if (!isOpen) {
      setErrorMessage("Phòng không ở trạng thái mở hoặc đã có đối thủ.");
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
