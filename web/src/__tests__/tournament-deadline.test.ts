import { describe, expect, it } from "vitest";
import { tournamentDeadline } from "@/utils/tournament-deadline";
import { formatCurrency } from "@/utils/format-currency";

const now = 1_794_326_400n;
describe("registration deadline from block time", () => {
  it("shows a full-year date above 48 hours", () => {
    const result = tournamentDeadline(now + 49n * 3600n, now, "vi");
    expect(result.key).toBe("deadlineDate");
    expect(result).toMatchObject({
      values: { date: expect.stringContaining("2026") },
    });
  });
  it("keeps an exact 48-hour deadline in date form", () => {
    expect(tournamentDeadline(now + 48n * 3600n, now, "vi").key).toBe(
      "deadlineDate",
    );
  });
  it("shows remaining hours below 48 hours", () => {
    expect(tournamentDeadline(now + 23n * 3600n, now, "vi")).toEqual({
      key: "deadlineHours",
      values: { hours: 23 },
    });
  });
  it("shows less than one hour without counting down from the browser clock", () => {
    expect(tournamentDeadline(now + 3599n, now, "vi")).toEqual({
      key: "deadlineUnderHour",
    });
  });
  it.each([0n, -1n])("marks an elapsed deadline (%s seconds)", (offset) => {
    expect(tournamentDeadline(now + offset, now, "en")).toEqual({
      key: "deadlineExpired",
    });
  });
});

describe("localized token amounts", () => {
  it("formats decimals for Vietnamese and English", () => {
    expect(formatCurrency(250_000_000_000_000_000n, " test", "vi")).toMatch(
      /^0,25 (ETH|AVAX) test$/,
    );
    expect(formatCurrency(250_000_000_000_000_000n, " test", "en")).toMatch(
      /^0\.25 (ETH|AVAX) test$/,
    );
  });
  it("preserves all 18 fractional digits and large integer amounts", () => {
    expect(formatCurrency(1n, " test", "vi")).toMatch(/^0,000000000000000001 /);
    expect(
      formatCurrency(
        12_345_678_901_234_567_890_123_456_789_012_345_678n,
        "",
        "en",
      ),
    ).toMatch(/^12,345,678,901,234,567,890\.123456789012345678 /);
  });
});
