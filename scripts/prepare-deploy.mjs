import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makeDeploymentEnv } from "./deployment-env.mjs";

const envFile = process.argv[2];
const target =
  process.argv.length === 3
    ? "caddy"
    : process.argv.length === 5 && process.argv[3] === "--target"
      ? process.argv[4]
      : undefined;
if (!envFile || !["caddy", "railway", "render"].includes(target)) {
  console.error(
    "Usage: node scripts/prepare-deploy.mjs .env.fuji.local [--target render|railway|caddy]",
  );
  process.exit(1);
}
process.loadEnvFile(envFile);
let files;
try {
  files = makeDeploymentEnv(process.env, target);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const directoryUrl = new URL(
  target === "caddy" ? "../.local/deploy/" : `../.local/deploy-${target}/`,
  import.meta.url,
);
const directory = fileURLToPath(directoryUrl);
if (fs.existsSync(directory)) {
  console.error(
    "Deployment output already exists; move it aside before generating a new configuration.",
  );
  process.exit(1);
}
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
fs.writeFileSync(new URL("web.env", directoryUrl), files.web, {
  flag: "wx",
  mode: 0o600,
});
fs.writeFileSync(new URL("relay.env", directoryUrl), files.relay, {
  flag: "wx",
  mode: 0o600,
});
console.log(
  `Created ${directory}/web.env and relay.env. Secret values are empty; configure them only in the relay host's secrets.`,
);
