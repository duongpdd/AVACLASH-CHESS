import { describe, expect, it } from "vitest";
import {
  contrast,
  DEFAULT_THEME,
  deltaE,
  readHideOpponentSkin,
  resolveTheme,
  writeHideOpponentSkin,
  type SkinTheme,
} from "../theme";

const skin: SkinTheme = {
  light: 0xe8f3ea,
  dark: 0x53776e,
  lastLight: 0xffe48a,
  lastDark: 0xcbb158,
  whiteFill: 0xfff1d0,
  whiteStroke: 0x0f172a,
  whiteWidth: 4,
  blackFill: 0x112237,
  blackStroke: 0xf8fafc,
  blackWidth: 3,
  shadow: false,
};

describe("cosmetic theme resolution", () => {
  it("preserves the built-in rendering colors and widths", () => {
    expect(resolveTheme({})).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME.board).toEqual({
      lightSquare: 0xead9b5,
      darkSquare: 0xb58863,
      lastMoveLight: 0xf7ec59,
      lastMoveDark: 0xdac331,
      selectedSquare: 0x38bdf8,
      legalMoveDot: 0x10b981,
      captureRing: 0xef4444,
      checkGlow: 0xef4444,
    });
    expect(DEFAULT_THEME.white).toEqual({
      fill: 0xfffbeb,
      stroke: 0x0f172a,
      width: 4,
    });
    expect(DEFAULT_THEME.black).toEqual({
      fill: 0x1e293b,
      stroke: 0xf8fafc,
      width: 2.5,
    });
    expect(DEFAULT_THEME.shadow).toBe(true);
  });

  it("prefers White's board and reads each player's own color and White's shadow", () => {
    const black = {
      ...skin,
      dark: 0x345670,
      blackFill: 0x101040,
      shadow: true,
    };
    const view = resolveTheme({
      whiteBoard: skin,
      blackBoard: black,
      whitePieces: skin,
      blackPieces: black,
    });
    expect(view.boardOwner).toBe("w");
    expect(view.board.darkSquare).toBe(skin.dark);
    expect(view.white.fill).toBe(skin.whiteFill);
    expect(view.black.fill).toBe(black.blackFill);
    expect(view.shadow).toBe(false);
    expect(
      resolveTheme({ blackBoard: black, blackPieces: black }).boardOwner,
    ).toBe("b");
    expect(resolveTheme({ blackPieces: black }).shadow).toBe(true);
  });

  it("rejects an outline that has zero width and a board with indistinguishable squares", () => {
    const invisible = { ...skin, whiteFill: 0xead9b5, whiteWidth: 0 };
    expect(resolveTheme({ whitePieces: invisible }).white).toBe(
      DEFAULT_THEME.white,
    );
    expect(resolveTheme({ whiteBoard: { ...skin, dark: skin.light } })).toBe(
      DEFAULT_THEME,
    );
  });

  it("rejects piece colors that disappear on a custom last-move square", () => {
    const whitePieces = {
      ...skin,
      whiteFill: 0xffffff,
      whiteStroke: 0xffffff,
      whiteWidth: 6,
    };
    const whiteBoard = {
      ...skin,
      light: 0x000000,
      dark: 0x3e3e3e,
      lastLight: 0xffffff,
      lastDark: 0x333333,
    };
    expect(resolveTheme({ whitePieces, whiteBoard }).white).toBe(
      DEFAULT_THEME.white,
    );
  });

  it("falls back to default Black for matching light pieces", () => {
    const black = {
      ...skin,
      blackFill: skin.whiteFill,
      blackStroke: skin.whiteStroke,
    };
    const view = resolveTheme({ whitePieces: skin, blackPieces: black });
    expect(view.white.fill).toBe(skin.whiteFill);
    expect(view.black).toBe(DEFAULT_THEME.black);
  });

  it("falls back to both defaults when White matches default Black", () => {
    const white = {
      ...skin,
      whiteFill: DEFAULT_THEME.black.fill,
      whiteStroke: DEFAULT_THEME.black.stroke,
    };
    const view = resolveTheme({ whitePieces: white, blackPieces: skin });
    expect(view.white).toBe(DEFAULT_THEME.white);
    expect(view.black).toBe(DEFAULT_THEME.black);
  });

  it("accepts distinct chroma at similar luminance", () => {
    const blue = 0x1515c0;
    const red = 0x8c0014;
    expect(contrast(blue, red)).toBeLessThan(1.5);
    expect(deltaE(blue, red)).toBeGreaterThan(50);
    const view = resolveTheme({
      whitePieces: { ...skin, whiteFill: red, whiteStroke: 0xffffff },
      blackPieces: { ...skin, blackFill: blue, blackStroke: 0xffffff },
    });
    expect(view.white.fill).toBe(red);
    expect(view.black.fill).toBe(blue);
  });

  it("produces identical themes for both players and spectators unless a player opts out", () => {
    const input = {
      whitePieces: skin,
      blackPieces: skin,
      whiteBoard: skin,
      blackBoard: skin,
    };
    const forWhite = resolveTheme({ ...input, viewerColor: "w" });
    expect(resolveTheme({ ...input, viewerColor: "b" })).toEqual(forWhite);
    expect(
      resolveTheme({
        ...input,
        viewerColor: "spectator",
        hideOpponentSkin: true,
      }),
    ).toEqual(forWhite);
    const forBlack = resolveTheme({
      ...input,
      viewerColor: "b",
      hideOpponentSkin: true,
    });
    expect(forBlack.board).toBe(DEFAULT_THEME.board);
    expect(forBlack.white).toBe(DEFAULT_THEME.white);
    expect(forBlack.black.fill).toBe(skin.blackFill);
    expect(
      resolveTheme({ ...input, viewerColor: "w", hideOpponentSkin: true })
        .boardOwner,
    ).toBe("w");
  });

  it("persists the preference and handles unavailable storage", () => {
    const values = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    });
    expect(readHideOpponentSkin(storage)).toBe(false);
    writeHideOpponentSkin(true, storage);
    expect(readHideOpponentSkin(storage)).toBe(true);
    const unavailable = () => {
      throw Error("storage blocked");
    };
    expect(readHideOpponentSkin(unavailable)).toBe(false);
    expect(() => writeHideOpponentSkin(true, unavailable)).not.toThrow();
  });
});
