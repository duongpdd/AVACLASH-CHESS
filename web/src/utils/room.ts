import { defaultUiText } from "@/i18n/ui-copy";
import { CURRENCY_SYMBOL } from "@/config/env";
import { parseEther, formatEther } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function getGameRoomUrl(roomId: bigint | number): string {
  return `/game?room=${roomId.toString()}`;
}

/** The wire protocol uses JSON numbers, so reject IDs that lose integer precision. */
export function parseRoomId(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 0 ? id : undefined;
}

export interface RoomLike {
  id?: bigint | number;
  roomId?: bigint | number;
  playerA?: string;
  playerB?: string;
  stake?: bigint;
  status?: number;
  creatorIsWhite?: boolean;
}

/**
 * Validates a stake input string against contract and UI limits.
 * Returns an error string if invalid, or null if valid.
 */
export function validateStake(
  stakeStr: string,
  minStake?: bigint,
  maxStake?: bigint,
  uiMax?: string,
): string | null {
  try {
    const stakeVal = parseEther(stakeStr);
    if (stakeVal <= BigInt(0)) {
      return defaultUiText("messageTheStakeMustBeGreaterThan");
    }
    if (minStake !== undefined && stakeVal < minStake) {
      return defaultUiText("messageMinimumStake2", {
        p0: String(formatEther(minStake)),
        p1: String(CURRENCY_SYMBOL),
      });
    }
    if (maxStake !== undefined && stakeVal > maxStake) {
      return defaultUiText("messageTheStakeExceedsTheContractLimit2", {
        p0: String(formatEther(maxStake)),
        p1: String(CURRENCY_SYMBOL),
      });
    }
    if (uiMax) {
      const uiMaxVal = parseEther(uiMax);
      if (stakeVal > uiMaxVal) {
        return defaultUiText("messageTheInterfaceLimitsStakesToFor", {
          p0: String(uiMax),
          p1: String(CURRENCY_SYMBOL),
        });
      }
    }
    return null;
  } catch {
    return defaultUiText("messageInvalidStakeAmount");
  }
}

/**
 * Determines the color that an opponent joining the room will play.
 * If creator is White (creatorIsWhite = true), joiner plays Black.
 * If creator is Black (creatorIsWhite = false), joiner plays White.
 */
export function getJoinerColor(
  room: { creatorIsWhite?: boolean } | null | undefined,
): "White" | "Black" | null {
  if (!room || room.creatorIsWhite === undefined) return null;
  return !room.creatorIsWhite ? "White" : "Black";
}

/**
 * Checks whether a room exists on-chain.
 */
export function doesRoomExist(
  room: RoomLike | null | undefined,
  nextRoomId?: bigint,
  roomId?: bigint | number,
): boolean {
  if (!room) return false;
  const targetId =
    roomId !== undefined
      ? BigInt(roomId)
      : room.roomId !== undefined
        ? BigInt(room.roomId)
        : room.id !== undefined
          ? BigInt(room.id)
          : undefined;

  if (
    targetId !== undefined &&
    nextRoomId !== undefined &&
    targetId >= nextRoomId
  ) {
    return false;
  }
  if (
    !room.playerA ||
    room.playerA.toLowerCase() === ZERO_ADDRESS.toLowerCase()
  ) {
    return false;
  }
  return true;
}

/**
 * Checks why a room is not joinable, returning a Vietnamese error reason or null if joinable.
 */
export function getRoomJoinableError(
  room: RoomLike | null | undefined,
  nextRoomId?: bigint,
  address?: string,
  roomId?: bigint | number,
): string | null {
  if (!doesRoomExist(room, nextRoomId, roomId)) {
    return defaultUiText("messageRoomDoesNotExist2");
  }
  if (room!.status !== 0) {
    return defaultUiText("messageTheRoomIsClosedOrAnother2");
  }
  if (room!.stake === undefined || room!.stake <= BigInt(0)) {
    return defaultUiText("messageInvalidRoomStake");
  }
  if (
    address &&
    room!.playerA &&
    room!.playerA.toLowerCase() === address.toLowerCase()
  ) {
    return defaultUiText("messageYouCannotJoinYourOwnRoom");
  }
  return null;
}

/**
 * Pure function to check if a room can be joined by the given user.
 * Must verify: roomId < nextRoomId, playerA != address(0), status == 0, not creator, and stake > 0.
 */
export function isRoomJoinable(
  room: RoomLike | null | undefined,
  nextRoomId?: bigint,
  address?: string,
  roomId?: bigint | number,
): boolean {
  return getRoomJoinableError(room, nextRoomId, address, roomId) === null;
}
