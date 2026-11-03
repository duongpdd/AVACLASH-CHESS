import { useRef, useState } from "react";
import { useAccount, usePublicClient, useSendTransaction } from "wagmi";
import {
  encodeFunctionData,
  type EncodeFunctionDataParameters,
  type Hash,
} from "viem";
import { TOURNAMENT_ABI } from "@avaclash/shared";
import { CHAIN_ID, TOURNAMENT_ADDRESS, tournamentEnabled } from "@/config/env";

export const tournamentContract = {
  abi: TOURNAMENT_ABI,
  address: TOURNAMENT_ADDRESS,
  chainId: CHAIN_ID,
} as const;

export function useTournamentTx() {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: CHAIN_ID });
  const { sendTransactionAsync } = useSendTransaction();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hash>();

  async function send(
    call: Omit<EncodeFunctionDataParameters<typeof TOURNAMENT_ABI>, "abi">,
    value?: bigint,
  ) {
    if (pending.current) return;
    if (!client || !address || chainId !== CHAIN_ID || !tournamentEnabled) {
      setMessage("Hãy kết nối ví và chọn đúng mạng thử nghiệm.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setHash(undefined);
    setMessage("Đang kiểm tra giao dịch…");
    try {
      const data = encodeFunctionData({ ...call, abi: TOURNAMENT_ABI });
      const code = await client.getCode({ address: TOURNAMENT_ADDRESS });
      if (!code || code === "0x")
        throw Error("Không tìm thấy hợp đồng giải trên mạng đã chọn.");
      const gasEstimate = await client.estimateGas({
        account: address,
        to: TOURNAMENT_ADDRESS,
        data,
        value,
      });
      setMessage("Xác nhận thao tác trong ví.");
      const hash = await sendTransactionAsync({
        chainId: CHAIN_ID,
        to: TOURNAMENT_ADDRESS,
        data,
        value,
        // A report can update the review deadline in the next block even when
        // it was a same-value storage write in the estimate block.
        gas: gasEstimate + gasEstimate / 5n + 5000n,
      });
      setHash(hash);
      setMessage("Đang chờ xác nhận trên mạng…");
      const receipt = await client.waitForTransactionReceipt({
        hash,
        timeout: 90_000,
      });
      if (receipt.status !== "success") throw Error("Giao dịch bị hoàn tác.");
      setMessage("Đã xác nhận trên mạng.");
      return receipt;
    } catch (error) {
      const short = (error as { shortMessage?: string })?.shortMessage;
      setMessage(
        short ??
          (error instanceof Error
            ? error.message
            : "Không thực hiện được giao dịch."),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { send, busy, message, hash };
}

export type TournamentTx = ReturnType<typeof useTournamentTx>;
