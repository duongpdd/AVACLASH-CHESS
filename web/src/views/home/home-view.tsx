import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight, ClipboardList, HandHeart, Trophy } from "lucide-react";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import Icon from "@/components/app-icon";
import { tournamentEnabled } from "@/config/env";
import { FeaturedTournament } from "@/components/tournament-catalog";
import TournamentElo from "@/components/tournament-elo";
import { EmptyState } from "@/components/ui-state";
import { ChessPreview } from "./chess-preview";

const communityActions = [
  {
    href: "/tournaments/new",
    icon: ClipboardList,
    title: "organizeTitle",
    detail: "organizeDetail",
    tag: "organizer",
    note: "organizeNote",
  },
  {
    href: "/tournaments?intent=sponsor",
    icon: HandHeart,
    title: "sponsorTitle",
    detail: "sponsorDetail",
    tag: "sponsorTag",
    note: "sponsorNote",
  },
] as const;
const steps = ["create", "compete", "claim"] as const;

export default function HomePage() {
  const t = useTranslations("pages");
  const home = useTranslations("home");
  const brand = useTranslations("brand");
  return (
    <div className="app-shell cup-home cup-home-discovery">
      <AppHeader active="home" />
      <main
        id="main-content"
        className="site-container home-page"
        tabIndex={-1}
      >
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="eyebrow hero-eyebrow">
              <span />
              {brand("full")} · {home("cupEyebrow")}
            </p>
            <h1 id="home-title">
              {home("cupTitle")}
              <span>{home("cupTitleAccent")}</span>
            </h1>
            <p className="hero-description">{home("cupDescription")}</p>
            <div className="hero-actions">
              <Link href="#open-tournaments" className="button-primary">
                {home("findCupCta")}
                <Icon name="arrow" />
              </Link>
              <Link href="/tournaments/new" className="button-secondary">
                <Icon name="plus" />
                {home("createCupCta")}
              </Link>
            </div>
            <p className="hero-reassurance">
              <Icon name="shield" />
              {home("cupReassurance")}
            </p>
            <dl className="cup-facts">
              <div>
                <dt>{home("formatLabel")}</dt>
                <dd>5 + 0</dd>
              </div>
              <div>
                <dt>{home("playersLabel")}</dt>
                <dd>2–8</dd>
              </div>
              <div>
                <dt>{home("entryLabel")}</dt>
                <dd>{home("freeEntry")}</dd>
              </div>
            </dl>
          </div>
          <ChessPreview />
        </section>

        <aside
          className="home-guest-actions"
          aria-labelledby="home-guide-title"
        >
          <h2 id="home-guide-title" className="sr-only">
            {home("warmUp")}
          </h2>
          <Link href="/practice" className="button-secondary">
            <Icon name="board" />
            {home("tryWithoutWallet")}
          </Link>
          <Link href="/hotseat" className="button-secondary">
            {t("hotseatTitle")}
          </Link>
        </aside>

        <section
          id="open-tournaments"
          className="home-open-cups"
          aria-labelledby="open-cups-title"
        >
          <div className="home-section-heading">
            <div>
              <h2 id="open-cups-title">
                <Trophy size={21} aria-hidden />
                {t("openCups")}
              </h2>
              <p className="section-description">{home("browseNote")}</p>
            </div>
            <Link href="/tournaments" className="text-link">
              {t("allCups")}
              <Icon name="arrow" />
            </Link>
          </div>
          {tournamentEnabled ? (
            <FeaturedTournament />
          ) : (
            <EmptyState
              title={home("unavailableTitle")}
              description={home("unavailableDetail")}
              action={
                <Link href="/guide" className="text-link">
                  {home("readGuide")}
                  <Icon name="arrow" />
                </Link>
              }
            />
          )}
          <p className="cup-network-note">{home("networkFeeNote")}</p>
        </section>

        <section
          id="game-modes"
          className="home-community"
          aria-labelledby="community-title"
        >
          <div className="home-section-heading">
            <div>
              <p className="eyebrow">{home("communityEyebrow")}</p>
              <h2 id="community-title">{home("communityTitle")}</h2>
              <p className="section-description">{home("communityDetail")}</p>
            </div>
          </div>
          <ul
            className="mode-grid community-grid"
            aria-label={home("cupActions")}
          >
            {communityActions.map(
              ({ href, icon: ActionIcon, title, detail, tag, note }) => (
                <li key={href}>
                  <Link href={href} className="surface-card mode-card">
                    <div className="mode-card-top">
                      <span className="mode-card-icon">
                        <ActionIcon size={22} aria-hidden />
                      </span>
                      <span className="mode-card-tag">{home(tag)}</span>
                      <ArrowUpRight className="mode-card-arrow" aria-hidden />
                    </div>
                    <div className="mode-card-copy">
                      <h3>{home(title)}</h3>
                      <p>{home(detail)}</p>
                    </div>
                    <span className="mode-card-note">
                      <Icon name="check" />
                      {home(note)}
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="cup-how" aria-labelledby="cup-how-title">
          <div className="home-section-heading">
            <div>
              <p className="eyebrow">{home("howEyebrow")}</p>
              <h2 id="cup-how-title">{home("howTitle")}</h2>
            </div>
            <Link href="/guide" className="text-link">
              {home("readGuide")}
              <Icon name="arrow" />
            </Link>
          </div>
          <ol className="cup-steps">
            {steps.map((step, index) => (
              <li key={step}>
                <span className="cup-step-number">0{index + 1}</span>
                <h3>{home(`${step}StepTitle`)}</h3>
                <p>{home(`${step}StepDetail`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {tournamentEnabled && <TournamentElo compact />}
      </main>
      <AppFooter />
    </div>
  );
}
