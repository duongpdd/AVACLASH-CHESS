// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

import type { ChessSceneConfig } from "../game/ChessScene";
interface SceneStub {
  config: Partial<ChessSceneConfig>;
  appliedMoves: string[];
  canMoveState: boolean;
  colorState: string;
  init(config?: Partial<ChessSceneConfig>): void;
  create(): void;
  syncMoves(moves: string[]): void;
  setCanMove(value: boolean): void;
  setPlayerColor(value: string): void;
}
const mockSceneInstances: SceneStub[] = [];

vi.mock("phaser", () => {
  class MockGame {
    public config: { scene?: (new () => SceneStub)[] };
    public sceneInstance?: SceneStub;
    constructor(config: { scene?: (new () => SceneStub)[] }) {
      this.config = config;
      if (Array.isArray(config.scene) && config.scene[0]) {
        const SceneClass = config.scene[0];
        this.sceneInstance = new SceneClass();
        this.sceneInstance.init();
      }
    }
    destroy() {}
  }
  return {
    default: {
      AUTO: 0,
      Scale: { NONE: 0, CENTER_BOTH: 0 },
      Game: MockGame,
    },
    AUTO: 0,
    Scale: { NONE: 0, CENTER_BOTH: 0 },
    Game: MockGame,
  };
});

vi.mock("@/game/ChessScene", () => {
  class MockChessScene {
    public config: Partial<ChessSceneConfig> = {};
    public appliedMoves: string[] = [];
    public canMoveState = false;
    public colorState = "spectator";

    constructor() {
      mockSceneInstances.push(this);
    }

    init(config: Partial<ChessSceneConfig> = {}) {
      this.config = config;
      this.appliedMoves = config?.moves ? [...config.moves] : [];
      this.canMoveState = config?.canMove ?? false;
      this.colorState = config?.playerColor ?? "spectator";
    }

    create() {}

    syncMoves(moves: string[]) {
      this.appliedMoves = [...moves];
    }

    setCanMove(canMove: boolean) {
      this.canMoveState = canMove;
    }

    setPlayerColor(color: "w" | "b" | "spectator") {
      this.colorState = color;
    }
  }

  return { ChessScene: MockChessScene };
});

import PhaserGame from "../components/PhaserGame";

describe("PhaserGame Scene Initialization Race Condition (Turn 3c-4 Item 3)", () => {
  beforeEach(() => {
    mockSceneInstances.length = 0;
  });

  it("applies the latest moves, canMove, and playerColor when props change before scene create() runs", async () => {
    // 1. Initial render with default waiting state
    const { rerender } = render(
      <PhaserGame moves={[]} canMove={false} playerColor="spectator" />,
    );

    // Wait for dynamic import inside PhaserGame useEffect to create the ConfiguredChessScene class and instantiate it
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockSceneInstances.length).toBe(1);
    const scene = mockSceneInstances[0];

    // 2. Scene init() was called with initial props
    expect(scene.appliedMoves).toEqual([]);
    expect(scene.canMoveState).toBe(false);

    // 3. Props change BEFORE create() is called (e.g. WebSocket roomState arrives)
    rerender(<PhaserGame moves={["e2e4"]} canMove={true} playerColor="w" />);

    // 4. Now scene create() finishes
    act(() => {
      scene.create();
    });

    // Before fix: scene was not updated because activeSceneRef was null during useEffect and create() did not read refs.
    // Must assert that scene has the latest props:
    expect(scene.appliedMoves).toEqual(["e2e4"]);
    expect(scene.canMoveState).toBe(true);
    expect(scene.colorState).toBe("w");
  });
});
