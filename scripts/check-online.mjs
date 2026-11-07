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
const tournament = env.NEXT_PUBLIC_TOURNAMENT_ADDRESS;
const routes = tournament
  ? ["/", "/tournaments", "/tournaments/play", "/hotseat", "/guide"]
  : ["/", "/game", "/hotseat", "/vault", "/guide"];
for (const route of routes) {
  try {
    const response = await fetch(new URL(route, env.WEB_ORIGIN), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    let pass = response.status === 200;
    if (tournament && route === "/") {
      const location = response.headers.get("location");
      pass =
        [307, 308].includes(response.status) &&
        !!location &&
        new URL(location, env.WEB_ORIGIN).href ===
          new URL("/tournaments", env.WEB_ORIGIN).href;
    }
    checks.push({ check: `Web ${route}`, pass });
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
    ws.once("open", () => {
      if (!expectAllowed || !tournament) finish(expectAllowed);
    });
    if (expectAllowed && tournament) {
      ws.once("message", (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          finish(
            message.type === "auth_challenge" &&
              message.chainId === 43113 &&
              message.origin === origin &&
              message.escrowAddress?.toLowerCase() === tournament.toLowerCase(),
          );
        } catch {
          finish(false);
        }
      });
    }
    ws.once("unexpected-response", (_req, res) => {
      res.resume();
      finish(!expectAllowed && res.statusCode === 403);
    });
    ws.once("error", () => finish(false));
  });
}
checks.push({
  check: tournament
    ? "WSS challenge matches Fuji, tournament contract and web origin"
    : "WSS accepts web origin",
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
