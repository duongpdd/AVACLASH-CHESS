import { configDefaults, defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/audit/**"],
    hookTimeout: 45000,
    testTimeout: 15000,
  },
});
