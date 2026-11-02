import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { RelayRoom } from "../src/RelayRoom.js";

const white = "0x1111111111111111111111111111111111111111";
const black = "0x2222222222222222222222222222222222222222";
const rooms: RelayRoom[] = [];
function socket() {
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
}
function setup() {
  const ended = vi.fn();
  const room = new RelayRoom({
    roomId: 0,
    whiteAddress: white,
    blackAddress: black,
    initialTimeMs: 1000,
    onGameOver: ended,
  });
  rooms.push(room);
  const w = socket(),
    b = socket();
  room.addPlayer(white, w);
  room.addPlayer(black, b);
  return { room, w, b, ended };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000000);
});
afterEach(() => {
  rooms.splice(0).forEach((room) => room.destroy());
  vi.useRealTimers();
});

describe("Relay clock and room authorization regressions", () => {
  it("rejects a checkmating move after time expires between clock ticks", () => {
    const { room, w, b, ended } = setup();
    room.handleMove(w, 0, "f2f3");
    room.handleMove(b, 1, "e7e5");
    room.handleMove(w, 2, "g2g4");
    room.blackMs = 50;
    vi.setSystemTime(Date.now() + 100);
    expect(room.handleMove(b, 3, "d8h4")).toBe(false);
    expect(room.moves).toHaveLength(3);
    expect(ended).toHaveBeenCalledWith(room, "white", "timeout", white);
  });
  it("preserves elapsed thinking time when a socket is replaced repeatedly", () => {
    const { room } = setup();
    for (let i = 0; i < 10; i++) {
      vi.setSystemTime(Date.now() + 100);
      room.addPlayer(white, socket());
    }
    room.updateClock();
    expect(room.whiteMs).toBe(0);
    expect(room.status).toBe("finished");
  });
  it("charges the old turn before switching to the next player", () => {
    const { room, w } = setup();
    vi.setSystemTime(Date.now() + 150);
    expect(room.handleMove(w, 0, "e2e4")).toBe(true);
    expect(room.whiteMs).toBe(850);
    expect(room.blackMs).toBe(1000);
  });
  it("does not allow an expired player to accept a draw", () => {
    const { room, w, b, ended } = setup();
    room.handleDrawOffer(b);
    vi.setSystemTime(Date.now() + 1001);
    expect(room.handleDrawAccept(w)).toBe(false);
    expect(ended).toHaveBeenCalledWith(room, "black", "timeout", black);
  });
  it("only lets the opponent decline a draw offer", () => {
    const { room, w, b } = setup();
    room.handleDrawOffer(w);
    expect(room.handleDrawDecline(socket())).toBe(false);
    expect(room.handleDrawDecline(w)).toBe(false);
    expect(room.drawOfferFrom).toBe("w");
    expect(room.handleDrawDecline(b)).toBe(true);
  });
  it("broadcasts focus warnings without claiming a clock penalty", () => {
    const { room, w, b } = setup();
    room.handleFocusWarning(w, 5, 10000);
    expect(room.whiteMs).toBe(1000);
    expect(b.send).toHaveBeenLastCalledWith(
      JSON.stringify({
        type: "focus_warning",
        player: "w",
        warningCount: 5,
        penaltyMs: 0,
      }),
    );
  });
});
