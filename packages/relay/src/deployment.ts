import path from "node:path";
import { isIP } from "node:net";

/** Railway must mount durable storage before this relay can accept any rooms. */
export function assertRailwayDeployment(env: NodeJS.ProcessEnv): void {
  if (!env.RAILWAY_ENVIRONMENT_ID) return;
  if (env.CHAIN_ID !== "43113")
    throw Error("Railway relay must use Fuji CHAIN_ID=43113.");
  if (env.HOST !== "0.0.0.0")
    throw Error("Railway relay requires HOST=0.0.0.0.");
  if (env.RAILWAY_VOLUME_MOUNT_PATH !== "/data")
    throw Error(
      "Attach a Railway volume mounted at /data before starting the relay.",
    );
  if (!env.RESULTS_DIR)
    throw Error("Railway relay requires RESULTS_DIR inside /data.");
  for (const [name, value] of [
    ["RESULTS_DIR", env.RESULTS_DIR],
    ["ACTIVE_DIR", env.ACTIVE_DIR || path.join(env.RESULTS_DIR, "active")],
  ]) {
    const relative = path.relative(path.resolve("/data"), path.resolve(value!));
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      throw Error(`${name} must be inside the /data Railway volume.`);
  }
  if (env.ALLOW_NO_ORIGIN !== "false")
    throw Error("Railway relay requires ALLOW_NO_ORIGIN=false.");
  assertPublicOrigins(env.ALLOWED_ORIGINS);
}

/** Render Free has no persistent disk: never fall back to JSON here. */
export function assertRenderDeployment(env: NodeJS.ProcessEnv): void {
  if (env.RENDER !== "true") return;
  if (env.CHAIN_ID !== "43113")
    throw Error("Render relay must use Fuji CHAIN_ID=43113.");
  if (env.HOST !== "0.0.0.0")
    throw Error("Render relay requires HOST=0.0.0.0.");
  if (env.STORAGE_DRIVER !== "postgres" || !env.DATABASE_URL)
    throw Error(
      "Render relay requires STORAGE_DRIVER=postgres and DATABASE_URL; its disk is ephemeral.",
    );
  let validDatabase = false;
  try {
    const url = new URL(env.DATABASE_URL);
    validDatabase =
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.endsWith(".neon.tech") &&
      !!url.username &&
      !!url.password;
  } catch {}
  if (!validDatabase)
    throw Error("Render relay requires the real Neon database connection URL.");
  if (env.ALLOW_NO_ORIGIN !== "false")
    throw Error("Render relay requires ALLOW_NO_ORIGIN=false.");
  assertPublicOrigins(env.ALLOWED_ORIGINS);
}

function assertPublicOrigins(value: string | undefined): void {
  const origins = (value || "").split(",").map((value) => value.trim());
  for (const origin of origins) {
    let valid = false;
    try {
      const url = new URL(origin);
      const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
      valid =
        url.protocol === "https:" &&
        url.origin === origin &&
        !url.username &&
        !url.password &&
        !isIP(host) &&
        host.includes(".") &&
        !host.includes("*") &&
        !/(^|\.)(localhost|local|internal|example|invalid|test)$/.test(host) &&
        !/(^|\.)example\.(com|net|org)$/.test(host);
    } catch {}
    if (!valid)
      throw Error(
        "ALLOWED_ORIGINS must contain exact public HTTPS origins for the web app.",
      );
  }
}
