/**
 * Outcome of a chess game.
 */
export type GameOutcome = "white" | "black" | "draw" | "ongoing";

/**
 * Reason the game ended.
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
 * Result of replaying a list of moves.
 */
export interface ReplayResult {
  valid: boolean;
  outcome: GameOutcome;
  reason?: EndReason;
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
 */
export interface ResultMessage {
  matchId: bigint;
  winner: `0x${string}`;
  movesHash: `0x${string}`;
  nonce: bigint;
}

/**
 * WebSocket message types.
 */
export type WsMessageType =
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
  | "error";
