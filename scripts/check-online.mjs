import { createRequire } from "node:module";
import { validatePublicDeployment, publicUrl } from "./deploy-config.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/check-online.mjs .env.fuji.local");
  process.exit(1);
}
process.loadEnvFile(file);
const env = process.env;
const errors = validatePublicDeployment(env);
if (!publicUrl(env.WEB_ORIGIN, "https:", { originOnly: true }))
  errors.push("WEB_ORIGIN must be an exact public HTTPS origin.");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const require = createRequire(
  new URL("../packages/relay/package.json", import.meta.url),
);
const { WebSocket } = require("ws");
const checks = [];
for (const route of ["/", "/game", "/hotseat", "/vault", "/guide"]) {
  try {
    const response = await fetch(new URL(route, env.WEB_ORIGIN), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    checks.push({ check: `Web ${route}`, pass: response.status === 200 });
    await response.body?.cancel();
  } catch {
    checks.push({ check: `Web ${route}`, pass: false });
  }
}
const relayHttp = new URL(env.NEXT_PUBLIC_RELAY_URL);
relayHttp.protocol = "https:";
for (const route of ["/healthz", "/readyz"]) {
  try {
    const response = await fetch(new URL(route, relayHttp), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    checks.push({
      check: `Relay ${route}`,
      pass:
        response.status === 200 &&
        data.status === (route === "/readyz" ? "ready" : "alive"),
    });
  } catch {
    checks.push({ check: `Relay ${route}`, pass: false });
  }
}
async function handshake(origin, expectAllowed) {
  return new Promise((resolve) => {
    const ws = new WebSocket(env.NEXT_PUBLIC_RELAY_URL, {
      origin,
      handshakeTimeout: 10000,
    });
    let done = false;
    const finish = (pass) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ws.terminate();
      resolve(pass);
    };
    const timer = setTimeout(() => finish(false), 12000);
    ws.once("open", () => finish(expectAllowed));
    ws.once("unexpected-response", (_req, res) => {
      res.resume();
      finish(!expectAllowed && res.statusCode === 403);
    });
    ws.once("error", () => finish(false));
  });
}
checks.push({
  check: "WSS accepts web origin",
  pass: await handshake(env.WEB_ORIGIN, true),
});
checks.push({
  check: "WSS rejects other origin",
  pass: await handshake("https://untrusted.invalid", false),
});
console.log(
  JSON.stringify(
    {
      checks,
      ready: checks.every((c) => c.pass),
      note: "Connectivity only; does not sign or play a game.",
    },
    null,
    2,
  ),
);
if (checks.some((c) => !c.pass)) process.exitCode = 1;
