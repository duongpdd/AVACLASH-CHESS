import { defaultUiText } from "@/i18n/ui-copy";
import { useUiCopy } from "@/i18n/use-ui-copy";
import { useReadContract, useWatchContractEvent } from "wagmi";
import { formatEther } from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { ESCROW_ADDRESS, CHAIN_ID } from "@/config/env";
import { doesRoomExist } from "@/utils/room";

export const ROOM_STATUS_TEXT: Record<
  number,
  { label: string; color: string; desc: string }
> = {
  0: {
    label: defaultUiText("messageWaitingForAnOpponent3"),
    color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    desc: defaultUiText("messageWaitingForAnOpponentToJoin"),
  },
  1: {
    label: defaultUiText("messageBothPlayersHaveJoined"),
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    desc: defaultUiText("messageBothPlayersHaveDepositedStakesOpen"),
  },
  2: {
    label: defaultUiText("messageSettled"),
    color: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    desc: defaultUiText("messageTheGameEndedAndThePrize"),
  },
  3: {
    label: defaultUiText("messageCanceled"),
    color: "text-slate-400 bg-slate-400/10 border-slate-400/30",
    desc: defaultUiText("messageTheCreatorCanceledBeforeAnyoneJoined"),
  },
  4: {
    label: defaultUiText("messageRefunded"),
    color: "text-rose-400 bg-rose-400/10 border-rose-400/30",
    desc: defaultUiText("messageTheGameTimedOutWithoutA"),
  },
  5: {
    label: defaultUiText("messageUnderDispute"),
    color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    desc: defaultUiText("messageAUnilateralResultIsDisputedAnd"),
  },
  6: {
    label: defaultUiText("messageCanceledEarly"),
    color: "text-orange-400 bg-orange-400/10 border-orange-400/30",
    desc: defaultUiText("messageTheMatchWasCanceledBecauseNo"),
  },
};

export function useRoom(roomId?: bigint | number) {
  const uiText = useUiCopy();
  const parsedId = roomId !== undefined ? BigInt(roomId) : undefined;

  // Read nextRoomId to verify room existence
  const { data: nextRoomId } = useReadContract({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    functionName: "nextRoomId",
    query: {
      refetchInterval: 5000,
    },
  });

  const {
    data: room,
    isLoading,
    refetch,
    error,
  } = useReadContract({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
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
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    eventName: "RoomJoined",
    onLogs() {
      refetch();
    },
  });

  useWatchContractEvent({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    eventName: "ResultSubmitted",
    onLogs() {
      refetch();
    },
  });

  useWatchContractEvent({
    address: ESCROW_ADDRESS,
    chainId: CHAIN_ID,
    abi: CHESS_ESCROW_ABI,
    eventName: "RoomCancelled",
    onLogs() {
      refetch();
    },
  });

  const exists = doesRoomExist(room, nextRoomId, parsedId);

  const statusInfo = !exists
    ? {
        label: uiText("messageRoomDoesNotExist"),
        color: "text-rose-400 bg-rose-400/10 border-rose-400/30",
        desc: uiText("messageThisRoomHasNotBeenCreated"),
      }
    : room
      ? ROOM_STATUS_TEXT[room.status] || {
          label: uiText("messageUnknown"),
          color: "text-slate-400",
          desc: "",
        }
      : null;

  return {
    room,
    exists,
    isLoading,
    refetch,
    error,
    statusInfo,
    stakeFormatted: room && exists ? formatEther(room.stake) : "0",
    whitePlayer:
      room && exists
        ? room.creatorIsWhite
          ? room.playerA
          : room.playerB
        : null,
    blackPlayer:
      room && exists
        ? room.creatorIsWhite
          ? room.playerB
          : room.playerA
        : null,
  };
}
