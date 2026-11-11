import { expect, it, vi } from "vitest";
import { ChessScene } from "@/game/chess-scene";
import { DEFAULT_THEME } from "@/game/theme";

const { fillStyle, text } = vi.hoisted(() => ({
  fillStyle: vi.fn(),
  text: vi.fn().mockImplementation(() => ({
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  })),
}));

vi.mock("phaser", () => {
  class Scene {
    add = {
      graphics: () => ({
        clear: vi.fn(),
        fillStyle,
        fillRect: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
      }),
      text,
    };
    scale = { width: 464, height: 464 };
    input = { on: vi.fn() };
  }
  return { Scene, default: { Scene } };
});

it("draws the same squares, coordinate labels and piece styles with the explicit default", () => {
  function draw(theme?: typeof DEFAULT_THEME) {
    fillStyle.mockClear();
    text.mockClear();
    const scene = new ChessScene();
    scene.init({ boardSize: 464, flipBoard: false, moves: ["e2e4"], theme });
    scene.create();
    scene.shutdown();
    return { fills: [...fillStyle.mock.calls], labels: [...text.mock.calls] };
  }

  const withDefault = draw(DEFAULT_THEME);
  expect(withDefault).toEqual(draw());
  expect(withDefault.fills).toContainEqual([0xdbd2e9, 1]);
  expect(withDefault.fills).toContainEqual([0x75618f, 1]);
  expect(withDefault.fills).toContainEqual([0xc4a5e8, 1]);
  expect(withDefault.labels).toContainEqual([
    4,
    3,
    "8",
    expect.objectContaining({ color: "#75618f" }),
  ]);
  expect(withDefault.labels).toContainEqual([
    29,
    29,
    "♜",
    expect.objectContaining({
      color: "#251A38",
      stroke: "#F5EFFF",
      strokeThickness: 2.5,
    }),
  ]);
  expect(withDefault.labels).toContainEqual([
    29,
    435,
    "♜",
    expect.objectContaining({
      color: "#F5EFFF",
      stroke: "#160D2B",
      strokeThickness: 4,
    }),
  ]);
});

it("redraws with a new theme while preserving the game state", () => {
  const scene = new ChessScene();
  scene.init({ boardSize: 464, flipBoard: false, moves: ["e2e4"] });
  scene.create();
  const game = scene.getGameState();
  fillStyle.mockClear();

  scene.setTheme({
    ...DEFAULT_THEME,
    board: { ...DEFAULT_THEME.board, lightSquare: 0xe8f3ea },
  });
  expect(fillStyle.mock.calls).toContainEqual([0xe8f3ea, 1]);
  expect(scene.getGameState()).toBe(game);

  scene.setTheme();
  expect(fillStyle.mock.calls).toContainEqual([0xdbd2e9, 1]);
  scene.shutdown();
});
