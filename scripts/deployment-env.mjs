import {
  validatePublicDeployment,
  validateFujiRoles,
  publicUrl,
} from "./deploy-config.mjs";

export function makeDeploymentEnv(env, target = "caddy") {
  if (!["caddy", "railway", "render"].includes(target))
    throw Error("Target must be caddy, railway or render.");
  const errors = [...validatePublicDeployment(env), ...validateFujiRoles(env)];
  if (!publicUrl(env.WEB_ORIGIN, "https:", { originOnly: true }))
    errors.push(
      "WEB_ORIGIN must be the exact public HTTPS origin, without a trailing slash.",
    );
  const relay = publicUrl(env.NEXT_PUBLIC_RELAY_URL, "wss:");
  if (relay && (relay.pathname !== "/" || relay.search || relay.port))
    errors.push("Relay URL must not include a path, query, or custom port.");
  if (env.FUJI_RPC_URL && env.FUJI_RPC_URL !== env.NEXT_PUBLIC_RPC_URL)
    errors.push(
      "Use the same FUJI_RPC_URL and NEXT_PUBLIC_RPC_URL for this deployment template.",
    );
  if (errors.length) throw Error(errors.join("\n"));
  const web = [
    "NEXT_PUBLIC_CHAIN_ID=43113",
    ...[
      "NEXT_PUBLIC_RPC_URL",
      "NEXT_PUBLIC_ESCROW_ADDRESS",
      "NEXT_PUBLIC_META_ADDRESS",
      "NEXT_PUBLIC_RELAY_URL",
    ].map((name) => `${name}=${env[name]}`),
    `NEXT_PUBLIC_UI_MAX_STAKE=${env.NEXT_PUBLIC_UI_MAX_STAKE || "0.1"}`,
  ];
  const relayEnv = [
    ...(target === "railway"
      ? ["RAILWAY_RUN_UID=0"]
      : target === "caddy"
        ? [`RELAY_DOMAIN=${relay.hostname}`]
        : []),
    "HOST=0.0.0.0",
    `PORT=${target === "render" ? "10000" : "8080"}`,
    "CHAIN_ID=43113",
    `RPC_URL=${env.NEXT_PUBLIC_RPC_URL}`,
    `ESCROW_ADDRESS=${env.NEXT_PUBLIC_ESCROW_ADDRESS}`,
    "RELAY_PRIVATE_KEY=",
    `ALLOWED_ORIGINS=${env.WEB_ORIGIN}`,
    "ALLOW_NO_ORIGIN=false",
    "TRUST_PROXY=true",
    "SIGNAL_GAME_STARTED_ENABLED=true",
    "RELAY_MIN_BALANCE=0.1",
    ...(target === "render"
      ? ["STORAGE_DRIVER=postgres", "DATABASE_URL="]
      : [
          "STORAGE_DRIVER=file",
          "RESULTS_DIR=/data/results",
          "ACTIVE_DIR=/data/results/active",
        ]),
  ];
  return { web: web.join("\n") + "\n", relay: relayEnv.join("\n") + "\n" };
}
