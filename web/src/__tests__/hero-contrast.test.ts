import { expect, it } from "vitest";
import fs from "node:fs";
import { contrastRatio } from "@/utils/contrast";

it("calculates WCAG reference ratios symmetrically", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  expect(contrastRatio("#ffffff", "#000000")).toBe(21);
  expect(contrastRatio("#123456", "#123456")).toBe(1);
});
it("keeps both piece silhouettes and their fills distinguishable on actual preview colors", () => {
  const css = fs.readFileSync(
    new URL("../styles/theme.css", import.meta.url),
    "utf8",
  );
  const token = (name: string) =>
    css.match(new RegExp(`--preview-${name}: (#[\\da-f]{6})`, "i"))![1];
  const white = token("piece-light"),
    black = token("piece-dark");
  for (const square of ["light", "dark", "highlight"]) {
    expect(
      Math.max(
        contrastRatio(white, token(square)),
        contrastRatio(black, token(square)),
      ),
    ).toBeGreaterThanOrEqual(3);
  }
  expect(contrastRatio(white, black)).toBeGreaterThanOrEqual(2);
});
