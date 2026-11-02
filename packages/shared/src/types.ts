/**
 * Outcome of a chess game (string form for internal logic).
 */
export type GameOutcome = "white" | "black" | "draw" | "ongoing";

/**
 * Reason the game ended (string form for internal logic).
 */
export type EndReason =
  | "checkmate"
  | "resign"
  | "timeout"
  | "stalemate"
  | "repetition"
  | "fifty"
  | "insufficient"
  | "draw_agreed";

/**
 * Numeric outcome codes matching Solidity uint8.
 * Used for EIP-712 signing and on-chain submission.
 */
export enum OutcomeCode {
  WhiteWin = 0,
  BlackWin = 1,
  Draw = 2,
}

/**
 * Numeric reason codes matching Solidity uint8.
 * Used for EIP-712 signing and on-chain submission.
 */
export enum ReasonCode {
  Checkmate = 0,
  Resign = 1,
  Timeout = 2,
  Stalemate = 3,
  Repetition = 4,
  FiftyMove = 5,
  InsufficientMaterial = 6,
  Agreement = 7,
}

/**
 * Convert GameOutcome to OutcomeCode for on-chain use.
 * Throws if outcome is "ongoing" (should not be submitted on-chain).
 */
export function outcomeToCode(outcome: GameOutcome): OutcomeCode {
  switch (outcome) {
    case "white":
      return OutcomeCode.WhiteWin;
    case "black":
      return OutcomeCode.BlackWin;
    case "draw":
      return OutcomeCode.Draw;
    default:
      throw new Error(`Cannot convert ongoing game to OutcomeCode`);
  }
}

/**
 * Convert OutcomeCode back to GameOutcome.
 */
export function codeToOutcome(code: OutcomeCode): GameOutcome {
  switch (code) {
    case OutcomeCode.WhiteWin:
      return "white";
    case OutcomeCode.BlackWin:
      return "black";
    case OutcomeCode.Draw:
      return "draw";
    default:
      throw new Error(`Unknown OutcomeCode: ${code}`);
  }
}

/**
 * Convert EndReason to ReasonCode for on-chain use.
 */
export function reasonToCode(reason: EndReason): ReasonCode {
  switch (reason) {
    case "checkmate":
      return ReasonCode.Checkmate;
    case "resign":
      return ReasonCode.Resign;
    case "timeout":
      return ReasonCode.Timeout;
    case "stalemate":
      return ReasonCode.Stalemate;
    case "repetition":
      return ReasonCode.Repetition;
    case "fifty":
      return ReasonCode.FiftyMove;
    case "insufficient":
      return ReasonCode.InsufficientMaterial;
    case "draw_agreed":
      return ReasonCode.Agreement;
    default:
      throw new Error(`Unknown EndReason: ${reason}`);
  }
}

/**
 * Convert ReasonCode back to EndReason.
 */
export function codeToReason(code: ReasonCode): EndReason {
  switch (code) {
    case ReasonCode.Checkmate:
      return "checkmate";
    case ReasonCode.Resign:
      return "resign";
    case ReasonCode.Timeout:
      return "timeout";
    case ReasonCode.Stalemate:
      return "stalemate";
    case ReasonCode.Repetition:
      return "repetition";
    case ReasonCode.FiftyMove:
      return "fifty";
    case ReasonCode.InsufficientMaterial:
      return "insufficient";
    case ReasonCode.Agreement:
      return "draw_agreed";
    default:
      throw new Error(`Unknown ReasonCode: ${code}`);
  }
}

/**
 * Result of replaying a list of moves.
 */
export interface ReplayResult {
  valid: boolean;
  outcome: GameOutcome;
  reason?: EndReason;
  /** Total number of half-moves (plies) played. */
  moveCount: number;
}

/**
 * Room status matching the smart contract enum.
 */
export type RoomStatus =
  | "Open"
  | "Active"
  | "Settled"
  | "Cancelled"
  | "Refunded";

/**
 * Player color.
 */
export type PlayerColor = "white" | "black";

/**
 * EIP-712 Result struct fields for signing.
 * Matches Solidity: Result(uint256 matchId, address winner, uint8 outcome,
 *   uint8 reason, uint16 moveCount, bytes32 movesHash, uint256 nonce, uint256 deadline)
 */
export interface ResultMessage {
  matchId: bigint;
  winner: `0x${string}`;
  outcome: number;
  reason: number;
  moveCount: number;
  movesHash: `0x${string}`;
  nonce: bigint;
  deadline: bigint;
}

/**
 * WebSocket message types.
 */
export type WsMessageType =
  | "auth_challenge"
  | "join_room"
  | "room_state"
  | "move"
  | "resign"
  | "draw_offer"
  | "draw_accept"
  | "draw_decline"
  | "clock_sync"
  | "result_proposal"
  | "result_signature"
  | "ping"
  | "pong"
  | "error"
  | "timeout"
  | "focus_warning"
  | "spectator_pool";

/**
 * EIP-712 Join struct fields for Relay join authentication.
 * Matches: Join(uint256 roomId, address player, bytes32 nonce, uint256 expiresAt)
 */
export interface JoinMessage {
  roomId: bigint;
  player: `0x${string}`;
  nonce: `0x${string}`;
  expiresAt: bigint;
}
