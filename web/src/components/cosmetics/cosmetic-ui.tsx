"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui-state";
import { NETWORK_NAME } from "@/config/env";
import type { CosmeticTx } from "@/hooks/use-cosmetic-tx";
import { colorHex, resolveTheme, type SkinTheme } from "@/game/theme";

export function CosmeticNotice() {
  const t = useTranslations("cosmetics");
  return (
    <span className="helper-text">
      {t("notice", { network: NETWORK_NAME })}
    </span>
  );
}

export function useKindName() {
  const t = useTranslations("cosmetics");
  return (kind: number) => t(kind === 0 ? "kindBoard" : "kindPieces");
}

export function SkinPreview({
  kind,
  theme,
}: {
  kind: number;
  theme: SkinTheme;
}) {
  const view = resolveTheme(
    kind === 0
      ? { whiteBoard: theme }
      : { whitePieces: theme, blackPieces: theme },
  );
  const { board } = view;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 160 160"
      className="mx-auto block w-full max-w-36 rounded-lg"
    >
      {Array.from({ length: 64 }, (_, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;
        return (
          <rect
            key={index}
            x={col * 20}
            y={row * 20}
            width="20"
            height="20"
            fill={colorHex(
              (row + col) % 2 ? board.darkSquare : board.lightSquare,
            )}
          />
        );
      })}
      {(
        [
          ["♞", view.white],
          ["♜", view.black],
        ] as const
      ).map(([glyph, style], index) => (
        <text
          key={glyph}
          x={50 + index * 60}
          y={88}
          textAnchor="middle"
          paintOrder="stroke"
          fontFamily="'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', sans-serif"
          fontSize="40"
          fill={colorHex(style.fill)}
          stroke={colorHex(style.stroke)}
          strokeWidth={style.width / 2}
        >
          {glyph}
        </text>
      ))}
    </svg>
  );
}

export function QueryState({
  query,
  label,
  empty,
  children,
}: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown };
  label: string;
  empty?: string;
  children: ReactNode;
}) {
  const t = useTranslations("cosmetics");
  if (query.isPending) return <Skeleton label={label} />;
  if (query.isError) {
    return (
      <EmptyState
        title={t("readFailed")}
        action={
          <Button onClick={() => void query.refetch()}>{t("retry")}</Button>
        }
      />
    );
  }
  return empty ? <EmptyState title={empty} /> : children;
}

export function TxMessage({ tx }: { tx: CosmeticTx }) {
  return (
    <p
      role={tx.failed ? "alert" : "status"}
      className="helper-text break-words"
    >
      {tx.message}
    </p>
  );
}

export function Pager({
  newer,
  older,
}: {
  newer?: () => void;
  older?: () => void;
}) {
  const t = useTranslations("cosmetics");
  return (
    (newer || older) && (
      <div className="flex flex-wrap gap-2">
        <Button disabled={!newer} onClick={newer}>
          {t("previous")}
        </Button>
        <Button disabled={!older} onClick={older}>
          {t("next")}
        </Button>
      </div>
    )
  );
}

export const cards = "grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3";
