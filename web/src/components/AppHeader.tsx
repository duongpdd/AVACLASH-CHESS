import Link from "next/link";
import WalletBar from "./WalletBar";
import Icon from "./Icon";
import { tournamentEnabled } from "@/config/env";

export default function AppHeader({
  active = "play",
  showWallet = true,
}: {
  active?: "play" | "vault" | "guide" | "tournament" | "practice" | "profile";
  showWallet?: boolean;
}) {
  return (
    <header className="app-header">
      <div className="site-container header-content">
        <Link
          href="/"
          className="brand"
          aria-label="AvaClash Chess — Trang chủ"
        >
          <span className="brand-mark">
            <Icon name="crown" />
          </span>
          <span>
            AvaClash<span className="brand-subtitle">CHESS CLUB</span>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Điều hướng chính">
          {(tournamentEnabled
            ? [
                { id: "tournament", href: "/tournaments", label: "Giải đấu" },
                { id: "practice", href: "/practice", label: "Tập cờ" },
                { id: "profile", href: "/profile", label: "Hồ sơ" },
                { id: "guide", href: "/guide", label: "Hướng dẫn" },
              ]
            : [
                { id: "play", href: "/", label: "Chơi" },
                { id: "tournament", href: "/tournaments", label: "Giải đấu" },
                { id: "vault", href: "/vault", label: "Vault" },
                { id: "guide", href: "/guide", label: "Hướng dẫn" },
              ]
          ).map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active === item.id ? "page" : undefined}
              className={active === item.id ? "nav-link is-active" : "nav-link"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {showWallet ? (
          <div className="header-wallet">
            <WalletBar />
          </div>
        ) : (
          <span className="header-offline">
            <Icon name="users" />
            {active === "practice" ? "Chơi solo" : "Cùng thiết bị"}
          </span>
        )}
      </div>
    </header>
  );
}
