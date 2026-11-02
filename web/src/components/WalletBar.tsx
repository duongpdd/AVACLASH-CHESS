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
import { CHAIN_ID, CURRENCY_SYMBOL, NETWORK_NAME, RPC_URL } from "@/config/env";
import TxStatusAlert from "./TxStatusAlert";
import Icon from "./Icon";
import Dialog from "./Dialog";
import { useWithdraw } from "@/hooks/useWithdraw";
import { useContractBytecodeGuard } from "@/hooks/useContractBytecodeGuard";
import { useClientMounted } from "@/hooks/useClientMounted";

export default function WalletBar() {
  const mounted = useClientMounted();

  const { address, isConnected } = useAccount();
  const {
    connect,
    connectors,
    isPending: isConnecting,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();
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
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="button-primary !min-h-10 !px-3 !py-2"
          >
            <Icon name="wallet" className="h-4 w-4" />
            <span>Nối ví</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="wallet-network rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400">
        {NETWORK_NAME}
      </span>
      {(connectError || switchError) && (
        <p role="alert" className="text-xs text-rose-300">
          {switchError
            ? "Chưa đổi được mạng. Hãy mở ví hoặc xem hướng dẫn thêm mạng."
            : "Chưa nối được ví. Hãy mở MetaMask/Core, kiểm tra yêu cầu rồi thử lại."}
        </p>
      )}
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
        <Dialog
          titleId="network-guide-title"
          onClose={() => setShowNetworkGuide(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-left text-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3
                id="network-guide-title"
                className="text-base font-bold text-amber-400"
              >
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
                  {RPC_URL}
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
                  <span className="text-slate-500 block">Block Explorer:</span>
                  <span className="font-bold text-slate-200 break-all">
                    {targetChain.blockExplorers.default.url}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-amber-300/80">
              💡 Mở MetaMask hoặc Core Wallet &rarr; Cài đặt &rarr; Mạng &rarr;
              Thêm mạng tùy chỉnh và dán các thông số trên.
            </p>
            <button
              type="button"
              onClick={() => setShowNetworkGuide(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl transition-all"
            >
              Đóng
            </button>
          </div>
        </Dialog>
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
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10"
              }`}
              title={
                isConfigBlocked
                  ? "Bị khóa: Lỗi cấu hình Smart Contract"
                  : "Có tiền thắng hoặc tiền hoàn sẵn sàng rút về ví!"
              }
            >
              <span>
                Rút: {pendingBalanceFormatted} {CURRENCY_SYMBOL}
              </span>
            </button>
          )}

          {/* Balance & Address Pill */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs">
            <span className="font-mono text-amber-300 font-bold">
              {balance
                ? `${parseFloat(formatEther(balance.value)).toFixed(3)} ${balance.symbol}`
                : isLoadingBalance
                  ? "Đang đọc số dư..."
                  : balanceError
                    ? "Không đọc được số dư"
                    : `0.000 ${CURRENCY_SYMBOL}`}
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
              className="button-primary !min-h-10 !px-3 !py-2"
            >
              <Icon name="wallet" className="h-4 w-4" />
              <span>
                {isConnecting
                  ? "Đang kết nối..."
                  : connectors.length > 1
                    ? `Nối ví (${c.name})`
                    : "Nối ví"}
              </span>
            </button>
          ))}
        </div>
      )}
      <TxStatusAlert
        step={withdrawStep}
        errorMessage={withdrawError}
        txHash={withdrawHash}
        onReset={resetWithdraw}
        successMessage="Đã rút tiền về ví."
      />
    </div>
  );
}
