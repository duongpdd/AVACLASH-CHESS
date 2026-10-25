import { WebSocketServer, WebSocket } from "ws";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  clientMessageSchema,
  computeMovesHash,
  outcomeToCode,
  reasonToCode,
  buildResultTypedData,
  FUJI_CHAIN_ID,
  ZERO_ADDRESS,
  type ClientMessage,
  type ServerMessage,
  type ResultMessage,
  type GameOutcome,
  type EndReason,
} from "@avaclash/shared";
import { RelayRoom } from "./RelayRoom.js";

export interface RelayServerOptions {
  port?: number;
  server?: any; // For attaching to existing http/https server in tests
  relayPrivateKey?: `0x${string}`;
  contractAddress?: `0x${string}`;
  chainId?: number;
  initialTimeMs?: number;
}

export class RelayServer {
  public wss: WebSocketServer;
  public rooms: Map<number, RelayRoom> = new Map();
  public relayAccount: PrivateKeyAccount;
  public contractAddress: `0x${string}`;
  public chainId: number;
  public initialTimeMs?: number;

  constructor(options: RelayServerOptions = {}) {
    // Default test key if not specified
    const privateKey =
      options.relayPrivateKey ??
      "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
    this.relayAccount = privateKeyToAccount(privateKey);
    this.contractAddress = options.contractAddress ?? ZERO_ADDRESS;
    this.chainId = options.chainId ?? FUJI_CHAIN_ID;
    this.initialTimeMs = options.initialTimeMs;

    if (options.server) {
      this.wss = new WebSocketServer({ server: options.server });
    } else {
      this.wss = new WebSocketServer({ port: options.port ?? 8080 });
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
    this.wss.on("connection", (ws: WebSocket) => {
      ws.on("message", (raw: string | Buffer) => {
        this.handleRawMessage(ws, raw.toString());
      });

      ws.on("close", () => {
        for (const room of this.rooms.values()) {
          room.removeSocket(ws);
        }
      });
    });
  }

  public handleRawMessage(ws: WebSocket, raw: string): void {
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

    this.routeMessage(ws, parseResult.data);
  }

  public routeMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case "ping": {
        this.send(ws, { type: "pong" });
        break;
      }

      case "join_room": {
        this.handleJoinRoom(ws, msg.roomId, msg.address as `0x${string}`);
        break;
      }

      case "move": {
        const room = this.rooms.get(msg.roomId);
        if (!room) {
          this.sendError(ws, `Room ${msg.roomId} not found`);
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
        if (room) room.handleResign(ws);
        break;
      }

      case "draw_offer": {
        const room = this.rooms.get(msg.roomId);
        if (room) room.handleDrawOffer(ws);
        break;
      }

      case "draw_accept": {
        const room = this.rooms.get(msg.roomId);
        if (room) room.handleDrawAccept(ws);
        break;
      }

      case "draw_decline": {
        const room = this.rooms.get(msg.roomId);
        if (room) room.handleDrawDecline(ws);
        break;
      }

      case "focus_warning": {
        // Forward warning to any room the socket is part of
        for (const room of this.rooms.values()) {
          if (room.whitePlayer?.ws === ws || room.blackPlayer?.ws === ws) {
            room.handleFocusWarning(ws, msg.warningCount, msg.penaltyMs);
            break;
          }
        }
        break;
      }

      case "result_signature": {
        const room = this.rooms.get(msg.roomId);
        if (room) {
          // Broadcast player's signature to the other player and spectators
          room.broadcast({
            type: "result_signature",
            roomId: msg.roomId,
            signature: msg.signature,
          });
        }
        break;
      }

      case "timeout": {
        const room = this.rooms.get(msg.roomId);
        if (room && room.status === "active") {
          // If a player claims timeout, verify and trigger if true
          if (room.whiteMs <= 0) room.handleTimeout("w");
          else if (room.blackMs <= 0) room.handleTimeout("b");
        }
        break;
      }
    }
  }

  public handleJoinRoom(ws: WebSocket, roomId: number, address: `0x${string}`): void {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new RelayRoom({
        roomId,
        initialTimeMs: this.initialTimeMs,
        onGameOver: (r, outcome, reason, winner) => {
          this.handleGameOver(r, outcome, reason, winner);
        },
      });
      this.rooms.set(roomId, room);
    }

    room.addPlayer(address, ws);
    room.broadcastRoomState();
  }

  public async handleGameOver(
    room: RelayRoom,
    outcome: GameOutcome,
    reason: EndReason,
    winnerAddress: `0x${string}`,
  ): Promise<void> {
    const outcomeCode = outcomeToCode(outcome);
    const reasonCode = reasonToCode(reason);
    const movesHash = computeMovesHash(room.moves);
    const nonce = BigInt(Math.floor(Date.now() / 1000));
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour validity

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
    const proposalMsg: ServerMessage = {
      type: "result_proposal",
      roomId: room.roomId,
      winner: winnerAddress,
      outcome: outcomeCode,
      reason: reasonCode,
      moveCount: room.moves.length,
      movesHash,
      nonce: Number(nonce),
      deadline: Number(deadline),
    };
    room.broadcast(proposalMsg);

    // 3. Broadcast Relay's signature (first of the 2-of-3 signatures!)
    const signatureMsg: ServerMessage = {
      type: "result_signature",
      roomId: room.roomId,
      signature: relaySignature,
    };
    room.broadcast(signatureMsg);
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
      this.wss.close(() => resolve());
    });
  }
}
