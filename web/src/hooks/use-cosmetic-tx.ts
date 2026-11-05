"use client";

import { useRef, useState } from "react";
import { useAccount, usePublicClient, useSendTransaction } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, type EncodeFunctionDataParameters } from "viem";
import { COSMETICS_ABI, COSMETIC_AUCTION_ABI } from "@avaclash/shared";
import {
  AUCTION_ADDRESS,
  CHAIN_ID,
  COSMETICS_ADDRESS,
  cosmeticsEnabled,
} from "@/config/env";

type CosmeticCall = Omit<
  EncodeFunctionDataParameters<typeof COSMETICS_ABI>,
  "abi"
>;
type AuctionCall = Omit<
  EncodeFunctionDataParameters<typeof COSMETIC_AUCTION_ABI>,
  "abi"
>;
type Call =
  | ({ contract: "cosmetics" } & CosmeticCall)
  | ({ contract: "auction"; value?: bigint } & AuctionCall);

export function useCosmeticTx() {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: CHAIN_ID });
  const { sendTransactionAsync } = useSendTransaction();
  const cache = useQueryClient();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function send(call: Call) {
    if (pending.current) return false;
    if (!cosmeticsEnabled || !address || !client || chainId !== CHAIN_ID) {
      setFailed(true);
      setMessage("Hãy kết nối ví và chọn đúng mạng thử nghiệm.");
      return false;
    }

    pending.current = true;
    setBusy(true);
    setFailed(false);
    setMessage("Đang kiểm tra giao dịch.");
    try {
      const to =
        call.contract === "cosmetics" ? COSMETICS_ADDRESS : AUCTION_ADDRESS;
      const code = await client.getCode({ address: to });
      if (!code || code === "0x") {
        setMessage("Không tìm thấy hợp đồng trên mạng này.");
        setFailed(true);
        return false;
      }
      const data =
        call.contract === "cosmetics"
          ? encodeFunctionData({ ...call, abi: COSMETICS_ABI })
          : encodeFunctionData({ ...call, abi: COSMETIC_AUCTION_ABI });
      const value = call.contract === "auction" ? call.value : undefined;
      const gas = await client.estimateGas({
        account: address,
        to,
        data,
        value,
      });
      setMessage("Hãy xác nhận trong ví.");
      const hash = await sendTransactionAsync({
        account: address,
        chainId: CHAIN_ID,
        to,
        data,
        value,
        gas: gas + gas / 5n + 5000n,
      });
      setMessage("Đang chờ xác nhận trên chuỗi.");
      const receipt = await client.waitForTransactionReceipt({
        hash,
        timeout: 90_000,
      });
      if (receipt.status !== "success") {
        setMessage("Giao dịch đã bị hoàn tác.");
        setFailed(true);
        return false;
      }
      setMessage("Đã xác nhận trên chuỗi.");
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
      setMessage(
        rejected
          ? "Bạn đã từ chối giao dịch trong ví."
          : "Chưa xác nhận được giao dịch. Hãy kiểm tra ví và làm mới dữ liệu trước khi thử lại.",
      );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { send, busy, message, failed };
}

export type CosmeticTx = ReturnType<typeof useCosmeticTx>;
