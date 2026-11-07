"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChessKnight,
  House,
  Menu,
  Trophy,
  User,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Brand } from "./brand";
import { Preferences } from "./preferences";
import WalletBar from "@/components/wallet-bar";
import { tournamentEnabled } from "@/config/env";
import { cn } from "@/lib/utils";

const workspace = [
  { href: "/profile", label: "profile", icon: User },
  { href: "/tournaments/new", label: "organize", icon: Trophy },
] as const;

const publicLinks = [
  { href: "/", label: "home", icon: House },
  { href: "/tournaments", label: "tournaments", icon: Trophy },
  { href: "/practice", label: "practice", icon: ChessKnight },
  { href: "/guide", label: "guide", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const activeHref = pathname.startsWith("/tournaments/play")
    ? "/tournaments"
    : pathname;

  function closeDrawer() {
    drawer.current?.close();
  }

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)");
    const closeAtDesktop = () => {
      if (desktop.matches) closeDrawer();
    };
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Brand />
        </div>
        <Navigation activeHref={activeHref} />
      </aside>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:left-60 md:justify-end">
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            aria-label={t("openMenu")}
            aria-haspopup="dialog"
            className="grid size-11 place-items-center rounded-dropdown hover:bg-muted"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu size={20} />
          </button>
          <Brand />
        </div>
        <Preferences />
      </header>
      <dialog
        ref={drawer}
        aria-label={t("primary")}
        className="workspace-drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-60 max-w-full bg-sidebar text-foreground backdrop:bg-overlay md:hidden"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <div className="flex h-full flex-col border-r border-border">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
            <Brand />
            <button
              type="button"
              aria-label={t("closeMenu")}
              className="grid size-11 place-items-center rounded-dropdown hover:bg-muted"
              onClick={closeDrawer}
            >
              <X size={20} />
            </button>
          </div>
          <Navigation activeHref={activeHref} close={closeDrawer} />
        </div>
      </dialog>
      <main className="h-dvh overflow-y-auto pt-14 md:pl-60">
        <div className="workspace-content mx-auto grid max-w-5xl min-w-0 gap-4 px-4 py-6">
          <WalletBar />
          {children}
        </div>
      </main>
    </div>
  );
}

function Navigation({
  close,
  activeHref,
}: {
  close?: () => void;
  activeHref: string;
}) {
  const t = useTranslations("navigation");
  return (
    <nav aria-label={t("primary")} className="grid gap-4 overflow-y-auto p-3">
      {(
        [
          [t("workspace"), workspace],
          [t("public"), publicLinks],
        ] as const
      ).map(([label, links]) => (
        <div key={label} className="grid gap-1">
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
            {label}
          </p>
          {links
            .filter(
              ({ href }) => tournamentEnabled || href !== "/tournaments/new",
            )
            .map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={close}
                aria-current={activeHref === href ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-dropdown px-3 py-2 text-sm text-muted-foreground hover:bg-muted",
                  activeHref === href &&
                    "bg-sidebar-accent font-semibold text-foreground",
                )}
              >
                <Icon size={16} aria-hidden />
                {t(label)}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  );
}
