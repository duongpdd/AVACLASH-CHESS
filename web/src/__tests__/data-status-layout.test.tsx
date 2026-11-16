// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@/test/render";
import { DataWithStatus } from "@/components/status/data-with-status";

afterEach(cleanup);
it("prioritizes an error over loading and a custom empty layout", () => {
  render(
    <DataWithStatus
      error="Unavailable"
      loading
      noData="Empty"
      noDataLayout="custom"
    >
      Content
    </DataWithStatus>,
  );
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByText("Empty")).toBeNull();
  expect(screen.queryByText("Content")).toBeNull();
});
it("shows loading instead of a premature empty table", () => {
  render(
    <DataWithStatus loading noData="Empty" noDataLayout="custom">
      Content
    </DataWithStatus>,
  );
  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.queryByText("Empty")).toBeNull();
});
it("retains the default empty treatment while permitting a table-sized empty layout", () => {
  const { container, rerender } = render(
    <DataWithStatus noData="Empty">Content</DataWithStatus>,
  );
  expect(container.querySelector(".empty-data")).toBeTruthy();
  rerender(
    <DataWithStatus
      noData={<section>Empty table</section>}
      noDataLayout="custom"
    >
      Content
    </DataWithStatus>,
  );
  expect(screen.getByText("Empty table")).toBeTruthy();
  expect(container.querySelector(".empty-data")).toBeNull();
});
