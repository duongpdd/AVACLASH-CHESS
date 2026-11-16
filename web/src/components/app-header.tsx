"use client";

import { isCosmeticsEnabled } from "@/config/cosmetics";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { Brand } from "@/components/layout/brand";
import { Preferences } from "@/components/layout/preferences";
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
    { id: "ranking", href: "/ranking", label: "ranking" },
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
    <header className="public-header">
      <a href="#main-content" className="skip-link">
        {t("skipToContent")}
      </a>
      <div className="site-container public-header-content">
        <Brand />
        <div className="public-header-actions">
          <Preferences />
          {showWallet && (
            <Link
              className="button-primary header-wallet"
              href={connected ? "/profile" : "/login"}
            >
              {t(connected ? "profile" : "connect")}
            </Link>
          )}
        </div>
        <nav aria-label={t("primary")} className="public-navigation">
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
