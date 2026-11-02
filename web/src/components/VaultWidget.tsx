"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { AVA_CLASH_META_ABI } from "@avaclash/shared";
import { CHAIN_ID, META_ADDRESS, CURRENCY_SYMBOL } from "@/config/env";
import { useContractBytecodeGuard } from "@/hooks/useContractBytecodeGuard";
import { decodeContractError } from "@/utils/errors";
import TxStatusAlert from "./TxStatusAlert";
import SeasonRewardsWidget from "./SeasonRewardsWidget";
import WalletAction from "./WalletAction";
import type { TxStep } from "@/hooks/useCreateRoom";

export default function VaultWidget() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { isBlocked } = useContractBytecodeGuard();
  const [amount, setAmount] = useState("0.5");
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const principal = useReadContract({
    address: META_ADDRESS,
    chainId: CHAIN_ID,
    abi: AVA_CLASH_META_ABI,
    functionName: "noLossPrincipal",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });
  const points = useReadContract({
    address: META_ADDRESS,
    chainId: CHAIN_ID,
    abi: AVA_CLASH_META_ABI,
    functionName: "seasonPoints",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });
  const { writeContractAsync, data: hash, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ chainId: CHAIN_ID, hash });
  const pending = step === "waiting_wallet" || receipt.isLoading;
  const actualStep: TxStep =
    receipt.data?.status === "reverted" || receipt.error
      ? "error"
      : receipt.data?.status === "success"
        ? "success"
        : step;
  async function transact(deposit: boolean) {
    reset();
    setError(null);
    if (!address || chainId !== CHAIN_ID || isBlocked) {
      setError("Hãy nối ví đúng mạng trước khi giao dịch.");
      setStep("error");
      return;
    }
    try {
      const value = deposit ? parseEther(amount) : undefined;
      if (deposit && (!value || value < parseEther("0.5")))
        throw Error(`Tối thiểu 0.5 ${CURRENCY_SYMBOL} mỗi lần gửi.`);
      setStep("waiting_wallet");
      if (deposit)
        await writeContractAsync({
          address: META_ADDRESS,
          chainId: CHAIN_ID,
          abi: AVA_CLASH_META_ABI,
          functionName: "enterNoLossVault",
          value,
        });
      else
        await writeContractAsync({
          address: META_ADDRESS,
          chainId: CHAIN_ID,
          abi: AVA_CLASH_META_ABI,
          functionName: "exitNoLossVault",
        });
      setStep("confirming");
    } catch (err) {
      setError(decodeContractError(err).message);
      setStep("error");
    }
  }
  return (
    <section className="w-full space-y-4 text-left">
      <h2 className="section-title">Vault tiền gốc</h2>
      {!address && <WalletAction />}
      <p className="helper-text">
        Gửi từ 0.5 {CURRENCY_SYMBOL}, rút toàn bộ tiền gốc bất cứ lúc nào. Vault
        hiện không tạo lợi suất. Điểm mùa không tự động đổi thành tiền; thưởng
        phụ thuộc quỹ và danh sách từng mùa được công bố.
      </p>
      <p>
        Tiền gốc:{" "}
        {principal.data === undefined ? "—" : formatEther(principal.data)}{" "}
        {CURRENCY_SYMBOL}
      </p>
      <p>Điểm mùa: {points.data?.toString() ?? "—"}</p>
      {(principal.error || points.error) && (
        <p role="alert">Không đọc được dữ liệu Vault. Hãy kiểm tra mạng.</p>
      )}
      <label className="field-label">
        Số tiền gửi ({CURRENCY_SYMBOL})
        <input
          className="form-input mt-2"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <div className="flex gap-4">
        <button
          className="button-primary"
          disabled={pending || !address || chainId !== CHAIN_ID || isBlocked}
          onClick={() => void transact(true)}
        >
          Gửi tiền gốc
        </button>
        <button
          className="button-secondary"
          disabled={
            pending ||
            !address ||
            chainId !== CHAIN_ID ||
            isBlocked ||
            !principal.data
          }
          onClick={() => void transact(false)}
        >
          Rút toàn bộ
        </button>
      </div>
      {!address && <p>Nối ví ở đầu trang để dùng Vault.</p>}
      <TxStatusAlert
        step={actualStep}
        errorMessage={
          error ||
          receipt.error?.message ||
          (receipt.data?.status === "reverted"
            ? "Giao dịch bị hoàn tác."
            : null)
        }
        txHash={hash}
        onReset={() => {
          reset();
          setStep("idle");
          setError(null);
        }}
      />
      <SeasonRewardsWidget />
    </section>
  );
}
