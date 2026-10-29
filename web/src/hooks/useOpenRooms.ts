import { useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS } from "@/config/env";

export interface OpenRoomSummary {
  id: bigint;
  playerA: string;
  stake: bigint;
  stakeFormatted: string;
  creatorIsWhite: boolean;
  status: number;
}

export function useOpenRooms(maxScan: number = 20) {
  // 1. Read nextRoomId
  const {
    data: nextRoomId,
    refetch: refetchNextId,
    isLoading: isLoadingNextId,
  } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    functionName: "nextRoomId",
    query: {
      refetchInterval: 5000,
    },
  });

  // Calculate IDs to scan: from nextRoomId - 1 down to max(0, nextRoomId - maxScan)
  const roomIdsToScan: bigint[] = [];
  if (nextRoomId && nextRoomId > BigInt(0)) {
    const total = Number(nextRoomId);
    const count = Math.min(total, maxScan);
    for (let i = 0; i < count; i++) {
      roomIdsToScan.push(BigInt(total - 1 - i));
    }
  }

  // 2. Multicall getRoom for scanned IDs
  const contracts = roomIdsToScan.map((id) => ({
    address: ESCROW_ADDRESS,
    abi: CHESS_ESCROW_ABI,
    functionName: "getRoom",
    args: [id],
  }));

  const {
    data: roomsData,
    isLoading: isLoadingRooms,
    refetch: refetchRooms,
  } = useReadContracts({
    contracts: contracts as any,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 5000,
    },
  });

  // Filter only Open rooms (status === 0)
  const openRooms: OpenRoomSummary[] = [];
  if (roomsData && roomsData.length > 0) {
    roomsData.forEach((res: any, index: number) => {
      if (res.status === "success" && res.result) {
        const r = res.result as any;
        if (r.status === 0) {
          openRooms.push({
            id: roomIdsToScan[index],
            playerA: r.playerA,
            stake: r.stake,
            stakeFormatted: formatEther(r.stake),
            creatorIsWhite: r.creatorIsWhite,
            status: r.status,
          });
        }
      }
    });
  }

  return {
    openRooms,
    nextRoomId: nextRoomId ?? BigInt(0),
    isLoading: isLoadingNextId || isLoadingRooms,
    refetch: () => {
      refetchNextId();
      refetchRooms();
    },
  };
}
