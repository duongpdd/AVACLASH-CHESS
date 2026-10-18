"use client";

import { useEffect, useRef, useState } from "react";
import type { GameOutcome, EndReason, PlayerColor } from "@avaclash/shared";
import type { ChessScene as ChessSceneType } from "@/game/ChessScene";

interface PhaserGameProps {
  boardSize?: number;
  flipBoard?: boolean;
  onMove?: (uci: string, san: string) => void;
  onGameOver?: (outcome: GameOutcome, reason: EndReason) => void;
  onClockTick?: (whiteMs: number, blackMs: number) => void;
  onTurnChange?: (turn: PlayerColor) => void;
  onSceneReady?: (scene: ChessSceneType) => void;
}

export default function PhaserGame({
  boardSize = 464,
  flipBoard = false,
  onMove,
  onGameOver,
  onClockTick,
  onTurnChange,
  onSceneReady,
}: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Store callbacks in refs to avoid re-creating Phaser game
  const callbacksRef = useRef({ onMove, onGameOver, onClockTick, onTurnChange, onSceneReady });
  callbacksRef.current = { onMove, onGameOver, onClockTick, onTurnChange, onSceneReady };

  useEffect(() => {
    let isCancelled = false;

    const initPhaser = async () => {
      try {
        if (!containerRef.current) return;
        if (gameRef.current) return;

        const phaserModule = await import("phaser");
        const Phaser = (phaserModule.default || phaserModule) as typeof import("phaser");
        const { ChessScene } = await import("@/game/ChessScene");

        if (isCancelled || !containerRef.current) return;

        class ConfiguredChessScene extends ChessScene {
          init() {
            super.init({
              boardSize,
              flipBoard,
              onMove: (uci: string, san: string) => callbacksRef.current.onMove?.(uci, san),
              onGameOver: (outcome: GameOutcome, reason: EndReason) =>
                callbacksRef.current.onGameOver?.(outcome, reason),
              onClockTick: (whiteMs: number, blackMs: number) =>
                callbacksRef.current.onClockTick?.(whiteMs, blackMs),
              onTurnChange: (turn: PlayerColor) =>
                callbacksRef.current.onTurnChange?.(turn),
            });
          }

          create() {
            super.create();
            setLoading(false);
            callbacksRef.current.onSceneReady?.(this);
          }
        }

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          width: boardSize,
          height: boardSize,
          parent: containerRef.current,
          backgroundColor: "#1a1a2e",
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
        setErrorMessage(err instanceof Error ? err.stack || err.message : String(err));
        setLoading(false);
      }
    };

    initPhaser();

    return () => {
      isCancelled = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [boardSize, flipBoard]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {errorMessage && (
        <div className="p-4 bg-red-900/80 border border-red-500 rounded-xl text-red-200 text-sm max-w-lg mb-4">
          <p className="font-bold">Error loading chess board:</p>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{errorMessage}</pre>
        </div>
      )}
      {loading && !errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10 rounded-xl">
          <div className="text-white text-sm font-medium animate-pulse flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            Loading board...
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: boardSize, height: boardSize }}
        className="rounded-lg overflow-hidden shadow-2xl bg-[#1a1a2e] flex items-center justify-center"
      />
    </div>
  );
}
