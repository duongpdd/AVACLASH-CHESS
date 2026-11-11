import { expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  HOME_PREVIEW_FEN,
  homePreviewBoard,
} from "@/views/home/preview-position";

it("renders the requested legal opening with every white piece on ranks 1–4", () => {
  expect(new Chess(HOME_PREVIEW_FEN).fen()).toBe(HOME_PREVIEW_FEN);
  expect(homePreviewBoard.filter(Boolean)).toHaveLength(32);
  const white = homePreviewBoard.filter((piece) => piece?.color === "w");
  expect(white).toHaveLength(16);
  expect(white.every((piece) => /^[a-h][1-4]$/.test(piece!.square))).toBe(true);
  expect(homePreviewBoard[0]?.color).toBe("b");
});
