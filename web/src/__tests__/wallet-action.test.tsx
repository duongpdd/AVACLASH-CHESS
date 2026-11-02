// @vitest-environment happy-dom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WalletAction from "../components/WalletAction";
const state = vi.hoisted(() => ({
  connected: false,
  chainId: 43113,
  connect: vi.fn(),
  switchChain: vi.fn(),
  connector: { id: "injected" },
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: state.connected }),
  useChainId: () => state.chainId,
  useConnect: () => ({
    connect: state.connect,
    connectors: [state.connector],
    isPending: false,
  }),
  useSwitchChain: () => ({ switchChain: state.switchChain, isPending: false }),
}));
vi.mock("../config/wagmi", () => ({
  targetChain: { id: 43113, name: "Fuji" },
}));
vi.mock("../hooks/useClientMounted", () => ({ useClientMounted: () => true }));
beforeEach(() => {
  state.connected = false;
  state.chainId = 43113;
  state.connect.mockReset();
  state.switchChain.mockReset();
});
afterEach(cleanup);
it("waits for a click before connecting and does not submit a transaction", () => {
  render(<WalletAction />);
  expect(state.connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Nối ví để tiếp tục/ }));
  expect(state.connect).toHaveBeenCalledWith({ connector: state.connector });
  expect(state.switchChain).not.toHaveBeenCalled();
});
it("offers a chain switch when an already connected wallet is on another chain", () => {
  state.connected = true;
  state.chainId = 1;
  render(<WalletAction />);
  fireEvent.click(screen.getByRole("button", { name: /Chuyển sang Fuji/ }));
  expect(state.switchChain).toHaveBeenCalledWith({ chainId: 43113 });
  expect(state.connect).not.toHaveBeenCalled();
});
