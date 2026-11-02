import { CURRENCY_SYMBOL } from "@/config/env";
import { ContractFunctionRevertedError } from "viem";

export const ERROR_MESSAGES: Record<string, string> = {
  SpectatorDisabled: "Cược khán giả đang đóng trong bản thử nghiệm.",
  MinStakeRequired: `Mỗi lần gửi Vault cần ít nhất 0.5 ${CURRENCY_SYMBOL}.`,
  NothingStaked: "Ví chưa có tiền gốc trong Vault.",
  RewardNotClaimable:
    "Chưa tới thời gian nhận thưởng, đã hết hạn hoặc mùa thưởng đã đóng.",
  InvalidRewardAllocation:
    "Số tiền hoặc bằng chứng thưởng không khớp danh sách đã công bố.",
  AlreadyClaimed: "Ví đã nhận phần thưởng hoặc tiền hoàn này.",
  StakeTooLow: `Mức cược quá thấp (tối thiểu 0.01 ${CURRENCY_SYMBOL}).`,
  StakeTooHigh: `Mức cược vượt quá giới hạn hợp đồng (tối đa 1.0 ${CURRENCY_SYMBOL}).`,
  RoomNotFound: "Phòng không tồn tại.",
  RoomNotOpen: "Phòng không ở trạng thái mở hoặc đã có đối thủ tham gia.",
  RoomNotActive: "Phòng chưa bắt đầu hoặc không còn hoạt động.",
  NotCreator: "Bạn không phải người tạo phòng này.",
  CannotJoinOwnRoom: "Không thể tự vào phòng do chính bạn tạo.",
  WrongStakeAmount: "Số tiền cược gửi vào không khớp với mức cược của phòng.",
  InvalidWinner: "Người chiến thắng không khớp với kết quả ván đấu.",
  InvalidSignature: "Chữ ký EIP-712 không hợp lệ.",
  NonceAlreadyUsed: "Nonce giao dịch đã được sử dụng.",
  NotAPlayer: "Địa chỉ của bạn không thuộc danh sách người chơi trong phòng.",
  RefundTooEarly: "Chưa hết thời gian chờ hoàn tiền (60 phút).",
  AbortTooEarly: "Chưa đủ thời gian hủy trận (3 phút không có nước đi).",
  GameAlreadyStarted: "Ván đấu đã bắt đầu, không thể hủy phòng.",
  ChallengeWindowExpired: "Thời hạn khiếu nại đã hết (10 phút).",
  ChallengeWindowNotExpired: "Thời hạn khiếu nại chưa kết thúc.",
  NoPendingSingleSigned: "Không có kết quả đơn phương nào đang chờ xác nhận.",
  NothingToWithdraw: "Không có số dư khả dụng để rút tiền.",
  AlreadySettled: "Phòng này đã được thanh toán hoàn tất.",
  NotTheWinner: "Chỉ người chiến thắng mới có thể thực hiện thao tác này.",
  DeadlineExpired: "Thời hạn hiệu lực của kết quả đã hết.",
  InsufficientBond: "Số tiền ký quỹ (bond) khiếu nại không đủ.",
  RoomNotChallenged: "Phòng này chưa có khiếu nại nào.",
  ArbiterDeadlineNotReached: "Chưa đến thời hạn trọng tài phân xử (24 giờ).",
  SingleSignedDisabled:
    "Tính năng gửi kết quả đơn phương hiện đang bị tạm khóa.",
  UserRejectedRequestError: "Giao dịch đã bị từ chối từ ví.",
};

export type ContractErrorCode =
  | "StakeTooLow"
  | "StakeTooHigh"
  | "RoomNotFound"
  | "RoomNotOpen"
  | "RoomNotActive"
  | "NotCreator"
  | "CannotJoinOwnRoom"
  | "WrongStakeAmount"
  | "InvalidWinner"
  | "InvalidSignature"
  | "NonceAlreadyUsed"
  | "NotAPlayer"
  | "RefundTooEarly"
  | "AbortTooEarly"
  | "GameAlreadyStarted"
  | "ChallengeWindowExpired"
  | "ChallengeWindowNotExpired"
  | "NoPendingSingleSigned"
  | "NothingToWithdraw"
  | "AlreadySettled"
  | "NotTheWinner"
  | "DeadlineExpired"
  | "InsufficientBond"
  | "RoomNotChallenged"
  | "ArbiterDeadlineNotReached"
  | "SingleSignedDisabled"
  | "UserRejectedRequestError";

export class DecodedContractError {
  code?: ContractErrorCode;
  message: string;

  constructor(message: string, code?: ContractErrorCode) {
    this.message = message;
    this.code = code;
  }

  toString(): string {
    return this.message;
  }

  valueOf(): string {
    return this.message;
  }

  [Symbol.toPrimitive](): string {
    return this.message;
  }
}

export function decodeContractError(err: unknown): DecodedContractError {
  if (!err) return new DecodedContractError("Đã xảy ra lỗi không xác định.");

  if (typeof err === "object" && err !== null) {
    const errorObj = err as {
      name?: string;
      code?: number;
      message?: string;
      shortMessage?: string;
    };

    // Check user rejection
    if (
      errorObj.name === "UserRejectedRequestError" ||
      errorObj.code === 4001 ||
      (typeof errorObj.message === "string" &&
        (errorObj.message.includes("User rejected") ||
          errorObj.message.includes("rejected the request")))
    ) {
      return new DecodedContractError(
        "Giao dịch đã bị từ chối từ ví.",
        "UserRejectedRequestError",
      );
    }

    // Check insufficient funds
    if (
      typeof errorObj.message === "string" &&
      (errorObj.message.includes("insufficient funds") ||
        errorObj.message.includes("exceeds balance"))
    ) {
      return new DecodedContractError(
        `Số dư ${CURRENCY_SYMBOL} không đủ để thanh toán tiền cược và phí gas.`,
      );
    }

    // Walk cause tree to find ContractFunctionRevertedError or custom error name
    let cause: unknown = err;
    const visited = new Set<unknown>();
    while (cause && typeof cause === "object" && !visited.has(cause)) {
      visited.add(cause);
      const current = cause as {
        data?: { errorName?: string };
        shortMessage?: string;
        message?: string;
        cause?: unknown;
      };
      if (current instanceof ContractFunctionRevertedError) {
        const errorName = current.data?.errorName;
        if (errorName && ERROR_MESSAGES[errorName]) {
          return new DecodedContractError(
            ERROR_MESSAGES[errorName],
            errorName as ContractErrorCode,
          );
        }
        if (errorName) {
          return new DecodedContractError(
            `Lỗi hợp đồng: ${errorName}`,
            errorName as ContractErrorCode,
          );
        }
      }
      if (current.data?.errorName && ERROR_MESSAGES[current.data.errorName]) {
        return new DecodedContractError(
          ERROR_MESSAGES[current.data.errorName],
          current.data.errorName as ContractErrorCode,
        );
      }
      if (typeof current.shortMessage === "string") {
        for (const [errName, msg] of Object.entries(ERROR_MESSAGES)) {
          if (current.shortMessage.includes(errName)) {
            return new DecodedContractError(msg, errName as ContractErrorCode);
          }
        }
      }
      if (typeof current.message === "string") {
        for (const [errName, msg] of Object.entries(ERROR_MESSAGES)) {
          if (current.message.includes(errName)) {
            return new DecodedContractError(msg, errName as ContractErrorCode);
          }
        }
      }
      cause = current.cause;
    }

    if (errorObj.shortMessage) {
      return new DecodedContractError(errorObj.shortMessage);
    }
    if (errorObj.message) {
      return new DecodedContractError(errorObj.message.slice(0, 150));
    }
  }

  return new DecodedContractError(String(err));
}
