// Core chess wrapper
export { TOURNAMENT_ABI } from "./abi/TournamentPrizePool.js";
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

// Contract ABIs
export { buildBoundJoinTypedData } from "./relay-auth.js";
export { CHESS_ESCROW_ABI } from "./abi/ChessEscrow.js";
export { AVA_CLASH_META_ABI } from "./abi/AvaClashMeta.js";

// Relay Client
export {
  RelayClient,
  type ConnectionStatus,
  type FinishedInfo,
  type RelayClientOptions,
  type RelayClientEventType,
  type RelayClientEventMap,
} from "./relay-client.js";

// Proposal Verification & Submit Flow
export {
  verifyResultProposal,
  type SeenTerminalEvents,
  type VerifyResultParams,
  type VerifyResultSuccess,
  type VerifyResultFailure,
  type VerifyResultOutcome,
} from "./verify-result.js";

export {
  submitResultFlow,
  type SubmitResultFlowParams,
  type SubmitResultFlowResult,
} from "./submit-flow.js";

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
  gameFinishedSchema,
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
  GameFinishedMessage,
  ClientMessage,
  ServerMessage,
} from "./schemas.js";

export { COSMETICS_ABI } from "./abi/AvaClashCosmetics.js";
