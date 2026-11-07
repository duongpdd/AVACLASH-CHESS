// @vitest-environment happy-dom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@/test/render";
import { afterEach, expect, it, vi } from "vitest";
import Tabs from "@/components/section-tabs";
import ConfirmDialog from "@/components/confirm-dialog";

const tabs = [
  { id: "intro", label: "Tổng quan" },
  { id: "history", label: "Lịch sử" },
] as const;
afterEach(cleanup);

it("selects and focuses tabs with arrows, Home and End", () => {
  function Example() {
    const [selected, setSelected] = useState<"intro" | "history">("intro");
    return (
      <Tabs
        label="Chi tiết"
        tabs={tabs}
        selected={selected}
        onChange={setSelected}
        panels={{ intro: "Thông tin", history: "Giao dịch" }}
      />
    );
  }
  render(<Example />);
  const intro = screen.getByRole("tab", { name: "Tổng quan" });
  const history = screen.getByRole("tab", { name: "Lịch sử" });
  fireEvent.keyDown(intro, { key: "ArrowRight" });
  expect(document.activeElement).toBe(history);
  expect(history.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel", { name: "Lịch sử" }).textContent).toBe(
    "Giao dịch",
  );
  fireEvent.keyDown(history, { key: "Home" });
  expect(document.activeElement).toBe(intro);
  fireEvent.keyDown(intro, { key: "End" });
  expect(document.activeElement).toBe(history);
});

it("closes the confirmation on Escape and restores focus without confirming", () => {
  const confirm = vi.fn();
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Hủy giải</button>
        {open && (
          <ConfirmDialog
            title="Xác nhận hủy"
            description="Hủy giải này?"
            confirmLabel="Đồng ý hủy"
            onClose={() => setOpen(false)}
            onConfirm={confirm}
          />
        )}
      </>
    );
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "Hủy giải" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Quay lại" }),
  );
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Xác nhận hủy" }), {
    key: "Escape",
  });
  expect(confirm).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Đồng ý hủy" }));
  expect(confirm).toHaveBeenCalledOnce();
});
