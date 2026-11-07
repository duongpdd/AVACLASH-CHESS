"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { Chess, type Square } from "chess.js";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Skeleton } from "@/components/ui-state";
import { puzzles, type Solution } from "@/utils/practice-puzzles";

const pieces = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};
const boardDirection = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
} as const;

const names = {
  k: "king",
  q: "messageQueen",
  r: "rook",
  b: "messageBishop",
  n: "messageKnight",
  p: "messagePawn",
} as const;
const subscribe = (update: () => void) => {
  const timer = setInterval(update, 60_000);
  return () => clearInterval(timer);
};
const dailyIndex = () =>
  Math.floor((Date.now() + 7 * 3_600_000) / 86_400_000) % puzzles.length;

function play(game: Chess, move: string) {
  game.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
}

const progressKey = "avaclash.practice.solved.v1";
const progressEvent = "avaclash-practice-progress";
const emptyProgress = "[]";
let sessionProgress = emptyProgress;
let storageUnavailable = false;

function readProgress() {
  if (storageUnavailable) return sessionProgress;
  try {
    return localStorage.getItem(progressKey) ?? sessionProgress;
  } catch {
    return sessionProgress;
  }
}

function subscribeProgress(update: () => void) {
  window.addEventListener(progressEvent, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(progressEvent, update);
    window.removeEventListener("storage", update);
  };
}

function solvedPositions(progress: string): string[] {
  try {
    const saved: unknown = JSON.parse(progress);
    return Array.isArray(saved)
      ? saved.filter((fen): fen is string => typeof fen === "string")
      : [];
  } catch {
    return [];
  }
}

function markSolved(fen: string) {
  sessionProgress = JSON.stringify([
    ...new Set([...solvedPositions(readProgress()), fen]),
  ]);
  try {
    localStorage.setItem(progressKey, sessionProgress);
  } catch {
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(progressEvent));
}

function Puzzle({ index, onNext }: { index: number; onNext: () => void }) {
  const uiText = useUiCopy();
  const t = useTranslations("pages");
  const puzzle = puzzles[index];
  const boardRef = useRef<HTMLDivElement>(null);
  const [focusedSquare, setFocusedSquare] = useState<Square>("a1");
  const [fen, setFen] = useState(puzzle.fen);
  const [solution, setSolution] = useState<Solution | null>(puzzle.solution);
  const [flipped, setFlipped] = useState(false);
  const [lastMove, setLastMove] = useState<string>();
  const [selected, setSelected] = useState<Square>();
  const [message, setMessage] = useState(
    uiText("messageSelectAWhitePieceThenSelect"),
  );
  const game = new Chess(fen);
  const targets = selected
    ? game.moves({ square: selected, verbose: true }).map((move) => move.to)
    : [];

  function select(square: Square) {
    if (!solution) return;
    if (game.get(square)?.color === "w") {
      setSelected(selected === square ? undefined : square);
      return;
    }
    if (!selected) return;
    const move = selected + square;
    if (!Object.hasOwn(solution, move)) {
      setMessage(
        targets.includes(square)
          ? uiText("messageThisMoveDoesNotForceCheckmate")
          : uiText("messageTheSelectedPieceCannotMoveTo"),
      );
      return;
    }
    const branch = solution[move];
    play(game, move);
    if (branch) play(game, branch.reply);
    else markSolved(puzzle.fen);
    setLastMove(branch?.reply ?? move);
    setFen(game.fen());
    setSolution(branch?.next ?? null);
    setSelected(undefined);
    setMessage(
      branch
        ? uiText("messageBlackHasRepliedWhiteToMove")
        : uiText("messageCheckmateYouSolvedThePuzzle"),
    );
  }

  function moveFocus(
    event: KeyboardEvent<HTMLButtonElement>,
    row: number,
    column: number,
  ) {
    const direction = boardDirection[event.key as keyof typeof boardDirection];
    if (!direction) return;
    event.preventDefault();
    const nextRow = row + direction[0];
    const nextColumn = column + direction[1];
    if (nextRow < 0 || nextRow > 7 || nextColumn < 0 || nextColumn > 7) return;
    boardRef.current
      ?.querySelectorAll("button")
      [nextRow * 8 + nextColumn]?.focus();
  }

  const board = game.board();
  const ranks = flipped ? board.reverse().map((rank) => rank.reverse()) : board;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-description font-semibold">
          {uiText("messageWhiteToMateIn")} {puzzle.mateIn}{" "}
          {uiText("messageMoves")}
        </h2>
        <Button type="button" onClick={() => setFlipped((value) => !value)}>
          {uiText("messageFlipTheBoard")}
        </Button>
      </div>
      <div className="hotseat-layout">
        <div
          ref={boardRef}
          className="grid w-full max-w-[560px] grid-cols-8 overflow-hidden rounded-xl border border-foreground/15"
          role="group"
          aria-label={uiText("messagePuzzleBoard")}
        >
          {ranks.flatMap((rank, row) =>
            rank.map((piece, column) => {
              const file = "abcdefgh"[flipped ? 7 - column : column];
              const square = `${file}${flipped ? row + 1 : 8 - row}` as Square;
              const highlighted =
                square === lastMove?.slice(0, 2) ||
                square === lastMove?.slice(2);
              const symbol = piece ? pieces[`${piece.color}${piece.type}`] : "";
              const label = piece
                ? t("puzzleSquareWithPiece", {
                    square,
                    piece: uiText(names[piece.type]),
                    color: uiText(
                      piece.color === "w" ? "messageWhite2" : "messageBlack2",
                    ),
                  })
                : square;
              return (
                <button
                  key={square}
                  type="button"
                  aria-label={label}
                  aria-pressed={selected === square}
                  tabIndex={focusedSquare === square ? 0 : -1}
                  onFocus={() => setFocusedSquare(square)}
                  onKeyDown={(event) => moveFocus(event, row, column)}
                  onClick={() => select(square)}
                  className={`relative aspect-square min-w-0 text-[clamp(22px,7vw,58px)] leading-none focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-board-piece-dark ${selected === square ? "bg-board-selected" : highlighted ? "bg-board-target" : (row + column) % 2 === 0 ? "bg-board-light" : "bg-board-dark"} ${piece?.color === "w" ? "text-board-piece-light board-piece-light" : "text-board-piece-dark"}`}
                >
                  <span aria-hidden="true">{symbol}</span>
                  {!piece && targets.includes(square) && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-1/5 w-1/5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/35"
                    />
                  )}
                  {column === 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1 top-0.5 text-[10px] font-bold text-board-piece-dark"
                    >
                      {square[1]}
                    </span>
                  )}
                  {row === 7 && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0.5 right-1 text-[10px] font-bold text-board-piece-dark"
                    >
                      {square[0]}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
        <aside className="surface-card space-y-3">
          <h2 className="text-description font-semibold">
            {uiText.existing(puzzle.title)}
          </h2>
          <p role="status" className="text-status-warning">
            {uiText.existing(message)}
          </p>
          <div className="flex flex-wrap gap-2">
            {!solution && (
              <Button type="button" tone="primary" onClick={onNext}>
                {uiText("messageTryTheNextPuzzle")}
              </Button>
            )}
            {solution && (
              <Button
                type="button"
                onClick={() => {
                  const hint = Object.keys(solution)[0];
                  setSelected(hint.slice(0, 2) as Square);
                  setMessage(
                    uiText("messageHintTryMovingFrom", {
                      p0: String(hint.slice(0, 2)),
                    }),
                  );
                }}
              >
                {uiText("messageHint")}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                setLastMove(undefined);
                setFen(puzzle.fen);
                setSolution(puzzle.solution);
                setSelected(undefined);
                setMessage(uiText("messageSelectAWhitePieceThenSelect"));
              }}
            >
              {uiText("messageStartOver")}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function PracticePage() {
  const uiText = useUiCopy();
  const t = useTranslations("pages");
  const puzzleSelectId = useId();
  const puzzleLabelId = useId();
  const today = useSyncExternalStore(subscribe, dailyIndex, () => -1);
  const [choice, setChoice] = useState<number | null>(null);
  const progress = useSyncExternalStore(
    subscribeProgress,
    readProgress,
    () => emptyProgress,
  );
  const solved = solvedPositions(progress);
  const index = choice ?? today;
  return (
    <div className="app-shell">
      <AppHeader active="practice" showWallet={false} />
      <main className="site-container play-page space-y-5">
        <PageHeader
          eyebrow={<>{uiText("messageSoloPractice")}</>}
          title={t("practiceTitle")}
          description={t("practiceDescription")}
          actions={
            <>
              <Link className="button-secondary" href="/hotseat">
                {t("twoPlayers")}
              </Link>
            </>
          }
        />
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid w-full min-w-0 max-w-xs gap-1 sm:w-64">
            <label
              id={puzzleLabelId}
              htmlFor={puzzleSelectId}
              className="text-label"
            >
              {t("choosePuzzle")}
            </label>
            <DropdownSelect
              id={puzzleSelectId}
              aria-labelledby={puzzleLabelId}
              value={choice === null ? "today" : String(choice)}
              disabled={today < 0}
              onValueChange={(value) =>
                setChoice(value === "today" ? null : Number(value))
              }
              options={[
                { value: "today", label: t("dailyPuzzle") },
                ...puzzles.map(({ title, fen }, i) => ({
                  value: String(i),
                  label:
                    uiText.existing(title) +
                    (solved.includes(fen) ? ` · ${t("solved")}` : ""),
                })),
              ]}
            />
          </div>
          <p className="helper-text">
            {t("puzzleProgress", {
              count: puzzles.filter(({ fen }) => solved.includes(fen)).length,
              total: puzzles.length,
            })}
          </p>
        </div>
        {index < 0 ? (
          <Skeleton label={uiText("messageOpeningTodaySPuzzle")} />
        ) : (
          <Puzzle
            key={index}
            index={index}
            onNext={() => setChoice((index + 1) % puzzles.length)}
          />
        )}
      </main>
      <AppFooter />
    </div>
  );
}
