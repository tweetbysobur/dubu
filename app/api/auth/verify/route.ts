import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAddress, isHex, type Address } from "viem";
import { client } from "@/lib/chog";
import { cookieBase, createSessionToken, NONCE_COOKIE, SESSION_COOKIE, signInMessage } from "@/lib/session";
import { fail, readJson } from "@/lib/http";
import { allowBurst, clientIp } from "@/lib/limits";

export async function POST(req: Request) {
  if (!allowBurst(`verify:${clientIp(req)}`, 10, 60_000)) return fail(429, "Too many attempts. Wait a minute.");

  const body = await readJson<{ address?: string; signature?: string }>(req);
  if (!body?.address || !isAddress(body.address)) return fail(400, "Invalid wallet address.");
  if (!body.signature || !isHex(body.signature)) return fail(400, "Invalid signature.");

  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  if (!nonce) return fail(400, "Sign-in expired. Try again.");

  const host = req.headers.get("host") ?? "dubu";
  const message = signInMessage(body.address, nonce, host);

  let valid = false;
  try {
    // Supports EOAs and smart wallets (EIP-1271)
    valid = await client.verifyMessage({
      address: body.address as Address,
      message,
      signature: body.signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return fail(401, "Signature does not match this wallet.");

  const { token, maxAge } = createSessionToken(body.address as Address);
  const res = NextResponse.json({ address: body.address.toLowerCase() });
  res.cookies.set(SESSION_COOKIE, token, { ...cookieBase, maxAge });
  res.cookies.delete(NONCE_COOKIE);
  return res;
}
