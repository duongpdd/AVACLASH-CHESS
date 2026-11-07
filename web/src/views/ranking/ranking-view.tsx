import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import TournamentElo from "@/components/tournament-elo";
import { EmptyState } from "@/components/ui-state";
import { tournamentEnabled } from "@/config/env";

export default function RankingPage() {
  const t = useTranslations("ranking");
  return (
    <div className="app-shell">
      <AppHeader active="ranking" />
      <main className="site-container play-page">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Link className="button-secondary" href="/profile">
              {t("myProfile")}
            </Link>
          }
        />
        {tournamentEnabled ? (
          <TournamentElo />
        ) : (
          <EmptyState title={t("unavailable")} />
        )}
      </main>
      <AppFooter />
    </div>
  );
}
