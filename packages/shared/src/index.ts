// Core chess wrapper
export { ChessGame } from "./chess.js";

// Replay engine
export { replay, validateResult } from "./replay.js";

// Moves hash
export { computeMovesHash, movesToString } from "./hash.js";

// EIP-712
export {
  getEip712Domain,
  EIP712_TYPES,
  buildResultTypedData,
  FUJI_CHAIN_ID,
  ZERO_ADDRESS,
} from "./eip712.js";

// Zod schemas
export {
  joinRoomSchema,
  roomStateSchema,
  moveSchema,
  resignSchema,
  drawOfferSchema,
  drawAcceptSchema,
  drawDeclineSchema,
  clockSyncSchema,
  resultProposalSchema,
  resultSignatureSchema,
  pingSchema,
  pongSchema,
  errorSchema,
  timeoutSchema,
  clientMessageSchema,
  serverMessageSchema,
} from "./schemas.js";

// Types
export type {
  GameOutcome,
  EndReason,
  ReplayResult,
  RoomStatus,
  PlayerColor,
  ResultMessage,
  WsMessageType,
} from "./types.js";

export type {
  JoinRoomMessage,
  RoomStateMessage,
  MoveMessage,
  ResignMessage,
  DrawOfferMessage,
  DrawAcceptMessage,
  DrawDeclineMessage,
  ClockSyncMessage,
  ResultProposalMessage,
  ResultSignatureMessage,
  PingMessage,
  PongMessage,
  ErrorMessage,
  TimeoutMessage,
  ClientMessage,
  ServerMessage,
} from "./schemas.js";
