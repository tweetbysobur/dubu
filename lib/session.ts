import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Address } from "viem";

export const NONCE_COOKIE = "dubu_nonce";
export const SESSION_COOKIE = "dubu_session";
const SESSION_TTL_S = 60 * 60 * 24; // 24h

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ chars)");
  return "dev-only-insecure-secret-change-me-please-0000";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function newNonce() {
  return randomBytes(16).toString("hex");
}

export function signInMessage(address: string, nonce: string, host: string) {
  return [
    `${host} wants you to sign in to Dubu with your wallet:`,
    address,
    "",
    "This proves you own this wallet. It costs no gas.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}

export function createSessionToken(address: Address) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const payload = `${address.toLowerCase()}.${exp}`;
  return { token: `${payload}.${sign(payload)}`, maxAge: SESSION_TTL_S };
}

function readToken(token: string | undefined): Address | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [address, exp, mac] = parts;
  const expected = sign(`${address}.${exp}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return address as Address;
}

/** Wallet address proven by signature, or null. */
export async function getSessionAddress(): Promise<Address | null> {
  const jar = await cookies();
  return readToken(jar.get(SESSION_COOKIE)?.value);
}

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
