import { cookies, headers } from "next/headers";
import { readClaims, sessionSecret } from "./session-token";

export const browserCookie = "avaclash_session";
export const challengeCookie = "avaclash_challenge";

export async function loginOrigin() {
  const origin = (await headers()).get("origin");
  if (!origin) return;
  try {
    const parsed = new URL(origin);
    if (
      parsed.origin === origin &&
      ["https:", "http:"].includes(parsed.protocol)
    )
      return origin;
  } catch {
    return;
  }
}

export async function browserSession() {
  const secret = sessionSecret();
  if (!secret) return;
  return readClaims(
    (await cookies()).get(browserCookie)?.value,
    "browser",
    secret,
  );
}
