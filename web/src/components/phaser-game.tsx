"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useEffect, useRef, useState } from "react";
import type { GameOutcome, EndReason, PlayerColor } from "@avaclash/shared";
import type { ChessScene as ChessSceneType } from "@/game/chess-scene";

import type { ResolvedTheme } from "@/game/theme";

interface PhaserGameProps {
  theme?: ResolvedTheme;
  boardSize?: number;
  flipBoard?: boolean;
  moves?: string[];
  playerColor?: "w" | "b" | "spectator";
  canMove?: boolean;
  onMove?: (uci: string, san: string) => void;
  onGameOver?: (outcome: GameOutcome, reason: EndReason) => void;
  onClockTick?: (whiteMs: number, blackMs: number) => void;
  onTurnChange?: (turn: PlayerColor) => void;
  onSceneReady?: (scene: ChessSceneType) => void;
  onBlockedInteraction?: () => void;
}

export default function PhaserGame({
  theme,
  boardSize = 464,
  flipBoard = false,
  moves,
  playerColor = "spectator",
  canMove = false,
  onMove,
  onGameOver,
  onClockTick,
  onTurnChange,
  onSceneReady,
  onBlockedInteraction,
}: PhaserGameProps) {
  const uiText = useUiCopy();
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const activeSceneRef = useRef<ChessSceneType | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Store callbacks in refs to avoid re-creating Phaser game
  const callbacksRef = useRef({
    onMove,
    onGameOver,
    onClockTick,
    onTurnChange,
    onSceneReady,
    onBlockedInteraction,
  });
  useEffect(() => {
    callbacksRef.current = {
      onMove,
      onGameOver,
      onClockTick,
      onTurnChange,
      onSceneReady,
      onBlockedInteraction,
    };
  }, [
    onMove,
    onGameOver,
    onClockTick,
    onTurnChange,
    onSceneReady,
    onBlockedInteraction,
  ]);

  // Store latest prop values in refs to guard against async initialization race conditions
  const movesRef = useRef(moves);
  const canMoveRef = useRef(canMove);
  const playerColorRef = useRef(playerColor);
  useEffect(() => {
    movesRef.current = moves;
    canMoveRef.current = canMove;
    playerColorRef.current = playerColor;
  }, [moves, canMove, playerColor]);

  const themeRef = useRef(theme);
  useEffect(() => {
    const previous = themeRef.current;
    themeRef.current = theme;
    if (previous !== theme) activeSceneRef.current?.setTheme(theme);
  }, [theme]);

  // Sync moves to active Phaser scene
  useEffect(() => {
    if (activeSceneRef.current && moves) {
      activeSceneRef.current.syncMoves(moves);
    }
  }, [moves]);

  // Sync canMove to active Phaser scene
  useEffect(() => {
    if (activeSceneRef.current && canMove !== undefined) {
      activeSceneRef.current.setCanMove(canMove);
    }
  }, [canMove]);

  // Sync playerColor to active Phaser scene
  useEffect(() => {
    if (activeSceneRef.current && playerColor) {
      activeSceneRef.current.setPlayerColor(playerColor);
    }
  }, [playerColor]);

  useEffect(() => {
    let isCancelled = false;

    const initPhaser = async () => {
      try {
        if (!containerRef.current) return;
        if (gameRef.current) return;

        const phaserModule = await import("phaser");
        const Phaser = (phaserModule.default ||
          phaserModule) as typeof import("phaser");
        const { ChessScene } = await import("@/game/chess-scene");

        if (isCancelled || !containerRef.current) return;

        class ConfiguredChessScene extends ChessScene {
          private initialTheme?: ResolvedTheme;

          init() {
            this.initialTheme = themeRef.current;
            super.init({
              boardSize,
              theme: themeRef.current,
              flipBoard,
              moves: movesRef.current,
              playerColor: playerColorRef.current,
              canMove: canMoveRef.current,
              onMove: (uci: string, san: string) =>
                callbacksRef.current.onMove?.(uci, san),
              onGameOver: (outcome: GameOutcome, reason: EndReason) =>
                callbacksRef.current.onGameOver?.(outcome, reason),
              onClockTick: (whiteMs: number, blackMs: number) =>
                callbacksRef.current.onClockTick?.(whiteMs, blackMs),
              onTurnChange: (turn: PlayerColor) =>
                callbacksRef.current.onTurnChange?.(turn),
              onBlockedInteraction: () =>
                callbacksRef.current.onBlockedInteraction?.(),
            });
          }

          create() {
            super.create();
            activeSceneRef.current = this;
            if (themeRef.current !== this.initialTheme) this.setTheme(themeRef.current);

            // Apply latest prop values from refs in case they changed during async scene initialization
            if (movesRef.current) {
              this.syncMoves(movesRef.current);
            }
            if (canMoveRef.current !== undefined) {
              this.setCanMove(canMoveRef.current);
            }
            if (playerColorRef.current) {
              this.setPlayerColor(playerColorRef.current);
            }

            setLoading(false);
            callbacksRef.current.onSceneReady?.(this);
          }
        }

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          width: boardSize,
          height: boardSize,
          parent: containerRef.current,
          backgroundColor: getComputedStyle(document.documentElement)
            .getPropertyValue("--board-canvas")
            .trim(),
          scene: [ConfiguredChessScene],
          scale: {
            mode: Phaser.Scale.NONE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          render: {
            antialias: true,
            pixelArt: false,
          },
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;
      } catch (err) {
        console.error("[PhaserGame] Error initializing Phaser:", err);
        if (!isCancelled) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };

    initPhaser();

    return () => {
      isCancelled = true;
      activeSceneRef.current = null;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [boardSize, flipBoard]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {errorMessage && (
        <div className="p-4 bg-status-danger/80 border border-status-danger rounded-xl text-status-danger text-sm max-w-lg mb-4">
          <p className="font-bold">{uiText("messageCouldNotLoadTheBoard")}</p>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{errorMessage}</pre>
        </div>
      )}
      {loading && !errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10 rounded-xl">
          <div className="text-foreground text-sm font-medium animate-pulse flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-status-warning animate-ping" />
            {uiText("messageOpeningTheBoard")}
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: boardSize, maxWidth: "100%", aspectRatio: "1" }}
        className="rounded-lg overflow-hidden shadow-2xl bg-board-canvas flex items-center justify-center [&_canvas]:!w-full [&_canvas]:!h-auto"
      />
    </div>
  );
}
