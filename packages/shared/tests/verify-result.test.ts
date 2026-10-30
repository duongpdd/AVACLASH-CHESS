import { describe, it, expect } from "vitest";
import { verifyResultProposal } from "../src/verify-result.js";
import { computeMovesHash } from "../src/hash.js";
import { OutcomeCode, ReasonCode } from "../src/types.js";
import { ZERO_ADDRESS } from "../src/eip712.js";

describe("verifyResultProposal (Turn 3c-2 Item 2)", () => {
  const white = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  const black = "0x2222222222222222222222222222222222222222" as `0x${string}`;
  const escrow = "0x3333333333333333333333333333333333333333" as `0x${string}`;
  const roomId = 42;
  const chainId = 43113;
  const baseNow = 1700000000;
  const validDeadline = baseNow + 1800; // 30 minutes in future

  // Quick 4-move Scholar's mate (White wins)
  // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
  const checkmateMoves = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"];
  const checkmateMovesHash = computeMovesHash(checkmateMoves);

  it("verifies a valid natural checkmate proposal", () => {
    const result = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Checkmate,
        moveCount: checkmateMoves.length,
        movesHash: checkmateMovesHash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: checkmateMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(result.valid).toBe(true);
  });

  it("rejects tampered roomId", () => {
    const result = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId: 999, // Tampered
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Checkmate,
        moveCount: checkmateMoves.length,
        movesHash: checkmateMovesHash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: checkmateMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/roomId/i);
  });

  it("rejects tampered movesHash", () => {
    const result = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Checkmate,
        moveCount: checkmateMoves.length,
        movesHash: ("0x" + "aa".repeat(32)) as `0x${string}`, // Tampered
        nonce: 1,
        deadline: validDeadline,
      },
      moves: checkmateMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/movesHash/i);
  });

  it("rejects tampered moveCount", () => {
    const result = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Checkmate,
        moveCount: 99, // Tampered
        movesHash: checkmateMovesHash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: checkmateMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/moveCount/i);
  });

  it("rejects tampered winner (claims Black or arbitrary address when White won)", () => {
    const result = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: black, // Tampered
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Checkmate,
        moveCount: checkmateMoves.length,
        movesHash: checkmateMovesHash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: checkmateMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/winner/i);
  });

  it("rejects tampered outcome (claims Draw with non-zero winner)", () => {
    const result = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.Draw, // Tampered
        reason: ReasonCode.Stalemate,
        moveCount: checkmateMoves.length,
        movesHash: checkmateMovesHash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: checkmateMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/winner|address\(0\)/i);
  });

  it("rejects checkmate reason when replay indicates ongoing game", () => {
    const ongoingMoves = ["e2e4", "e7e5"];
    const hash = computeMovesHash(ongoingMoves);

    const result = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Checkmate, // False checkmate claim
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ongoing|checkmate/i);
  });

  it("verifies resignation if and only if resignSeen is true", () => {
    const ongoingMoves = ["e2e4", "e7e5", "g1f3"];
    const hash = computeMovesHash(ongoingMoves);

    // Without resignSeen -> REJECT
    const resNoSeen = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Resign,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: { resignSeen: false },
    });
    expect(resNoSeen.valid).toBe(false);
    expect(resNoSeen.error).toMatch(/resign/i);

    // With resignSeen -> ACCEPT
    const resSeen = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Resign,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: { resignSeen: true },
    });
    expect(resSeen.valid).toBe(true);
  });

  it("verifies timeout if and only if timeoutSeen is true", () => {
    // 2 moves -> White turn -> White loses on timeout -> Black wins
    const ongoingMoves = ["e2e4", "e7e5"];
    const hash = computeMovesHash(ongoingMoves);

    // Without timeoutSeen -> REJECT
    const resNoSeen = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: black,
        outcome: OutcomeCode.BlackWin,
        reason: ReasonCode.Timeout,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: { timeoutSeen: false },
    });
    expect(resNoSeen.valid).toBe(false);
    expect(resNoSeen.error).toMatch(/timeout/i);

    // With timeoutSeen -> ACCEPT
    const resSeen = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: black,
        outcome: OutcomeCode.BlackWin,
        reason: ReasonCode.Timeout,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: { timeoutSeen: true },
    });
    expect(resSeen.valid).toBe(true);
  });

  it("verifies draw agreement if and only if drawAcceptSeen is true", () => {
    const ongoingMoves = ["e2e4", "e7e5"];
    const hash = computeMovesHash(ongoingMoves);

    const resNoSeen = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: ZERO_ADDRESS,
        outcome: OutcomeCode.Draw,
        reason: ReasonCode.Agreement,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: { drawAcceptSeen: false },
    });
    expect(resNoSeen.valid).toBe(false);
    expect(resNoSeen.error).toMatch(/agreement|draw/i);

    const resSeen = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: ZERO_ADDRESS,
        outcome: OutcomeCode.Draw,
        reason: ReasonCode.Agreement,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: { drawAcceptSeen: true },
    });
    expect(resSeen.valid).toBe(true);
  });

  it("rejects expired deadline and flags shouldRequestNewProposal", () => {
    const expiredProposal = {
      type: "result_proposal" as const,
      roomId,
      winner: white,
      outcome: OutcomeCode.WhiteWin,
      reason: ReasonCode.Checkmate,
      moveCount: checkmateMoves.length,
      movesHash: checkmateMovesHash,
      nonce: 1,
      deadline: baseNow - 10, // Already expired
    };

    const res = verifyResultProposal({
      proposal: expiredProposal,
      moves: checkmateMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(res.valid).toBe(false);
    expect(res.shouldRequestNewProposal).toBe(true);
    expect(res.error).toMatch(/expired/i);
  });

  it("rejects deadline with under 120 seconds remaining and flags shouldRequestNewProposal", () => {
    const lowDeadlineProposal = {
      type: "result_proposal" as const,
      roomId,
      winner: white,
      outcome: OutcomeCode.WhiteWin,
      reason: ReasonCode.Checkmate,
      moveCount: checkmateMoves.length,
      movesHash: checkmateMovesHash,
      nonce: 1,
      deadline: baseNow + 100, // Only 100 seconds left (< 120)
    };

    const res = verifyResultProposal({
      proposal: lowDeadlineProposal,
      moves: checkmateMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
    });

    expect(res.valid).toBe(false);
    expect(res.shouldRequestNewProposal).toBe(true);
    expect(res.error).toMatch(/120 seconds/i);
  });
  it("rejects resignation when winner is the resigning player (Turn 3c-2-fix Item 1)", () => {
    const ongoingMoves = ["e2e4", "e7e5"];
    const hash = computeMovesHash(ongoingMoves);

    const res = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Resign,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: {
        resignSeen: true,
        resignerColor: "w",
      },
    });

    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/resigning player|cannot win/i);
  });

  it("rejects timeout when winner is the timed out player (Turn 3c-2-fix Item 1)", () => {
    const ongoingMoves = ["e2e4"];
    const hash = computeMovesHash(ongoingMoves);

    const res = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Timeout,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: {
        timeoutSeen: true,
        timeoutPlayer: "w",
      },
    });

    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/timed out player|cannot win/i);
  });

  it("accepts timeout when clock_sync shows loser still had time (even multiple hours remaining) if timed out player is on turn (Turn 3c-3 Item 2)", () => {
    const ongoingMoves = ["e2e4"];
    const hash = computeMovesHash(ongoingMoves);

    const res = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: white,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Timeout,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: {
        timeoutSeen: true,
        // Even if lastClockSync recorded 5 hours (18,000,000 ms) remaining for Black
        lastClockSync: { whiteMs: 290000, blackMs: 5 * 3600 * 1000 },
      },
    });

    expect(res.valid).toBe(true);
  });

  it("rejects timeout when the player assigned timeout loss was NOT on turn (Turn 3c-3 Item 2)", () => {
    const ongoingMoves = ["e2e4"]; // 1 move -> Black's turn
    const hash = computeMovesHash(ongoingMoves);

    // Falsely claims White timed out (even though it's Black's turn)
    const res = verifyResultProposal({
      proposal: {
        type: "result_proposal",
        roomId,
        winner: black,
        outcome: OutcomeCode.BlackWin,
        reason: ReasonCode.Timeout,
        moveCount: ongoingMoves.length,
        movesHash: hash,
        nonce: 1,
        deadline: validDeadline,
      },
      moves: ongoingMoves,
      whiteAddress: white,
      blackAddress: black,
      roomId,
      chainId,
      escrowAddress: escrow,
      now: baseNow,
      seenEvents: {
        timeoutSeen: true,
      },
    });

    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/turn/i);
  });
});
