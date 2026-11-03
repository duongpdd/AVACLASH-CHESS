"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Chess, type Square } from "chess.js";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

type Solution = Record<string, null | { reply: string; next: Solution }>;
const puzzles: {
  title: string;
  goal: string;
  fen: string;
  solution: Solution;
}[] = [
  {
    title: "Hàng cuối",
    goal: "Trắng chiếu hết trong 1 nước",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: { e1e8: null },
  },
  {
    title: "Vua Bách Khoa",
    goal: "Trắng chiếu hết trong 2 nước",
    fen: "7k/8/8/5K2/8/Q7/8/8 w - - 0 1",
    solution: { f5g6: { reply: "h8g8", next: { a3a8: null } } },
  },
  {
    title: "Dồn vua vào góc",
    goal: "Trắng chiếu hết trong 3 nước",
    fen: "k7/8/8/8/2K5/8/8/1Q6 w - - 0 1",
    solution: {
      c4c5: {
        reply: "a8a7",
        next: { c5c6: { reply: "a7a8", next: { b1b7: null } } },
      },
      c4d5: {
        reply: "a8a7",
        next: { d5c6: { reply: "a7a8", next: { b1b7: null } } },
      },
    },
  },
];
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
const names = { k: "Vua", q: "Hậu", r: "Xe", b: "Tượng", n: "Mã", p: "Tốt" };
const subscribe = (update: () => void) => {
  const timer = setInterval(update, 60_000);
  return () => clearInterval(timer);
};
const dailyIndex = () =>
  Math.floor((Date.now() + 7 * 3_600_000) / 86_400_000) % puzzles.length;

function play(game: Chess, move: string) {
  game.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
}

function Puzzle({ index }: { index: number }) {
  const puzzle = puzzles[index];
  const [fen, setFen] = useState(puzzle.fen);
  const [solution, setSolution] = useState<Solution | null>(puzzle.solution);
  const [selected, setSelected] = useState<Square>();
  const [message, setMessage] = useState("Chọn quân Trắng rồi chọn ô đích.");
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
          ? "Nước này chưa buộc được chiếu hết. Thử nước khác."
          : "Quân đã chọn không thể đi tới ô đó.",
      );
      return;
    }
    const branch = solution[move];
    play(game, move);
    if (branch) play(game, branch.reply);
    setFen(game.fen());
    setSolution(branch?.next ?? null);
    setSelected(undefined);
    setMessage(
      branch
        ? "Đen đã đáp lại. Đến lượt Trắng."
        : "Chiếu hết! Bạn đã giải xong thế cờ.",
    );
  }

  return (
    <div className="hotseat-layout">
      <div
        className="grid w-full max-w-[560px] grid-cols-8 overflow-hidden rounded-xl border border-white/15"
        role="group"
        aria-label="Bàn cờ giải thế"
      >
        {game.board().flatMap((rank, row) =>
          rank.map((piece, column) => {
            const square = `${"abcdefgh"[column]}${8 - row}` as Square;
            const symbol = piece ? pieces[`${piece.color}${piece.type}`] : "";
            const label = piece
              ? `${square}, ${names[piece.type]} ${piece.color === "w" ? "trắng" : "đen"}`
              : square;
            return (
              <button
                key={square}
                type="button"
                aria-label={label}
                aria-pressed={selected === square}
                onClick={() => select(square)}
                className={`relative aspect-square min-w-0 text-[clamp(1.35rem,7vw,3.6rem)] leading-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-amber-500 ${selected === square ? "bg-amber-400" : (row + column) % 2 === 0 ? "bg-amber-100" : "bg-emerald-700"} ${piece?.color === "w" ? "text-white [text-shadow:0_1px_3px_#111827,0_0_2px_#111827]" : "text-slate-950"}`}
              >
                <span aria-hidden="true">{symbol}</span>
                {!piece && targets.includes(square) && (
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 h-1/5 w-1/5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950/35"
                  />
                )}
                {(row === 7 || column === 0) && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 left-1 text-[clamp(.42rem,1.8vw,.72rem)] font-bold text-slate-950"
                  >
                    {row === 7 ? square[0] : square[1]}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
      <aside className="surface-card space-y-3">
        <p className="eyebrow">{puzzle.goal}</p>
        <h2 className="section-title">{puzzle.title}</h2>
        <p role="status" className="text-amber-100">
          {message}
        </p>
        <div className="flex flex-wrap gap-2">
          {solution && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                const hint = Object.keys(solution)[0];
                setSelected(hint.slice(0, 2) as Square);
                setMessage(`Gợi ý: thử đi từ ${hint.slice(0, 2)}.`);
              }}
            >
              Gợi ý
            </button>
          )}
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setFen(puzzle.fen);
              setSolution(puzzle.solution);
              setSelected(undefined);
              setMessage("Chọn quân Trắng rồi chọn ô đích.");
            }}
          >
            Làm lại
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function PracticePage() {
  const today = useSyncExternalStore(subscribe, dailyIndex, () => 0);
  const [choice, setChoice] = useState<number | null>(null);
  const index = choice ?? today;
  return (
    <div className="app-shell">
      <AppHeader active="practice" showWallet={false} />
      <main className="site-container play-page space-y-5">
        <section className="page-intro">
          <div>
            <p className="eyebrow">LUYỆN TẬP SOLO</p>
            <h1>
              Giải <span>thế cờ.</span>
            </h1>
            <p className="intro-description">
              Thử thế cờ hôm nay hoặc chọn bài khác. Bàn cờ phản hồi ngay và
              không cần kết nối ví.
            </p>
          </div>
          <Link className="button-secondary" href="/hotseat">
            Chơi hai người
          </Link>
        </section>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Chọn thế cờ"
        >
          <button
            type="button"
            className={choice === null ? "button-primary" : "button-secondary"}
            aria-pressed={choice === null}
            onClick={() => setChoice(null)}
          >
            Thế cờ hôm nay
          </button>
          {puzzles.map(({ title }, i) => (
            <button
              key={title}
              type="button"
              className={choice === i ? "button-primary" : "button-secondary"}
              aria-pressed={choice === i}
              onClick={() => setChoice(i)}
            >
              {title}
            </button>
          ))}
        </div>
        <Puzzle key={index} index={index} />
      </main>
      <AppFooter />
    </div>
  );
}
