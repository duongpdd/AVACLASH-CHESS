"use client";
import { useUiCopy } from "@/i18n/use-ui-copy";
import { Button } from "@/components/ui/button";
import { useAccount, useChainId, useConnect, useSwitchChain } from "wagmi";
import { targetChain } from "@/config/wagmi";
import { useClientMounted } from "@/hooks/use-client-mounted";
import Icon from "./app-icon";

/** One next action in the lobby; no signing or connection occurs until clicked. */
export default function WalletAction() {
  const uiText = useUiCopy();
  const mounted = useClientMounted();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending, error } = useConnect();
  const {
    switchChain,
    isPending: switching,
    error: switchError,
  } = useSwitchChain();
  if (mounted && isConnected && chainId === targetChain.id) return null;
  const wrongNetwork = mounted && isConnected && chainId !== targetChain.id;
  return (
    <div className="wallet-next-action">
      <Button
        type="button"
        tone="primary"
        className="w-full"
        disabled={
          !mounted ||
          isPending ||
          switching ||
          (!wrongNetwork && !connectors.length)
        }
        onClick={() => {
          if (wrongNetwork) switchChain({ chainId: targetChain.id });
          else if (connectors[0]) connect({ connector: connectors[0] });
        }}
      >
        <Icon name="wallet" />
        {wrongNetwork
          ? switching
            ? uiText("messageSwitchingNetworks")
            : uiText("messageSwitchTo", { p0: String(targetChain.name) })
          : isPending
            ? uiText("messageConfirmTheConnectionInYourWallet")
            : uiText("messageConnectWalletToContinue")}
      </Button>
      <p className="helper-text mt-2 text-center">
        {wrongNetwork
          ? uiText("messageUseTheSameNetworkAsThe")
          : uiText("messageMetamaskOrCoreConnectingIsFree")}
      </p>
      {(error || switchError) && (
        <p role="alert" className="mt-2 text-sm text-status-danger">
          {uiText("messageCouldNot")}{" "}
          {wrongNetwork
            ? uiText("messageSwitchNetworks")
            : uiText("messageConnectTheWallet")}
          {uiText("messageOpenYourWalletCheckTheRequest")}
        </p>
      )}
    </div>
  );
}
