// @vitest-environment happy-dom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import HotseatPage from "../app/hotseat/page";
vi.mock("next/dynamic", () => ({
  default: () =>
    function MockBoard(props: {
      canMove: boolean;
      onMove: (uci: string) => void;
    }) {
      return (
        <div>
          {["f2f3", "e7e5", "g2g4", "d8h4"].map((move) => (
            <button
              disabled={!props.canMove}
              key={move}
              onClick={() => props.onMove(move)}
            >
              {move}
            </button>
          ))}
        </div>
      );
    },
}));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("plays both sides, detects mate and resets into a fresh stopped game", () => {
  render(<HotseatPage />);
  fireEvent.click(screen.getByText("Bắt đầu"));
  for (const move of ["f2f3", "e7e5", "g2g4", "d8h4"])
    fireEvent.click(screen.getByText(move));
  expect(screen.getByRole("status").textContent).toContain("Đen thắng");
  expect(screen.getByLabelText("Lịch sử nước đi").textContent).toContain(
    "Qh4#",
  );
  fireEvent.click(screen.getByText("Ván mới"));
  expect(screen.getByLabelText("Lịch sử nước đi").textContent).toBe("");
  expect(screen.getByText("Bắt đầu")).toBeDefined();
});
it("expires the active clock and prevents further moves", () => {
  render(<HotseatPage />);
  fireEvent.click(screen.getByText("Bắt đầu"));
  act(() => vi.advanceTimersByTime(300100));
  expect(screen.getByRole("status").textContent).toContain("Hết giờ");
  expect((screen.getByText("f2f3") as HTMLButtonElement).disabled).toBe(true);
});
it("requires confirmation before resignation and supports Escape to keep playing", () => {
  render(<HotseatPage />);
  fireEvent.click(screen.getByText("Bắt đầu"));
  fireEvent.click(screen.getByText("Đầu hàng (Trắng)"));
  const dialog = screen.getByRole("dialog", { name: "Xác nhận đầu hàng" });
  expect(screen.getByRole("status").textContent).toContain("Lượt Trắng");
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByText("Đầu hàng (Trắng)"));
  fireEvent.click(screen.getByText("Đồng ý đầu hàng"));
  expect(screen.getByRole("status").textContent).toContain("Đen thắng");
});
