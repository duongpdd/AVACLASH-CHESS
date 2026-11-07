import { describe, it, expect } from "vitest";
import { applyRelayMoves } from "../apply-relay-moves";

describe("applyRelayMoves pure function (Turn 3c-3 Item 1)", () => {
  it("returns append with empty moves when currentMoves equals newMoves", () => {
    const current = ["e2e4", "e7e5"];
    const next = ["e2e4", "e7e5"];
    const result = applyRelayMoves(current, next);
    expect(result).toEqual({ kind: "append", moves: [] });
  });

  it("returns append with delta when newMoves strictly extends currentMoves", () => {
    const current = ["e2e4", "e7e5"];
    const next = ["e2e4", "e7e5", "g1f3", "b8c6"];
    const result = applyRelayMoves(current, next);
    expect(result).toEqual({ kind: "append", moves: ["g1f3", "b8c6"] });
  });

  it("returns reset when newMoves is shorter than currentMoves", () => {
    const current = ["e2e4", "e7e5", "g1f3"];
    const next = ["e2e4"];
    const result = applyRelayMoves(current, next);
    expect(result).toEqual({ kind: "reset", moves: ["e2e4"] });
  });

  it("returns reset when history diverges (reconnect or alternative branch)", () => {
    const current = ["e2e4", "e7e5", "g1f3"];
    const next = ["e2e4", "c7c5", "g1f3"];
    const result = applyRelayMoves(current, next);
    expect(result).toEqual({ kind: "reset", moves: ["e2e4", "c7c5", "g1f3"] });
  });

  it("returns append when current is empty and newMoves has moves", () => {
    const current: string[] = [];
    const next = ["e2e4", "e7e5"];
    const result = applyRelayMoves(current, next);
    expect(result).toEqual({ kind: "append", moves: ["e2e4", "e7e5"] });
  });

  it("returns append with empty moves when both are empty", () => {
    const current: string[] = [];
    const next: string[] = [];
    const result = applyRelayMoves(current, next);
    expect(result).toEqual({ kind: "append", moves: [] });
  });
});
