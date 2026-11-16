"use client";

import { useTranslations } from "next-intl";
import { CHAIN_ID } from "@/config/env";

export function TestnetBadge() {
  const t = useTranslations("network");
  if (CHAIN_ID !== 31337 && CHAIN_ID !== 43113) return null;
  return <span className="testnet-badge">{t("testnet")}</span>;
}

export default function FujiTestnetBanner({
  compact = false,
}: {
  compact?: boolean;
}) {
  const t = useTranslations("banner");
  if (compact) return <TestnetBadge />;
  const isAnvil = CHAIN_ID === 31337;
  return (
    <aside
      aria-label={t(isAnvil ? "local" : "fuji")}
      className="flex w-full items-center justify-center gap-2 border-b border-border bg-card px-4 py-2 text-center text-[13px] text-muted-foreground"
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-status-warning"
        aria-hidden
      />
      <span className="whitespace-nowrap">{t(isAnvil ? "local" : "fuji")}</span>
      <span className="hidden lg:inline">
        · {t(isAnvil ? "localDetail" : "fujiDetail")}
      </span>
    </aside>
  );
}
