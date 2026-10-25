import type { WebSocket } from "ws";
import {
  ChessGame,
  computeMovesHash,
  outcomeToCode,
  reasonToCode,
  type ServerMessage,
  type ClientMessage,
  type GameOutcome,
  type EndReason,
} from "@avaclash/shared";

export interface PlayerConnection {
  address: `0x${string}`;
  ws: WebSocket;
  color: "w" | "b";
  warnings: number;
}

export interface RelayRoomConfig {
  roomId: number;
  initialTimeMs?: number; // Default 5 mins (300,000 ms)
  onGameOver?: (
    room: RelayRoom,
    outcome: GameOutcome,
    reason: EndReason,
    winnerAddress: `0x${string}`,
  ) => void;
}

export class RelayRoom {
  public readonly roomId: number;
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

  private clockInterval?: NodeJS.Timeout;
  private onGameOver?: (
    room: RelayRoom,
    outcome: GameOutcome,
    reason: EndReason,
    winnerAddress: `0x${string}`,
  ) => void;

  // Signatures collected for 2-of-3 settlement
  public signatures: Map<`0x${string}`, `0x${string}`> = new Map();

  constructor(config: RelayRoomConfig) {
    this.roomId = config.roomId;
    const initialTime = config.initialTimeMs ?? 5 * 60 * 1000;
    this.whiteMs = initialTime;
    this.blackMs = initialTime;
    this.chess = new ChessGame();
    this.onGameOver = config.onGameOver;
  }

  public addPlayer(address: `0x${string}`, ws: WebSocket): "w" | "b" | "spectator" {
    // If player already connected in this room, rebind socket
    if (this.whitePlayer?.address.toLowerCase() === address.toLowerCase()) {
      this.whitePlayer.ws = ws;
      return "w";
    }
    if (this.blackPlayer?.address.toLowerCase() === address.toLowerCase()) {
      this.blackPlayer.ws = ws;
      return "b";
    }

    if (!this.whitePlayer) {
      this.whitePlayer = { address, ws, color: "w", warnings: 0 };
      return "w";
    }

    if (!this.blackPlayer) {
      this.blackPlayer = { address, ws, color: "b", warnings: 0 };
      this.startGame();
      return "b";
    }

    // Room is full for players -> join as spectator
    this.spectators.add(ws);
    return "spectator";
  }

  public removeSocket(ws: WebSocket): void {
    this.spectators.delete(ws);
  }

  public startGame(): void {
    if (this.status !== "waiting" || !this.whitePlayer || !this.blackPlayer) return;

    this.status = "active";
    this.lastClockUpdate = Date.now();
    this.activeTurn = "w";

    this.startClock();
    this.broadcastRoomState();
  }

  private startClock(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);

    this.clockInterval = setInterval(() => {
      if (this.status !== "active") {
        if (this.clockInterval) clearInterval(this.clockInterval);
        return;
      }

      const now = Date.now();
      const elapsed = now - this.lastClockUpdate;
      this.lastClockUpdate = now;

      if (this.activeTurn === "w") {
        this.whiteMs = Math.max(0, this.whiteMs - elapsed);
        if (this.whiteMs === 0) {
          this.handleTimeout("w");
        }
      } else {
        this.blackMs = Math.max(0, this.blackMs - elapsed);
        if (this.blackMs === 0) {
          this.handleTimeout("b");
        }
      }
    }, 200);
  }

  public handleTimeout(loserColor: "w" | "b"): void {
    if (this.status !== "active") return;
    this.status = "finished";
    if (this.clockInterval) clearInterval(this.clockInterval);

    const outcome: GameOutcome = loserColor === "w" ? "black" : "white";
    const winner = outcome === "white" ? this.whitePlayer!.address : this.blackPlayer!.address;

    this.broadcast({
      type: "timeout",
      roomId: this.roomId,
    });

    this.onGameOver?.(this, outcome, "timeout", winner);
  }

  public handleMove(playerWs: WebSocket, seq: number, uci: string): boolean {
    if (this.status !== "active") return false;

    // Check sender is the current turn player
    const expectedPlayer = this.activeTurn === "w" ? this.whitePlayer : this.blackPlayer;
    if (!expectedPlayer || expectedPlayer.ws !== playerWs) return false;

    // Sequence must be strictly sequential
    if (seq !== this.seq) return false;

    // Execute move on chess engine
    const success = this.chess.makeMove(uci);
    if (!success) return false;

    // Update clocks
    const now = Date.now();
    const elapsed = now - this.lastClockUpdate;
    this.lastClockUpdate = now;

    if (this.activeTurn === "w") {
      this.whiteMs = Math.max(0, this.whiteMs - elapsed);
    } else {
      this.blackMs = Math.max(0, this.blackMs - elapsed);
    }

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

    // Check for game over (checkmate, draw)
    if (this.chess.isGameOver()) {
      this.status = "finished";
      if (this.clockInterval) clearInterval(this.clockInterval);

      const outcome = this.chess.getOutcome();
      const reason = this.chess.getEndReason() ?? "checkmate";

      let winner: `0x${string}` = "0x0000000000000000000000000000000000000000";
      if (outcome === "white" && this.whitePlayer) {
        winner = this.whitePlayer.address;
      } else if (outcome === "black" && this.blackPlayer) {
        winner = this.blackPlayer.address;
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

    this.status = "finished";
    if (this.clockInterval) clearInterval(this.clockInterval);

    const outcome: GameOutcome = loser === "w" ? "black" : "white";
    const winner = outcome === "white" ? this.whitePlayer!.address : this.blackPlayer!.address;

    this.broadcast({
      type: "resign",
      roomId: this.roomId,
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

    this.status = "finished";
    if (this.clockInterval) clearInterval(this.clockInterval);

    this.broadcast({
      type: "draw_accept",
      roomId: this.roomId,
    });

    const zeroAddress: `0x${string}` = "0x0000000000000000000000000000000000000000";
    this.onGameOver?.(this, "draw", "draw_agreed", zeroAddress);
    return true;
  }

  public handleDrawDecline(playerWs: WebSocket): boolean {
    if (this.status !== "active" || !this.drawOfferFrom) return false;

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
    penaltyMs: number,
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
      penaltyMs,
    });

    return true;
  }

  public broadcastRoomState(): void {
    if (!this.whitePlayer) return;

    const stateMsg: ServerMessage = {
      type: "room_state",
      roomId: this.roomId,
      white: this.whitePlayer.address,
      black: this.blackPlayer?.address,
      moves: this.moves,
      whiteMs: this.whiteMs,
      blackMs: this.blackMs,
      status: this.status,
    };

    this.broadcast(stateMsg);
  }

  public broadcast(msg: ServerMessage): void {
    const raw = JSON.stringify(msg);
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
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  public destroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = undefined;
    }
    this.spectators.clear();
  }
}
