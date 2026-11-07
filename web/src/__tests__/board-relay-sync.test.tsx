// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { BoardSyncController } from "../game/board-sync-controller";

describe("Board Relay Synchronization Component / Controller (Turn 3c-3 Item 1)", () => {
  it("only executes move on board after receiving move echo from relay (no optimistic move)", () => {
    const onMoveMock = vi.fn();
    const controller = new BoardSyncController({
      playerColor: "w",
      canMove: true,
      onMove: onMoveMock,
    });

    // Player attempts legal move e2 -> e4
    const attempt = controller.handleUserMoveAttempt("e2", "e4");
    expect(attempt.valid).toBe(true);
    expect(onMoveMock).toHaveBeenCalledWith("e2e4", "e4");

    // Board state MUST NOT have e4 applied yet (relay is source of truth, no optimistic move)
    expect(controller.getAppliedMoves()).toEqual([]);
    expect(controller.getPieceAt("e2")).toEqual({ type: "p", color: "w" });
    expect(controller.getPieceAt("e4")).toBeNull();

    // Now relay broadcasts confirmed move echo
    controller.syncMoves(["e2e4"]);
    expect(controller.getAppliedMoves()).toEqual(["e2e4"]);
    expect(controller.getPieceAt("e2")).toBeNull();
    expect(controller.getPieceAt("e4")).toEqual({ type: "p", color: "w" });
  });

  it("blocks user move attempt when canMove is false", () => {
    const onMoveMock = vi.fn();
    const controller = new BoardSyncController({
      playerColor: "w",
      canMove: false,
      onMove: onMoveMock,
    });

    const attempt = controller.handleUserMoveAttempt("e2", "e4");
    expect(attempt.valid).toBe(false);
    expect(attempt.error).toMatch(/not allowed to move/i);
    expect(onMoveMock).not.toHaveBeenCalled();
    expect(controller.getPieceAt("e2")).toEqual({ type: "p", color: "w" });
  });

  it("blocks moving opponent pieces", () => {
    const onMoveMock = vi.fn();
    const controller = new BoardSyncController({
      playerColor: "w",
      canMove: true,
      onMove: onMoveMock,
    });

    // White player tries to move black pawn e7
    const attempt = controller.handleUserMoveAttempt("e7", "e5");
    expect(attempt.valid).toBe(false);
    expect(onMoveMock).not.toHaveBeenCalled();
  });

  it("reverts selection on rejected or invalid move attempt", () => {
    const onMoveMock = vi.fn();
    const controller = new BoardSyncController({
      playerColor: "w",
      canMove: true,
      onMove: onMoveMock,
    });

    // Illegal move: pawn e2 -> e5 (cannot jump 3 squares)
    const attempt = controller.handleUserMoveAttempt("e2", "e5");
    expect(attempt.valid).toBe(false);
    expect(onMoveMock).not.toHaveBeenCalled();
    expect(controller.getSelectedSquare()).toBeNull();
  });

  it("applies incremental moves exactly once and resets on history diverged", () => {
    const controller = new BoardSyncController({
      playerColor: "w",
      canMove: true,
    });

    const applySpy = vi.spyOn(controller, "applyConfirmedMove");

    // First update: 2 moves
    controller.syncMoves(["e2e4", "e7e5"]);
    expect(applySpy).toHaveBeenCalledTimes(2);
    expect(controller.getAppliedMoves()).toEqual(["e2e4", "e7e5"]);

    // Second update with same moves -> no duplicate application
    controller.syncMoves(["e2e4", "e7e5"]);
    expect(applySpy).toHaveBeenCalledTimes(2);

    // Third update appending 1 move
    controller.syncMoves(["e2e4", "e7e5", "g1f3"]);
    expect(applySpy).toHaveBeenCalledTimes(3);
    expect(controller.getAppliedMoves()).toEqual(["e2e4", "e7e5", "g1f3"]);

    // Divergent history (reset)
    const rebuildSpy = vi.spyOn(controller, "rebuildFromMoves");
    controller.syncMoves(["d2d4", "d7d5"]);
    expect(rebuildSpy).toHaveBeenCalledWith(["d2d4", "d7d5"]);
    expect(controller.getAppliedMoves()).toEqual(["d2d4", "d7d5"]);
  });
});
