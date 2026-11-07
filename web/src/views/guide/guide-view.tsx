import { useUiCopy } from "@/i18n/use-ui-copy";
import { useTranslations } from "next-intl";
import { CardCustom } from "@/components/ui/card-custom";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import Icon from "@/components/app-icon";
import WalletAction from "@/components/wallet-action";
import {
  CURRENCY_SYMBOL,
  NETWORK_NAME,
  CHAIN_ID,
  RPC_URL,
  tournamentEnabled,
  FUJI_FAUCET_URL,
} from "@/config/env";
export default function GuidePage() {
  const uiText = useUiCopy();
  const t = useTranslations("pages");
  if (tournamentEnabled)
    return (
      <div className="app-shell">
        <AppHeader active="guide" />
        <main className="site-container play-page space-y-5">
          <PageHeader
            eyebrow={<>{uiText("messageAvaclashCupGuide")}</>}
            title={t("guideTitle")}
            description={t("guideDescription")}
            actions={
              <>
                <Link href="/tournaments" className="button-primary">
                  {t("viewCups")}
                </Link>
              </>
            }
          />
          <CardCustom>
            <ol className="guide-steps">
              <li>
                <span>01</span>
                <div>
                  <h2 className="text-description">{t("signUp")}</h2>
                  <p>{t("signUpDetail", { network: NETWORK_NAME })}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <WalletAction />
                    {CHAIN_ID === 43113 && (
                      <a
                        className="button-secondary"
                        href={FUJI_FAUCET_URL}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("testTokens")}
                      </a>
                    )}
                    <Link className="button-secondary" href="/tournaments">
                      {t("viewCups")}
                    </Link>
                  </div>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h2 className="text-description">{t("playMatch")}</h2>
                  <p>{t("playMatchDetail")}</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h2 className="text-description">{t("report")}</h2>
                  <p>{t("reportDetail")}</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h2 className="text-description">{t("claim")}</h2>
                  <p>{t("claimDetail")}</p>
                </div>
              </li>
            </ol>
          </CardCustom>
        </main>
        <AppFooter />
      </div>
    );
  return (
    <div className="app-shell">
      <AppHeader active="guide" />
      <main className="site-container play-page">
        <PageHeader
          eyebrow={<>{uiText("messageGetStarted")}</>}
          title={
            <>
              {uiText("messageJoinARoom")}{" "}
              <span>{uiText("messageItSYourMove")}</span>
            </>
          }
          description={<>{uiText("messageLearnHowToConnectAWallet")}</>}
        />
        <div className="guide-layout">
          <CardCustom>
            <ol className="guide-steps">
              <li>
                <span>01</span>
                <div>
                  <h2 className="text-description">
                    {uiText("messageConnectToTheCorrectNetwork")}
                  </h2>
                  <p>
                    {uiText("messageUseMetamaskOrCoreOn")} {NETWORK_NAME}
                    {uiText("messageConnectingIsFreeYouLlNeed")}{" "}
                    {CURRENCY_SYMBOL}{" "}
                    {uiText("messageTestTokensForStakesAndNetwork")}
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h2 className="text-description">
                    {uiText("messageCreateOrJoinARoom")}
                  </h2>
                  <p>{uiText("messageTheCreatorPicksAColorAnd")}</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h2 className="text-description">
                    {uiText("messageSignToJoinTheMatch")}
                  </h2>
                  <p>{uiText("messageOnceBothPlayersHaveJoinedOpen")}</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h2 className="text-description">
                    {uiText("messagePlayConfirmTheResultAndWithdraw")}
                  </h2>
                  <p>{uiText("messageMovesRequireNoTransactionsSignAnd")}</p>
                </div>
              </li>
            </ol>
            <Link href="/" className="button-primary mt-6">
              {uiText("messageGoToTheLobby")}
              <Icon name="arrow" />
            </Link>
          </CardCustom>
          <aside className="space-y-4">
            <details className="surface-card">
              <summary className="section-title !text-base">
                {uiText("messageAddANetworkToYourWallet")}
              </summary>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">
                    {uiText("messageNetworkName")}
                  </dt>
                  <dd className="mt-1">{NETWORK_NAME}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">RPC</dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {RPC_URL}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {uiText("messageChainIdCurrencySymbol")}
                  </dt>
                  <dd className="mt-1">
                    {CHAIN_ID} · {CURRENCY_SYMBOL}
                  </dd>
                </div>
              </dl>
              <p className="helper-text mt-4">
                {uiText("messageSelectTheOptionToAddA")}
              </p>
            </details>
            <CardCustom>
              <h2 className="text-description font-semibold">
                {uiText("messageJustWantToPlayChess")}
              </h2>
              <p className="helper-text my-3">
                {uiText("messageTwoPlayersCanShareADevice")}
              </p>
              <Link href="/hotseat" className="button-secondary w-full">
                {uiText("messagePlayOnTheSameDevice")}
                <Icon name="board" />
              </Link>
            </CardCustom>
            <CardCustom id="vault">
              <h2 className="text-description font-semibold">
                {uiText("messageVaultAndSeasonalRewards")}
              </h2>
              <p className="helper-text mt-3">
                {uiText("messageTheVaultHoldsPrincipalAndCurrently")}
              </p>
            </CardCustom>
          </aside>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
