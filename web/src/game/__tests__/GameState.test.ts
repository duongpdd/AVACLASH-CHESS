import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameState } from "../GameState";

describe("GameState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes correctly with 5 minute clocks and white to move", () => {
    const state = new GameState();
    expect(state.currentTurn()).toBe("white");
    expect(state.isGameOver()).toBe(false);
    expect(state.getMoves()).toEqual([]);
    expect(state.getSans()).toEqual([]);
    expect(state.getClocks()).toEqual({ whiteMs: 300000, blackMs: 300000 });
    state.destroy();
  });

  it("handles valid moves and alternates turns", () => {
    const onMove = vi.fn();
    const onTurnChange = vi.fn();
    const state = new GameState(300000, { onMove, onTurnChange });

    const move1 = state.tryMove("e2", "e4");
    expect(move1).toBe(true);
    expect(state.currentTurn()).toBe("black");
    expect(state.getMoves()).toEqual(["e2e4"]);
    expect(state.getSans()).toEqual(["e4"]);
    expect(onMove).toHaveBeenCalledWith("e2e4", "e4", expect.any(String));
    expect(onTurnChange).toHaveBeenCalledWith("black");

    const move2 = state.tryMove("e7", "e5");
    expect(move2).toBe(true);
    expect(state.currentTurn()).toBe("white");
    expect(state.getMoves()).toEqual(["e2e4", "e7e5"]);
    expect(state.getSans()).toEqual(["e4", "e5"]);
    expect(onTurnChange).toHaveBeenCalledWith("white");

    state.destroy();
  });

  it("rejects illegal moves without changing state", () => {
    const state = new GameState();
    const invalid = state.tryMove("e2", "e5"); // Pawn cannot jump 3 squares
    expect(invalid).toBe(false);
    expect(state.currentTurn()).toBe("white");
    expect(state.getMoves()).toEqual([]);
    state.destroy();
  });

  it("handles kingside and queenside castling", () => {
    const state = new GameState();
    // Prepare for kingside castling
    state.tryMove("e2", "e4");
    state.tryMove("e7", "e5");
    state.tryMove("g1", "f3");
    state.tryMove("b8", "c6");
    state.tryMove("f1", "c4");
    state.tryMove("g8", "f6");
    // White castles kingside: e1g1
    const castle = state.tryMove("e1", "g1");
    expect(castle).toBe(true);
    expect(state.getSans()).toContain("O-O");
    state.destroy();
  });

  it("handles en passant capture", () => {
    const state = new GameState();
    state.tryMove("e2", "e4");
    state.tryMove("a7", "a6");
    state.tryMove("e4", "e5");
    state.tryMove("d7", "d5");
    // En passant capture e5xd6
    const ep = state.tryMove("e5", "d6");
    expect(ep).toBe(true);
    expect(state.getMoves()).toContain("e5d6");
    expect(state.getSans()).toContain("exd6");
    state.destroy();
  });

  it("detects pawn promotion and executes promotion moves", () => {
    const state = new GameState();
    // Set up a game where a pawn promotes
    // 1. e4 d5 2. exd5 c6 3. dxc6 Nf6 4. cxb7 e6
    state.tryMove("e2", "e4");
    state.tryMove("d7", "d5");
    state.tryMove("e4", "d5");
    state.tryMove("c7", "c6");
    state.tryMove("d5", "c6");
    state.tryMove("g8", "f6");
    state.tryMove("c6", "b7");
    state.tryMove("e7", "e6");

    expect(state.needsPromotion("b7", "b8")).toBe(true);
    expect(state.needsPromotion("b7", "a8")).toBe(true);
    expect(state.needsPromotion("e6", "e5")).toBe(false);

    // Promote to Queen by capturing rook on a8
    const promoted = state.tryMove("b7", "a8", "q");
    expect(promoted).toBe(true);
    expect(state.getMoves()).toContain("b7a8q");
    expect(state.getSans()[state.getSans().length - 1]).toContain("bxa8=Q");
    state.destroy();
  });

  it("detects check and notifies listener", () => {
    const onCheck = vi.fn();
    const state = new GameState(300000, { onCheck });
    // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 (ready for check) or direct check: 1. e4 f5 2. Qh5+
    state.tryMove("e2", "e4");
    state.tryMove("f7", "f5");
    state.tryMove("d1", "h5");
    expect(onCheck).toHaveBeenCalledWith("black");
    state.destroy();
  });

  it("detects Fool's Mate checkmate and declares Black winner", () => {
    const onGameOver = vi.fn();
    const state = new GameState(300000, { onGameOver });
    state.tryMove("f2", "f3");
    state.tryMove("e7", "e5");
    state.tryMove("g2", "g4");
    state.tryMove("d8", "h4"); // Fool's Mate!

    expect(state.isGameOver()).toBe(true);
    expect(onGameOver).toHaveBeenCalledWith("black", "checkmate");
    state.destroy();
  });

  it("detects Scholar's Mate checkmate and declares White winner", () => {
    const onGameOver = vi.fn();
    const state = new GameState(300000, { onGameOver });
    state.tryMove("e2", "e4");
    state.tryMove("e7", "e5");
    state.tryMove("d1", "h5");
    state.tryMove("b8", "c6");
    state.tryMove("f1", "c4");
    state.tryMove("g8", "f6");
    state.tryMove("h5", "f7"); // Scholar's Mate!

    expect(state.isGameOver()).toBe(true);
    expect(onGameOver).toHaveBeenCalledWith("white", "checkmate");
    state.destroy();
  });

  it("handles resignation", () => {
    const onGameOver = vi.fn();
    const state = new GameState(300000, { onGameOver });
    state.resign("white");

    expect(state.isGameOver()).toBe(true);
    expect(onGameOver).toHaveBeenCalledWith("black", "resign");

    // Cannot make moves after resignation
    expect(state.tryMove("e2", "e4")).toBe(false);
    state.destroy();
  });

  it("handles mutual draw agreement", () => {
    const onGameOver = vi.fn();
    const state = new GameState(300000, { onGameOver });
    state.acceptDraw();

    expect(state.isGameOver()).toBe(true);
    expect(onGameOver).toHaveBeenCalledWith("draw", "draw_agreed");
    state.destroy();
  });

  it("operates clocks and detects timeout for white", () => {
    const onClockTick = vi.fn();
    const onGameOver = vi.fn();
    const state = new GameState(1000, { onClockTick, onGameOver }); // 1 second clock

    state.startClock();
    expect(state.getClocks().whiteMs).toBe(1000);

    // Advance 500ms
    vi.advanceTimersByTime(500);
    expect(state.getClocks().whiteMs).toBeLessThanOrEqual(500);
    expect(state.getClocks().blackMs).toBe(1000); // Black clock unchanged

    // Advance another 600ms -> timeout for White
    vi.advanceTimersByTime(600);
    expect(state.isGameOver()).toBe(true);
    expect(onGameOver).toHaveBeenCalledWith("black", "timeout");

    state.destroy();
  });

  it("operates clocks and detects timeout for black", () => {
    const onGameOver = vi.fn();
    const state = new GameState(1000, { onGameOver });

    state.startClock();
    state.tryMove("e2", "e4"); // Turn switches to Black

    // Advance 1100ms -> timeout for Black
    vi.advanceTimersByTime(1100);
    expect(state.isGameOver()).toBe(true);
    expect(onGameOver).toHaveBeenCalledWith("white", "timeout");

    state.destroy();
  });

  it("returns legal moves and validates square selection", () => {
    const state = new GameState();
    // e2 pawn can move to e3 or e4
    const e2Moves = state.getLegalMovesFrom("e2");
    expect(e2Moves).toContain("e3");
    expect(e2Moves).toContain("e4");

    // White can select e2
    expect(state.canSelectSquare("e2")).toBe(true);
    // White cannot select e7 (black pawn)
    expect(state.canSelectSquare("e7")).toBe(false);
    // White cannot select empty square e4
    expect(state.canSelectSquare("e4")).toBe(false);

    state.destroy();
  });
});
