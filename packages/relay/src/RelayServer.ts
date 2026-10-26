import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  recoverTypedDataAddress,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  clientMessageSchema,
  computeMovesHash,
  outcomeToCode,
  reasonToCode,
  buildResultTypedData,
  getRelayEip712Domain,
  RELAY_EIP712_TYPES,
  FUJI_CHAIN_ID,
  ZERO_ADDRESS,
  type ClientMessage,
  type ServerMessage,
  type ResultMessage,
  type ResultProposalMessage,
  type GameOutcome,
  type EndReason,
} from "@avaclash/shared";
import { RelayRoom } from "./RelayRoom.js";
import { CHESS_ESCROW_ABI } from "./abi/ChessEscrow.js";

export const ESCROW_ABI = CHESS_ESCROW_ABI;

export interface SavedGameResult {
  chainId?: number;
  contractAddress?: string;
  roomId: number;
  moves: string[];
  outcome: GameOutcome;
  reason: EndReason;
  winner: `0x${string}`;
  whiteAddress?: string;
  blackAddress?: string;
  timestamp: number; // Unix epoch ms
}

export interface ActiveGameState {
  chainId: number;
  contractAddress: string;
  roomId: number;
  moves: string[];
  whiteMs: number;
  blackMs: number;
  activeTurn: "w" | "b";
  whiteAddress: string;
  blackAddress: string;
  status: "waiting" | "active";
  savedAt: number; // Unix epoch ms
}

export interface RelayServerOptions {
  port?: number;
  server?: any; // For attaching to existing http/https server in tests
  relayPrivateKey?: `0x${string}`;
  contractAddress?: `0x${string}`;
  rpcUrl?: string;
  chainId?: number;
  initialTimeMs?: number;
  publicClient?: any;
  walletClient?: any;
  signalGameStartedEnabled?: boolean;
  minRelayBalance?: bigint;
  resultsDir?: string;
  trustProxy?: boolean;
  maxPayload?: number; // bytes, default 4096 (4 KB)
  maxConnectionsPerIp?: number;
  maxRooms?: number;
  rateLimitPerSecond?: number;
}

interface SocketSession {
  ip: string;
  authChallenge?: {
    nonce: `0x${string}`;
    expiresAt: number; // Unix timestamp seconds
    used: boolean;
  };
  authenticatedAddress?: `0x${string}`;
  role?: "player" | "spectator";
  authTimeoutTimer?: NodeJS.Timeout;
  messageCountInWindow: number;
  windowStart: number;
}

export class RelayServer {
  public wss: WebSocketServer;
  public rooms: Map<number, RelayRoom> = new Map();
  public relayAccount: PrivateKeyAccount;
  public contractAddress: `0x${string}`;
  public chainId: number;
  public initialTimeMs?: number;
  public publicClient: any;
  public walletClient?: any;
  public signalGameStartedEnabled: boolean;
  public minRelayBalance: bigint;
  public resultsDir: string;
  public trustProxy: boolean;
  public savedResults: Map<string, SavedGameResult> = new Map();

  public getResultKey(roomId: number): string {
    return `${this.chainId}:${this.contractAddress.toLowerCase()}:${roomId}`;
  }

  public getActiveGamesDir(): string {
    return path.join(this.resultsDir, "active");
  }

  public getActiveGameFilePath(roomId: number): string {
    const fileName = `${this.chainId}_${this.contractAddress.toLowerCase()}_${roomId}.json`;
    return path.join(this.getActiveGamesDir(), fileName);
  }

  public saveActiveGameState(room: RelayRoom): void {
    try {
      const activeDir = this.getActiveGamesDir();
      if (!fs.existsSync(activeDir)) {
        fs.mkdirSync(activeDir, { recursive: true });
      }
      const state: ActiveGameState = {
        chainId: this.chainId,
        contractAddress: this.contractAddress,
        roomId: room.roomId,
        moves: [...room.moves],
        whiteMs: room.whiteMs,
        blackMs: room.blackMs,
        activeTurn: room.activeTurn,
        whiteAddress: room.whiteAddress,
        blackAddress: room.blackAddress,
        status: room.status === "active" ? "active" : "waiting",
        savedAt: Date.now(),
      };
      const finalPath = this.getActiveGameFilePath(room.roomId);
      const tmpPath = path.join(
        activeDir,
        `tmp_${room.roomId}_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`
      );
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
      fs.renameSync(tmpPath, finalPath);
    } catch (err) {
      console.error(`[Relay] Error saving active game state for room ${room.roomId}:`, err);
    }
  }

  public deleteActiveGameState(roomId: number): void {
    try {
      const finalPath = this.getActiveGameFilePath(roomId);
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
        console.log(`[Relay] Removed active game file for room ${roomId}`);
      }
    } catch (err) {
      console.warn(`[Relay] Error deleting active game state for room ${roomId}:`, err);
    }
  }

  public maxConnectionsPerIp: number;
  public maxRooms: number;
  public rateLimitPerSecond: number;

  private ipConnectionCounts: Map<string, number> = new Map();
  private socketSessions: Map<WebSocket, SocketSession> = new Map();

  constructor(options: RelayServerOptions = {}) {
    const rawKey =
      options.relayPrivateKey ??
      (process.env.RELAY_PRIVATE_KEY as `0x${string}` | undefined);
    if (!rawKey) {
      throw new Error(
        "Missing required Relay private key. Please set RELAY_PRIVATE_KEY environment variable or pass relayPrivateKey in options."
      );
    }
    const privateKey = rawKey.startsWith("0x")
      ? (rawKey as `0x${string}`)
      : (`0x${rawKey}` as `0x${string}`);
    this.relayAccount = privateKeyToAccount(privateKey);

    const contract =
      options.contractAddress ??
      (process.env.ESCROW_ADDRESS as `0x${string}` | undefined) ??
      (process.env.CHESS_ESCROW_ADDRESS as `0x${string}` | undefined);
    if (!contract || contract.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      throw new Error(
        "ESCROW_ADDRESS is required and cannot be zero address."
      );
    }
    this.contractAddress = contract;

    this.chainId = options.chainId ?? FUJI_CHAIN_ID;
    this.initialTimeMs = options.initialTimeMs;

    this.maxConnectionsPerIp = options.maxConnectionsPerIp ?? 20;
    this.maxRooms = options.maxRooms ?? 500;
    this.rateLimitPerSecond = options.rateLimitPerSecond ?? 25;
    this.trustProxy = options.trustProxy ?? (process.env.TRUST_PROXY === "true");

    this.signalGameStartedEnabled =
      options.signalGameStartedEnabled ??
      (process.env.SIGNAL_GAME_STARTED_ENABLED !== "false");

    const envMinBal = process.env.RELAY_MIN_BALANCE;
    this.minRelayBalance =
      options.minRelayBalance ??
      (envMinBal ? parseEther(envMinBal) : parseEther("0.1"));

    if (options.publicClient) {
      this.publicClient = options.publicClient;
    } else {
      const rpcUrl = options.rpcUrl ?? process.env.RPC_URL;
      if (!rpcUrl) {
        throw new Error("RPC_URL is required to initialize publicClient.");
      }
      this.publicClient = createPublicClient({
        transport: http(rpcUrl),
      });
    }

    if (options.walletClient) {
      this.walletClient = options.walletClient;
    } else {
      const rpcUrl = options.rpcUrl ?? process.env.RPC_URL;
      if (rpcUrl) {
        this.walletClient = createWalletClient({
          account: this.relayAccount,
          transport: http(rpcUrl),
        });
      }
    }

    this.resultsDir = options.resultsDir ?? process.env.RESULTS_DIR ?? "./results";
    this.loadAndPruneResults();

    const maxPayload = options.maxPayload ?? 4 * 1024; // 4 KB maxPayload

    if (options.server) {
      this.wss = new WebSocketServer({ server: options.server, maxPayload });
    } else {
      this.wss = new WebSocketServer({ port: options.port ?? 8080, maxPayload });
    }

    this.setupWss();

    // Check balance asynchronously on startup
    this.checkRelayBalance().catch((err) => {
      console.warn("[Relay] Startup balance check error:", err);
    });
  }

  public get relayAddress(): `0x${string}` {
    return this.relayAccount.address;
  }

  public getRoom(roomId: number): RelayRoom | undefined {
    return this.rooms.get(roomId);
  }

  private setupWss(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const trustProxy = this.trustProxy || process.env.TRUST_PROXY === "true";
      const ip =
        (trustProxy
          ? (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress
          : req.socket.remoteAddress) ||
        "127.0.0.1";

      // Check IP connection limit
      const currentIpCount = this.ipConnectionCounts.get(ip) ?? 0;
      if (currentIpCount >= this.maxConnectionsPerIp) {
        ws.close(1008, "Too many connections from this IP");
        return;
      }
      this.ipConnectionCounts.set(ip, currentIpCount + 1);

      // Create session with auth challenge
      const nonce = ("0x" + crypto.randomBytes(32).toString("hex")) as `0x${string}`;
      const expiresAt = Math.floor(Date.now() / 1000) + 60; // 60 seconds validity

      const session: SocketSession = {
        ip,
        authChallenge: { nonce, expiresAt, used: false },
        messageCountInWindow: 0,
        windowStart: Date.now(),
        authTimeoutTimer: setTimeout(() => {
          if (!session.authenticatedAddress && session.role !== "spectator") {
            try {
              ws.close(4001, "Auth timeout: unauthenticated connection closed after 10s");
            } catch {
              // ignore
            }
          }
        }, 10000),
      };

      this.socketSessions.set(ws, session);

      // Send auth_challenge immediately to client
      this.send(ws, {
        type: "auth_challenge",
        nonce,
        expiresAt,
      });

      ws.on("message", (raw: string | Buffer) => {
        this.handleRawMessage(ws, raw.toString());
      });

      ws.on("error", () => {
        // Handle socket errors (e.g. maxPayload exceeded) cleanly without uncaught exception
      });

      ws.on("close", () => {
        if (session.authTimeoutTimer) {
          clearTimeout(session.authTimeoutTimer);
        }
        const cnt = this.ipConnectionCounts.get(ip) ?? 1;
        if (cnt <= 1) {
          this.ipConnectionCounts.delete(ip);
        } else {
          this.ipConnectionCounts.set(ip, cnt - 1);
        }
        this.socketSessions.delete(ws);

        for (const room of this.rooms.values()) {
          room.removeSocket(ws);
        }
      });
    });
  }

  public handleRawMessage(ws: WebSocket, raw: string): void {
    const session = this.socketSessions.get(ws);
    if (!session) return;

    // Rate limiting per socket
    const now = Date.now();
    if (now - session.windowStart > 1000) {
      session.windowStart = now;
      session.messageCountInWindow = 0;
    }
    session.messageCountInWindow++;
    if (session.messageCountInWindow > this.rateLimitPerSecond) {
      this.sendError(ws, "Rate limit exceeded");
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      this.sendError(ws, "Malformed JSON payload");
      return;
    }

    const parseResult = clientMessageSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      this.sendError(ws, `Validation error: ${parseResult.error.issues[0]?.message ?? "Invalid message"}`);
      return;
    }

    this.routeMessage(ws, parseResult.data, session).catch((err) => {
      console.error("[Relay] routeMessage error:", err);
      this.sendError(ws, "Internal error processing message");
    });
  }

  public async routeMessage(
    ws: WebSocket,
    msg: ClientMessage,
    session: SocketSession
  ): Promise<void> {
    switch (msg.type) {
      case "ping": {
        this.send(ws, { type: "pong" });
        break;
      }

      case "join_room": {
        await this.handleJoinRoom(ws, msg, session);
        break;
      }

      case "move": {
        const room = this.rooms.get(msg.roomId);
        if (!room) {
          this.sendError(ws, `Room ${msg.roomId} not found`);
          return;
        }
        if (session.role === "spectator" || !session.authenticatedAddress) {
          this.sendError(ws, "Spectators or unauthenticated users cannot send moves");
          return;
        }
        const ok = room.handleMove(ws, msg.seq, msg.uci);
        if (!ok) {
          this.sendError(ws, "Invalid move or out of turn");
        }
        break;
      }

      case "resign": {
        const room = this.rooms.get(msg.roomId);
        if (!room) {
          this.sendError(ws, `Room ${msg.roomId} not found`);
          return;
        }
        if (session.role === "spectator" || !session.authenticatedAddress) {
          this.sendError(ws, "Spectators cannot resign");
          return;
        }
        room.handleResign(ws);
        break;
      }

      case "draw_offer": {
        const room = this.rooms.get(msg.roomId);
        if (room && session.role !== "spectator") room.handleDrawOffer(ws);
        break;
      }

      case "draw_accept": {
        const room = this.rooms.get(msg.roomId);
        if (room && session.role !== "spectator") room.handleDrawAccept(ws);
        break;
      }

      case "draw_decline": {
        const room = this.rooms.get(msg.roomId);
        if (room && session.role !== "spectator") room.handleDrawDecline(ws);
        break;
      }

      case "focus_warning": {
        if (session.role === "spectator") return;
        const room = this.rooms.get(this.findRoomIdForSocket(ws) ?? -1);
        if (room) {
          room.handleFocusWarning(ws, msg.warningCount, msg.penaltyMs);
        }
        break;
      }

      case "result_signature": {
        const room = this.rooms.get(msg.roomId);
        if (!room) return;
        if (session.role === "spectator" || !session.authenticatedAddress) {
          this.sendError(ws, "Spectators cannot submit result signatures");
          return;
        }

        // Reject if room has no active proposal
        if (!room.lastResultProposal || !room.lastResultMessage) {
          this.sendError(ws, "No active result proposal found for room");
          return;
        }

        try {
          const typedData = buildResultTypedData(
            this.contractAddress,
            room.lastResultMessage,
            this.chainId
          );
          const signer = await recoverTypedDataAddress({
            ...typedData,
            signature: msg.signature as `0x${string}`,
          });
          if (signer.toLowerCase() !== session.authenticatedAddress.toLowerCase()) {
            this.sendError(ws, "Signature recovered address does not match player address");
            return;
          }

          const isWhite = signer.toLowerCase() === room.whiteAddress.toLowerCase();
          const isBlack = signer.toLowerCase() === room.blackAddress.toLowerCase();
          if (!isWhite && !isBlack) {
            this.sendError(ws, "Signer is not a player of this room");
            return;
          }
        } catch (err: any) {
          this.sendError(ws, `Failed to verify signature: ${err.message}`);
          return;
        }

        // Broadcast player's valid signature to room
        room.broadcast({
          type: "result_signature",
          roomId: msg.roomId,
          signature: msg.signature,
        });
        break;
      }

      case "timeout": {
        const room = this.rooms.get(msg.roomId);
        if (room && room.status === "active" && session.role !== "spectator") {
          if (room.whiteMs <= 0) room.handleTimeout("w");
          else if (room.blackMs <= 0) room.handleTimeout("b");
        }
        break;
      }

      case "request_result": {
        await this.handleRequestResult(ws, session, msg.roomId);
        break;
      }
    }
  }

  private findRoomIdForSocket(ws: WebSocket): number | undefined {
    for (const [id, r] of this.rooms.entries()) {
      if (r.whitePlayer?.ws === ws || r.blackPlayer?.ws === ws) {
        return id;
      }
    }
    return undefined;
  }

  public async handleJoinRoom(
    ws: WebSocket,
    msg: {
      type: "join_room";
      roomId: number;
      role?: "player" | "spectator";
      address?: string;
      signature?: string;
      nonce?: string;
    },
    session: SocketSession
  ): Promise<void> {
    const isSpectator = msg.role === "spectator";

    if (!isSpectator) {
      // Validate Player Authentication via EIP-712 signature
      if (!msg.address || !msg.signature || !msg.nonce) {
        this.sendError(ws, "Missing required player credentials: address, signature, and nonce");
        return;
      }

      const challenge = session.authChallenge;
      if (!challenge) {
        this.sendError(ws, "No auth challenge active on socket");
        return;
      }

      if (challenge.used) {
        this.sendError(ws, "Nonce already used");
        return;
      }

      if (challenge.nonce.toLowerCase() !== msg.nonce.toLowerCase()) {
        this.sendError(ws, "Nonce does not match active auth challenge");
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      if (now > challenge.expiresAt) {
        this.sendError(ws, "Auth challenge expired");
        return;
      }

      // Mark challenge nonce as consumed (single-use)
      challenge.used = true;

      // Recover signer using Relay Join EIP-712 domain
      let recoveredAddress: `0x${string}`;
      try {
        recoveredAddress = await recoverTypedDataAddress({
          domain: getRelayEip712Domain(this.chainId),
          types: RELAY_EIP712_TYPES,
          primaryType: "Join",
          message: {
            roomId: BigInt(msg.roomId),
            player: msg.address as `0x${string}`,
            nonce: msg.nonce as `0x${string}`,
            expiresAt: BigInt(challenge.expiresAt),
          },
          signature: msg.signature as `0x${string}`,
        });
      } catch (err: any) {
        this.sendError(ws, `Signature recovery failed: ${err.message}`);
        return;
      }

      if (recoveredAddress.toLowerCase() !== msg.address.toLowerCase()) {
        this.sendError(ws, "Signature does not match declared player address");
        return;
      }

      // Socket successfully authenticated as player
      if (session.authTimeoutTimer) {
        clearTimeout(session.authTimeoutTimer);
        session.authTimeoutTimer = undefined;
      }
      session.authenticatedAddress = msg.address.toLowerCase() as `0x${string}`;
      session.role = "player";
    } else {
      // Spectator role does not require signature
      if (session.authTimeoutTimer) {
        clearTimeout(session.authTimeoutTimer);
        session.authTimeoutTimer = undefined;
      }
      session.role = "spectator";
    }

    // On-Chain Room Validation (Fail-closed)
    let roomData: any;
    try {
      roomData = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: ESCROW_ABI,
        functionName: "getRoom",
        args: [BigInt(msg.roomId)],
      });
    } catch (err: any) {
      this.sendError(ws, `On-chain query failed: ${err.message}`);
      return;
    }

    // Status: 0=Open, 1=Active, 2=Settled, 3=Cancelled, 4=Refunded, 5=Challenged, 6=Aborted
    if (!roomData || Number(roomData.status) !== 1) {
      this.sendError(ws, "Room is not Active on-chain");
      return;
    }

    const playerA = (roomData.playerA as string).toLowerCase();
    const playerB = (roomData.playerB as string).toLowerCase();

    if (!isSpectator) {
      const playerAddr = session.authenticatedAddress!;
      if (playerAddr !== playerA && playerAddr !== playerB) {
        this.sendError(ws, "Address is not a player of this room. Join as spectator instead.");
        return;
      }
    }

    // Turn 3b Item 1b: If room already has a saved result and no active RelayRoom in memory,
    // do NOT create a new RelayRoom; send game_finished and only allow request_result.
    // Only allow when address is a player of the room.
    const resultKey = this.getResultKey(msg.roomId);
    const existingResult = this.savedResults.get(resultKey);
    const existingRoom = this.rooms.get(msg.roomId);
    const isRoomActive = existingRoom && existingRoom.status === "active";

    if (existingResult && !isRoomActive) {
      if (isSpectator || !session.authenticatedAddress) {
        this.sendError(ws, "Game has finished. Only room players can access this room.");
        return;
      }
      const playerAddr = session.authenticatedAddress.toLowerCase();
      if (playerAddr !== playerA && playerAddr !== playerB) {
        this.sendError(ws, "Address is not a player of this room.");
        return;
      }
      this.send(ws, {
        type: "game_finished",
        roomId: msg.roomId,
      });
      return;
    }

    // Get or Create RelayRoom with immutable colors determined on-chain (Q13)
    let room = this.rooms.get(msg.roomId);
    if (!room) {
      if (this.rooms.size >= this.maxRooms) {
        this.sendError(ws, "Server reached maximum room capacity");
        return;
      }

      // Check if an active game state file exists for this room (Turn 3b Item 2 / Q19)
      const activeFilePath = this.getActiveGameFilePath(msg.roomId);
      let recoveredState: ActiveGameState | null = null;
      if (fs.existsSync(activeFilePath)) {
        try {
          const raw = fs.readFileSync(activeFilePath, "utf-8");
          const parsed = JSON.parse(raw) as ActiveGameState;
          if (
            parsed.chainId === this.chainId &&
            parsed.contractAddress.toLowerCase() === this.contractAddress.toLowerCase() &&
            parsed.roomId === msg.roomId
          ) {
            recoveredState = parsed;
          }
        } catch (err) {
          console.warn(`[Relay] Failed to read active game file for room ${msg.roomId}:`, err);
        }
      }

      const whiteAddr = roomData.creatorIsWhite ? roomData.playerA : roomData.playerB;
      const blackAddr = roomData.creatorIsWhite ? roomData.playerB : roomData.playerA;

      room = new RelayRoom({
        roomId: msg.roomId,
        whiteAddress: whiteAddr as `0x${string}`,
        blackAddress: blackAddr as `0x${string}`,
        initialTimeMs: this.initialTimeMs,
        onMoveAccepted: (r) => {
          this.saveActiveGameState(r);
        },
        onGameStarted: (r) => {
          this.saveActiveGameState(r);
          // Không gọi lại signalGameStarted nếu on-chain đã gameStarted
          if (!roomData.gameStarted) {
            this.handleGameStarted(r).catch((err) => {
              console.error(`[Relay] handleGameStarted error for room ${r.roomId}:`, err);
            });
          }
        },
        onWaitingTimeout: (r) => {
          this.rooms.delete(r.roomId);
          this.deleteActiveGameState(r.roomId);
          console.log(`[Relay] Removed stale waiting room ${r.roomId} after 10m timeout`);
        },
        onGameOver: (r, outcome, reason, winner) => {
          this.deleteActiveGameState(r.roomId);
          this.handleGameOver(r, outcome, reason, winner).catch((err) => {
            console.error(`[Relay] handleGameOver unhandled rejection for room ${r.roomId}:`, err);
          });
        },
      });

      if (recoveredState) {
        // Reconstruct RelayRoom from active file:
        // 1. Replay moves through ChessGame
        for (const mv of recoveredState.moves) {
          const ok = room.chess.makeMove(mv);
          if (ok) {
            room.moves.push(mv);
            room.seq++;
          }
        }
        // 2. Restore clocks without deducting downtime
        room.whiteMs = recoveredState.whiteMs;
        room.blackMs = recoveredState.blackMs;
        room.activeTurn = recoveredState.activeTurn;
        room.status = recoveredState.status;
        room.lastClockUpdate = Date.now();
        if (room.status === "active") {
          room.startClock();
        }
        console.log(
          `[Relay] Restored active room ${room.roomId} from disk (${room.moves.length} moves, whiteMs=${room.whiteMs}, blackMs=${room.blackMs}, turn=${room.activeTurn})`
        );
      }

      this.rooms.set(msg.roomId, room);
    }

    if (isSpectator) {
      room.addSpectator(ws);
      room.broadcastRoomState();
    } else {
      room.addPlayer(msg.address as `0x${string}`, ws);
      room.broadcastRoomState();
    }
  }

  public async handleGameOver(
    room: RelayRoom,
    outcome: GameOutcome,
    reason: EndReason,
    winnerAddress: `0x${string}`,
  ): Promise<void> {
    try {
      this.deleteActiveGameState(room.roomId);
      const resultKey = this.getResultKey(room.roomId);
      // Turn 3b Item 1d: nếu đã có kết quả lưu cho phòng này thì không ghi đè và không ký ván thứ hai
      if (this.savedResults.has(resultKey)) {
        console.warn(`[Relay] Room ${room.roomId} already has a saved result. Refusing to sign a second game.`);
        return;
      }

      if (!this.contractAddress || this.contractAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
        console.warn("[Relay] contractAddress not configured. Skipping co-signature.");
        return;
      }

      // Check on-chain room status before signing
      let roomData: any;
      try {
        roomData = await this.publicClient.readContract({
          address: this.contractAddress,
          abi: ESCROW_ABI,
          functionName: "getRoom",
          args: [BigInt(room.roomId)],
        });
      } catch (err) {
        console.error(`[Relay] Failed to query on-chain room before signing room ${room.roomId}:`, err);
        return;
      }

      if (!roomData || Number(roomData.status) !== 1) {
        console.warn(
          `[Relay] Room ${room.roomId} is no longer Active on-chain (status=${roomData?.status}). Refusing to sign.`
        );
        return;
      }

      const outcomeCode = outcomeToCode(outcome);
      const reasonCode = reasonToCode(reason);
      const movesHash = computeMovesHash(room.moves);
      const now = Math.floor(Date.now() / 1000);
      const nonce = BigInt(now) * 1000n + BigInt(room.roomId % 1000);
      const deadline = BigInt(now + 1800); // 30 minutes validity per requirement

      const resultMessage: ResultMessage = {
        matchId: BigInt(room.roomId),
        winner: winnerAddress,
        outcome: outcomeCode,
        reason: reasonCode,
        moveCount: room.moves.length,
        movesHash,
        nonce,
        deadline,
      };

      // 1. Build and sign EIP-712 Typed Data using Relay Signer account
      const typedData = buildResultTypedData(this.contractAddress, resultMessage, this.chainId);
      const relaySignature = await this.relayAccount.signTypedData(typedData);

      // 2. Broadcast result proposal
      const proposalMsg: ResultProposalMessage = {
        type: "result_proposal",
        roomId: room.roomId,
        winner: winnerAddress,
        outcome: outcomeCode,
        reason: reasonCode,
        moveCount: room.moves.length,
        movesHash,
        nonce: Number(nonce % BigInt(Number.MAX_SAFE_INTEGER)),
        deadline: Number(deadline),
      };

      room.lastResultProposal = proposalMsg;
      room.lastResultMessage = resultMessage;
      room.broadcast(proposalMsg);

      // 3. Broadcast Relay's signature
      const signatureMsg: ServerMessage = {
        type: "result_signature",
        roomId: room.roomId,
        signature: relaySignature,
      };
      room.broadcast(signatureMsg);

      // Save finished game to resultsDir (Turn 3a Item 4 / Turn 3b Item 1)
      this.saveGameResult({
        chainId: this.chainId,
        contractAddress: this.contractAddress,
        roomId: room.roomId,
        moves: [...room.moves],
        outcome,
        reason,
        winner: winnerAddress,
        whiteAddress: room.whiteAddress,
        blackAddress: room.blackAddress,
        timestamp: Date.now(),
      });

      // 4. Schedule automatic room cleanup after 10 minutes
      setTimeout(() => {
        const r = this.rooms.get(room.roomId);
        if (r && r.status === "finished") {
          r.destroy();
          this.rooms.delete(room.roomId);
        }
      }, 10 * 60 * 1000);
    } catch (err) {
      console.error(`[Relay] Error in handleGameOver for room ${room.roomId}:`, err);
    }
  }

  public async handleGameStarted(room: RelayRoom): Promise<void> {
    if (!this.signalGameStartedEnabled) {
      console.log(`[Relay] signalGameStarted disabled; skipping on-chain call for room ${room.roomId}`);
      return;
    }
    if (!this.walletClient) {
      console.warn(`[Relay] walletClient not configured; skipping signalGameStarted for room ${room.roomId}`);
      return;
    }

    const startTime = Date.now();
    const maxDurationMs = 150_000; // 150 seconds, safely before 3m ABORT_TIMEOUT
    let attempt = 0;
    let delayMs = 1000;

    while (Date.now() - startTime < maxDurationMs) {
      attempt++;
      try {
        console.log(`[Relay] Calling signalGameStarted for room ${room.roomId} (attempt ${attempt})...`);
        const txHash = await this.walletClient.writeContract({
          address: this.contractAddress,
          abi: CHESS_ESCROW_ABI,
          functionName: "signalGameStarted",
          args: [BigInt(room.roomId)],
        });
        console.log(`[Relay] signalGameStarted tx sent for room ${room.roomId}: ${txHash}. Waiting receipt...`);
        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 30_000,
        });
        if (receipt.status === "success") {
          console.log(`[Relay] signalGameStarted confirmed on-chain for room ${room.roomId} in tx ${txHash}`);
          return;
        } else {
          console.warn(`[Relay] signalGameStarted tx reverted for room ${room.roomId}: ${txHash}`);
        }
      } catch (err: any) {
        console.warn(`[Relay] signalGameStarted attempt ${attempt} for room ${room.roomId} failed: ${err.message}`);
        if (
          err.message?.includes("GameAlreadyStarted") ||
          err.message?.includes("RoomNotActive") ||
          err.message?.includes("AlreadySettled")
        ) {
          return;
        }
      }

      const remaining = maxDurationMs - (Date.now() - startTime);
      if (remaining <= 0) break;
      const sleep = Math.min(delayMs, remaining);
      await new Promise((resolve) => setTimeout(resolve, sleep));
      delayMs = Math.min(delayMs * 2, 10_000);
    }

    console.error(`[Relay] signalGameStarted timed out after 150s for room ${room.roomId}`);
  }

  public async checkRelayBalance(): Promise<bigint> {
    try {
      if (!this.publicClient || typeof this.publicClient.getBalance !== "function") return 0n;
      const balance = await this.publicClient.getBalance({
        address: this.relayAccount.address,
      });
      if (balance < this.minRelayBalance) {
        console.warn(
          `[Relay] WARNING: Relay account balance (${balance} wei) is below minimum threshold (${this.minRelayBalance} wei)!`
        );
      }
      return balance;
    } catch (err: any) {
      console.warn(`[Relay] Could not check relay balance: ${err.message}`);
      return 0n;
    }
  }

  public loadAndPruneResults(): void {
    try {
      if (!fs.existsSync(this.resultsDir)) {
        fs.mkdirSync(this.resultsDir, { recursive: true });
        return;
      }
      const files = fs.readdirSync(this.resultsDir);
      const now = Date.now();
      const maxAgeMs = 48 * 60 * 60 * 1000; // 48 hours

      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(this.resultsDir, file);
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          const data: SavedGameResult = JSON.parse(raw);
          if (now - data.timestamp > maxAgeMs) {
            fs.unlinkSync(filePath);
            console.log(`[Relay] Pruned expired result (>48h): ${file}`);
          }

          // Item 1a: Khi nạp, bỏ qua file khác chainId hoặc contract
          const baseName = path.basename(file, ".json");
          const separator = baseName.includes(":") ? ":" : baseName.includes("_") ? "_" : null;
          if (separator) {
            const parts = baseName.split(separator);
            if (parts.length === 3) {
              const [fileChainId, fileContract] = parts;
              if (
                Number(fileChainId) !== this.chainId ||
                fileContract.toLowerCase() !== this.contractAddress.toLowerCase()
              ) {
                console.log(`[Relay] Skipping result ${file}: chainId or contract mismatch in filename`);
                continue;
              }
            }
          }

          if (data.chainId !== undefined && data.chainId !== this.chainId) {
            console.log(`[Relay] Skipping result ${file}: chainId mismatch (${data.chainId} !== ${this.chainId})`);
            continue;
          }
          if (
            data.contractAddress &&
            data.contractAddress.toLowerCase() !== this.contractAddress.toLowerCase()
          ) {
            console.log(`[Relay] Skipping result ${file}: contractAddress mismatch (${data.contractAddress} !== ${this.contractAddress})`);
            continue;
          }

          const key = this.getResultKey(data.roomId);
          this.savedResults.set(key, data);
        } catch (err) {
          console.warn(`[Relay] Could not read result file ${file}:`, err);
        }
      }
    } catch (err) {
      console.warn(`[Relay] Error loading results from ${this.resultsDir}:`, err);
    }
  }

  public saveGameResult(result: SavedGameResult): void {
    try {
      const key = this.getResultKey(result.roomId);
      this.savedResults.set(key, result);
      if (!fs.existsSync(this.resultsDir)) {
        fs.mkdirSync(this.resultsDir, { recursive: true });
      }
      const cId = result.chainId ?? this.chainId;
      const cAddr = (result.contractAddress ?? this.contractAddress).toLowerCase();
      const fileName = `${cId}_${cAddr}_${result.roomId}.json`;
      const filePath = path.join(this.resultsDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
      console.log(`[Relay] Saved game result for room ${result.roomId} to ${filePath}`);
    } catch (err) {
      console.error(`[Relay] Error saving game result for room ${result.roomId}:`, err);
    }
  }

  public async handleRequestResult(
    ws: WebSocket,
    session: SocketSession,
    roomId: number
  ): Promise<void> {
    if (!session.authenticatedAddress) {
      this.sendError(ws, "Authentication required to request result");
      return;
    }

    let roomData: any;
    try {
      roomData = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: CHESS_ESCROW_ABI,
        functionName: "getRoom",
        args: [BigInt(roomId)],
      });
    } catch (err: any) {
      this.sendError(ws, `Failed to fetch on-chain room ${roomId}: ${err.message}`);
      return;
    }

    // Room must still be Active on-chain (status == 1)
    if (Number(roomData.status) !== 1) {
      this.sendError(ws, `Room ${roomId} is not Active on-chain (status=${roomData.status})`);
      return;
    }

    // Requester must be playerA or playerB
    const caller = session.authenticatedAddress.toLowerCase();
    const pA = (roomData.playerA as string).toLowerCase();
    const pB = (roomData.playerB as string).toLowerCase();
    if (caller !== pA && caller !== pB) {
      this.sendError(ws, `Address ${session.authenticatedAddress} is not a player of room ${roomId}`);
      return;
    }

    // Must have saved result
    const resultKey = this.getResultKey(roomId);
    const saved = this.savedResults.get(resultKey);
    if (!saved) {
      this.sendError(ws, `No saved result found for room ${roomId}`);
      return;
    }

    // Turn 3b Item 1c: đối chiếu địa chỉ trắng/đen đã lưu với getRoom/creatorIsWhite hiện tại; không khớp thì từ chối và ghi log.
    const expectedWhite = (roomData.creatorIsWhite ? roomData.playerA : roomData.playerB as string).toLowerCase();
    const expectedBlack = (roomData.creatorIsWhite ? roomData.playerB : roomData.playerA as string).toLowerCase();

    if (
      (saved.whiteAddress && saved.whiteAddress.toLowerCase() !== expectedWhite) ||
      (saved.blackAddress && saved.blackAddress.toLowerCase() !== expectedBlack)
    ) {
      console.error(
        `[Relay] Player address mismatch for room ${roomId}. Saved white=${saved.whiteAddress}, black=${saved.blackAddress}. Expected white=${expectedWhite}, black=${expectedBlack}`
      );
      this.sendError(ws, "Player address mismatch with saved game result");
      return;
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const deadline = BigInt(now + 1800); // fresh 30-minute deadline
      const nonce = BigInt(now) * 1000n + BigInt(roomId % 1000);
      const moveCount = saved.moves.length;
      const movesHash = computeMovesHash(saved.moves);
      const outcomeCode = outcomeToCode(saved.outcome);
      const reasonCode = reasonToCode(saved.reason);

      const resultMessage: ResultMessage = {
        matchId: BigInt(roomId),
        winner: saved.winner,
        outcome: outcomeCode,
        reason: reasonCode,
        moveCount,
        movesHash,
        nonce,
        deadline,
      };

      const typedData = buildResultTypedData(
        this.contractAddress,
        resultMessage,
        this.chainId
      );
      const relaySignature = await this.relayAccount.signTypedData(typedData);

      const proposalMsg: ResultProposalMessage = {
        type: "result_proposal",
        roomId,
        winner: saved.winner,
        outcome: outcomeCode,
        reason: reasonCode,
        moveCount,
        movesHash,
        nonce: Number(nonce % BigInt(Number.MAX_SAFE_INTEGER)),
        deadline: Number(deadline),
      };

      const signatureMsg: ServerMessage = {
        type: "result_signature",
        roomId,
        signature: relaySignature,
      };

      // Send proposal and signature exclusively to this requesting socket
      this.send(ws, proposalMsg);
      this.send(ws, signatureMsg);

      const room = this.rooms.get(roomId);
      if (room) {
        room.lastResultProposal = proposalMsg;
        room.lastResultMessage = resultMessage;
      }
    } catch (err: any) {
      this.sendError(ws, `Failed to re-sign result for room ${roomId}: ${err.message}`);
    }
  }

  public send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  public sendError(ws: WebSocket, message: string): void {
    this.send(ws, { type: "error", message });
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      for (const room of this.rooms.values()) {
        room.destroy();
      }
      this.rooms.clear();
      for (const [ws, session] of this.socketSessions.entries()) {
        if (session.authTimeoutTimer) clearTimeout(session.authTimeoutTimer);
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
      this.socketSessions.clear();
      this.ipConnectionCounts.clear();
      this.wss.close(() => resolve());
    });
  }
}
