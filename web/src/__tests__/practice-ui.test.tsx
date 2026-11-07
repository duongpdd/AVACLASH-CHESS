// @vitest-environment happy-dom
import { NextIntlClientProvider } from "next-intl";
import { act, cleanup, fireEvent, render, screen, within } from "@/test/render";
import { afterEach, expect, it, vi } from "vitest";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import messages from "@/messages/en.json";
import PracticePage from "@/views/practice/practice-view";

vi.mock("@/components/app-header", () => ({ default: () => null }));
afterEach(cleanup);

it("keeps the keyboard-active option visible and commits it on Enter", () => {
  const choose = vi.fn();
  render(
    <DropdownSelect
      aria-label="Puzzle"
      value="1"
      onValueChange={choose}
      options={[
        { value: "1", label: "First" },
        { value: "2", label: "Second" },
        { value: "3", label: "Last" },
      ]}
    />,
  );
  const trigger = screen.getByRole("combobox");
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const menu = screen.getByRole("listbox");
  const last = within(menu).getByRole("option", { name: "Last" });
  Object.defineProperty(menu, "clientHeight", { value: 88 });
  Object.defineProperties(last, {
    offsetTop: { value: 88 },
    offsetHeight: { value: 44 },
  });

  fireEvent.keyDown(trigger, { key: "End" });

  expect(trigger.getAttribute("aria-activedescendant")).toBe(last.id);
  expect(menu.scrollTop).toBe(44);
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(choose).toHaveBeenCalledWith("3");
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("uses one tab stop on the board and follows the displayed orientation", () => {
  render(<PracticePage />);
  const board = screen.getByRole("group", { name: "Bàn cờ giải thế" });
  const first = board.querySelector<HTMLButtonElement>('button[tabindex="0"]')!;
  expect(board.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
  expect(first.getAttribute("aria-label")?.split(",")[0]).toBe("a1");

  act(() => first.focus());
  fireEvent.keyDown(first, { key: "ArrowRight" });
  const next = document.activeElement;
  expect(next?.getAttribute("aria-label")?.split(",")[0]).toBe("b1");
  expect(next?.getAttribute("tabindex")).toBe("0");

  fireEvent.click(screen.getByRole("button", { name: "Xoay bàn" }));
  fireEvent.keyDown(next!, { key: "ArrowLeft" });
  expect(
    document.activeElement?.getAttribute("aria-label")?.split(",")[0],
  ).toBe("c1");
});

it("localizes all puzzle options when English is selected", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PracticePage />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Choose a puzzle" }));
  const menu = screen.getByRole("listbox", { name: "Choose a puzzle" });
  expect(
    within(menu).getByRole("option", { name: "Back-rank checkmate" }),
  ).toBeTruthy();
  expect(
    within(menu).getByRole("option", { name: "Mate in three · 5" }),
  ).toBeTruthy();
  expect(menu.textContent).not.toMatch(/Chiếu hết/);
});
