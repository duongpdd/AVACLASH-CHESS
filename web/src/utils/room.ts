import { parseEther, formatEther } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
  uiMax?: string
): string | null {
  try {
    const stakeVal = parseEther(stakeStr);
    if (stakeVal <= BigInt(0)) {
      return "Số tiền cược phải lớn hơn 0.";
    }
    if (minStake !== undefined && stakeVal < minStake) {
      return `Mức cược tối thiểu là ${formatEther(minStake)} AVAX`;
    }
    if (maxStake !== undefined && stakeVal > maxStake) {
      return `Mức cược vượt quá tối đa ${formatEther(maxStake)} AVAX của hợp đồng`;
    }
    if (uiMax) {
      const uiMaxVal = parseEther(uiMax);
      if (stakeVal > uiMaxVal) {
        return `Giao diện giới hạn cược tối đa ${uiMax} AVAX (chế độ an toàn)`;
      }
    }
    return null;
  } catch {
    return "Số tiền cược không hợp lệ";
  }
}

/**
 * Determines the color that an opponent joining the room will play.
 * If creator is White (creatorIsWhite = true), joiner plays Black.
 * If creator is Black (creatorIsWhite = false), joiner plays White.
 */
export function getJoinerColor(
  room: { creatorIsWhite?: boolean } | null | undefined
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
  roomId?: bigint | number
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

  if (targetId !== undefined && nextRoomId !== undefined && targetId >= nextRoomId) {
    return false;
  }
  if (!room.playerA || room.playerA.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
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
  roomId?: bigint | number
): string | null {
  if (!doesRoomExist(room, nextRoomId, roomId)) {
    return "Phòng không tồn tại.";
  }
  if (room!.status !== 0) {
    return "Phòng không ở trạng thái mở hoặc đã có đối thủ.";
  }
  if (room!.stake === undefined || room!.stake <= BigInt(0)) {
    return "Mức cược phòng không hợp lệ.";
  }
  if (
    address &&
    room!.playerA &&
    room!.playerA.toLowerCase() === address.toLowerCase()
  ) {
    return "Không thể tự vào phòng do chính bạn tạo.";
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
  roomId?: bigint | number
): boolean {
  return getRoomJoinableError(room, nextRoomId, address, roomId) === null;
}

