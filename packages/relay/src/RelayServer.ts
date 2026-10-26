import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import crypto from "node:crypto";
import {
  createPublicClient,
  http,
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

export const ESCROW_ABI = [
  {
    name: "getRoom",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roomId", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "id", type: "uint256" },
          { name: "playerA", type: "address" },
          { name: "playerB", type: "address" },
          { name: "stake", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "startedAt", type: "uint256" },
          { name: "creatorIsWhite", type: "bool" },
          { name: "gameStarted", type: "bool" },
          { name: "singleSignedWinner", type: "address" },
          { name: "singleSignedBond", type: "uint256" },
          { name: "singleSignedAt", type: "uint256" },
          { name: "challenger", type: "address" },
          { name: "challengeBond", type: "uint256" },
          { name: "challengedAt", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
  },
] as const;

export interface RelayServerOptions {
  port?: number;
  server?: any; // For attaching to existing http/https server in tests
  relayPrivateKey?: `0x${string}`;
  contractAddress?: `0x${string}`;
  rpcUrl?: string;
  chainId?: number;
  initialTimeMs?: number;
  publicClient?: any;
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

    const maxPayload = options.maxPayload ?? 4 * 1024; // 4 KB maxPayload

    if (options.server) {
      this.wss = new WebSocketServer({ server: options.server, maxPayload });
    } else {
      this.wss = new WebSocketServer({ port: options.port ?? 8080, maxPayload });
    }

    this.setupWss();
  }

  public get relayAddress(): `0x${string}` {
    return this.relayAccount.address;
  }

  public getRoom(roomId: number): RelayRoom | undefined {
    return this.rooms.get(roomId);
  }

  private setupWss(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
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

    this.routeMessage(ws, parseResult.data, session);
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

        // Verify that the signature was generated by the player for the active proposal
        if (room.lastResultMessage) {
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
          } catch (err: any) {
            this.sendError(ws, `Failed to verify signature: ${err.message}`);
            return;
          }
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

    // Get or Create RelayRoom with immutable colors determined on-chain (Q13)
    let room = this.rooms.get(msg.roomId);
    if (!room) {
      if (this.rooms.size >= this.maxRooms) {
        this.sendError(ws, "Server reached maximum room capacity");
        return;
      }

      const whiteAddr = roomData.creatorIsWhite ? roomData.playerA : roomData.playerB;
      const blackAddr = roomData.creatorIsWhite ? roomData.playerB : roomData.playerA;

      room = new RelayRoom({
        roomId: msg.roomId,
        whiteAddress: whiteAddr as `0x${string}`,
        blackAddress: blackAddr as `0x${string}`,
        initialTimeMs: this.initialTimeMs,
        onGameOver: (r, outcome, reason, winner) => {
          this.handleGameOver(r, outcome, reason, winner).catch((err) => {
            console.error(`[Relay] handleGameOver unhandled rejection for room ${r.roomId}:`, err);
          });
        },
      });
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
