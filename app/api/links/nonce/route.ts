import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { cookieBase, getSessionAddress, LINK_NONCE_COOKIE, linkMessage, newNonce } from "@/lib/session";
import { softBurst } from "@/lib/limits";
import { fail } from "@/lib/http";

/** Message the wallet being linked must sign. Bound to the signed-in account and that wallet. */
export async function GET(req: Request) {
  const account = await getSessionAddress();
  if (!account) return fail(401, "Sign in first.");
  if (!(await softBurst(`link-nonce:${account}`, 20, 60_000))) return fail(429, "Too many requests. Wait a minute.");

  const wallet = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(wallet)) return fail(400, "Invalid wallet address.");
  if (wallet.toLowerCase() === account.toLowerCase()) return fail(400, "That is the wallet you signed in with.");

  const nonce = newNonce();
  const host = req.headers.get("host") ?? "dubu";
  const res = NextResponse.json({ message: linkMessage(account, wallet, nonce, host) });
  res.cookies.set(LINK_NONCE_COOKIE, nonce, { ...cookieBase, maxAge: 300 });
  return res;
}
