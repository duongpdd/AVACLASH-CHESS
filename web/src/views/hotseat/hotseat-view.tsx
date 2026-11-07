"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CardCustom } from "@/components/ui/card-custom";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import type { EndReason, GameOutcome } from "@avaclash/shared";
import type { UiKey } from "@/i18n/ui-copy";
import { GameState } from "@/game/game-state";
import BoardPerformance from "@/components/board-performance";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import Icon from "@/components/app-icon";
import Dialog from "@/components/modal-dialog";
import { tournamentEnabled } from "@/config/env";
import type { ChessScene } from "@/game/chess-scene";

const PhaserGame = dynamic(() => import("@/components/phaser-game"), {
  ssr: false,
});
const time = (ms: number) =>
  `${Math.floor(Math.ceil(ms / 1000) / 60)}:${String(Math.ceil(ms / 1000) % 60).padStart(2, "0")}`;

const desktopHistory = "(min-width: 901px)";
function subscribeViewport(update: () => void) {
  const viewport = window.matchMedia(desktopHistory);
  viewport.addEventListener("change", update);
  return () => viewport.removeEventListener("change", update);
}
function DebugPerformance({ getFps }: { getFps: () => number | undefined }) {
  const params = useSearchParams();
  return params?.get("debug") === "1" ? (
    <BoardPerformance getFps={getFps} />
  ) : null;
}

const resultReason: Partial<Record<EndReason, UiKey>> = {
  checkmate: "messageCheckmate",
  stalemate: "messageStalemate",
  repetition: "messageRepetition",
  fifty: "messageFiftyMoveRule",
  insufficient: "messageInsufficientMaterial",
  draw_agreed: "messageAgreeToADraw",
  resign: "messageResign",
  timeout: "messageTimeExpired",
};

export default function HotseatPage() {
  const uiText = useUiCopy();
  const t = useTranslations("pages");
  const historyOpen = useSyncExternalStore(
    subscribeViewport,
    () => window.matchMedia(desktopHistory).matches,
    () => false,
  );
  const game = useRef<GameState | null>(null);
  const scene = useRef<ChessScene | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [sans, setSans] = useState<string[]>([]);
  const [clocks, setClocks] = useState({ whiteMs: 300000, blackMs: 300000 });
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState<{
    outcome: GameOutcome;
    reason: EndReason;
  }>();
  const [round, setRound] = useState(0);
  const [drawOffered, setDrawOffered] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [resigning, setResigning] = useState<"white" | "black" | null>(null);
  useEffect(() => {
    const current = new GameState(300000, {
      onMove: () => {
        setMoves(current.getMoves());
        setSans(current.getSans());
        setDrawOffered(false);
      },
      onClockTick: (whiteMs, blackMs) => setClocks({ whiteMs, blackMs }),
      onGameOver: (outcome, reason) => setFinished({ outcome, reason }),
    });
    game.current = current;
    return () => {
      current.destroy();
      game.current = null;
    };
  }, [round]);
  function reset() {
    setStarted(false);
    setResigning(null);
    setFinished(undefined);
    setMoves([]);
    setSans([]);
    setDrawOffered(false);
    setClocks({ whiteMs: 300000, blackMs: 300000 });
    setRound((r) => r + 1);
  }
  const result = finished
    ? `${uiText(finished.outcome === "draw" ? "messageDraw2" : finished.outcome === "white" ? "messageWhiteWins" : "messageBlackWins")} · ${uiText(resultReason[finished.reason] ?? "messageGameOver")}`
    : "";
  const turn = moves.length % 2 === 0 ? "w" : "b";
  function clockCard(color: "w" | "b") {
    const active = started && !result && turn === color;
    return (
      <div className={`local-player-card ${active ? "is-active" : ""}`}>
        <span className="local-piece" aria-hidden="true">
          {color === "w" ? "♔" : "♚"}
        </span>
        <div>
          <strong>
            {color === "w" ? uiText("messageWhite") : uiText("messageBlack")}
          </strong>
          {active && <span>{uiText("messageThinking")}</span>}
        </div>
        <time>{time(color === "w" ? clocks.whiteMs : clocks.blackMs)}</time>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <AppHeader showWallet={false} />
      <main
        className={`site-container play-page hotseat-page ${started ? "is-playing" : ""}`}
      >
        <PageHeader
          eyebrow={<>{uiText("messageOneBoardTwoPlayers")}</>}
          title={t("hotseatTitle")}
          description={t("hotseatDescription")}
          actions={
            <>
              <div className="flex flex-wrap items-center gap-5 shrink-0">
                <Link href="/" className="text-link">
                  {tournamentEnabled
                    ? uiText("messageHome")
                    : uiText("messagePlayHeadToHead")}
                  <Icon name="arrow" />
                </Link>
              </div>
            </>
          }
        />
        <div className="hotseat-layout">
          <div className="game-board-column w-full space-y-2">
            {!started && (
              <Button
                tone="primary"
                onClick={() => {
                  game.current?.startClock();
                  setStarted(true);
                }}
              >
                {uiText("messageStart")}
                <Icon name="arrow" />
              </Button>
            )}
            {clockCard(flipped ? "w" : "b")}
            <div className="rounded-xl border border-foreground/10 bg-card p-2">
              <PhaserGame
                key={round}
                boardSize={560}
                moves={moves}
                canMove={started && !result}
                playerColor={turn}
                flipBoard={flipped}
                onSceneReady={(current) => {
                  scene.current = current;
                }}
                onMove={(uci) =>
                  game.current?.tryMove(
                    uci.slice(0, 2),
                    uci.slice(2, 4),
                    uci.slice(4) || undefined,
                  )
                }
              />
            </div>
            {clockCard(flipped ? "b" : "w")}
            <div className="rounded-lg border border-foreground/10 bg-card px-4 py-3">
              <p role="status" className="text-sm text-status-warning">
                {result ||
                  (started
                    ? uiText("messageToMove", {
                        p0:
                          turn === "w"
                            ? uiText("messageWhite")
                            : uiText("messageBlack"),
                      })
                    : uiText("messagePressStartWhenBothPlayersAre"))}
              </p>
              {result && (
                <Button tone="primary" className="mt-3" onClick={reset}>
                  {uiText("messageNewGame")}
                </Button>
              )}
            </div>
          </div>
          <aside className="hotseat-sidebar space-y-4">
            <CardCustom>
              <h2 className="text-description font-semibold">
                {uiText("messageYourGame")}
              </h2>
              <div className="mt-5 grid gap-3">
                {started && !result && (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => setDrawOffered(true)}
                    >
                      {uiText("messageOfferADraw")}
                    </Button>
                    {drawOffered && (
                      <div className="space-y-2 rounded-lg border border-foreground/10 p-3">
                        <p className="helper-text">
                          {uiText("messageDoesYourOpponentAgreeToA")}
                        </p>
                        <Button
                          tone="primary"
                          className="w-full"
                          onClick={() => game.current?.acceptDraw()}
                        >
                          {uiText("messageOpponentAcceptsTheDraw")}
                        </Button>
                        <button
                          className="button-quiet w-full"
                          onClick={() => setDrawOffered(false)}
                        >
                          {uiText("messageDeclineDraw")}
                        </button>
                      </div>
                    )}
                  </>
                )}
                <Button
                  className="w-full"
                  onClick={() => setFlipped((value) => !value)}
                >
                  <Icon name="refresh" />
                  {uiText("messageFlipTheBoard")}
                </Button>
                {started && !result && (
                  <button
                    className="button-quiet mt-3 !text-status-danger/80"
                    onClick={() =>
                      setResigning(turn === "w" ? "white" : "black")
                    }
                  >
                    {uiText("messageResign2")}
                    {turn === "w"
                      ? uiText("messageWhite")
                      : uiText("messageBlack")}
                    )
                  </button>
                )}
              </div>
            </CardCustom>
            <details className="surface-card" open={historyOpen}>
              <summary className="section-title mb-4 cursor-pointer">
                {uiText("messageMoveHistory2")}
              </summary>
              <p
                className="move-transcript"
                aria-label={uiText("messageMoveHistory2")}
              >
                {sans
                  .map(
                    (san, i) => `${i % 2 === 0 ? `${i / 2 + 1}. ` : ""}${san}`,
                  )
                  .join(" ")}
              </p>
              {!sans.length && (
                <p className="helper-text">
                  {uiText("messageMovesWillAppearOnceTheGame")}
                </p>
              )}
            </details>
            <Suspense fallback={null}>
              <DebugPerformance
                getFps={() => scene.current?.game?.loop.actualFps}
              />
            </Suspense>
          </aside>
        </div>
      </main>
      <AppFooter />
      {resigning && (
        <Dialog titleId="local-resign-title" onClose={() => setResigning(null)}>
          <CardCustom as="div" className="w-full max-w-sm space-y-4">
            <h2
              id="local-resign-title"
              className="text-description font-semibold"
            >
              {uiText("messageConfirmResignation")}
            </h2>
            <p className="helper-text">
              {resigning === "white"
                ? uiText("messageWhite")
                : uiText("messageBlack")}{" "}
              {uiText("messageWillResignAndEndTheGame")}
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setResigning(null)}>
                {uiText("messageKeepPlaying")}
              </Button>
              <Button
                tone="primary"
                className="!border-status-danger !bg-status-danger !text-background"
                onClick={() => {
                  game.current?.resign(resigning);
                  setResigning(null);
                }}
              >
                {uiText("messageConfirmResignation2")}
              </Button>
            </div>
          </CardCustom>
        </Dialog>
      )}
    </div>
  );
}
