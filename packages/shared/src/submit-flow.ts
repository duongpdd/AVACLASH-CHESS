import {
  verifyResultProposal,
  type SeenTerminalEvents,
} from "./verify-result.js";
import { type ResultProposalMessage } from "./schemas.js";
import { getEip712Domain, EIP712_TYPES } from "./eip712.js";
import { CHESS_ESCROW_ABI } from "./abi/ChessEscrow.js";

export interface SubmitResultFlowParams {
  proposal: ResultProposalMessage;
  relaySignature: `0x${string}`;
  moves: string[];
  whiteAddress: `0x${string}`;
  blackAddress: `0x${string}`;
  roomId: number;
  chainId: number;
  escrowAddress: `0x${string}`;
  now?: number;
  seenEvents?: SeenTerminalEvents;
  signTypedData: (typedData: any) => Promise<`0x${string}`>;
  writeContract: (args: any) => Promise<`0x${string}`>;
}

export interface SubmitResultFlowResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
  shouldRequestNewProposal?: boolean;
}

export async function submitResultFlow(
  params: SubmitResultFlowParams
): Promise<SubmitResultFlowResult> {
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const verifyOutcome = verifyResultProposal({
    proposal: params.proposal,
    moves: params.moves,
    whiteAddress: params.whiteAddress,
    blackAddress: params.blackAddress,
    roomId: params.roomId,
    chainId: params.chainId,
    escrowAddress: params.escrowAddress,
    now,
    seenEvents: params.seenEvents,
  });

  if (!verifyOutcome.valid) {
    return {
      success: false,
      error: verifyOutcome.error,
      shouldRequestNewProposal: verifyOutcome.shouldRequestNewProposal,
    };
  }

  // 2. Sign Result EIP-712
  const domain = getEip712Domain(params.escrowAddress, params.chainId);
  const typedData = {
    domain,
    types: EIP712_TYPES,
    primaryType: "Result" as const,
    message: {
      matchId: BigInt(params.proposal.roomId),
      winner: params.proposal.winner as `0x${string}`,
      outcome: params.proposal.outcome,
      reason: params.proposal.reason,
      moveCount: params.proposal.moveCount,
      movesHash: params.proposal.movesHash as `0x${string}`,
      nonce: BigInt(params.proposal.nonce),
      deadline: BigInt(params.proposal.deadline),
    },
  };

  let mySignature: `0x${string}`;
  try {
    mySignature = await params.signTypedData(typedData);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "User rejected signature",
    };
  }

  // 3. Write contract
  try {
    const txHash = await params.writeContract({
      address: params.escrowAddress,
      abi: CHESS_ESCROW_ABI,
      functionName: "submitResult",
      args: [
        BigInt(params.proposal.roomId),
        params.proposal.winner as `0x${string}`,
        params.proposal.outcome,
        params.proposal.reason,
        params.proposal.moveCount,
        params.proposal.movesHash as `0x${string}`,
        BigInt(params.proposal.nonce),
        BigInt(params.proposal.deadline),
        mySignature,
        params.relaySignature,
      ],
    });
    return {
      success: true,
      txHash,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Contract call failed",
    };
  }
}
