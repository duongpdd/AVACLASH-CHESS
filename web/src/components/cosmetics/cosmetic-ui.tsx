"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { maxUint256, parseEther } from "viem";
import AppHeader from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Skeleton } from "@/components/ui-state";
import { NETWORK_NAME, cosmeticsEnabled } from "@/config/env";
import type { CosmeticTx } from "@/hooks/use-cosmetic-tx";
import { colorHex, resolveTheme, type SkinTheme } from "@/game/theme";

export function CosmeticNotice() {
  return (
    <span className="helper-text">
      Tài sản thử nghiệm trên {NETWORK_NAME}, không có giá trị quy đổi.
    </span>
  );
}

export function CosmeticPage({
  page,
  children,
}: {
  page: "collection" | "market";
  children: ReactNode;
}) {
  const collection = page === "collection";
  return (
    <div className="app-shell">
      <AppHeader active={page} />
      <main className="site-container grid min-w-0 gap-4 py-6">
        <PageHeader
          title={collection ? "Bộ sưu tập" : "Chợ"}
          description={<CosmeticNotice />}
          actions={
            cosmeticsEnabled && (
              <Link
                className="button-secondary"
                href={collection ? "/market" : "/collection"}
              >
                {collection ? "Đến chợ" : "Xem bộ sưu tập"}
              </Link>
            )
          }
        />
        {cosmeticsEnabled ? (
          children
        ) : (
          <EmptyState title="Chưa bật trên mạng này" />
        )}
      </main>
    </div>
  );
}

export const kindName = (kind: number) => (kind === 0 ? "Bàn cờ" : "Bộ quân");

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
  if (query.isPending) return <Skeleton label={label} />;
  if (query.isError) {
    return (
      <EmptyState
        title="Không đọc được dữ liệu trên chuỗi"
        action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
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
  return (
    (newer || older) && (
      <div className="flex flex-wrap gap-2">
        <Button disabled={!newer} onClick={newer}>
          Trang trước
        </Button>
        <Button disabled={!older} onClick={older}>
          Trang sau
        </Button>
      </div>
    )
  );
}

export function nativeAmount(text: string) {
  if (!/^\d{1,78}(?:\.\d{1,18})?$/.test(text)) return undefined;
  const value = parseEther(text);
  return value > 0n && value <= maxUint256 ? value : undefined;
}

export const cards = "grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3";
