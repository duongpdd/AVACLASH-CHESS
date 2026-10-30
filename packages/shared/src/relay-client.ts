import {
  serverMessageSchema,
  type ServerMessage,
  type RoomStateMessage,
  type MoveMessage,
  type ClockSyncMessage,
  type ResignMessage,
  type DrawOfferMessage,
  type DrawAcceptMessage,
  type DrawDeclineMessage,
  type TimeoutMessage,
  type ResultProposalMessage,
  type ResultSignatureMessage,
  type GameFinishedMessage,
  type FocusWarningMessage,
} from "./schemas.js";
import { buildJoinTypedData } from "./eip712.js";
import { ReasonCode } from "./types.js";
import type { SeenTerminalEvents } from "./verify-result.js";

export interface FinishedInfo {
  roomId: number;
  outcome?: number | string;
  reason?: string | number;
  winner?: `0x${string}`;
  moveCount?: number;
}

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface RelayClientOptions {
  url: string;
  WebSocketImpl: any;
  signTypedData: (typedData: any) => Promise<`0x${string}`>;
  getAddress: () => Promise<`0x${string}`> | `0x${string}`;
  chainId: number;
  escrowAddress: `0x${string}`;
}

export type RelayClientEventType =
  | "roomState"
  | "move"
  | "clockSync"
  | "resign"
  | "drawOffer"
  | "drawAccept"
  | "drawDecline"
  | "timeout"
  | "resultProposal"
  | "resultSignature"
  | "gameFinished"
  | "focusWarning"
  | "error"
  | "connectionStatus";

export interface RelayClientEventMap {
  roomState: (state: RoomStateMessage) => void;
  move: (move: MoveMessage) => void;
  clockSync: (clock: ClockSyncMessage) => void;
  resign: (msg: ResignMessage) => void;
  drawOffer: (msg: DrawOfferMessage) => void;
  drawAccept: (msg: DrawAcceptMessage) => void;
  drawDecline: (msg: DrawDeclineMessage) => void;
  timeout: (msg: TimeoutMessage) => void;
  resultProposal: (proposal: ResultProposalMessage) => void;
  resultSignature: (sig: ResultSignatureMessage) => void;
  gameFinished: (msg: GameFinishedMessage) => void;
  focusWarning: (warn: FocusWarningMessage) => void;
  error: (err: { message: string; code?: string }) => void;
  connectionStatus: (status: ConnectionStatus) => void;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

export class RelayClient {
  private options: RelayClientOptions;
  private ws: any = null;
  private roomId: number | null = null;
  private status: ConnectionStatus = "idle";
  private isManuallyClosed: boolean = false;
  private reconnectAttempt: number = 0;
  private reconnectTimer: any = null;

  private authenticated: boolean = false;
  private myAddress: `0x${string}` | null = null;
  private roomState?: RoomStateMessage;
  private moves: string[] = [];
  private finishedInfo: FinishedInfo | null = null;
  private seenTerminalEvents: SeenTerminalEvents = {};
  private lastClockSync: { whiteMs: number; blackMs: number } | null = null;

  private listeners: {
    [K in keyof RelayClientEventMap]?: RelayClientEventMap[K][];
  } = {};

  constructor(options: RelayClientOptions) {
    this.options = options;
  }

  // --- Event Emitter ---

  public on<K extends keyof RelayClientEventMap>(
    event: K,
    listener: RelayClientEventMap[K]
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as RelayClientEventMap[K][]).push(listener);

    return () => {
      this.off(event, listener);
    };
  }

  public off<K extends keyof RelayClientEventMap>(
    event: K,
    listener: RelayClientEventMap[K]
  ): void {
    const list = this.listeners[event];
    if (!list) return;
    this.listeners[event] = (list as any[]).filter((l) => l !== listener);
  }

  private emit<K extends keyof RelayClientEventMap>(
    event: K,
    ...args: Parameters<RelayClientEventMap[K]>
  ): void {
    const list = this.listeners[event];
    if (!list) return;
    for (const listener of [...list]) {
      try {
        (listener as any)(...args);
      } catch (err) {
        console.error(`[RelayClient] Error in listener for event "${event}":`, err);
      }
    }
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.emit("connectionStatus", newStatus);
    }
  }

  // --- Getters ---

  public getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  public isAuthenticated(): boolean {
    return this.authenticated;
  }

  public getRoomState(): RoomStateMessage | undefined {
    return this.roomState;
  }

  public getMoves(): string[] {
    return [...this.moves];
  }

  public getMyAddress(): `0x${string}` | null {
    return this.myAddress;
  }

  public getMyColor(): "w" | "b" | "spectator" | undefined {
    if (!this.roomState || !this.myAddress) return undefined;
    const addr = this.myAddress.toLowerCase();
    if (this.roomState.white.toLowerCase() === addr) return "w";
    if (this.roomState.black && this.roomState.black.toLowerCase() === addr) return "b";
    return "spectator";
  }

  public isMyTurn(): boolean {
    if (!this.authenticated || !this.roomState || this.roomState.status !== "active") {
      return false;
    }
    const myColor = this.getMyColor();
    if (!myColor || myColor === "spectator") return false;

    // In chess, turn alternates starting with White (even moves count)
    const expectedTurn: "w" | "b" = this.moves.length % 2 === 0 ? "w" : "b";
    return myColor === expectedTurn;
  }

  // --- Connection Management ---

  public connect(roomId: number): void {
    this.roomId = roomId;
    this.isManuallyClosed = false;
    this.reconnectAttempt = 0;
    this.initiateSocket();
  }

  public disconnect(): void {
    this.isManuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "Client closed intentionally");
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.authenticated = false;
    this.setStatus("disconnected");
  }

  private initiateSocket(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.authenticated = false;
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    try {
      const WebSocketClass = this.options.WebSocketImpl;
      const wsInstance = new WebSocketClass(this.options.url);
      this.ws = wsInstance;

      const onOpen = () => {
        if (this.ws !== wsInstance) return;
        // Socket opened; waiting for auth_challenge from server
      };

      const onMessage = (event: any) => {
        if (this.ws !== wsInstance) return;
        const raw = typeof event.data === "string" ? event.data : event.data?.toString();
        this.handleIncomingRaw(raw);
      };

      const onClose = () => {
        if (this.ws !== wsInstance) return;
        this.handleSocketClose();
      };

      const onError = (err: any) => {
        if (this.ws !== wsInstance) return;
        this.emit("error", {
          message: `WebSocket error: ${err?.message || "connection error"}`,
        });
      };

      if (typeof wsInstance.addEventListener === "function") {
        wsInstance.addEventListener("open", onOpen);
        wsInstance.addEventListener("message", onMessage);
        wsInstance.addEventListener("close", onClose);
        wsInstance.addEventListener("error", onError);
      } else if (typeof wsInstance.on === "function") {
        wsInstance.on("open", onOpen);
        wsInstance.on("message", (data: any) => onMessage({ data }));
        wsInstance.on("close", onClose);
        wsInstance.on("error", onError);
      }
    } catch (err: any) {
      this.emit("error", { message: `Failed to create WebSocket: ${err?.message}` });
      this.handleSocketClose();
    }
  }

  private handleSocketClose(): void {
    this.ws = null;
    this.authenticated = false;

    if (this.isManuallyClosed) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("reconnecting");
    const delay =
      BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)];
    this.reconnectAttempt++;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isManuallyClosed && this.roomId !== null) {
        this.initiateSocket();
      }
    }, delay);
  }

  // --- Message Handling ---

  private handleIncomingRaw(raw: string): void {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      this.emit("error", { message: "Malformed JSON message received from relay" });
      return;
    }

    const parseResult = serverMessageSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]?.message ?? "Invalid schema";
      this.emit("error", { message: `Relay message schema validation error: ${issue}` });
      return;
    }

    const msg: ServerMessage = parseResult.data;
    this.handleServerMessage(msg);
  }

  private async handleServerMessage(msg: ServerMessage): Promise<void> {
    switch (msg.type) {
      case "auth_challenge": {
        await this.handleAuthChallenge(msg.nonce as `0x${string}`, msg.expiresAt);
        break;
      }

      case "room_state": {
        this.roomState = msg;
        this.moves = [...msg.moves];
        this.authenticated = true;
        this.reconnectAttempt = 0;
        this.setStatus("connected");
        this.emit("roomState", msg);
        break;
      }

      case "move": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;

        if (msg.seq === this.moves.length) {
          this.moves.push(msg.uci);
          this.emit("move", msg);
        } else if (msg.seq > this.moves.length) {
          this.emit("error", {
            message: `Move sequence gap detected (expected ${this.moves.length}, received ${msg.seq}). Resyncing room...`,
          });
          // Reconnect to resync full room state
          if (this.ws) {
            try {
              this.ws.close(1000, "Sequence gap resync");
            } catch {
              // ignore
            }
          }
        }
        break;
      }

      case "clock_sync": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.lastClockSync = { whiteMs: msg.whiteMs, blackMs: msg.blackMs };
        this.seenTerminalEvents.lastClockSync = this.lastClockSync;
        if (this.roomState) {
          this.roomState.whiteMs = msg.whiteMs;
          this.roomState.blackMs = msg.blackMs;
        }
        this.emit("clockSync", msg);
        break;
      }

      case "resign": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.seenTerminalEvents.resignSeen = true;
        if (msg.player) this.seenTerminalEvents.resignerColor = msg.player;
        this.emit("resign", msg);
        break;
      }

      case "draw_offer": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.emit("drawOffer", msg);
        break;
      }

      case "draw_accept": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.seenTerminalEvents.drawAcceptSeen = true;
        this.emit("drawAccept", msg);
        break;
      }

      case "draw_decline": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.emit("drawDecline", msg);
        break;
      }

      case "timeout": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.seenTerminalEvents.timeoutSeen = true;
        if (msg.player) this.seenTerminalEvents.timeoutPlayer = msg.player;
        this.emit("timeout", msg);
        break;
      }

      case "result_proposal": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.emit("resultProposal", msg);
        break;
      }

      case "result_signature": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.emit("resultSignature", msg);
        break;
      }

      case "game_finished": {
        if (this.roomId !== null && msg.roomId !== this.roomId) return;
        this.authenticated = true;
        this.reconnectAttempt = 0;
        this.setStatus("connected");
        if (msg.moves && Array.isArray(msg.moves)) {
          this.moves = [...msg.moves];
        }
        this.finishedInfo = {
          roomId: msg.roomId,
          outcome: msg.outcome,
          reason: msg.reason,
          winner: msg.winner as `0x${string}` | undefined,
          moveCount: msg.moveCount,
          moves: msg.moves,
        };
        const r = typeof msg.reason === "string" ? msg.reason.toLowerCase() : "";
        if (r === "resign" || msg.reason === ReasonCode.Resign) {
          this.seenTerminalEvents.resignSeen = true;
          if (!this.seenTerminalEvents.resignerColor && msg.winner && this.roomState) {
            const w = msg.winner.toLowerCase();
            if (this.roomState.white.toLowerCase() === w) {
              this.seenTerminalEvents.resignerColor = "b";
            } else if (this.roomState.black?.toLowerCase() === w) {
              this.seenTerminalEvents.resignerColor = "w";
            }
          }
        } else if (r === "timeout" || msg.reason === ReasonCode.Timeout) {
          this.seenTerminalEvents.timeoutSeen = true;
          if (!this.seenTerminalEvents.timeoutPlayer && msg.winner && this.roomState) {
            const w = msg.winner.toLowerCase();
            if (this.roomState.white.toLowerCase() === w) {
              this.seenTerminalEvents.timeoutPlayer = "b";
            } else if (this.roomState.black?.toLowerCase() === w) {
              this.seenTerminalEvents.timeoutPlayer = "w";
            }
          }
        } else if (
          r === "agreement" ||
          r === "draw_agreed" ||
          msg.reason === ReasonCode.Agreement
        ) {
          this.seenTerminalEvents.drawAcceptSeen = true;
        }
        if (this.roomState) {
          this.roomState.status = "finished";
        }
        this.emit("gameFinished", msg);
        break;
      }

      case "focus_warning": {
        this.emit("focusWarning", msg);
        break;
      }

      case "error": {
        this.emit("error", { message: msg.message, code: msg.code });
        break;
      }

      case "pong":
      case "spectator_pool":
        // Handled silently
        break;
    }
  }

  private async handleAuthChallenge(
    nonce: `0x${string}`,
    expiresAt: number
  ): Promise<void> {
    if (this.roomId === null) return;

    try {
      const address = await this.options.getAddress();
      this.myAddress = address;

      const typedData = buildJoinTypedData(
        this.roomId,
        address,
        nonce,
        expiresAt,
        this.options.chainId
      );

      const signature = await this.options.signTypedData(typedData);

      this.sendRaw({
        type: "join_room",
        roomId: this.roomId,
        role: "player",
        address,
        signature,
        nonce,
      });
    } catch (err: any) {
      this.emit("error", {
        message: `Failed to authenticate with relay: ${err?.message || "signing error"}`,
      });
    }
  }

  // --- Outgoing Messages ---

  private sendRaw(data: any): void {
    if (!this.ws || this.ws.readyState !== 1) {
      this.emit("error", { message: "Cannot send message: WebSocket is not open" });
      return;
    }
    try {
      this.ws.send(JSON.stringify(data));
    } catch (err: any) {
      this.emit("error", { message: `Send failed: ${err?.message}` });
    }
  }

  public sendMove(uci: string): void {
    if (!this.authenticated || this.roomId === null) {
      throw new Error("Cannot send move: client is not authenticated");
    }
    if (!this.isMyTurn()) {
      throw new Error("Cannot send move: not your turn");
    }

    this.sendRaw({
      type: "move",
      roomId: this.roomId,
      seq: this.moves.length,
      uci,
    });
  }

  public sendResign(): void {
    if (this.roomId === null) return;
    this.sendRaw({ type: "resign", roomId: this.roomId });
  }

  public sendDrawOffer(): void {
    if (this.roomId === null) return;
    this.sendRaw({ type: "draw_offer", roomId: this.roomId });
  }

  public sendDrawAccept(): void {
    if (this.roomId === null) return;
    this.sendRaw({ type: "draw_accept", roomId: this.roomId });
  }

  public sendDrawDecline(): void {
    if (this.roomId === null) return;
    this.sendRaw({ type: "draw_decline", roomId: this.roomId });
  }

  public sendTimeout(): void {
    if (this.roomId === null) return;
    this.sendRaw({ type: "timeout", roomId: this.roomId });
  }

  public sendFocusWarning(
    player: "w" | "b",
    warningCount: number,
    penaltyMs: number
  ): void {
    this.sendRaw({
      type: "focus_warning",
      player,
      warningCount,
      penaltyMs,
    });
  }

  public sendResultSignature(signature: string): void {
    if (this.roomId === null) return;
    this.sendRaw({
      type: "result_signature",
      roomId: this.roomId,
      signature,
    });
  }

  public sendPing(): void {
    this.sendRaw({ type: "ping" });
  }

  public requestResult(roomId?: number): void {
    const targetRoomId = roomId ?? this.roomId;
    if (targetRoomId === null || targetRoomId === undefined) {
      throw new Error("Room ID is required to request result");
    }
    this.sendRaw({
      type: "request_result",
      roomId: targetRoomId,
    });
  }

  public getFinishedInfo(): FinishedInfo | null {
    return this.finishedInfo;
  }

  public getSeenTerminalEvents(): SeenTerminalEvents {
    return { ...this.seenTerminalEvents };
  }

  public getSeenEvents(): SeenTerminalEvents {
    return this.getSeenTerminalEvents();
  }

  public getLastClockSync(): { whiteMs: number; blackMs: number } | null {
    return this.lastClockSync ? { ...this.lastClockSync } : null;
  }
}
