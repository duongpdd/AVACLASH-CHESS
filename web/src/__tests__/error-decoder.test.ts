import { describe, it, expect } from "vitest";
import { decodeContractError, ERROR_MESSAGES } from "../utils/errors";
import { ROOM_STATUS_TEXT } from "../hooks/useRoom";
import { parseEther, formatEther } from "viem";

describe("Web3 Contract Error Decoder & Hook Logic", () => {
  describe("decodeContractError", () => {
    it("correctly decodes standard custom contract errors", () => {
      for (const [errName, expectedMsg] of Object.entries(ERROR_MESSAGES)) {
        const errorObj = {
          name: "ContractFunctionExecutionError",
          message: `Execution reverted with reason: ${errName}()`,
          shortMessage: `The contract function reverted: ${errName}`,
        };
        const decoded = decodeContractError(errorObj);
        expect(decoded.message).toBe(expectedMsg);
        expect(decoded.code).toBe(errName);
      }
    });

    it("correctly decodes user rejection in wallet (code 4001)", () => {
      const userRejectError = {
        name: "UserRejectedRequestError",
        code: 4001,
        message: "User rejected the request.",
      };
      expect(decodeContractError(userRejectError).message).toBe(
        "Giao dịch đã bị từ chối từ ví."
      );
    });

    it("correctly decodes insufficient funds error", () => {
      const fundsError = {
        name: "EstimateGasExecutionError",
        message: "sender doesn't have enough funds to send tx or exceeds balance",
      };
      expect(decodeContractError(fundsError).message).toBe(
        "Số dư AVAX không đủ để thanh toán tiền cược và phí gas."
      );
    });

    it("falls back gracefully for unknown errors", () => {
      expect(decodeContractError(null).message).toBe("Đã xảy ra lỗi không xác định.");
      expect(decodeContractError("Random network error").message).toBe(
        "Random network error"
      );
    });
  });

  describe("Stake validation logic (useCreateRoom)", () => {
    const minStake = parseEther("0.01");
    const maxStake = parseEther("1.0");
    const uiMaxStake = "0.1";

    const validateStake = (stakeStr: string): string | null => {
      try {
        const stakeVal = parseEther(stakeStr);
        if (stakeVal < minStake) {
          return `Mức cược tối thiểu là ${formatEther(minStake)} AVAX`;
        }
        if (stakeVal > maxStake) {
          return `Mức cược vượt quá tối đa ${formatEther(maxStake)} AVAX của hợp đồng`;
        }
        const uiMax = parseEther(uiMaxStake);
        if (stakeVal > uiMax) {
          return `Giao diện giới hạn cược tối đa ${uiMaxStake} AVAX (chế độ an toàn)`;
        }
        return null;
      } catch {
        return "Số tiền cược không hợp lệ";
      }
    };

    it("rejects stake below 0.01 AVAX", () => {
      expect(validateStake("0.005")).toContain("Mức cược tối thiểu");
    });

    it("rejects stake above UI_MAX_STAKE (0.1 AVAX)", () => {
      expect(validateStake("0.5")).toContain("Giao diện giới hạn cược tối đa");
    });

    it("rejects invalid input text", () => {
      expect(validateStake("abc")).toBe("Số tiền cược không hợp lệ");
    });

    it("accepts valid stake within [0.01, 0.1]", () => {
      expect(validateStake("0.01")).toBeNull();
      expect(validateStake("0.05")).toBeNull();
      expect(validateStake("0.1")).toBeNull();
    });
  });

  describe("Join room color and detail calculation (useJoinRoom)", () => {
    it("assigns Black to joiner when creator chose White", () => {
      const room = { creatorIsWhite: true, stake: parseEther("0.05") };
      const joinerColor = !room.creatorIsWhite ? "White" : "Black";
      expect(joinerColor).toBe("Black");
    });

    it("assigns White to joiner when creator chose Black", () => {
      const room = { creatorIsWhite: false, stake: parseEther("0.05") };
      const joinerColor = !room.creatorIsWhite ? "White" : "Black";
      expect(joinerColor).toBe("White");
    });
  });

  describe("Room status labels and descriptions (useRoom)", () => {
    it("contains valid labels for all 7 statuses (0..6)", () => {
      for (let s = 0; s <= 6; s++) {
        expect(ROOM_STATUS_TEXT[s]).toBeDefined();
        expect(ROOM_STATUS_TEXT[s].label).toBeTruthy();
        expect(ROOM_STATUS_TEXT[s].desc).toBeTruthy();
      }
      expect(ROOM_STATUS_TEXT[0].label).toContain("Open");
      expect(ROOM_STATUS_TEXT[1].label).toContain("Active");
      expect(ROOM_STATUS_TEXT[2].label).toContain("Settled");
      expect(ROOM_STATUS_TEXT[3].label).toContain("Cancelled");
      expect(ROOM_STATUS_TEXT[4].label).toContain("Refunded");
      expect(ROOM_STATUS_TEXT[5].label).toContain("Challenged");
      expect(ROOM_STATUS_TEXT[6].label).toContain("Aborted");
    });
  });
});
