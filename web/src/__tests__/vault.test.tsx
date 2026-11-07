// @vitest-environment happy-dom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseEther } from "viem";
import VaultWidget from "../components/vault-widget";
vi.mock("../components/wallet-action", () => ({ default: () => null }));
const state = vi.hoisted(() => ({
  chainId: 43113,
  status: undefined as string | undefined,
  write: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111" }),
  useChainId: () => state.chainId,
  useReadContract: ({ functionName }: { functionName: string }) => ({
    data: functionName === "noLossPrincipal" ? 500000000000000000n : 15n,
  }),
  useWriteContract: () => ({
    writeContractAsync: state.write,
    reset: state.reset,
  }),
  useWaitForTransactionReceipt: () => ({
    data: state.status ? { status: state.status } : undefined,
    isLoading: false,
  }),
}));
vi.mock("../hooks/use-contract-bytecode-guard", () => ({
  useContractBytecodeGuard: () => ({ isBlocked: false }),
}));
vi.mock("../components/season-rewards-widget", () => ({ default: () => null }));
beforeEach(() => {
  state.chainId = 43113;
  state.status = undefined;
  state.write.mockReset();
  state.write.mockResolvedValue("0x1234");
});
afterEach(cleanup);
it("deposits on the configured chain and withdraws principal through its own method", async () => {
  const view = render(<VaultWidget />);
  fireEvent.click(screen.getByText("Gửi tiền gốc"));
  await waitFor(() =>
    expect(state.write).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 43113,
        functionName: "enterNoLossVault",
        value: parseEther("0.5"),
      }),
    ),
  );
  state.status = "success";
  view.rerender(<VaultWidget />);
  fireEvent.click(screen.getByText("Rút toàn bộ"));
  await waitFor(() =>
    expect(state.write).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 43113,
        functionName: "exitNoLossVault",
      }),
    ),
  );
});
it("blocks deposits below minimum before asking the wallet", async () => {
  render(<VaultWidget />);
  fireEvent.change(screen.getByLabelText(/Số tiền gửi/), {
    target: { value: "0.1" },
  });
  fireEvent.click(screen.getByText("Gửi tiền gốc"));
  await waitFor(() => expect(screen.getByText(/Tối thiểu 0.5/)).toBeDefined());
  expect(state.write).not.toHaveBeenCalled();
});
it("reports reverted receipts and blocks transactions on the wrong chain", () => {
  state.status = "reverted";
  state.chainId = 1;
  render(<VaultWidget />);
  expect(screen.getByText("Giao dịch bị hoàn tác.")).toBeDefined();
  expect((screen.getByText("Gửi tiền gốc") as HTMLButtonElement).disabled).toBe(
    true,
  );
});
