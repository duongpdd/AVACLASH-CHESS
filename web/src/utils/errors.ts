import { ContractFunctionRevertedError } from "viem";

export const ERROR_MESSAGES: Record<string, string> = {
  StakeTooLow: "Mức cược quá thấp (tối thiểu 0.01 AVAX).",
  StakeTooHigh: "Mức cược vượt quá giới hạn hợp đồng (tối đa 1.0 AVAX).",
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
  SingleSignedDisabled: "Tính năng gửi kết quả đơn phương hiện đang bị tạm khóa.",
  UserRejectedRequestError: "Giao dịch đã bị từ chối từ ví.",
};

export function decodeContractError(err: unknown): string {
  if (!err) return "Đã xảy ra lỗi không xác định.";

  if (typeof err === "object" && err !== null) {
    const errorObj = err as any;

    // Check user rejection
    if (
      errorObj.name === "UserRejectedRequestError" ||
      errorObj.code === 4001 ||
      (typeof errorObj.message === "string" &&
        (errorObj.message.includes("User rejected") ||
          errorObj.message.includes("rejected the request")))
    ) {
      return "Giao dịch đã bị từ chối từ ví.";
    }

    // Check insufficient funds
    if (
      typeof errorObj.message === "string" &&
      (errorObj.message.includes("insufficient funds") ||
        errorObj.message.includes("exceeds balance"))
    ) {
      return "Số dư AVAX không đủ để thanh toán tiền cược và phí gas.";
    }

    // Walk cause tree to find ContractFunctionRevertedError or custom error name
    let current: any = err;
    while (current) {
      if (current instanceof ContractFunctionRevertedError) {
        const errorName = current.data?.errorName;
        if (errorName && ERROR_MESSAGES[errorName]) {
          return ERROR_MESSAGES[errorName];
        }
        if (errorName) {
          return `Lỗi hợp đồng: ${errorName}`;
        }
      }
      if (current.data?.errorName && ERROR_MESSAGES[current.data.errorName]) {
        return ERROR_MESSAGES[current.data.errorName];
      }
      if (typeof current.shortMessage === "string") {
        for (const [errName, msg] of Object.entries(ERROR_MESSAGES)) {
          if (current.shortMessage.includes(errName)) {
            return msg;
          }
        }
      }
      if (typeof current.message === "string") {
        for (const [errName, msg] of Object.entries(ERROR_MESSAGES)) {
          if (current.message.includes(errName)) {
            return msg;
          }
        }
      }
      current = current.cause;
    }

    if (errorObj.shortMessage) {
      return errorObj.shortMessage;
    }
    if (errorObj.message) {
      return errorObj.message.slice(0, 150);
    }
  }

  return String(err);
}
