"use client";

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
import { useWithdraw } from "@/hooks/useWithdraw";

export default function WalletBar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  const {
    pendingBalanceFormatted,
    pendingBalance,
    withdraw,
    step: withdrawStep,
  } = useWithdraw();

  const [showNetworkGuide, setShowNetworkGuide] = useState(false);

  const isWrongNetwork = isConnected && chainId !== targetChain.id;

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Wrong Network Warning & Switch Button */}
      {isWrongNetwork && (
        <div className="flex items-center gap-2 bg-rose-500/20 border border-rose-500/40 rounded-xl px-3 py-1.5 text-xs text-rose-300">
          <span className="font-semibold">Sai mạng!</span>
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: targetChain.id })}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm"
          >
            {isSwitching ? "Đang đổi..." : `Chuyển sang ${targetChain.name}`}
          </button>
          <button
            type="button"
            onClick={() => setShowNetworkGuide(!showNetworkGuide)}
            className="underline text-rose-200 hover:text-white"
            title="Xem thông số cấu hình mạng thủ công"
          >
            Hướng dẫn thêm mạng
          </button>
        </div>
      )}

      {/* Network Guide Modal */}
      {showNetworkGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-left text-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-amber-400">
                Hướng Dẫn Thêm Mạng {targetChain.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowNetworkGuide(false)}
                className="text-slate-400 hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>
            <div className="text-xs space-y-2.5 text-slate-300 font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                <span className="text-slate-500 block">
                  Tên mạng (Network Name):
                </span>
                <span className="font-bold text-slate-200">
                  {targetChain.id === 43113
                    ? "Avalanche Fuji Testnet"
                    : "Anvil Localhost"}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                <span className="text-slate-500 block">RPC URL:</span>
                <span className="font-bold text-slate-200 break-all">
                  {targetChain.id === 43113
                    ? "https://api.avax-test.network/ext/bc/C/rpc"
                    : "http://127.0.0.1:8545"}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                <span className="text-slate-500 block">Chain ID:</span>
                <span className="font-bold text-slate-200">
                  {targetChain.id}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                <span className="text-slate-500 block">
                  Ký hiệu tiền tệ (Symbol):
                </span>
                <span className="font-bold text-slate-200">
                  {targetChain.nativeCurrency.symbol}
                </span>
              </div>
              {targetChain.blockExplorers?.default && (
                <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-500 block">
                    Block Explorer:
                  </span>
                  <span className="font-bold text-slate-200 break-all">
                    {targetChain.blockExplorers.default.url}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-amber-300/80">
              💡 Mở MetaMask hoặc Core Wallet &rarr; Cài đặt &rarr; Mạng
              &rarr; Thêm mạng tùy chỉnh và dán các thông số trên.
            </p>
            <button
              type="button"
              onClick={() => setShowNetworkGuide(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl transition-all"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Connected Wallet Info */}
      {isConnected && address ? (
        <div className="flex items-center gap-2">
          {/* Pending Withdrawals Pull Badge */}
          {pendingBalance > BigInt(0) && (
            <button
              type="button"
              onClick={() => withdraw()}
              disabled={
                withdrawStep === "waiting_wallet" ||
                withdrawStep === "confirming"
              }
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-md hover:brightness-110 transition-all animate-pulse"
              title="Có tiền thắng hoặc tiền hoàn sẵn sàng rút về ví!"
            >
              <span>🎁 Rút: {pendingBalanceFormatted} AVAX</span>
            </button>
          )}

          {/* Balance & Address Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs">
            <span className="font-mono text-amber-300 font-bold">
              {balance
                ? `${parseFloat(formatEther(balance.value)).toFixed(3)} ${balance.symbol}`
                : "0.000 AVAX"}
            </span>
            <span className="h-3 w-px bg-white/20" />
            <span
              className="font-mono text-slate-300 font-semibold"
              title={address}
            >
              {truncateAddress(address)}
            </span>
          </div>

          {/* Disconnect Button */}
          <button
            type="button"
            onClick={() => disconnect()}
            className="rounded-xl border border-white/10 bg-slate-800/80 hover:bg-rose-900/40 hover:border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-rose-300 transition-all"
            title="Ngắt kết nối ví"
          >
            Ngắt ví
          </button>
        </div>
      ) : (
        /* Connect Wallet Buttons */
        <div className="flex items-center gap-2">
          {connectors.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={isConnecting}
              onClick={() => connect({ connector: c })}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs sm:text-sm px-4 py-2 shadow-lg transition-all"
            >
              <span>🦊</span>
              <span>
                {isConnecting
                  ? "Đang kết nối..."
                  : "Nối ví (MetaMask / Core)"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
