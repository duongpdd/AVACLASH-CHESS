import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { validatePublicDeployment } from "../../scripts/deploy-config.mjs";

// Vercel supplies these before the build. Never silently ship Anvil defaults.
const errors = validatePublicDeployment(process.env);
if (errors.length) {
  console.error(
    "Vercel deployment configuration is incomplete:\n" + errors.join("\n"),
  );
  process.exit(1);
}
const web = fileURLToPath(new URL("..", import.meta.url));
const shared = fileURLToPath(
  new URL("../../packages/shared/", import.meta.url),
);
const requireWeb = createRequire(new URL("../package.json", import.meta.url));
const requireShared = createRequire(
  new URL("../../packages/shared/package.json", import.meta.url),
);
function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    console.error("Deployment build step failed.");
    process.exit(result.status || 1);
  }
}
run(
  fileURLToPath(
    new URL("../../packages/shared/scripts/generate-abi.mjs", import.meta.url),
  ),
  [],
  shared,
);
run(requireShared.resolve("typescript/bin/tsc"), [], shared);
run(requireWeb.resolve("next/dist/bin/next"), ["build", "--webpack"], web);
