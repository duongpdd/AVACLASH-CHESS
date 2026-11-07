import { defaultUiText } from "@/i18n/ui-copy";
import { CURRENCY_SYMBOL } from "@/config/env";
import { ContractFunctionRevertedError } from "viem";

export const ERROR_MESSAGES: Record<string, string> = {
  SpectatorDisabled: defaultUiText("messageSpectatorStakingIsClosedInThis"),
  MinStakeRequired: defaultUiText("messageTheVaultRequiresAMinimumDeposit", {
    p0: String(CURRENCY_SYMBOL),
  }),
  NothingStaked: defaultUiText("messageThisWalletHasNoPrincipalIn"),
  RewardNotClaimable: defaultUiText("messageTheClaimWindowHasNotOpened"),
  InvalidRewardAllocation: defaultUiText("messageTheRewardAmountOrProofDoes"),
  AlreadyClaimed: defaultUiText("messageThisWalletAlreadyClaimedTheReward"),
  StakeTooLow: defaultUiText("messageTheStakeIsTooLowMinimum", {
    p0: String(CURRENCY_SYMBOL),
  }),
  StakeTooHigh: defaultUiText("messageTheStakeExceedsTheContractLimit", {
    p0: String(CURRENCY_SYMBOL),
  }),
  RoomNotFound: defaultUiText("messageRoomDoesNotExist2"),
  RoomNotOpen: defaultUiText("messageTheRoomIsClosedOrAnother"),
  RoomNotActive: defaultUiText("messageTheMatchHasNotStartedOr"),
  NotCreator: defaultUiText("messageYouDidNotCreateThisRoom"),
  CannotJoinOwnRoom: defaultUiText("messageYouCannotJoinYourOwnRoom"),
  WrongStakeAmount: defaultUiText("messageTheDepositDoesNotMatchThe"),
  InvalidWinner: defaultUiText("messageTheWinnerDoesNotMatchThe"),
  InvalidSignature: defaultUiText("messageInvalidEip712Signature"),
  NonceAlreadyUsed: defaultUiText("messageTheTransactionNonceHasAlreadyBeen"),
  NotAPlayer: defaultUiText("messageYourWalletAddressIsNotA"),
  RefundTooEarly: defaultUiText("messageThe60MinuteRefundWaitingPeriod"),
  AbortTooEarly: defaultUiText("messageTheThreeMinuteNoMoveCancellation"),
  GameAlreadyStarted: defaultUiText("messageTheGameAlreadyStartedAndCannot"),
  ChallengeWindowExpired: defaultUiText("messageTheTenMinuteAppealWindowHas"),
  ChallengeWindowNotExpired: defaultUiText("messageTheAppealWindowIsStillOpen"),
  NoPendingSingleSigned: defaultUiText(
    "messageThereIsNoUnilateralResultAwaiting",
  ),
  NothingToWithdraw: defaultUiText("messageNoBalanceIsAvailableToWithdraw"),
  AlreadySettled: defaultUiText("messageThisRoomHasAlreadyBeenSettled"),
  NotTheWinner: defaultUiText("messageOnlyTheWinnerCanPerformThis"),
  DeadlineExpired: defaultUiText("messageTheResultExpired"),
  InsufficientBond: defaultUiText("messageTheDisputeBondIsInsufficient"),
  RoomNotChallenged: defaultUiText("messageThisRoomHasNoDisputes"),
  ArbiterDeadlineNotReached: defaultUiText(
    "messageThe24HourRefereeDecisionPeriod",
  ),
  SingleSignedDisabled: defaultUiText(
    "messageUnilateralResultSubmissionIsCurrentlyDisabled",
  ),
  UserRejectedRequestError: defaultUiText(
    "messageTheWalletRejectedTheTransaction",
  ),
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
  if (!err)
    return new DecodedContractError(
      defaultUiText("messageAnUnknownErrorOccurred"),
    );

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
        defaultUiText("messageTheWalletRejectedTheTransaction"),
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
        defaultUiText("messageYourBalanceCannotCoverTheStake", {
          p0: String(CURRENCY_SYMBOL),
        }),
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
            defaultUiText("messageContractError", { p0: String(errorName) }),
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
