import { useUiCopy } from "@/i18n/use-ui-copy";
import { useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS, CHAIN_ID } from "@/config/env";
import { isRoomJoinable } from "@/utils/room";

export interface OpenRoomSummary {
  id: bigint;
  playerA: string;
  stake: bigint;
  stakeFormatted: string;
  creatorIsWhite: boolean;
  status: number;
}

export function useOpenRooms(maxScan: number = 20) {
  const uiText = useUiCopy();
  // 1. Read nextRoomId
  const {
    data: nextRoomId,
    refetch: refetchNextId,
    isLoading: isLoadingNextId,
    error: nextIdError,
  } = useReadContract({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    functionName: "nextRoomId",
    query: {
      refetchInterval: 5000,
    },
  });

  // Calculate IDs to scan: from nextRoomId - 1 down to max(0, nextRoomId - maxScan)
  const roomIdsToScan: bigint[] = [];
  if (nextRoomId && nextRoomId > BigInt(0)) {
    const limit = Math.max(0, Math.min(1000, Math.floor(maxScan) || 0));
    const count = Number(
      nextRoomId < BigInt(limit) ? nextRoomId : BigInt(limit),
    );
    for (let i = 0; i < count; i++) {
      roomIdsToScan.push(nextRoomId - 1n - BigInt(i));
    }
  }

  // 2. Multicall getRoom for scanned IDs
  const contracts = roomIdsToScan.map((id) => ({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    functionName: "getRoom" as const,
    args: [id] as const,
  }));

  const {
    data: roomsData,
    isLoading: isLoadingRooms,
    error: roomsError,
    refetch: refetchRooms,
  } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 5000,
    },
  });

  // Filter only valid, existing Open rooms using isRoomJoinable
  const openRooms: OpenRoomSummary[] = [];
  if (roomsData && roomsData.length > 0) {
    roomsData.forEach((res, index) => {
      if (res.status === "success" && res.result) {
        const r = res.result;
        const currentId = roomIdsToScan[index];
        if (currentId === undefined) return;
        // Use isRoomJoinable to ensure roomId < nextRoomId, playerA != 0, status == 0, stake > 0
        if (isRoomJoinable(r, nextRoomId, undefined, currentId)) {
          openRooms.push({
            id: currentId,
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
    errorMessage:
      nextIdError ||
      roomsError ||
      (roomsData?.length &&
        roomsData.every((result) => result.status === "failure"))
        ? uiText("messageCouldNotLoadTheRoomList")
        : null,
    refetch: () => {
      refetchNextId();
      refetchRooms();
    },
  };
}
