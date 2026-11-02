"use client";
import { useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther } from "viem";
import { AVA_CLASH_META_ABI } from "@avaclash/shared";
import { CHAIN_ID, CURRENCY_SYMBOL, META_ADDRESS } from "@/config/env";
import { parseRewardClaim } from "@/utils/reward-claims";
import { decodeContractError } from "@/utils/errors";
import { useContractBytecodeGuard } from "@/hooks/useContractBytecodeGuard";
import type { TxStep } from "@/hooks/useCreateRoom";
import TxStatusAlert from "./TxStatusAlert";

export default function SeasonRewardsWidget() {
  const { address } = useAccount();
  const chainId = useChainId();
  // Keep the source so switching accounts always revalidates the beneficiary.
  const [source, setSource] = useState("");
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);
  let allocation: ReturnType<typeof parseRewardClaim> | undefined;
  let fileError: string | undefined;
  if (source && address) {
    try {
      allocation = parseRewardClaim(source, address, CHAIN_ID, META_ADDRESS);
    } catch (e) {
      fileError = e instanceof Error ? e.message : "Tệp không hợp lệ.";
    }
  }
  const season = useReadContract({
    address: META_ADDRESS,
    chainId: CHAIN_ID,
    abi: AVA_CLASH_META_ABI,
    functionName: "rewardSeasons",
    args: allocation ? [allocation.id] : undefined,
    query: { enabled: !!allocation, refetchInterval: 4000 },
  });
  const claimed = useReadContract({
    address: META_ADDRESS,
    chainId: CHAIN_ID,
    abi: AVA_CLASH_META_ABI,
    functionName: "seasonRewardClaimed",
    args: allocation && address ? [allocation.id, address] : undefined,
    query: { enabled: !!allocation && !!address, refetchInterval: 4000 },
  });
  const { isBlocked } = useContractBytecodeGuard();
  const { writeContractAsync, data: hash, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ chainId: CHAIN_ID, hash });
  const published =
    allocation &&
    season.data &&
    season.data[0].toLowerCase() === allocation.merkleRoot.toLowerCase() &&
    season.data[1].toLowerCase() === allocation.allocationHash.toLowerCase();
  async function claim() {
    if (
      !allocation ||
      !address ||
      !published ||
      claimed.data ||
      chainId !== CHAIN_ID ||
      isBlocked
    )
      return;
    reset();
    setError(null);
    setStep("waiting_wallet");
    try {
      await writeContractAsync({
        address: META_ADDRESS,
        chainId: CHAIN_ID,
        abi: AVA_CLASH_META_ABI,
        functionName: "claimSeasonReward",
        args: [allocation.id, allocation.amount, allocation.proof],
      });
      setStep("confirming");
    } catch (err) {
      setError(decodeContractError(err).message);
      setStep("error");
    }
  }
  const actualStep: TxStep =
    receipt.error || receipt.data?.status === "reverted"
      ? "error"
      : receipt.data?.status === "success"
        ? "success"
        : step;
  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="font-bold">Nhận thưởng mùa</h3>
      <p className="text-sm">
        Chỉ có thưởng khi một mùa được công bố và đã được cấp quỹ. Tải danh sách
        công khai của mùa để kiểm tra ví của bạn.
      </p>
      <label className="block">
        Danh sách thưởng (.json)
        <input
          type="file"
          accept=".json,application/json"
          className="block mt-2 max-w-full text-xs"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 1_000_000) {
              setError("Tệp quá lớn.");
              setSource("");
              return;
            }
            try {
              setSource(await file.text());
              setError(null);
            } catch {
              setError("Không đọc được tệp.");
            }
          }}
        />
      </label>
      {source && !address && <p>Nối ví để kiểm tra phần thưởng.</p>}
      {fileError && <p role="alert">{fileError}</p>}
      {allocation && (
        <>
          <p>
            Phần thưởng: {formatEther(allocation.amount)} {CURRENCY_SYMBOL}
          </p>
          <p>
            {claimed.data
              ? "Ví đã nhận phần thưởng này."
              : published
                ? `Thời gian nhận: ${new Date(Number(season.data![3]) * 1000).toLocaleString("vi-VN")} – ${new Date(Number(season.data![4]) * 1000).toLocaleString("vi-VN")}`
                : "Chưa xác nhận được danh sách trên mạng."}
          </p>
          <button
            disabled={
              !published ||
              !!claimed.data ||
              !!season.data?.[5] ||
              isBlocked ||
              chainId !== CHAIN_ID ||
              step === "waiting_wallet" ||
              receipt.isLoading
            }
            onClick={() => void claim()}
            className="button-primary"
          >
            Nhận thưởng
          </button>
        </>
      )}
      <TxStatusAlert
        step={actualStep}
        errorMessage={
          error ||
          receipt.error?.message ||
          (receipt.data?.status === "reverted"
            ? "Giao dịch nhận thưởng bị hoàn tác."
            : null)
        }
        txHash={hash}
        onReset={() => {
          reset();
          setStep("idle");
          setError(null);
        }}
      />
      {error && step === "idle" && <p role="alert">{error}</p>}
    </section>
  );
}
