import type { WebSocket } from "ws";
import {
  ChessGame,
  type ServerMessage,
  type GameOutcome,
  type EndReason,
  type ResultMessage,
  type ResultProposalMessage,
} from "@avaclash/shared";

export interface PlayerConnection {
  address: `0x${string}`;
  ws: WebSocket;
  color: "w" | "b";
  warnings: number;
}

export interface TerminalState {
  outcome: GameOutcome;
  reason: EndReason;
  winner: `0x${string}`;
}

export interface RelayRoomConfig {
  roomId: number;
  whiteAddress: `0x${string}`;
  blackAddress: `0x${string}`;
  creatorIsWhite?: boolean;
  initialTimeMs?: number; // Default 5 mins (300,000 ms)
  waitingTimeoutMs?: number; // Default 10 mins (600,000 ms)
  recoveryGraceMs?: number; // Grace period after restart before clock resumes (default 120s)
  commit?: (room: RelayRoom, terminal?: TerminalState) => Promise<void>;
  onStorageFailure?: () => void;
  onWaitingTimeout?: (room: RelayRoom) => void;
  onGameStarted?: (room: RelayRoom) => void;
  onMoveAccepted?: (room: RelayRoom) => void;
  onGameOver?: (
    room: RelayRoom,
    outcome: GameOutcome,
    reason: EndReason,
    winnerAddress: `0x${string}`,
  ) => void;
}

export class RelayRoom {
  public readonly roomId: number;
  public readonly whiteAddress: `0x${string}`;
  public readonly blackAddress: `0x${string}`;
  public readonly creatorIsWhite?: boolean;
  public status: "waiting" | "active" | "finished" = "waiting";
  public chess: ChessGame;
  public moves: string[] = [];
  public seq: number = 0;

  public whitePlayer?: PlayerConnection;
  public blackPlayer?: PlayerConnection;
  public spectators: Set<WebSocket> = new Set();

  public whiteMs: number;
  public blackMs: number;
  public lastClockUpdate: number = 0;
  public activeTurn: "w" | "b" = "w";

  public drawOfferFrom?: "w" | "b";

  public recoveredAt?: number;
  public recoveryGraceMs: number = 120_000;
  private recoveryTimer?: NodeJS.Timeout;

  private clockInterval?: NodeJS.Timeout;
  private waitingTimeoutTimer?: NodeJS.Timeout;
  private commit?: RelayRoomConfig["commit"];
  private onStorageFailure?: () => void;
  private commandTail: Promise<unknown> = Promise.resolve();
  private pendingSends?: Array<() => void>;
  private pendingEffects?: Array<() => void>;
  private pendingTerminal?: TerminalState;
  private storageFailed = false;
  private onWaitingTimeout?: (room: RelayRoom) => void;
  private onGameStarted?: (room: RelayRoom) => void;
  private onMoveAccepted?: (room: RelayRoom) => void;
  private onGameOver?: (
    room: RelayRoom,
    outcome: GameOutcome,
    reason: EndReason,
    winnerAddress: `0x${string}`,
  ) => void;

  // Stored proposal for verifying client result_signatures
  public lastResultProposal?: ResultProposalMessage;
  public lastResultMessage?: ResultMessage;

  // Signatures collected for 2-of-3 settlement
  public signatures: Map<`0x${string}`, `0x${string}`> = new Map();

  constructor(config: RelayRoomConfig) {
    this.roomId = config.roomId;
    this.whiteAddress = config.whiteAddress.toLowerCase() as `0x${string}`;
    this.blackAddress = config.blackAddress.toLowerCase() as `0x${string}`;
    this.creatorIsWhite = config.creatorIsWhite;
    const initialTime = config.initialTimeMs ?? 5 * 60 * 1000;
    this.whiteMs = initialTime;
    this.blackMs = initialTime;
    this.chess = new ChessGame();
    this.commit = config.commit;
    this.onStorageFailure = config.onStorageFailure;
    this.onGameStarted = (r) =>
      this.afterCommit(() => config.onGameStarted?.(r));
    this.onMoveAccepted = (r) =>
      this.afterCommit(() => config.onMoveAccepted?.(r));
    this.onGameOver = (r, outcome, reason, winner) => {
      this.pendingTerminal = { outcome, reason, winner };
      this.afterCommit(() => config.onGameOver?.(r, outcome, reason, winner));
    };
    this.onWaitingTimeout = config.onWaitingTimeout;

    // Timeout waiting room after 10 minutes if opponent never joins
    const waitingMs = config.waitingTimeoutMs ?? 10 * 60 * 1000;
    this.waitingTimeoutTimer = setTimeout(() => {
      void this.run(() => {
        if (this.status === "waiting") {
          this.closeAllSockets("Waiting room timed out after 10m");
          this.destroy();
          this.onWaitingTimeout?.(this);
        }
      }).catch(() => {});
    }, waitingMs);

    if (config.recoveryGraceMs !== undefined) {
      this.recoveryGraceMs = config.recoveryGraceMs;
    }
  }

  private afterCommit(effect: () => void): void {
    if (this.pendingEffects) this.pendingEffects.push(effect);
    else effect();
  }

  /** Serialize timer/actions and withhold acknowledgements until durable commit. */
  public run<T>(action: () => T, forceSave = false): Promise<T> {
    if (!this.commit) {
      try {
        return Promise.resolve(action());
      } catch (error) {
        return Promise.reject(error);
      }
    }
    const operation = this.commandTail.then(async () => {
      if (this.storageFailed) throw Error("Room storage unavailable.");
      const before = `${this.status}:${this.seq}`;
      this.pendingSends = [];
      this.pendingEffects = [];
      this.pendingTerminal = undefined;
      try {
        const result = action();
        if (
          (forceSave && this.status !== "finished") ||
          before !== `${this.status}:${this.seq}`
        )
          await this.commit!(this, this.pendingTerminal);
        const sends = this.pendingSends;
        const effects = this.pendingEffects;
        this.pendingSends = undefined;
        this.pendingEffects = undefined;
        for (const send of sends) send();
        for (const effect of effects) effect();
        return result;
      } catch {
        this.pendingSends = undefined;
        this.pendingEffects = undefined;
        this.failStorage();
        throw Error("Could not save room. Reconnect after relay restart.");
      }
    });
    this.commandTail = operation.catch(() => {});
    return operation;
  }

  public failStorage(): void {
    if (this.storageFailed) return;
    this.storageFailed = true;
    this.destroy();
    this.closeAllSockets("Storage unavailable. Reconnect after relay restart.");
    this.onStorageFailure?.();
  }

  public setRecovered(
    recoveredAt: number = Date.now(),
    graceMs: number = 120_000,
  ): void {
    this.recoveredAt = recoveredAt;
    this.recoveryGraceMs = graceMs;
    this.lastClockUpdate = Date.now();
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
    this.recoveryTimer = setTimeout(() => {
      void this.run(() => this.clearRecovery()).catch(() => {});
    }, graceMs);
  }

  public clearRecovery(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    this.recoveredAt = undefined;
    this.lastClockUpdate = Date.now();
  }

  public addPlayer(
    address: `0x${string}`,
    ws: WebSocket,
  ): "w" | "b" | "spectator" {
    const addr = address.toLowerCase() as `0x${string}`;

    if (addr === this.whiteAddress) {
      if (this.whitePlayer && this.whitePlayer.ws !== ws) {
        try {
          this.whitePlayer.ws.close(4000, "Replaced by new connection");
        } catch {
          // ignore
        }
      }
      this.whitePlayer = {
        address,
        ws,
        color: "w",
        warnings: this.whitePlayer?.warnings ?? 0,
      };
      if (this.blackPlayer) {
        if (this.status === "waiting") {
          this.startGame();
        } else if (this.status === "active") {
          if (this.recoveredAt !== undefined) {
            this.clearRecovery();
          }
          if (!this.clockInterval) {
            this.startClock();
          }
        }
      }
      return "w";
    }

    if (addr === this.blackAddress) {
      if (this.blackPlayer && this.blackPlayer.ws !== ws) {
        try {
          this.blackPlayer.ws.close(4000, "Replaced by new connection");
        } catch {
          // ignore
        }
      }
      this.blackPlayer = {
        address,
        ws,
        color: "b",
        warnings: this.blackPlayer?.warnings ?? 0,
      };
      if (this.whitePlayer) {
        if (this.status === "waiting") {
          this.startGame();
        } else if (this.status === "active") {
          if (this.recoveredAt !== undefined) {
            this.clearRecovery();
          }
          if (!this.clockInterval) {
            this.startClock();
          }
        }
      }
      return "b";
    }

    // Not assigned to this room as player -> add as spectator
    this.spectators.add(ws);
    return "spectator";
  }

  public addSpectator(ws: WebSocket): void {
    this.spectators.add(ws);
  }

  public removeSocket(ws: WebSocket): void {
    if (this.whitePlayer?.ws === ws) {
      this.whitePlayer = undefined;
    }
    if (this.blackPlayer?.ws === ws) {
      this.blackPlayer = undefined;
    }
    this.spectators.delete(ws);
  }

  public startGame(): void {
    if (this.status !== "waiting" || !this.whitePlayer || !this.blackPlayer)
      return;

    if (this.waitingTimeoutTimer) {
      clearTimeout(this.waitingTimeoutTimer);
      this.waitingTimeoutTimer = undefined;
    }

    this.status = "active";
    this.lastClockUpdate = Date.now();
    this.activeTurn = "w";

    this.startClock();
    this.broadcastRoomState();
    this.onGameStarted?.(this);
  }

  public startClock(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);

    this.clockInterval = setInterval(() => {
      void this.run(() => {
        if (this.status !== "active") {
          if (this.clockInterval) clearInterval(this.clockInterval);
          return;
        }

        // If in recovery grace period after server restart:
        // Clock stays paused until both players are present OR grace timeout elapses
        if (this.recoveredAt !== undefined) {
          if (this.whitePlayer && this.blackPlayer) {
            this.clearRecovery();
          } else if (Date.now() >= this.recoveredAt + this.recoveryGraceMs) {
            this.clearRecovery();
          } else {
            this.lastClockUpdate = Date.now();
            return;
          }
        }

        this.updateClock();
      }).catch(() => {});
    }, 200);
  }

  /** Charge elapsed time before accepting an action, including between timer ticks. */
  public updateClock(): boolean {
    if (this.status !== "active") return false;
    if (this.recoveredAt !== undefined) return true;
    const now = Date.now();
    const elapsed = Math.max(0, now - this.lastClockUpdate);
    this.lastClockUpdate = now;
    if (this.activeTurn === "w") {
      this.whiteMs = Math.max(0, this.whiteMs - elapsed);
      if (this.whiteMs === 0) this.handleTimeout("w");
    } else {
      this.blackMs = Math.max(0, this.blackMs - elapsed);
      if (this.blackMs === 0) this.handleTimeout("b");
    }
    return this.status === "active";
  }

  public handleTimeout(loserColor: "w" | "b"): void {
    if (this.status !== "active") return;
    this.status = "finished";
    if (this.clockInterval) clearInterval(this.clockInterval);

    const outcome: GameOutcome = loserColor === "w" ? "black" : "white";
    const winner = outcome === "white" ? this.whiteAddress : this.blackAddress;

    this.broadcast({
      type: "timeout",
      roomId: this.roomId,
      player: loserColor,
    });

    this.onGameOver?.(this, outcome, "timeout", winner);
  }

  public handleMove(playerWs: WebSocket, seq: number, uci: string): boolean {
    if (this.status !== "active") return false;

    // Check sender is the current turn player
    const expectedPlayer =
      this.activeTurn === "w" ? this.whitePlayer : this.blackPlayer;
    if (!expectedPlayer || expectedPlayer.ws !== playerWs) return false;

    // Sequence must be strictly sequential
    if (seq !== this.seq) return false;

    if (this.recoveredAt !== undefined) this.clearRecovery();
    if (!this.updateClock()) return false;

    // Execute move on chess engine
    const success = this.chess.makeMove(uci);
    if (!success) return false;

    this.moves.push(uci);
    this.seq++;
    this.drawOfferFrom = undefined; // Move clears any pending draw offer

    // Switch turn
    this.activeTurn = this.activeTurn === "w" ? "b" : "w";

    // Broadcast valid move to everyone
    this.broadcast({
      type: "move",
      roomId: this.roomId,
      seq,
      uci,
    });

    // Broadcast updated clock
    this.broadcast({
      type: "clock_sync",
      roomId: this.roomId,
      whiteMs: this.whiteMs,
      blackMs: this.blackMs,
    });

    this.onMoveAccepted?.(this);

    // Check for game over (checkmate, draw)
    if (this.chess.isGameOver()) {
      this.status = "finished";
      if (this.clockInterval) clearInterval(this.clockInterval);

      const outcome = this.chess.getOutcome();
      const reason = this.chess.getEndReason() ?? "checkmate";

      let winner: `0x${string}` = "0x0000000000000000000000000000000000000000";
      if (outcome === "white") {
        winner = this.whiteAddress;
      } else if (outcome === "black") {
        winner = this.blackAddress;
      }

      this.onGameOver?.(this, outcome, reason, winner);
    }

    return true;
  }

  public handleResign(playerWs: WebSocket): boolean {
    if (this.status !== "active") return false;

    let loser: "w" | "b";
    if (this.whitePlayer?.ws === playerWs) {
      loser = "w";
    } else if (this.blackPlayer?.ws === playerWs) {
      loser = "b";
    } else {
      return false;
    }

    if (!this.updateClock()) return false;

    this.status = "finished";
    if (this.clockInterval) clearInterval(this.clockInterval);

    const outcome: GameOutcome = loser === "w" ? "black" : "white";
    const winner = outcome === "white" ? this.whiteAddress : this.blackAddress;

    this.broadcast({
      type: "resign",
      roomId: this.roomId,
      player: loser,
    });

    this.onGameOver?.(this, outcome, "resign", winner);
    return true;
  }

  public handleDrawOffer(playerWs: WebSocket): boolean {
    if (this.status !== "active") return false;

    let from: "w" | "b";
    if (this.whitePlayer?.ws === playerWs) from = "w";
    else if (this.blackPlayer?.ws === playerWs) from = "b";
    else return false;

    this.drawOfferFrom = from;
    const opponent = from === "w" ? this.blackPlayer : this.whitePlayer;

    if (opponent) {
      this.send(opponent.ws, {
        type: "draw_offer",
        roomId: this.roomId,
      });
    }
    return true;
  }

  public handleDrawAccept(playerWs: WebSocket): boolean {
    if (this.status !== "active" || !this.drawOfferFrom) return false;

    let acceptor: "w" | "b";
    if (this.whitePlayer?.ws === playerWs) acceptor = "w";
    else if (this.blackPlayer?.ws === playerWs) acceptor = "b";
    else return false;

    if (acceptor === this.drawOfferFrom) return false; // Cannot accept own offer
    if (!this.updateClock()) return false;

    this.status = "finished";
    if (this.clockInterval) clearInterval(this.clockInterval);

    this.broadcast({
      type: "draw_accept",
      roomId: this.roomId,
    });

    const zeroAddress: `0x${string}` =
      "0x0000000000000000000000000000000000000000";
    this.onGameOver?.(this, "draw", "draw_agreed", zeroAddress);
    return true;
  }

  public handleDrawDecline(playerWs: WebSocket): boolean {
    if (this.status !== "active" || !this.drawOfferFrom) return false;

    const opponent =
      this.drawOfferFrom === "w" ? this.blackPlayer : this.whitePlayer;
    if (opponent?.ws !== playerWs) return false;

    this.drawOfferFrom = undefined;
    this.broadcast({
      type: "draw_decline",
      roomId: this.roomId,
    });
    return true;
  }

  public handleFocusWarning(
    playerWs: WebSocket,
    warningCount: number,
    _penaltyMs: number,
  ): boolean {
    if (this.status !== "active") return false;

    let playerColor: "w" | "b";
    if (this.whitePlayer?.ws === playerWs) {
      playerColor = "w";
      this.whitePlayer.warnings = warningCount;
    } else if (this.blackPlayer?.ws === playerWs) {
      playerColor = "b";
      this.blackPlayer.warnings = warningCount;
    } else {
      return false;
    }

    // Forward telemetry warning to opponent & spectators (warning-only per Q10/D10, no clock penalty)
    this.broadcast({
      type: "focus_warning",
      player: playerColor,
      warningCount,
      penaltyMs: 0,
    });

    return true;
  }

  public broadcastRoomState(): void {
    const stateMsg: ServerMessage = {
      type: "room_state",
      roomId: this.roomId,
      white: this.whiteAddress,
      black: this.blackAddress,
      moves: this.moves,
      whiteMs: this.whiteMs,
      blackMs: this.blackMs,
      status: this.status,
    };

    this.broadcast(stateMsg);
  }

  public broadcast(msg: ServerMessage): void {
    const raw = JSON.stringify(msg);
    if (this.pendingSends) {
      this.pendingSends.push(() => this.broadcastRaw(raw));
      return;
    }
    this.broadcastRaw(raw);
  }

  private broadcastRaw(raw: string): void {
    if (this.whitePlayer?.ws.readyState === 1) {
      this.whitePlayer.ws.send(raw);
    }
    if (this.blackPlayer?.ws.readyState === 1) {
      this.blackPlayer.ws.send(raw);
    }
    for (const spec of this.spectators) {
      if (spec.readyState === 1) {
        spec.send(raw);
      }
    }
  }

  public send(ws: WebSocket, msg: ServerMessage): void {
    if (this.pendingSends) {
      const raw = JSON.stringify(msg);
      this.pendingSends.push(() => {
        if (ws.readyState === 1) ws.send(raw);
      });
      return;
    }
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  public closeAllSockets(reason: string = "Room closed"): void {
    if (this.whitePlayer?.ws) {
      try {
        this.whitePlayer.ws.close(4002, reason);
      } catch {
        // ignore
      }
    }
    if (this.blackPlayer?.ws) {
      try {
        this.blackPlayer.ws.close(4002, reason);
      } catch {
        // ignore
      }
    }
    for (const spec of this.spectators) {
      try {
        spec.close(4002, reason);
      } catch {
        // ignore
      }
    }
    this.spectators.clear();
  }

  public destroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = undefined;
    }
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    if (this.waitingTimeoutTimer) {
      clearTimeout(this.waitingTimeoutTimer);
      this.waitingTimeoutTimer = undefined;
    }
    this.spectators.clear();
  }
}
