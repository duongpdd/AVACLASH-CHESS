import { describe, it, expect } from "vitest";
import { parseEther } from "viem";
import {
  validateStake,
  getJoinerColor,
  doesRoomExist,
  getRoomJoinableError,
  isRoomJoinable,
  ZERO_ADDRESS,
} from "../utils/room";

describe("room.ts pure logic utilities", () => {
  describe("validateStake", () => {
    const minStake = parseEther("0.01");
    const maxStake = parseEther("1.0");
    const uiMax = "0.1";

    it("rejects zero or negative stake", () => {
      expect(validateStake("0", minStake, maxStake, uiMax)).toContain("lớn hơn 0");
      expect(validateStake("-0.05", minStake, maxStake, uiMax)).toBeTruthy();
    });

    it("rejects stake lower than contract MIN_STAKE", () => {
      expect(validateStake("0.005", minStake, maxStake, uiMax)).toContain("tối thiểu là 0.01 AVAX");
    });

    it("rejects stake exceeding contract MAX_STAKE", () => {
      expect(validateStake("1.5", minStake, maxStake, "2.0")).toContain("vượt quá tối đa 1 AVAX");
    });

    it("rejects stake exceeding UI_MAX_STAKE", () => {
      expect(validateStake("0.2", minStake, maxStake, uiMax)).toContain("Giao diện giới hạn cược tối đa 0.1 AVAX");
    });

    it("accepts valid stake within [min, uiMax]", () => {
      expect(validateStake("0.01", minStake, maxStake, uiMax)).toBeNull();
      expect(validateStake("0.05", minStake, maxStake, uiMax)).toBeNull();
      expect(validateStake("0.1", minStake, maxStake, uiMax)).toBeNull();
    });

    it("rejects invalid numeric strings", () => {
      expect(validateStake("abc", minStake, maxStake, uiMax)).toBe("Số tiền cược không hợp lệ");
    });
  });

  describe("getJoinerColor", () => {
    it("returns null for null or undefined room", () => {
      expect(getJoinerColor(null)).toBeNull();
      expect(getJoinerColor(undefined)).toBeNull();
    });

    it("assigns Black to joiner when creator is White", () => {
      expect(getJoinerColor({ creatorIsWhite: true })).toBe("Black");
    });

    it("assigns White to joiner when creator is Black", () => {
      expect(getJoinerColor({ creatorIsWhite: false })).toBe("White");
    });
  });

  describe("doesRoomExist", () => {
    it("returns false for undefined or null room", () => {
      expect(doesRoomExist(null, BigInt(10), BigInt(0))).toBe(false);
      expect(doesRoomExist(undefined, BigInt(10), BigInt(0))).toBe(false);
    });

    it("returns false if roomId >= nextRoomId", () => {
      const room = {
        playerA: "0x1111111111111111111111111111111111111111",
        stake: parseEther("0.05"),
        status: 0,
      };
      expect(doesRoomExist(room, BigInt(5), BigInt(5))).toBe(false);
      expect(doesRoomExist(room, BigInt(5), BigInt(6))).toBe(false);
    });

    it("returns false if playerA is zero address", () => {
      const room = {
        playerA: ZERO_ADDRESS,
        stake: parseEther("0.05"),
        status: 0,
      };
      expect(doesRoomExist(room, BigInt(10), BigInt(1))).toBe(false);
    });

    it("returns true for a valid existing room", () => {
      const room = {
        playerA: "0x1111111111111111111111111111111111111111",
        stake: parseEther("0.05"),
        status: 0,
      };
      expect(doesRoomExist(room, BigInt(10), BigInt(1))).toBe(true);
    });
  });

  describe("isRoomJoinable and getRoomJoinableError", () => {
    const nextRoomId = BigInt(5);
    const validRoom = {
      id: BigInt(2),
      playerA: "0x1111111111111111111111111111111111111111",
      stake: parseEther("0.05"),
      status: 0,
      creatorIsWhite: true,
    };
    const userAddr = "0x2222222222222222222222222222222222222222";

    it("returns joinable=true and error=null for valid room and opponent", () => {
      expect(isRoomJoinable(validRoom, nextRoomId, userAddr, BigInt(2))).toBe(true);
      expect(getRoomJoinableError(validRoom, nextRoomId, userAddr, BigInt(2))).toBeNull();
    });

    it("rejects non-existent room when roomId >= nextRoomId", () => {
      expect(isRoomJoinable(validRoom, nextRoomId, userAddr, BigInt(5))).toBe(false);
      expect(getRoomJoinableError(validRoom, nextRoomId, userAddr, BigInt(5))).toBe("Phòng không tồn tại.");
    });

    it("rejects room with zero address as playerA", () => {
      const uncreated = { ...validRoom, playerA: ZERO_ADDRESS };
      expect(isRoomJoinable(uncreated, nextRoomId, userAddr, BigInt(1))).toBe(false);
      expect(getRoomJoinableError(uncreated, nextRoomId, userAddr, BigInt(1))).toBe("Phòng không tồn tại.");
    });

    it("rejects room that is not in Open status (e.g. status=1 Active)", () => {
      const activeRoom = { ...validRoom, status: 1 };
      expect(isRoomJoinable(activeRoom, nextRoomId, userAddr, BigInt(2))).toBe(false);
      expect(getRoomJoinableError(activeRoom, nextRoomId, userAddr, BigInt(2))).toContain("không ở trạng thái mở");
    });

    it("rejects self-join by room creator", () => {
      const creatorAddr = "0x1111111111111111111111111111111111111111";
      expect(isRoomJoinable(validRoom, nextRoomId, creatorAddr, BigInt(2))).toBe(false);
      expect(getRoomJoinableError(validRoom, nextRoomId, creatorAddr, BigInt(2))).toContain("Không thể tự vào phòng do chính bạn tạo");
    });

    it("rejects room with zero stake to prevent zero value transactions", () => {
      const zeroStakeRoom = { ...validRoom, stake: BigInt(0) };
      expect(isRoomJoinable(zeroStakeRoom, nextRoomId, userAddr, BigInt(2))).toBe(false);
      expect(getRoomJoinableError(zeroStakeRoom, nextRoomId, userAddr, BigInt(2))).toContain("Mức cược");
    });
  });
});

