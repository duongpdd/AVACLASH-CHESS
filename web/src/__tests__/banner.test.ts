// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

describe("FujiTestnetBanner Network Display", () => {
  it("displays 'Anvil local' when CHAIN_ID is 31337", async () => {
    cleanup();
    vi.resetModules();
    vi.doMock("../config/env", () => ({
      CHAIN_ID: 31337,
    }));

    const { default: FujiTestnetBanner } =
      await import("../components/FujiTestnetBanner");
    render(React.createElement(FujiTestnetBanner));

    expect(
      screen.getByText(/Anvil local - mạng thử nghiệm cục bộ/i),
    ).toBeDefined();
    expect(screen.getByText(/Chain ID 31337/i)).toBeDefined();
  });

  it("displays 'Fuji testnet' when CHAIN_ID is 43113", async () => {
    cleanup();
    vi.resetModules();
    vi.doMock("../config/env", () => ({
      CHAIN_ID: 43113,
    }));

    const { default: FujiTestnetBanner } =
      await import("../components/FujiTestnetBanner");
    render(React.createElement(FujiTestnetBanner));

    expect(screen.getByText(/Fuji testnet - tiền thử nghiệm/i)).toBeDefined();
    expect(screen.getAllByText(/Fuji testnet/i).length).toBeGreaterThanOrEqual(
      1,
    );
  });
});
