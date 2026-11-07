import { useUiCopy } from "@/i18n/use-ui-copy";
import { showApiError } from "@/utils/show-api-error";
import { tournamentRevertMessage } from "@/utils/tournament-errors";
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
  const uiText = useUiCopy();
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
      setMessage(uiText("messageConnectYourWalletAndSelectThe"));
      return;
    }
    pending.current = true;
    setBusy(true);
    setHash(undefined);
    setMessage(uiText("messageCheckingTheTransaction"));
    try {
      const data = encodeFunctionData({ ...call, abi: TOURNAMENT_ABI });
      const code = await client.getCode({ address: TOURNAMENT_ADDRESS });
      if (!code || code === "0x")
        throw Error(uiText("messageCouldNotFindTheTournamentContract"));
      const gasEstimate = await client.estimateGas({
        account: address,
        to: TOURNAMENT_ADDRESS,
        data,
        value,
      });
      setMessage(uiText("messageConfirmInYourWallet"));
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
      setMessage(uiText("messageWaitingForOnChainConfirmation"));
      const receipt = await client.waitForTransactionReceipt({
        hash,
        timeout: 90_000,
      });
      if (receipt.status !== "success")
        throw Error(uiText("messageTheTransactionReverted"));
      setMessage(uiText("messageConfirmedOnChain"));
      return receipt;
    } catch (error) {
      const short = (error as { shortMessage?: string })?.shortMessage;
      const revert = tournamentRevertMessage(error);
      const failure =
        (revert && uiText(revert)) ??
        short ??
        (error instanceof Error
          ? error.message
          : uiText("messageCouldNotCompleteTheTransaction"));
      setMessage(failure);
      showApiError(failure);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { send, busy, message, hash };
}

export type TournamentTx = ReturnType<typeof useTournamentTx>;
