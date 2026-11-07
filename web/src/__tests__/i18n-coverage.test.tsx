// @vitest-environment happy-dom
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import RouteError from "@/app/error";
import { Pager } from "@/components/cosmetics/cosmetic-ui";
import { localizeExisting } from "@/i18n/ui-copy";
import en from "@/messages/en.json";
import vi_ from "@/messages/vi.json";

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [prefix + key]
      : keys(value, `${prefix}${key}.`),
  );

function inEnglish(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("translations", () => {
  it("keeps the Vietnamese and English catalogs in step", () => {
    expect(keys(en).sort()).toEqual(keys(vi_).sort());
  });

  it("translates the profile loss label returned by the API", () => {
    const text = ((key: "messageLoss") => en.ui[key]) as never;
    expect(localizeExisting("Thua", text)).toBe("Loss");
  });

  it("renders cosmetics controls in the selected language", () => {
    inEnglish(<Pager newer={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDefined();
  });
});

describe("route error page", () => {
  it("offers a retry without exposing the error text", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    inEnglish(<RouteError error={new Error("secret detail")} retry={retry} />);
    expect(screen.queryByText(/secret detail/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
