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
  getRelayEip712Domain,
  RELAY_EIP712_TYPES,
  buildJoinTypedData,
} from "./eip712.js";

// Zod schemas
export {
  authChallengeSchema,
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
  focusWarningSchema,
  FocusWarningSchema,
  spectatorPoolUpdateSchema,
  SpectatorPoolUpdateSchema,
  requestResultSchema,
  clientMessageSchema,
  serverMessageSchema,
} from "./schemas.js";

// Types — enums and converters
export {
  OutcomeCode,
  ReasonCode,
  outcomeToCode,
  codeToOutcome,
  reasonToCode,
  codeToReason,
} from "./types.js";

// Types — interfaces and type aliases
export type {
  GameOutcome,
  EndReason,
  ReplayResult,
  RoomStatus,
  PlayerColor,
  ResultMessage,
  WsMessageType,
  JoinMessage,
} from "./types.js";

export type {
  AuthChallengeMessage,
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
  FocusWarningMessage,
  SpectatorPoolUpdateMessage,
  RequestResultMessage,
  ClientMessage,
  ServerMessage,
} from "./schemas.js";
