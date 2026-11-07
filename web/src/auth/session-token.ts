import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { walletAddress } from "./session-type";

const purpose = z.enum(["challenge", "session", "browser"]);
const claimsSchema = z.object({
  purpose,
  id: z.string().regex(/^[a-f0-9]{32}$/),
  address: walletAddress,
  origin: z.string().url(),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
});

export type Claims = z.infer<typeof claimsSchema>;
export const challengeAge = 5 * 60;
export const sessionAge = 12 * 60 * 60;

export function sessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  return secret && Buffer.byteLength(secret, "utf8") >= 32 ? secret : undefined;
}

export function createClaims(
  purpose: Claims["purpose"],
  address: Claims["address"],
  origin: string,
  age: number,
  now = Date.now(),
): Claims {
  return {
    purpose,
    id: randomBytes(16).toString("hex"),
    address,
    origin,
    issuedAt: now,
    expiresAt: now + age * 1000,
  };
}

function mac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signClaims(claims: Claims, secret: string) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${mac(payload, secret)}`;
}

export function readClaims(
  value: string | undefined,
  expected: Claims["purpose"],
  secret: string,
  now = Date.now(),
): Claims | undefined {
  if (!value || value.length > 2048) return;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return;
  const provided = Buffer.from(signature, "utf8");
  const calculated = Buffer.from(mac(payload, secret), "utf8");
  if (
    provided.length !== calculated.length ||
    !timingSafeEqual(provided, calculated)
  )
    return;
  try {
    const claims = claimsSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    if (
      claims.purpose === expected &&
      claims.issuedAt <= now &&
      now < claims.expiresAt
    )
      return claims;
  } catch {
    return;
  }
}
