import { createRequire } from "node:module";
import net from "node:net";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const { isAddress, parseEther } = require("viem");
const zero = /^0x0{40}$/i;

export function validAddress(value) {
  return typeof value === "string" && isAddress(value) && !zero.test(value);
}

function publicHost(hostname) {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  // Deployment templates require public DNS names, including for the RPC.
  return (
    !net.isIP(host) &&
    host.includes(".") &&
    !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host) &&
    !/(^|\.)example\.(com|net|org)$/.test(host)
  );
}

export function publicUrl(value, protocol, { originOnly = false } = {}) {
  try {
    if (
      typeof value !== "string" ||
      value.trim() !== value ||
      /[\r\n]/.test(value)
    )
      return null;
    const url = new URL(value);
    if (
      url.protocol !== protocol ||
      !publicHost(url.hostname) ||
      url.username ||
      url.password ||
      url.hash ||
      (originOnly && (url.origin !== value || url.search))
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

export function validatePublicDeployment(env) {
  const errors = [];
  if (env.NEXT_PUBLIC_CHAIN_ID !== "43113")
    errors.push("NEXT_PUBLIC_CHAIN_ID must be 43113 (Fuji).");
  for (const name of ["NEXT_PUBLIC_ESCROW_ADDRESS", "NEXT_PUBLIC_META_ADDRESS"])
    if (!validAddress(env[name]))
      errors.push(`${name} must be a nonzero EVM address.`);
  if (
    env.NEXT_PUBLIC_ESCROW_ADDRESS?.toLowerCase() ===
    env.NEXT_PUBLIC_META_ADDRESS?.toLowerCase()
  )
    errors.push("Escrow and Meta must have different addresses.");
  if (!publicUrl(env.NEXT_PUBLIC_RPC_URL, "https:"))
    errors.push(
      "NEXT_PUBLIC_RPC_URL must use HTTPS with a public DNS hostname and no URL credentials.",
    );
  if (!publicUrl(env.NEXT_PUBLIC_RELAY_URL, "wss:"))
    errors.push(
      "NEXT_PUBLIC_RELAY_URL must use WSS with a public DNS hostname and no URL credentials.",
    );
  try {
    const stake = parseEther(env.NEXT_PUBLIC_UI_MAX_STAKE || "0.1");
    if (stake < parseEther("0.01") || stake > parseEther("1")) throw Error();
  } catch {
    errors.push("NEXT_PUBLIC_UI_MAX_STAKE must be between 0.01 and 1 AVAX.");
  }
  return errors;
}

export function validateFujiRoles(env) {
  const errors = [];
  const seen = new Set();
  for (const name of [
    "DEPLOYER_ADDRESS",
    "RELAY_SIGNER_ADDRESS",
    "ARBITER_ADDRESS",
    "TREASURY_ADDRESS",
  ]) {
    const address = env[name];
    if (!validAddress(address))
      errors.push(`${name} must be a nonzero EVM address.`);
    else if (seen.has(address.toLowerCase()))
      errors.push(`${name} must use a distinct account.`);
    else seen.add(address.toLowerCase());
  }
  return errors;
}
