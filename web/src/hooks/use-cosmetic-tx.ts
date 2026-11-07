"use client";

import { useRef, useState } from "react";
import { useAccount, usePublicClient, useSendTransaction } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { encodeFunctionData, type EncodeFunctionDataParameters } from "viem";
import { COSMETICS_ABI } from "@avaclash/shared";
import { CHAIN_ID, COSMETICS_ADDRESS, cosmeticsEnabled } from "@/config/env";

type CosmeticCall = Omit<
  EncodeFunctionDataParameters<
    typeof COSMETICS_ABI,
    "claimTrophy" | "equip" | "unequip"
  >,
  "abi"
>;

export function useCosmeticTx() {
  const t = useTranslations("cosmetics");
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: CHAIN_ID });
  const { sendTransactionAsync } = useSendTransaction();
  const cache = useQueryClient();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function send(call: CosmeticCall) {
    if (pending.current) return false;
    if (!cosmeticsEnabled || !address || !client || chainId !== CHAIN_ID) {
      setFailed(true);
      setMessage(t("txWrongNetwork"));
      return false;
    }

    pending.current = true;
    setBusy(true);
    setFailed(false);
    setMessage(t("txChecking"));
    try {
      const code = await client.getCode({ address: COSMETICS_ADDRESS });
      if (!code || code === "0x") {
        setMessage(t("txNoContract"));
        setFailed(true);
        return false;
      }
      const data = encodeFunctionData({ ...call, abi: COSMETICS_ABI });
      const gas = await client.estimateGas({
        account: address,
        to: COSMETICS_ADDRESS,
        data,
      });
      setMessage(t("txConfirmWallet"));
      const hash = await sendTransactionAsync({
        account: address,
        chainId: CHAIN_ID,
        to: COSMETICS_ADDRESS,
        data,
        gas: gas + gas / 5n + 5000n,
      });
      setMessage(t("txWaiting"));
      const receipt = await client.waitForTransactionReceipt({
        hash,
        timeout: 90_000,
      });
      if (receipt.status !== "success") {
        setMessage(t("txReverted"));
        setFailed(true);
        return false;
      }
      setMessage(t("txConfirmed"));
      await cache.invalidateQueries({ queryKey: ["cosmetics", CHAIN_ID] });
      return true;
    } catch (error) {
      const viemError = error as {
        name?: string;
        walk?: (fn: (cause: Error) => boolean) => Error;
      };
      const rejected =
        viemError?.name === "UserRejectedRequestError" ||
        viemError?.walk?.((cause) => cause.name === "UserRejectedRequestError")
          ?.name === "UserRejectedRequestError";
      setFailed(true);
      setMessage(rejected ? t("txRejected") : t("txFailed"));
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { send, busy, message, failed };
}

export type CosmeticTx = ReturnType<typeof useCosmeticTx>;
