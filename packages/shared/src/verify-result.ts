import { computeMovesHash } from "./hash.js";
import { replay } from "./replay.js";
import {
  OutcomeCode,
  ReasonCode,
  reasonToCode,
  codeToReason,
} from "./types.js";
import { ZERO_ADDRESS } from "./eip712.js";
import type { ResultProposalMessage } from "./schemas.js";

export interface SeenTerminalEvents {
  resignSeen?: boolean;
  timeoutSeen?: boolean;
  drawAcceptSeen?: boolean;
  resignerColor?: "w" | "b";
  timeoutPlayer?: "w" | "b";
  lastClockSync?: { whiteMs: number; blackMs: number };
}

export interface VerifyResultParams {
  proposal: ResultProposalMessage;
  moves: string[];
  whiteAddress: `0x${string}`;
  blackAddress: `0x${string}`;
  roomId: number;
  chainId: number;
  escrowAddress: `0x${string}`;
  now: number; // Unix timestamp in seconds
  seenEvents?: SeenTerminalEvents;
}

export interface VerifyResultSuccess {
  valid: true;
  reasonText: string;
}

export interface VerifyResultFailure {
  valid: false;
  error: string;
  shouldRequestNewProposal?: boolean;
}

export type VerifyResultOutcome = VerifyResultSuccess | VerifyResultFailure;

/**
 * Pure verification function that thoroughly validates a result proposal
 * from Relay BEFORE any player signs it.
 *
 * Rejects with a descriptive error message if any check fails:
 * - proposal.roomId != roomId
 * - movesHash != computeMovesHash(local moves); moveCount != moves.length
 * - outcome and winner do not match player colors (0 -> white; 1 -> black; 2 -> ZERO_ADDRESS)
 * - reason does not match replayMoves (natural checkmate/draw vs client-seen terminal events)
 * - deadline has passed or has less than 120 seconds remaining
 */
export function verifyResultProposal(params: VerifyResultParams): VerifyResultOutcome {
  const {
    proposal,
    moves,
    whiteAddress,
    blackAddress,
    roomId,
    now,
    seenEvents,
  } = params;

  // 1. Validate roomId
  if (proposal.roomId !== roomId) {
    return {
      valid: false,
      error: `Proposal roomId (${proposal.roomId}) does not match expected roomId (${roomId}).`,
    };
  }

  // 2. Validate moveCount
  if (proposal.moveCount !== moves.length) {
    return {
      valid: false,
      error: `Proposal moveCount (${proposal.moveCount}) does not match local moves count (${moves.length}).`,
    };
  }

  // 3. Validate movesHash
  const localMovesHash = computeMovesHash(moves);
  if (proposal.movesHash.toLowerCase() !== localMovesHash.toLowerCase()) {
    return {
      valid: false,
      error: `Proposal movesHash (${proposal.movesHash}) does not match computed local movesHash (${localMovesHash}).`,
    };
  }

  // 4. Validate winner and outcome alignment with player addresses
  if (proposal.outcome === OutcomeCode.WhiteWin) {
    if (proposal.winner.toLowerCase() !== whiteAddress.toLowerCase()) {
      return {
        valid: false,
        error: `Proposal claims WhiteWin but winner address (${proposal.winner}) does not match White player (${whiteAddress}).`,
      };
    }
  } else if (proposal.outcome === OutcomeCode.BlackWin) {
    if (proposal.winner.toLowerCase() !== blackAddress.toLowerCase()) {
      return {
        valid: false,
        error: `Proposal claims BlackWin but winner address (${proposal.winner}) does not match Black player (${blackAddress}).`,
      };
    }
  } else if (proposal.outcome === OutcomeCode.Draw) {
    if (proposal.winner.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
      return {
        valid: false,
        error: `Proposal claims Draw but winner address (${proposal.winner}) is not address(0).`,
      };
    }
  } else {
    return {
      valid: false,
      error: `Invalid outcome code: ${proposal.outcome}. Must be 0 (White), 1 (Black), or 2 (Draw).`,
    };
  }

  // 5. Validate moves and outcome consistency with chess engine replay
  const replayResult = replay(moves);
  if (!replayResult.valid) {
    return {
      valid: false,
      error: "Move sequence is invalid according to standard chess rules.",
    };
  }

  if (replayResult.outcome === "white" || replayResult.outcome === "black") {
    // Natural checkmate ending
    const expectedOutcome =
      replayResult.outcome === "white"
        ? OutcomeCode.WhiteWin
        : OutcomeCode.BlackWin;
    const expectedReason = ReasonCode.Checkmate;

    if (proposal.reason !== expectedReason) {
      return {
        valid: false,
        error: `Replay indicates natural checkmate, but proposal reason is ${codeToReason(proposal.reason)} (${proposal.reason}).`,
      };
    }
    if (proposal.outcome !== expectedOutcome) {
      return {
        valid: false,
        error: `Replay indicates ${replayResult.outcome} checkmated opponent, but proposal outcome is ${proposal.outcome}.`,
      };
    }
  } else if (replayResult.outcome === "draw") {
    // Natural draw ending (stalemate, 3-fold repetition, 50-move, insufficient material)
    const expectedReason = reasonToCode(replayResult.reason!);

    if (proposal.outcome !== OutcomeCode.Draw) {
      return {
        valid: false,
        error: `Replay indicates natural draw (${replayResult.reason}), but proposal outcome is ${proposal.outcome}.`,
      };
    }
    if (proposal.reason !== expectedReason) {
      return {
        valid: false,
        error: `Replay indicates draw by ${replayResult.reason}, but proposal reason is ${codeToReason(proposal.reason)} (${proposal.reason}).`,
      };
    }
  } else {
    // Replay outcome is "ongoing" — game did NOT end by chess board rules.
    // In this state, only external terminal events are accepted (resign, timeout, draw_agreed)
    // AND the client MUST have seen the corresponding message from relay.
    if (proposal.reason === ReasonCode.Resign) {
      if (!seenEvents?.resignSeen) {
        return {
          valid: false,
          error: "Proposal claims resignation, but client never received a resign event from relay.",
        };
      }
      if (proposal.outcome === OutcomeCode.Draw) {
        return {
          valid: false,
          error: "Resignation cannot result in a Draw outcome.",
        };
      }
      if (seenEvents?.resignerColor) {
        const expectedWinner =
          seenEvents.resignerColor === "w" ? blackAddress : whiteAddress;
        const expectedOutcome =
          seenEvents.resignerColor === "w"
            ? OutcomeCode.BlackWin
            : OutcomeCode.WhiteWin;
        if (
          proposal.winner.toLowerCase() !== expectedWinner.toLowerCase() ||
          proposal.outcome !== expectedOutcome
        ) {
          return {
            valid: false,
            error: `Resigning player (${seenEvents.resignerColor}) cannot win the game. Winner must be opponent (${expectedWinner}).`,
          };
        }
      }
    } else if (proposal.reason === ReasonCode.Timeout) {
      if (!seenEvents?.timeoutSeen) {
        return {
          valid: false,
          error: "Proposal claims timeout, but client never received a timeout event from relay.",
        };
      }
      if (proposal.outcome === OutcomeCode.Draw) {
        return {
          valid: false,
          error: "Timeout cannot result in a Draw outcome.",
        };
      }
      if (seenEvents?.timeoutPlayer) {
        const expectedWinner =
          seenEvents.timeoutPlayer === "w" ? blackAddress : whiteAddress;
        const expectedOutcome =
          seenEvents.timeoutPlayer === "w"
            ? OutcomeCode.BlackWin
            : OutcomeCode.WhiteWin;
        if (
          proposal.winner.toLowerCase() !== expectedWinner.toLowerCase() ||
          proposal.outcome !== expectedOutcome
        ) {
          return {
            valid: false,
            error: `Timed out player (${seenEvents.timeoutPlayer}) cannot win the game. Winner must be opponent (${expectedWinner}).`,
          };
        }
      }
      if (seenEvents?.lastClockSync) {
        const loserColor: "w" | "b" =
          proposal.outcome === OutcomeCode.WhiteWin ? "b" : "w";
        const loserMs =
          loserColor === "w"
            ? seenEvents.lastClockSync.whiteMs
            : seenEvents.lastClockSync.blackMs;
        const THRESHOLD_MS = 500;
        const currentTurn: "w" | "b" = moves.length % 2 === 0 ? "w" : "b";
        const isLoserTurn = currentTurn === loserColor;
        if (loserMs > THRESHOLD_MS || (loserMs > 0 && !isLoserTurn)) {
          return {
            valid: false,
            error: `Proposal claims timeout for ${loserColor}, but clock shows ${loserMs}ms time remaining.`,
          };
        }
      }
    } else if (proposal.reason === ReasonCode.Agreement) {
      if (!seenEvents?.drawAcceptSeen) {
        return {
          valid: false,
          error: "Proposal claims draw agreement, but client never received a draw_accept event from relay.",
        };
      }
      if (proposal.outcome !== OutcomeCode.Draw) {
        return {
          valid: false,
          error: "Draw agreement proposal outcome must be Draw (2).",
        };
      }
    } else {
      return {
        valid: false,
        error: `Game is still ongoing according to chess rules. Reason ${codeToReason(proposal.reason)} is invalid without natural board termination.`,
      };
    }
  }

  // 6. Validate deadline
  if (proposal.deadline <= now) {
    return {
      valid: false,
      error: `Proposal deadline has expired (${proposal.deadline} <= ${now}). Please request a new result signature.`,
      shouldRequestNewProposal: true,
    };
  }

  const remainingSeconds = proposal.deadline - now;
  if (remainingSeconds < 120) {
    return {
      valid: false,
      error: `Proposal deadline has less than 120 seconds remaining (${remainingSeconds}s left). Please request a new result signature.`,
      shouldRequestNewProposal: true,
    };
  }

  // 7. All checks passed
  return {
    valid: true,
    reasonText: "Proposal successfully verified against local game state and rules.",
  };
}
