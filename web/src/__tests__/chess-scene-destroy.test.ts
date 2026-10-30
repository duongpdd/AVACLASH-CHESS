// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("phaser", () => {
  class MockScene {
    public add = {
      graphics: () => ({
        clear: vi.fn(),
        lineStyle: vi.fn(),
        strokeRect: vi.fn(),
        fillStyle: vi.fn(),
        fillRect: vi.fn(),
        fillCircle: vi.fn(),
        strokeCircle: vi.fn(),
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }),
      text: vi.fn().mockReturnValue({
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }),
    };
    public scale = { width: 464, height: 464 };
    public input = { on: vi.fn() };
    constructor(public config: any) {}
  }
  return {
    default: { Scene: MockScene },
    Scene: MockScene,
  };
});

import { ChessScene } from "../game/ChessScene";

describe("ChessScene syncMoves GameState Lifecycle (Turn 3c-4 Item 4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not accumulate timer counts when syncMoves is called 50 times with active clocks", () => {
    const scene = new ChessScene();
    scene.init({
      boardSize: 464,
      flipBoard: false,
      moves: [],
      playerColor: "w",
      canMove: true,
    });
    scene.create();

    // Start clock on initial gameState
    scene.getGameState().startClock();
    expect(vi.getTimerCount()).toBe(1);

    // Call syncMoves 50 times, starting clock on new gameState each time
    for (let i = 0; i < 50; i++) {
      scene.syncMoves(["e2e4"]);
      scene.getGameState().startClock();
    }

    // Without destroy() on old gameState in syncMoves, previous intervals are not cleared -> timer count would be 51.
    // With destroy(), previous timer is cancelled on each syncMoves so timer count remains exactly 1.
    expect(vi.getTimerCount()).toBe(1);

    scene.shutdown();
    expect(vi.getTimerCount()).toBe(0);
  });
});
