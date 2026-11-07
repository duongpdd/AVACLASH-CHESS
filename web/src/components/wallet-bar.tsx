"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { formatEther } from "viem";
import { targetChain } from "@/config/wagmi";
import { CHAIN_ID, CURRENCY_SYMBOL, NETWORK_NAME, RPC_URL } from "@/config/env";
import TxStatusAlert from "./tx-status-alert";
import Icon from "./app-icon";
import Dialog from "./modal-dialog";
import { useWithdraw } from "@/hooks/use-withdraw";
import { useContractBytecodeGuard } from "@/hooks/use-contract-bytecode-guard";
import { useAuth } from "@/providers/auth-provider";
import { useClientMounted } from "@/hooks/use-client-mounted";

export default function WalletBar() {
  const uiText = useUiCopy();
  const mounted = useClientMounted();

  const { address, isConnected } = useAccount();
  const {
    connect,
    connectors,
    isPending: isConnecting,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const auth = useAuth();
  const chainId = useChainId();
  const {
    switchChain,
    isPending: isSwitching,
    error: switchError,
  } = useSwitchChain();
  const {
    data: balance,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useBalance({
    address,
    chainId: CHAIN_ID,
    query: { refetchInterval: 4000 },
  });
  const { isBlocked: isConfigBlocked } = useContractBytecodeGuard();
  const {
    pendingBalanceFormatted,
    pendingBalance,
    withdraw,
    step: withdrawStep,
    errorMessage: withdrawError,
    txHash: withdrawHash,
    reset: resetWithdraw,
  } = useWithdraw();

  const [showNetworkGuide, setShowNetworkGuide] = useState(false);

  const isWrongNetwork = mounted && isConnected && chainId !== targetChain.id;

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!mounted) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled
              tone="primary"
              className="!px-3 !py-2"
            >
              <Icon name="wallet" className="h-4 w-4" />
              <span>{uiText("messageConnectWallet")}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="wallet-network rounded-md border border-foreground/10 px-2 py-1 text-xs text-muted-foreground">
            {NETWORK_NAME}
          </span>
          {(connectError || switchError) && (
            <p role="alert" className="text-xs text-status-danger">
              {switchError
                ? uiText("messageCouldNotSwitchNetworksOpenYour")
                : uiText("messageCouldNotConnectOpenMetamaskOr")}
            </p>
          )}
          {/* Connected Wallet Info */}
          {isConnected && address ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {/* Pending Withdrawals Pull Badge */}
              {pendingBalance > BigInt(0) && (
                <button
                  type="button"
                  onClick={() => withdraw()}
                  disabled={
                    isConfigBlocked ||
                    isWrongNetwork ||
                    withdrawStep === "waiting_wallet" ||
                    withdrawStep === "confirming"
                  }
                  className={`flex items-center gap-1.5 font-semibold text-xs px-3 py-2 rounded-lg transition-all ${
                    isConfigBlocked
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "border border-status-success/30 text-status-success hover:bg-status-success/10"
                  }`}
                  title={
                    isConfigBlocked
                      ? uiText("messageBlockedByASmartContractConfiguration")
                      : uiText("messagePrizeOrRefundFundsAreAvailable")
                  }
                >
                  <span>
                    {uiText("messageWithdraw")} {pendingBalanceFormatted}{" "}
                    {CURRENCY_SYMBOL}
                  </span>
                </button>
              )}

              {/* Balance & Address Pill */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/10 bg-card/70 px-3 py-2 text-xs">
                <span className="font-mono text-status-warning font-bold">
                  {balance
                    ? `${parseFloat(formatEther(balance.value)).toFixed(3)} ${balance.symbol}`
                    : isLoadingBalance
                      ? uiText("messageReadingBalance")
                      : balanceError
                        ? uiText("messageCouldNotReadTheBalance")
                        : `0.000 ${CURRENCY_SYMBOL}`}
                </span>
                <span className="h-3 w-px bg-foreground/20" />
                <span
                  className="font-mono text-foreground font-semibold"
                  title={address}
                >
                  {truncateAddress(address)}
                </span>
              </div>

              {/* Disconnect Button */}
              <button
                type="button"
                onClick={() => {
                  void auth.signOut();
                  disconnect();
                }}
                className="min-h-11 rounded-xl border border-foreground/10 bg-muted/80 hover:bg-status-danger/40 hover:border-status-danger/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:text-status-danger transition-all"
                title={uiText("messageDisconnectWallet")}
              >
                {uiText("messageDisconnect")}
              </button>
            </div>
          ) : (
            /* Connect Wallet Buttons */
            <div className="flex items-center gap-2">
              {connectors.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  disabled={isConnecting}
                  onClick={() => connect({ connector: c })}
                  tone="primary"
                  className="!px-3 !py-2"
                >
                  <Icon name="wallet" className="h-4 w-4" />
                  <span>
                    {isConnecting
                      ? uiText("messageConnecting")
                      : connectors.length > 1
                        ? uiText("messageConnectWallet2", {
                            p0: String(c.name),
                          })
                        : uiText("messageConnectWallet")}
                  </span>
                </Button>
              ))}
            </div>
          )}
          <TxStatusAlert
            step={withdrawStep}
            errorMessage={withdrawError}
            txHash={withdrawHash}
            onReset={resetWithdraw}
            successMessage={uiText("messageFundsWereWithdrawnToYourWallet")}
          />
        </div>
      </div>
      {/* Wrong Network Warning & Switch Button */}
      {isWrongNetwork && (
        <div className="wallet-network-warning flex flex-wrap items-center gap-2 bg-status-danger/20 border border-status-danger/40 rounded-xl px-3 py-1.5 text-xs text-status-danger">
          <span className="font-semibold">
            {uiText("messageWrongNetwork2")}
          </span>
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: targetChain.id })}
            className="min-h-11 bg-status-danger hover:bg-status-danger text-background font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm"
          >
            {isSwitching
              ? uiText("messageSwitching")
              : uiText("messageSwitchTo", { p0: String(targetChain.name) })}
          </button>
          <button
            type="button"
            onClick={() => setShowNetworkGuide(!showNetworkGuide)}
            className="min-h-11 underline text-status-danger hover:text-foreground"
            title={uiText("messageViewManualNetworkSettings")}
          >
            {uiText("messageNetworkSetupGuide")}
          </button>
        </div>
      )}

      {/* Network Guide Modal */}
      {showNetworkGuide && (
        <Dialog
          titleId="network-guide-title"
          onClose={() => setShowNetworkGuide(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-foreground/10 bg-card p-6 shadow-2xl text-left text-foreground flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
              <h3
                id="network-guide-title"
                className="text-base font-bold text-status-warning"
              >
                {uiText("messageAddTheNetwork")} {targetChain.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowNetworkGuide(false)}
                className="text-muted-foreground hover:text-foreground text-lg"
              >
                ✕
              </button>
            </div>
            <div className="text-xs space-y-2.5 text-foreground font-mono">
              <div className="bg-background p-2.5 rounded-lg border border-foreground/5">
                <span className="text-muted-foreground block">
                  {uiText("messageNetworkName2")}
                </span>
                <span className="font-bold text-foreground">
                  {targetChain.id === 43113
                    ? "Avalanche Fuji Testnet"
                    : "Anvil Localhost"}
                </span>
              </div>
              <div className="bg-background p-2.5 rounded-lg border border-foreground/5">
                <span className="text-muted-foreground block">RPC URL:</span>
                <span className="font-bold text-foreground break-all">
                  {RPC_URL}
                </span>
              </div>
              <div className="bg-background p-2.5 rounded-lg border border-foreground/5">
                <span className="text-muted-foreground block">Chain ID:</span>
                <span className="font-bold text-foreground">
                  {targetChain.id}
                </span>
              </div>
              <div className="bg-background p-2.5 rounded-lg border border-foreground/5">
                <span className="text-muted-foreground block">
                  {uiText("messageCurrencySymbol")}
                </span>
                <span className="font-bold text-foreground">
                  {targetChain.nativeCurrency.symbol}
                </span>
              </div>
              {targetChain.blockExplorers?.default && (
                <div className="bg-background p-2.5 rounded-lg border border-foreground/5">
                  <span className="text-muted-foreground block">
                    Block Explorer:
                  </span>
                  <span className="font-bold text-foreground break-all">
                    {targetChain.blockExplorers.default.url}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-status-warning/80">
              {uiText("messageOpenMetamaskOrCoreWalletThen")}
            </p>
            <button
              type="button"
              onClick={() => setShowNetworkGuide(false)}
              className="w-full bg-muted hover:bg-muted text-foreground font-bold py-2 rounded-xl transition-all"
            >
              {uiText("messageClose")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
