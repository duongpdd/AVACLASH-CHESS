"use client";

import { isCosmeticsEnabled } from "@/config/cosmetics";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { Brand } from "@/components/layout/brand";
import { Preferences } from "@/components/layout/preferences";
import { tournamentEnabled } from "@/config/env";
import { useClientMounted } from "@/hooks/use-client-mounted";

export default function AppHeader({
  active = "home",
  showWallet = true,
}: {
  active?:
    | "none"
    | "home"
    | "play"
    | "vault"
    | "guide"
    | "tournament"
    | "practice"
    | "profile"
    | "ranking"
    | "collection";
  showWallet?: boolean;
}) {
  const t = useTranslations("navigation");
  const mounted = useClientMounted();
  const { isConnected } = useAccount();
  const nav = [
    { id: "home", href: "/", label: "home" },
    { id: "tournament", href: "/tournaments", label: "tournaments" },
    tournamentEnabled
      ? { id: "ranking", href: "/ranking", label: "ranking" }
      : { id: "vault", href: "/vault", label: "vault" },
    { id: "guide", href: "/guide", label: "guide" },
  ] as const;
  const links = [
    ...nav.map((item) => ({ ...item, title: t(item.label) })),
    ...(isCosmeticsEnabled()
      ? [{ id: "collection", href: "/collection", title: t("collection") }]
      : []),
  ];
  const connected = mounted && isConnected;
  return (
    <header className="border-b border-border bg-background">
      <div className="site-container public-header-content flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
        <Brand />
        <div className="flex flex-wrap items-center justify-end gap-2 md:order-3">
          <Preferences />
          {showWallet && (
            <Link
              className="button-secondary !px-2"
              href={connected ? "/profile" : "/login"}
            >
              {t(connected ? "profile" : "connect")}
            </Link>
          )}
        </div>
        <nav
          aria-label={t("primary")}
          className="public-navigation flex w-full flex-wrap items-center justify-between gap-1 md:w-auto md:flex-1 md:justify-center"
        >
          {links.map(({ id, href, title }) => {
            const selected =
              id === active ||
              (id === "home" && ["practice", "play"].includes(active));
            const cosmetic = id === "collection";
            return (
              <Link
                key={href}
                className={`nav-link${selected ? " is-active" : ""}${cosmetic ? " min-h-11" : ""}`}
                aria-current={selected ? "page" : undefined}
                href={href}
              >
                {title}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
