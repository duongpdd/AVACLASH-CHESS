// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import AbortRefundWidget from "../components/abort-refund-widget";

const mocks = vi.hoisted(() => ({
  receipt: undefined as { status: "success" | "reverted" } | undefined,
  write: vi.fn(),
}));
vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: mocks.write }),
  useWaitForTransactionReceipt: () => ({
    data: mocks.receipt,
    isLoading: false,
  }),
}));
const now = 2000000;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now * 1000);
  mocks.receipt = undefined;
});
afterEach(() => {
  vi.useRealTimers();
});
describe("Abort and refund contract eligibility", () => {
  it("uses the later game-start timestamp for the refund deadline", () => {
    render(
      <AbortRefundWidget
        roomId={0}
        room={{
          status: 1,
          gameStarted: true,
          startedAt: now - 4000,
          gameStartedAt: now - 300,
        }}
      />,
    );
    expect(
      (screen.getByRole("button", { name: /Hoàn tiền/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText("55:00")).toBeDefined();
  });
  it("allows refund only after the later timestamp plus sixty minutes", () => {
    render(
      <AbortRefundWidget
        roomId={0}
        room={{
          status: 1,
          gameStarted: true,
          startedAt: now - 8000,
          gameStartedAt: now - 3601,
        }}
      />,
    );
    expect(
      (screen.getByRole("button", { name: /Hoàn tiền/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it("blocks abort and refund while a single-signed claim is pending", () => {
    render(
      <AbortRefundWidget
        roomId={0}
        room={{
          status: 1,
          gameStarted: false,
          startedAt: now - 8000,
          singleSignedAt: now - 100,
        }}
      />,
    );
    expect(
      (screen.getByRole("button", { name: /Hủy phòng/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Hoàn tiền/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("does not announce success for a reverted receipt", () => {
    mocks.receipt = { status: "reverted" };
    const onSuccess = vi.fn();
    render(
      <AbortRefundWidget
        roomId={0}
        room={{ status: 1, gameStarted: true }}
        onSuccess={onSuccess}
      />,
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("reverted");
  });
});
