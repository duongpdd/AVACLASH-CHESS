// @vitest-environment happy-dom
import React from "react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../messages/vi.json";
import english from "../messages/en.json";
import { act, cleanup, fireEvent, render, screen } from "@/test/render";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import HotseatPage from "../views/hotseat/hotseat-view";
vi.mock("@/components/app-header", () => ({ default: () => null }));
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
  render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <HotseatPage />
    </NextIntlClientProvider>,
  );
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
  render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <HotseatPage />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText("Bắt đầu"));
  act(() => vi.advanceTimersByTime(300100));
  expect(screen.getByRole("status").textContent).toContain("Hết giờ");
  expect((screen.getByText("f2f3") as HTMLButtonElement).disabled).toBe(true);
});
it("requires confirmation before resignation and supports Escape to keep playing", () => {
  render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <HotseatPage />
    </NextIntlClientProvider>,
  );
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

it("changes language during a match and translates its result without restarting", () => {
  const renderGame = (locale: "vi" | "en") => (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? messages : english}
    >
      <HotseatPage />
    </NextIntlClientProvider>
  );
  const view = render(renderGame("vi"));
  fireEvent.click(screen.getByText("Bắt đầu"));
  fireEvent.click(screen.getByText("f2f3"));
  view.rerender(renderGame("en"));
  expect(screen.getByRole("status").textContent).toContain("Black to move");
  for (const move of ["e7e5", "g2g4", "d8h4"])
    fireEvent.click(screen.getByText(move));
  expect(screen.getByRole("status").textContent).toContain(
    "Black wins · Checkmate",
  );
  view.rerender(renderGame("vi"));
  expect(screen.getByRole("status").textContent).toContain(
    "Đen thắng · Chiếu hết",
  );
  expect(screen.getByLabelText("Lịch sử nước đi").textContent).toContain(
    "Qh4#",
  );
});
