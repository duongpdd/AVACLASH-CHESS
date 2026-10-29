import { useReadContract, useWatchContractEvent } from "wagmi";
import { formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS } from "@/config/env";

export const ROOM_STATUS_TEXT: Record<
  number,
  { label: string; color: string; desc: string }
> = {
  0: {
    label: "Đang mở (Open)",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    desc: "Đang chờ đối thủ vào phòng",
  },
  1: {
    label: "Đang thi đấu (Active)",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    desc: "Hai người chơi đã sẵn sàng, trận đấu đang diễn ra",
  },
  2: {
    label: "Đã kết thúc (Settled)",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    desc: "Ván đấu đã kết thúc và tiền thưởng đã được thanh toán",
  },
  3: {
    label: "Đã hủy (Cancelled)",
    color: "text-slate-400 bg-slate-400/10 border-slate-400/30",
    desc: "Người tạo đã hủy phòng trước khi có người vào",
  },
  4: {
    label: "Hoàn tiền (Refunded)",
    color: "text-rose-400 bg-rose-400/10 border-rose-400/30",
    desc: "Quá hạn không có kết quả, cả hai người chơi được hoàn tiền",
  },
  5: {
    label: "Khiếu nại (Challenged)",
    color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    desc: "Có tranh chấp đơn phương, đang chờ trọng tài giải quyết",
  },
  6: {
    label: "Hủy sớm (Aborted)",
    color: "text-orange-400 bg-orange-400/10 border-orange-400/30",
    desc: "Trận đấu bị hủy vì không có nước đi đầu tiên trong 3 phút",
  },
};

export function useRoom(roomId?: bigint | number) {
  const parsedId = roomId !== undefined ? BigInt(roomId) : undefined;

  const {
    data: room,
    isLoading,
    refetch,
    error,
  } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    functionName: "getRoom",
    args: parsedId !== undefined ? [parsedId] : undefined,
    query: {
      enabled: parsedId !== undefined,
      refetchInterval: 3000,
    },
  });

  // Watch contract events to trigger automatic refetch
  useWatchContractEvent({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    eventName: "RoomJoined",
    onLogs() {
      refetch();
    },
  });

  useWatchContractEvent({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    eventName: "ResultSubmitted",
    onLogs() {
      refetch();
    },
  });

  useWatchContractEvent({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    eventName: "RoomCancelled",
    onLogs() {
      refetch();
    },
  });

  const statusInfo = room
    ? ROOM_STATUS_TEXT[room.status] || {
        label: "Không xác định",
        color: "text-slate-400",
        desc: "",
      }
    : null;

  return {
    room,
    isLoading,
    refetch,
    error,
    statusInfo,
    stakeFormatted: room ? formatEther(room.stake) : "0",
    whitePlayer: room
      ? room.creatorIsWhite
        ? room.playerA
        : room.playerB
      : null,
    blackPlayer: room
      ? room.creatorIsWhite
        ? room.playerB
        : room.playerA
      : null,
  };
}
