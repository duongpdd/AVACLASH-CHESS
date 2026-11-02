import { useState, useCallback } from "react";
import {
  useSignTypedData,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
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
  "idle" | "verifying" | "signing" | "submitting" | "confirmed" | "error";

export interface SubmitParams {
  proposal: ResultProposalMessage;
  relaySignature: `0x${string}`;
  moves: string[];
  white: `0x${string}`;
  black: `0x${string}`;
  seenEvents?: SeenTerminalEvents;
  onRequestNewResult?: () => void;
  refetchRoom?: () => Promise<unknown>;
  refetchBalance?: () => Promise<unknown>;
}

export function useSubmitResult(roomId?: bigint | number) {
  const [step, setStep] = useState<SubmitResultStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [needsNewProposal, setNeedsNewProposal] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isSuccess, setIsSuccess] = useState(false);

  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, reset: resetWrite } = useWriteContract();

  const { data: receipt, isLoading: isConfirming } =
    useWaitForTransactionReceipt({
      chainId: CHAIN_ID,
      hash: txHash,
    });

  const confirmed = Boolean(txHash && receipt?.status === "success");
  const reverted = Boolean(txHash && receipt?.status === "reverted");

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setStatusMessage(null);
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
      refetchRoom,
      refetchBalance,
    }: SubmitParams) => {
      setError(null);
      setStatusMessage(null);
      setNeedsNewProposal(false);
      setTxHash(undefined);
      setIsSuccess(false);

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
        mySignature = await signTypedDataAsync(typedData);
      } catch (err) {
        const signingError =
          err instanceof Error ? err : new Error(String(err));
        if (
          signingError.name === "UserRejectedRequestError" ||
          /user rejected|denied/i.test(signingError.message)
        ) {
          setError("Người dùng đã từ chối ký xác nhận kết quả.");
        } else {
          setError(`Lỗi ký kết quả: ${signingError.message}`);
        }
        setStep("error");
        return;
      }

      // 3. Submit transaction to ChessEscrow contract
      setStep("submitting");
      try {
        const hash = await writeContractAsync({
          address: ESCROW_ADDRESS,
          chainId: CHAIN_ID,
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
      } catch (err) {
        const decoded = decodeContractError(err);

        if (decoded.code === "DeadlineExpired") {
          setError(
            "Chữ ký kết quả đã hết hạn (DeadlineExpired). Đang yêu cầu relay tạo chữ ký mới...",
          );
          setNeedsNewProposal(true);
          onRequestNewResult?.();
        } else if (decoded.code === "RoomNotActive") {
          if (refetchRoom) {
            try {
              const fetched = await refetchRoom();
              const result =
                fetched && typeof fetched === "object"
                  ? (fetched as Record<string, unknown>)
                  : undefined;
              const roomData = (
                result && "data" in result ? result.data : result
              ) as { status?: unknown } | undefined;
              if (
                roomData &&
                (roomData.status === 2 ||
                  roomData.status === "Settled" ||
                  roomData.status === 2n)
              ) {
                setStep("confirmed");
                setIsSuccess(true);
                setStatusMessage("Đã được nộp");
                setError(null);
                if (refetchBalance) {
                  await refetchBalance();
                }
                return;
              }
            } catch {
              // ignore refetch failure and proceed to error state
            }
          }
          setError(
            "Phòng đã được đối thủ hoặc bên thứ ba nộp kết quả thành công (RoomNotActive).",
          );
        } else if (decoded.code === "NonceAlreadyUsed") {
          setError("Nonce của kết quả này đã được sử dụng (NonceAlreadyUsed).");
        } else if (decoded.code === "UserRejectedRequestError") {
          setError("Giao dịch đã bị từ chối từ ví.");
        } else {
          setError(decoded.message);
        }
        setStep("error");
      }
    },
    [roomId, signTypedDataAsync, writeContractAsync],
  );

  return {
    step: reverted ? "error" : confirmed ? "confirmed" : step,
    statusMessage: confirmed
      ? "Kết quả đã được xác nhận thành công trên blockchain."
      : statusMessage,
    isSubmitting: step === "signing" || step === "submitting" || isConfirming,
    isSuccess: !reverted && (isSuccess || confirmed),
    txHash,
    error: reverted
      ? "Giao dịch bị từ chối (reverted) trên mạng. Bạn có thể kiểm tra chi tiết trên Snowtrace Explorer."
      : error,
    needsNewProposal,
    submit,
    reset,
  };
}
