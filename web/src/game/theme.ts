export interface SkinTheme {
  light: number;
  dark: number;
  lastLight: number;
  lastDark: number;
  whiteFill: number;
  whiteStroke: number;
  whiteWidth: number;
  blackFill: number;
  blackStroke: number;
  blackWidth: number;
  shadow: boolean;
}

export interface BoardTheme {
  lightSquare: number;
  darkSquare: number;
  lastMoveLight: number;
  lastMoveDark: number;
  selectedSquare: number;
  legalMoveDot: number;
  captureRing: number;
  checkGlow: number;
}

export interface PieceStyle {
  fill: number;
  stroke: number;
  width: number;
}

type Color = "w" | "b";
type Viewer = Color | "spectator";

export interface ResolvedTheme {
  board: BoardTheme;
  white: PieceStyle;
  black: PieceStyle;
  shadow: boolean;
  boardOwner?: Color;
  whiteCustom?: boolean;
  blackCustom?: boolean;
}

export const DEFAULT_THEME: ResolvedTheme = {
  board: {
    lightSquare: 0xead9b5,
    darkSquare: 0xb58863,
    lastMoveLight: 0xf7ec59,
    lastMoveDark: 0xdac331,
    selectedSquare: 0x38bdf8,
    legalMoveDot: 0x10b981,
    captureRing: 0xef4444,
    checkGlow: 0xef4444,
  },
  white: { fill: 0xfffbeb, stroke: 0x0f172a, width: 4 },
  black: { fill: 0x1e293b, stroke: 0xf8fafc, width: 2.5 },
  shadow: true,
};

export const PROMOTION_STYLE = {
  background: 0x0f172a,
  border: 0xf59e0b,
  button: 0x1e293b,
  hover: 0x334155,
};

export const PIECE_SHADOW = {
  offsetX: 0,
  offsetY: 3,
  color: "rgba(0, 0, 0, 0.45)",
  blur: 4,
  fill: true,
};

export const SELECTED_ALPHA = 0.45;
export const CHECK_ALPHA = 0.35;

export function colorHex(color: number) {
  return `#${color.toString(16).padStart(6, "0").toUpperCase()}`;
}

function rgb(color: number) {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255] as const;
}

function linearRgb(color: number) {
  return rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

function luminance(color: number) {
  const [r, g, b] = linearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: number, b: number) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function lab(color: number) {
  const [r, g, b] = linearRgb(color);
  const delta = 6 / 29;
  const f = (v: number) =>
    v > delta ** 3 ? Math.cbrt(v) : v / (3 * delta ** 2) + 4 / 29;
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)] as const;
}

export function deltaE(a: number, b: number) {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

function blend(background: number, foreground: number, alpha: number) {
  const channels = rgb(foreground);
  return rgb(background).reduce(
    (result, channel, i) =>
      (result << 8) | Math.round(channel * (1 - alpha) + channels[i]! * alpha),
    0,
  );
}

function visible(piece: PieceStyle, board: BoardTheme) {
  const squares = [
    board.lightSquare,
    board.darkSquare,
    board.lastMoveLight,
    board.lastMoveDark,
  ];
  const backgrounds = squares.flatMap((square) => {
    const selected = blend(square, board.selectedSquare, SELECTED_ALPHA);
    return [
      square,
      selected,
      blend(square, board.checkGlow, CHECK_ALPHA),
      blend(selected, board.checkGlow, CHECK_ALPHA),
    ];
  });
  backgrounds.push(PROMOTION_STYLE.button, PROMOTION_STYLE.hover);
  return backgrounds.every(
    (bg) =>
      contrast(piece.fill, bg) >= 3 ||
      (piece.width > 0 && contrast(piece.stroke, bg) >= 3),
  );
}

function distinct(white: PieceStyle, black: PieceStyle) {
  return (
    contrast(white.fill, black.fill) >= 1.5 ||
    deltaE(white.fill, black.fill) >= 50
  );
}

export function resolveTheme({
  whitePieces,
  blackPieces,
  whiteBoard,
  blackBoard,
  hideOpponentSkin,
  viewerColor,
}: {
  whitePieces?: SkinTheme;
  blackPieces?: SkinTheme;
  whiteBoard?: SkinTheme;
  blackBoard?: SkinTheme;
  hideOpponentSkin?: boolean;
  viewerColor?: Viewer;
}): ResolvedTheme {
  if (hideOpponentSkin && viewerColor === "w") blackPieces = undefined;
  if (hideOpponentSkin && viewerColor === "b") whitePieces = undefined;

  const chosenBoard = whiteBoard ?? blackBoard;
  let boardOwner: Color | undefined = whiteBoard
    ? "w"
    : blackBoard
      ? "b"
      : undefined;
  if (
    hideOpponentSkin &&
    viewerColor &&
    viewerColor !== "spectator" &&
    boardOwner !== viewerColor
  ) {
    boardOwner = undefined;
  }
  const board =
    chosenBoard &&
    boardOwner &&
    contrast(chosenBoard.light, chosenBoard.dark) >= 1.35
      ? {
          ...DEFAULT_THEME.board,
          lightSquare: chosenBoard.light,
          darkSquare: chosenBoard.dark,
          lastMoveLight: chosenBoard.lastLight,
          lastMoveDark: chosenBoard.lastDark,
        }
      : DEFAULT_THEME.board;

  if (!whitePieces && !blackPieces && board === DEFAULT_THEME.board)
    return DEFAULT_THEME;

  const customWhite = whitePieces && {
    fill: whitePieces.whiteFill,
    stroke: whitePieces.whiteStroke,
    width: whitePieces.whiteWidth,
  };
  const customBlack = blackPieces && {
    fill: blackPieces.blackFill,
    stroke: blackPieces.blackStroke,
    width: blackPieces.blackWidth,
  };

  let white =
    customWhite && visible(customWhite, board)
      ? customWhite
      : DEFAULT_THEME.white;
  let black =
    customBlack && visible(customBlack, board)
      ? customBlack
      : DEFAULT_THEME.black;
  if (!distinct(white, black)) {
    black = DEFAULT_THEME.black;
    if (!distinct(white, black)) white = DEFAULT_THEME.white;
  }

  return {
    board,
    white,
    black,
    shadow: (whitePieces ?? blackPieces)?.shadow ?? DEFAULT_THEME.shadow,
    boardOwner: board === DEFAULT_THEME.board ? undefined : boardOwner,
    whiteCustom: white === customWhite,
    blackCustom: black === customBlack,
  };
}

const preferenceKey = "avaclash:hide-opponent-skin";
const browserStorage = (): Pick<Storage, "getItem" | "setItem"> =>
  window.localStorage;

export function readHideOpponentSkin(storage = browserStorage) {
  try {
    return storage().getItem(preferenceKey) === "true";
  } catch {
    return false;
  }
}

export function writeHideOpponentSkin(
  value: boolean,
  storage = browserStorage,
) {
  try {
    storage().setItem(preferenceKey, String(value));
  } catch {
    // The current viewer's in-memory preference still works.
  }
}
