"use client";
import { useAccount, useChainId, useConnect, useSwitchChain } from "wagmi";
import { targetChain } from "@/config/wagmi";
import { useClientMounted } from "@/hooks/useClientMounted";
import Icon from "./Icon";

/** One next action in the lobby; no signing or connection occurs until clicked. */
export default function WalletAction() {
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
      <button
        type="button"
        className="button-primary w-full"
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
            ? "Đang chuyển mạng…"
            : `Chuyển sang ${targetChain.name}`
          : isPending
            ? "Xác nhận kết nối trong ví…"
            : "Nối ví để tiếp tục"}
      </button>
      <p className="helper-text mt-2 text-center">
        {wrongNetwork
          ? "Ví cần dùng cùng mạng với phòng thi đấu."
          : "MetaMask hoặc Core · Nối ví không mất phí"}
      </p>
      {(error || switchError) && (
        <p role="alert" className="mt-2 text-sm text-rose-300">
          Không thể {wrongNetwork ? "chuyển mạng" : "nối ví"}. Hãy mở ví, kiểm
          tra yêu cầu rồi thử lại.
        </p>
      )}
    </div>
  );
}
