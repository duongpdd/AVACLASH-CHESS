"use client";
import { useUiCopy } from "@/i18n/use-ui-copy";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useLocale } from "next-intl";
import { formatDateTime } from "@/utils/format-date";
import { formatCurrency } from "@/utils/format-currency";
import { AVA_CLASH_META_ABI } from "@avaclash/shared";
import { CHAIN_ID, META_ADDRESS } from "@/config/env";
import { parseRewardClaim } from "@/utils/reward-claims";
import { decodeContractError } from "@/utils/errors";
import { useContractBytecodeGuard } from "@/hooks/use-contract-bytecode-guard";
import type { TxStep } from "@/hooks/use-create-room";
import TxStatusAlert from "./tx-status-alert";

export default function SeasonRewardsWidget() {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const locale = useLocale();
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
      fileError = e instanceof Error ? e.message : uiText("messageInvalidFile");
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
    <section className="space-y-3 border-t border-foreground/10 pt-4">
      <h3 className="font-bold">{uiText("messageClaimSeasonalRewards")}</h3>
      <p className="text-sm">
        {uiText("messageRewardsAreAvailableOnceASeason")}
      </p>
      <label className="block">
        {uiText("messageRewardAllocationJson")}
        <input
          type="file"
          accept=".json,application/json"
          className="block mt-2 max-w-full text-xs"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 1_000_000) {
              setError(uiText("messageTheFileIsTooLarge"));
              setSource("");
              return;
            }
            try {
              setSource(await file.text());
              setError(null);
            } catch {
              setError(uiText("messageCouldNotReadTheFile"));
            }
          }}
        />
      </label>
      {source && !address && (
        <p>{uiText("messageConnectYourWalletToCheckRewards")}</p>
      )}
      {fileError && <p role="alert">{uiText.existing(fileError)}</p>}
      {allocation && (
        <>
          <p>
            {uiText("messageReward")} {formatCurrency(allocation.amount)}
          </p>
          <p>
            {claimed.data
              ? uiText("messageThisWalletHasAlreadyClaimedThe")
              : published
                ? uiText("messageClaimPeriod", {
                    p0: String(formatDateTime(season.data![3], locale)),
                    p1: String(formatDateTime(season.data![4], locale)),
                  })
                : uiText("messageCouldNotVerifyTheAllocationOn")}
          </p>
          <Button
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
            tone="primary"
          >
            {uiText("messageClaimReward")}
          </Button>
        </>
      )}
      <TxStatusAlert
        step={actualStep}
        errorMessage={
          error ||
          receipt.error?.message ||
          (receipt.data?.status === "reverted"
            ? uiText("messageTheRewardClaimTransactionReverted")
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
