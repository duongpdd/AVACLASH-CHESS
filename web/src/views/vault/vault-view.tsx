import { useUiCopy } from "@/i18n/use-ui-copy";
import { CardCustom } from "@/components/ui/card-custom";
import { PageHeader } from "@/components/ui/page-header";
import ConfigErrorBanner from "@/components/config-error-banner";
import VaultWidget from "@/components/vault-widget";
import Icon from "@/components/app-icon";
import Link from "next/link";
import { CURRENCY_SYMBOL } from "@/config/env";
export default function VaultPage() {
  const uiText = useUiCopy();
  return (
    <div className="app-shell">
      <ConfigErrorBanner />
      <div className="site-container play-page">
        <PageHeader
          eyebrow={<>{uiText("messagePrincipalAndRewards")}</>}
          title={
            <>
              Vault <span>{uiText("messagePrincipal")}</span>
            </>
          }
          description={<>{uiText("messageManageDepositsAndCheckRewardsBy")}</>}
        />
        <div className="vault-layout">
          <CardCustom as="div">
            <VaultWidget />
          </CardCustom>
          <aside className="vault-explainer">
            <span className="icon-tile">
              <Icon name="shield" />
            </span>
            <h2 className="text-description">
              {uiText("messageBeforeYouDeposit")}
            </h2>
            <p>
              {uiText("messageDepositAtLeast05")} {CURRENCY_SYMBOL}{" "}
              {uiText("messagePerTransactionYouCanWithdrawAll")}
            </p>
            <ul>
              <li>{uiText("messageTheVaultCurrentlyGeneratesNoYield")}</li>
              <li>{uiText("messageSeasonPointsDoNotAutomaticallyConvert")}</li>
              <li>{uiText("messageRewardsAreAvailableOnceTheSeason")}</li>
              <li>{uiText("messageYourWalletShowsTheNetworkFee")}</li>
            </ul>
            <Link href="/guide#vault" className="text-link">
              {uiText("messageLearnAboutTheVault")}
              <Icon name="arrow" />
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
