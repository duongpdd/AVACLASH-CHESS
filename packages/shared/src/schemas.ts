import { z } from "zod";

// --- Primitive schemas ---

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

const bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid bytes32 hex");

const uciMoveSchema = z
  .string()
  .regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/, "Invalid UCI move");

const roomIdSchema = z.number().int().nonnegative();

const seqSchema = z.number().int().nonnegative();

// --- WebSocket message schemas ---

export const authChallengeSchema = z.object({
  type: z.literal("auth_challenge"),
  nonce: bytes32Schema,
  expiresAt: z.number().int().nonnegative(),
});

export const joinRoomSchema = z.object({
  type: z.literal("join_room"),
  roomId: roomIdSchema,
  role: z.enum(["player", "spectator"]).optional(),
  address: addressSchema.optional(),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature hex").optional(),
  nonce: bytes32Schema.optional(),
});

export const roomStateSchema = z.object({
  type: z.literal("room_state"),
  roomId: roomIdSchema,
  white: addressSchema,
  black: addressSchema.optional(),
  moves: z.array(uciMoveSchema),
  whiteMs: z.number().nonnegative(),
  blackMs: z.number().nonnegative(),
  status: z.enum(["waiting", "active", "finished"]),
});

export const moveSchema = z.object({
  type: z.literal("move"),
  roomId: roomIdSchema,
  seq: seqSchema,
  uci: uciMoveSchema,
});

export const resignSchema = z.object({
  type: z.literal("resign"),
  roomId: roomIdSchema,
  player: z.enum(["w", "b"]).optional(),
});

export const drawOfferSchema = z.object({
  type: z.literal("draw_offer"),
  roomId: roomIdSchema,
});

export const drawAcceptSchema = z.object({
  type: z.literal("draw_accept"),
  roomId: roomIdSchema,
});

export const drawDeclineSchema = z.object({
  type: z.literal("draw_decline"),
  roomId: roomIdSchema,
});

export const clockSyncSchema = z.object({
  type: z.literal("clock_sync"),
  roomId: roomIdSchema,
  whiteMs: z.number().nonnegative(),
  blackMs: z.number().nonnegative(),
});

export const resultProposalSchema = z.object({
  type: z.literal("result_proposal"),
  roomId: roomIdSchema,
  winner: addressSchema,
  outcome: z.number().int().min(0).max(2),
  reason: z.number().int().min(0).max(7),
  moveCount: z.number().int().nonnegative(),
  movesHash: bytes32Schema,
  nonce: z.number().int().nonnegative(),
  deadline: z.number().int().nonnegative(),
});

export const resultSignatureSchema = z.object({
  type: z.literal("result_signature"),
  roomId: roomIdSchema,
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature hex"),
});

export const pingSchema = z.object({
  type: z.literal("ping"),
});

export const pongSchema = z.object({
  type: z.literal("pong"),
});

export const errorSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  code: z.string().optional(),
});

export const timeoutSchema = z.object({
  type: z.literal("timeout"),
  roomId: roomIdSchema,
  player: z.enum(["w", "b"]).optional(),
});

export const focusWarningSchema = z.object({
  type: z.literal("focus_warning"),
  player: z.enum(["w", "b"]),
  warningCount: z.number().int().min(1).max(3),
  penaltyMs: z.number().int().nonnegative(),
});

export const FocusWarningSchema = focusWarningSchema;

/**
 * Spectator Pool update — simplified to White/Black/Draw market only.
 * "Under 40 moves" option removed per Q5 decision.
 */
export const spectatorPoolUpdateSchema = z.object({
  type: z.literal("spectator_pool"),
  whitePoolAvax: z.string(),
  blackPoolAvax: z.string(),
  drawPoolAvax: z.string(),
  isLocked: z.boolean(),
});

export const requestResultSchema = z.object({
  type: z.literal("request_result"),
  roomId: roomIdSchema,
});

export const SpectatorPoolUpdateSchema = spectatorPoolUpdateSchema;

/**
 * Discriminated union of all client → relay messages.
 */
export const clientMessageSchema = z.discriminatedUnion("type", [
  joinRoomSchema,
  moveSchema,
  resignSchema,
  drawOfferSchema,
  drawAcceptSchema,
  drawDeclineSchema,
  resultSignatureSchema,
  pingSchema,
  timeoutSchema,
  focusWarningSchema,
  requestResultSchema,
]);

export const gameFinishedSchema = z.object({
  type: z.literal("game_finished"),
  roomId: roomIdSchema,
  outcome: z.union([z.number().int().min(0).max(2), z.enum(["w", "b", "draw"])]).optional(),
  reason: z.union([z.string(), z.number()]).optional(),
  winner: addressSchema.optional(),
  moveCount: z.number().int().nonnegative().optional(),
  moves: z.array(z.string()).optional(),
});

/**
 * Discriminated union of all relay → client messages.
 */
export const serverMessageSchema = z.discriminatedUnion("type", [
  authChallengeSchema,
  roomStateSchema,
  moveSchema,
  resignSchema,
  drawOfferSchema,
  drawAcceptSchema,
  drawDeclineSchema,
  clockSyncSchema,
  resultProposalSchema,
  resultSignatureSchema,
  pongSchema,
  errorSchema,
  timeoutSchema,
  focusWarningSchema,
  spectatorPoolUpdateSchema,
  gameFinishedSchema,
]);

// Inferred types
export type AuthChallengeMessage = z.infer<typeof authChallengeSchema>;
export type JoinRoomMessage = z.infer<typeof joinRoomSchema>;
export type RoomStateMessage = z.infer<typeof roomStateSchema>;
export type MoveMessage = z.infer<typeof moveSchema>;
export type ResignMessage = z.infer<typeof resignSchema>;
export type DrawOfferMessage = z.infer<typeof drawOfferSchema>;
export type DrawAcceptMessage = z.infer<typeof drawAcceptSchema>;
export type DrawDeclineMessage = z.infer<typeof drawDeclineSchema>;
export type ClockSyncMessage = z.infer<typeof clockSyncSchema>;
export type ResultProposalMessage = z.infer<typeof resultProposalSchema>;
export type ResultSignatureMessage = z.infer<typeof resultSignatureSchema>;
export type PingMessage = z.infer<typeof pingSchema>;
export type PongMessage = z.infer<typeof pongSchema>;
export type ErrorMessage = z.infer<typeof errorSchema>;
export type TimeoutMessage = z.infer<typeof timeoutSchema>;
export type FocusWarningMessage = z.infer<typeof focusWarningSchema>;
export type SpectatorPoolUpdateMessage = z.infer<typeof spectatorPoolUpdateSchema>;
export type RequestResultMessage = z.infer<typeof requestResultSchema>;
export type GameFinishedMessage = z.infer<typeof gameFinishedSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
