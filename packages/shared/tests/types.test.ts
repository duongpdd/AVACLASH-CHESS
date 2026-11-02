import { describe, it, expect } from "vitest";
import {
  OutcomeCode,
  ReasonCode,
  outcomeToCode,
  codeToOutcome,
  reasonToCode,
  codeToReason,
} from "../src/types.js";

describe("OutcomeCode enum", () => {
  it("should have correct numeric values", () => {
    expect(OutcomeCode.WhiteWin).toBe(0);
    expect(OutcomeCode.BlackWin).toBe(1);
    expect(OutcomeCode.Draw).toBe(2);
  });
});

describe("ReasonCode enum", () => {
  it("should have correct numeric values", () => {
    expect(ReasonCode.Checkmate).toBe(0);
    expect(ReasonCode.Resign).toBe(1);
    expect(ReasonCode.Timeout).toBe(2);
    expect(ReasonCode.Stalemate).toBe(3);
    expect(ReasonCode.Repetition).toBe(4);
    expect(ReasonCode.FiftyMove).toBe(5);
    expect(ReasonCode.InsufficientMaterial).toBe(6);
    expect(ReasonCode.Agreement).toBe(7);
  });
});

describe("outcomeToCode", () => {
  it("should convert white to WhiteWin", () => {
    expect(outcomeToCode("white")).toBe(OutcomeCode.WhiteWin);
  });

  it("should convert black to BlackWin", () => {
    expect(outcomeToCode("black")).toBe(OutcomeCode.BlackWin);
  });

  it("should convert draw to Draw", () => {
    expect(outcomeToCode("draw")).toBe(OutcomeCode.Draw);
  });

  it("should throw for ongoing", () => {
    expect(() => outcomeToCode("ongoing")).toThrow("Cannot convert ongoing game");
  });
});

describe("codeToOutcome", () => {
  it("should convert WhiteWin to white", () => {
    expect(codeToOutcome(OutcomeCode.WhiteWin)).toBe("white");
  });

  it("should convert BlackWin to black", () => {
    expect(codeToOutcome(OutcomeCode.BlackWin)).toBe("black");
  });

  it("should convert Draw to draw", () => {
    expect(codeToOutcome(OutcomeCode.Draw)).toBe("draw");
  });

  it("should throw for unknown code", () => {
    expect(() => codeToOutcome(99 as OutcomeCode)).toThrow("Unknown OutcomeCode");
  });
});

describe("reasonToCode", () => {
  const cases: [string, number][] = [
    ["checkmate", ReasonCode.Checkmate],
    ["resign", ReasonCode.Resign],
    ["timeout", ReasonCode.Timeout],
    ["stalemate", ReasonCode.Stalemate],
    ["repetition", ReasonCode.Repetition],
    ["fifty", ReasonCode.FiftyMove],
    ["insufficient", ReasonCode.InsufficientMaterial],
    ["draw_agreed", ReasonCode.Agreement],
  ];

  for (const [reason, code] of cases) {
    it(`should convert ${reason} to ${code}`, () => {
      expect(reasonToCode(reason as any)).toBe(code);
    });
  }
});

describe("codeToReason", () => {
  const cases: [number, string][] = [
    [ReasonCode.Checkmate, "checkmate"],
    [ReasonCode.Resign, "resign"],
    [ReasonCode.Timeout, "timeout"],
    [ReasonCode.Stalemate, "stalemate"],
    [ReasonCode.Repetition, "repetition"],
    [ReasonCode.FiftyMove, "fifty"],
    [ReasonCode.InsufficientMaterial, "insufficient"],
    [ReasonCode.Agreement, "draw_agreed"],
  ];

  for (const [code, reason] of cases) {
    it(`should convert code ${code} to ${reason}`, () => {
      expect(codeToReason(code)).toBe(reason);
    });
  }

  it("should throw for unknown code", () => {
    expect(() => codeToReason(99 as ReasonCode)).toThrow("Unknown ReasonCode");
  });
});

describe("roundtrip conversions", () => {
  it("should roundtrip all outcomes", () => {
    for (const outcome of ["white", "black", "draw"] as const) {
      expect(codeToOutcome(outcomeToCode(outcome))).toBe(outcome);
    }
  });

  it("should roundtrip all reasons", () => {
    for (const reason of [
      "checkmate", "resign", "timeout", "stalemate",
      "repetition", "fifty", "insufficient", "draw_agreed",
    ] as const) {
      expect(codeToReason(reasonToCode(reason))).toBe(reason);
    }
  });
});
