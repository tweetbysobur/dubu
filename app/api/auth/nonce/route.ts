import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { cookieBase, newNonce, NONCE_COOKIE, signInMessage } from "@/lib/session";
import { fail } from "@/lib/http";
import { clientIp, softBurst } from "@/lib/limits";

export async function GET(req: Request) {
  if (!(await softBurst(`nonce:${clientIp(req)}`, 20, 60_000))) return fail(429, "Too many requests. Wait a minute.");

  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) return fail(400, "Invalid wallet address.");

  const nonce = newNonce();
  const host = req.headers.get("host") ?? "dubu";
  const res = NextResponse.json({ message: signInMessage(address, nonce, host) });
  res.cookies.set(NONCE_COOKIE, nonce, { ...cookieBase, maxAge: 300 });
  return res;
}
