"use client";

import { useTranslations } from "next-intl";
import { CHAIN_ID } from "@/config/env";

export default function FujiTestnetBanner() {
  const t = useTranslations("banner");
  const isAnvil = CHAIN_ID === 31337;
  return (
    <aside
      aria-label={t(isAnvil ? "local" : "fuji")}
      className="flex w-full items-center justify-center gap-2 border-b border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground"
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
