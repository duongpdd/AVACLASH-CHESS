"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/status/field-error";
import { ValueWithStatus } from "@/components/status/value-with-status";
import { showApiError } from "@/utils/show-api-error";
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
import { useContractBytecodeGuard } from "@/hooks/use-contract-bytecode-guard";
import { decodeContractError } from "@/utils/errors";
import TxStatusAlert from "./tx-status-alert";
import SeasonRewardsWidget from "./season-rewards-widget";
import WalletAction from "./wallet-action";
import type { TxStep } from "@/hooks/use-create-room";

export default function VaultWidget() {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const chainId = useChainId();
  const { isBlocked } = useContractBytecodeGuard();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ amount: string }>({ defaultValues: { amount: "0.5" } });
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
  async function transact(value?: bigint) {
    reset();
    setError(null);
    if (!address || chainId !== CHAIN_ID || isBlocked) {
      setError(uiText("messageConnectYourWalletToTheCorrect"));
      setStep("error");
      return;
    }
    try {
      setStep("waiting_wallet");
      if (value !== undefined)
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
      const message = uiText.existing(decodeContractError(err).message);
      showApiError(message);
      setError(message);
      setStep("error");
    }
  }
  return (
    <section className="w-full space-y-4 text-left">
      <h2 className="text-description font-semibold">
        {uiText("messagePrincipalVault")}
      </h2>
      {!address && <WalletAction />}
      <p className="helper-text">
        {uiText("messageDepositAtLeast05")} {CURRENCY_SYMBOL}
        {uiText("messageAndWithdrawAllYourPrincipalWhenever")}
      </p>
      <p>
        {uiText("messagePrincipal2")}{" "}
        <ValueWithStatus
          error={!!principal.error}
          loading={principal.isLoading}
          noData={principal.data === undefined}
        >
          {principal.data === undefined ? null : formatEther(principal.data)}
        </ValueWithStatus>{" "}
        {CURRENCY_SYMBOL}
      </p>
      <p>
        {uiText("messageSeasonPoints")}{" "}
        <ValueWithStatus
          error={!!points.error}
          loading={points.isLoading}
          noData={points.data === undefined}
        >
          {points.data?.toString()}
        </ValueWithStatus>
      </p>
      {(principal.error || points.error) && (
        <p role="alert">{uiText("messageCouldNotLoadVaultDataCheck")}</p>
      )}
      <form
        className="grid gap-4 md:max-w-lg"
        noValidate
        onSubmit={handleSubmit(({ amount }) => transact(parseEther(amount)))}
      >
        <label className="text-label">
          {uiText("messageDepositAmount")}
          {CURRENCY_SYMBOL})
          <Input
            className="mt-2"
            inputMode="decimal"
            aria-invalid={!!errors.amount}
            {...register("amount", {
              setValueAs: (value: string) => value.trim(),
              validate: (value) => {
                try {
                  if (parseEther(value) >= parseEther("0.5")) return true;
                } catch {}
                return uiText("messageDepositAtLeast05Per", {
                  p0: String(CURRENCY_SYMBOL),
                });
              },
            })}
          />
          <FieldError message={errors.amount?.message} />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            tone="primary"
            type="submit"
            disabled={
              pending ||
              isSubmitting ||
              !address ||
              chainId !== CHAIN_ID ||
              isBlocked
            }
          >
            {uiText("messageDepositPrincipal")}
          </Button>
          <Button
            disabled={
              pending ||
              isSubmitting ||
              !address ||
              chainId !== CHAIN_ID ||
              isBlocked ||
              !principal.data
            }
            onClick={() => void transact()}
          >
            {uiText("messageWithdrawAll")}
          </Button>
        </div>
      </form>
      {!address && <p>{uiText("messageConnectYourWalletAboveToUse")}</p>}
      <TxStatusAlert
        step={actualStep}
        errorMessage={
          error ||
          receipt.error?.message ||
          (receipt.data?.status === "reverted"
            ? uiText("messageTheTransactionReverted")
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
