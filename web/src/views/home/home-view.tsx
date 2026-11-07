import { useUiCopy } from "@/i18n/use-ui-copy";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import Icon from "@/components/app-icon";
import RoomLobbyWidget from "@/components/room-lobby-widget";
import ConfigErrorBanner from "@/components/config-error-banner";
import { tournamentEnabled } from "@/config/env";
import { FeaturedTournament } from "@/components/tournament-catalog";
import TournamentElo from "@/components/tournament-elo";

const cupModes = [
  {
    href: "/tournaments",
    icon: "crown",
    title: "cupTitle",
    detail: "cupDetail",
  },
  {
    href: "/hotseat",
    icon: "users",
    title: "hotseatTitle",
    detail: "hotseatDetail",
  },
  {
    href: "/practice",
    icon: "board",
    title: "practiceTitle",
    detail: "practiceDetail",
  },
] as const;

function CupHome() {
  const t = useTranslations("pages");
  return (
    <div className="app-shell">
      <AppHeader active="home" />
      <main className="site-container play-page">
        <PageHeader
          eyebrow={<>AVACLASH CUP</>}
          title={t("homeTitle")}
          description={t("homeDescription")}
        />
        <ul className="grid gap-3 md:grid-cols-3" aria-label={t("modes")}>
          {cupModes.map(({ href, icon, title, detail }) => (
            <li key={href}>
              <Link
                href={href}
                className={`surface-card mode-card ${href === "/tournaments" ? "mode-card-featured" : ""}`}
              >
                <span className="mode-card-icon">
                  <Icon name={icon} />
                </span>
                <div className="mode-card-copy">
                  <h2>{t(title)}</h2>
                  <p>{t(detail)}</p>
                </div>
                {href !== "/tournaments" && (
                  <span className="mode-card-note">{t("noWallet")}</span>
                )}
                <Icon name="arrow" className="mode-card-arrow" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="home-discovery mt-8 grid gap-5 md:grid-cols-2">
          <section
            aria-labelledby="open-tournaments"
            className="home-tournaments grid content-start gap-3"
          >
            <div className="home-panel-heading">
              <h2
                id="open-tournaments"
                className="text-description font-semibold"
              >
                {t("openCups")}
              </h2>
              <Link href="/tournaments" className="text-link">
                {t("allCups")}
              </Link>
            </div>
            <FeaturedTournament />
          </section>
          <TournamentElo compact />
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

export default function HomePage() {
  const uiText = useUiCopy();
  if (tournamentEnabled) return <CupHome />;
  return (
    <div className="app-shell">
      <AppHeader />
      <ConfigErrorBanner />
      <main className="site-container play-page">
        <PageHeader
          eyebrow={<>{uiText("messageReadyToPlay")}</>}
          title={
            <>
              {uiText("messageOneBoard")}{" "}
              <span>{uiText("messageTwoPlayers")}</span>
            </>
          }
          description={<>{uiText("messagePlay50ChessWithFriends")}</>}
          actions={
            <>
              <div className="intro-meta">
                <span>
                  <Icon name="clock" />
                  {uiText("messageFiveMinutesPerSide")}
                </span>
                <span>
                  <Icon name="shield" />
                  {uiText("messageStandardChessRules")}
                </span>
              </div>
            </>
          }
        />
        <div className="mode-switch" aria-label={uiText("messageGameMode")}>
          <span className="mode-active">
            <Icon name="users" />
            {uiText("messagePlayHeadToHead")}
          </span>
          <Link href="/hotseat">
            <Icon name="board" />
            {uiText("messageSameDevice")}
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
        <RoomLobbyWidget />
        <section
          className="play-notes"
          aria-label={uiText("messageBeforeYouPlay")}
        >
          <div>
            <Icon name="shield" />
            <p>
              <strong>{uiText("messageStakesAreHeldInEscrow")}</strong>
              <span>{uiText("messageTheWinnerReceives95OfThe")}</span>
            </p>
          </div>
          <div>
            <Icon name="info" />
            <p>
              <strong>{uiText("messageOneSeatPerWalletAddress")}</strong>
              <span>{uiText("messageToTestWithAFriendUse")}</span>
            </p>
          </div>
          <Link href="/guide">
            {uiText("messageReadTheGuide")}
            <Icon name="arrow" />
          </Link>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
