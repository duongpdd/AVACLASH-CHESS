import { useState, useCallback } from "react";
import { useSignTypedData, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  CHESS_ESCROW_ABI,
  EIP712_TYPES,
  getEip712Domain,
  verifyResultProposal,
  type ResultProposalMessage,
  type SeenTerminalEvents,
} from "@avaclash/shared";
import { ESCROW_ADDRESS, CHAIN_ID } from "@/config/env";
import { decodeContractError } from "@/utils/errors";

export type SubmitResultStep =
  | "idle"
  | "verifying"
  | "signing"
  | "submitting"
  | "confirmed"
  | "error";

export interface SubmitParams {
  proposal: ResultProposalMessage;
  relaySignature: `0x${string}`;
  moves: string[];
  white: `0x${string}`;
  black: `0x${string}`;
  seenEvents?: SeenTerminalEvents;
  onRequestNewResult?: () => void;
}

export function useSubmitResult(roomId?: bigint | number) {
  const [step, setStep] = useState<SubmitResultStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsNewProposal, setNeedsNewProposal] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isSuccess, setIsSuccess] = useState(false);

  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, reset: resetWrite } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setNeedsNewProposal(false);
    setTxHash(undefined);
    setIsSuccess(false);
    resetWrite();
  }, [resetWrite]);

  const submit = useCallback(
    async ({
      proposal,
      relaySignature,
      moves,
      white,
      black,
      seenEvents,
      onRequestNewResult,
    }: SubmitParams) => {
      setError(null);
      setNeedsNewProposal(false);

      const targetRoomId =
        roomId !== undefined ? Number(roomId) : proposal.roomId;

      // 1. Pure verification before signing
      setStep("verifying");
      const now = Math.floor(Date.now() / 1000);
      const verifyOutcome = verifyResultProposal({
        proposal,
        moves,
        whiteAddress: white,
        blackAddress: black,
        roomId: targetRoomId,
        chainId: CHAIN_ID,
        escrowAddress: ESCROW_ADDRESS,
        now,
        seenEvents,
      });

      if (!verifyOutcome.valid) {
        setError(verifyOutcome.error);
        if (verifyOutcome.shouldRequestNewProposal) {
          setNeedsNewProposal(true);
        }
        setStep("error");
        return;
      }

      // 2. Sign Result EIP-712
      setStep("signing");
      const domain = getEip712Domain(ESCROW_ADDRESS, CHAIN_ID);
      const typedData = {
        domain,
        types: EIP712_TYPES,
        primaryType: "Result" as const,
        message: {
          matchId: BigInt(proposal.roomId),
          winner: proposal.winner as `0x${string}`,
          outcome: proposal.outcome,
          reason: proposal.reason,
          moveCount: proposal.moveCount,
          movesHash: proposal.movesHash as `0x${string}`,
          nonce: BigInt(proposal.nonce),
          deadline: BigInt(proposal.deadline),
        },
      };

      let mySignature: `0x${string}`;
      try {
        mySignature = await signTypedDataAsync(typedData as any);
      } catch (err: any) {
        if (
          err?.name === "UserRejectedRequestError" ||
          /user rejected|denied/i.test(err?.message || "")
        ) {
          setError("Người dùng đã từ chối ký xác nhận kết quả.");
        } else {
          setError(`Lỗi ký kết quả: ${err?.message || "Unknown error"}`);
        }
        setStep("error");
        return;
      }

      // 3. Submit transaction to ChessEscrow contract
      setStep("submitting");
      try {
        const hash = await writeContractAsync({
          address: ESCROW_ADDRESS,
          abi: CHESS_ESCROW_ABI,
          functionName: "submitResult",
          args: [
            BigInt(proposal.roomId),
            proposal.winner as `0x${string}`,
            proposal.outcome,
            proposal.reason,
            proposal.moveCount,
            proposal.movesHash as `0x${string}`,
            BigInt(proposal.nonce),
            BigInt(proposal.deadline),
            mySignature,
            relaySignature,
          ],
        });

        setTxHash(hash);
        setStep("confirmed");
        setIsSuccess(true);
      } catch (err: any) {
        const rawMsg = err?.message || "";
        const decoded = decodeContractError(err);

        if (rawMsg.includes("DeadlineExpired") || decoded.includes("hết hạn")) {
          setError(
            "Chữ ký kết quả đã hết hạn (DeadlineExpired). Đang yêu cầu relay tạo chữ ký mới..."
          );
          setNeedsNewProposal(true);
          onRequestNewResult?.();
        } else if (
          rawMsg.includes("RoomNotActive") ||
          decoded.includes("không còn hoạt động") ||
          decoded.includes("chưa bắt đầu")
        ) {
          setError(
            "Phòng đã được đối thủ hoặc bên thứ ba nộp kết quả thành công (RoomNotActive)."
          );
        } else if (
          rawMsg.includes("NonceAlreadyUsed") ||
          decoded.includes("Nonce")
        ) {
          setError(
            "Nonce của kết quả này đã được sử dụng (NonceAlreadyUsed)."
          );
        } else {
          setError(`Giao dịch submitResult thất bại: ${decoded || rawMsg}`);
        }
        setStep("error");
      }
    },
    [roomId, signTypedDataAsync, writeContractAsync]
  );

  return {
    step,
    isSubmitting: step === "signing" || step === "submitting" || isConfirming,
    isSuccess: isSuccess || isConfirmed,
    txHash,
    error,
    needsNewProposal,
    submit,
    reset,
  };
}
