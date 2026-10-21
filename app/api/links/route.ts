import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAddress, isHex, type Address } from "viem";
import { client } from "@/lib/chog";
import { getSessionAddress, LINK_NONCE_COOKIE, linkMessage } from "@/lib/session";
import { linkWallet, unlinkWallet } from "@/lib/links";
import { softBurst } from "@/lib/limits";
import { fail, readJson } from "@/lib/http";

/** Links a wallet to the signed-in account after that wallet signs the link message. */
export async function POST(req: Request) {
  const account = await getSessionAddress();
  if (!account) return fail(401, "Sign in first.");
  if (!(await softBurst(`link:${account}`, 10, 60_000))) return fail(429, "Too many attempts. Wait a minute.");

  const body = await readJson<{ address?: string; signature?: string }>(req);
  if (!body?.address || !isAddress(body.address)) return fail(400, "Invalid wallet address.");
  if (!body.signature || !isHex(body.signature)) return fail(400, "Invalid signature.");

  const jar = await cookies();
  const nonce = jar.get(LINK_NONCE_COOKIE)?.value;
  if (!nonce) return fail(400, "The link request expired. Try again.");

  const host = req.headers.get("host") ?? "dubu";
  let valid = false;
  try {
    valid = await client.verifyMessage({
      address: body.address as Address,
      message: linkMessage(account, body.address, nonce, host),
      signature: body.signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return fail(401, "The signature does not match that wallet.");

  let result;
  try {
    result = await linkWallet(account, body.address);
  } catch (e) {
    console.error("[links] store error", e);
    return fail(503, "Could not save the link right now. Try again shortly.");
  }
  if (!result.ok) return fail(result.status, result.error);

  const res = NextResponse.json({ linked: body.address.toLowerCase() });
  res.cookies.delete(LINK_NONCE_COOKIE);
  return res;
}

/** Unlinks a wallet from the signed-in account. */
export async function DELETE(req: Request) {
  const account = await getSessionAddress();
  if (!account) return fail(401, "Sign in first.");
  const body = await readJson<{ address?: string }>(req);
  if (!body?.address || !isAddress(body.address)) return fail(400, "Invalid wallet address.");
  try {
    await unlinkWallet(account, body.address);
  } catch (e) {
    console.error("[links] store error", e);
    return fail(503, "Could not unlink right now. Try again shortly.");
  }
  return NextResponse.json({ unlinked: body.address.toLowerCase() });
}
