import { Chess } from "chess.js";

export const HOME_PREVIEW_FEN =
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5";

export const homePreviewBoard = new Chess(HOME_PREVIEW_FEN).board().flat();
