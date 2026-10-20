import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/session";
import { getOwnedToken, TOKEN_ID } from "@/lib/chog";
import { allowBurst } from "@/lib/limits";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Loads one Chog by ID, only if the signed-in wallet owns it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in with your wallet first.");
  if (!TOKEN_ID.test(id)) return fail(400, "Token ID must be a number.");
  if (!allowBurst(`token:${address}`, 20, 60_000)) return fail(429, "Too many lookups. Wait a minute.");

  try {
    const token = await getOwnedToken(address, id);
    if (!token) return fail(403, `Chog #${id} is not in your wallet.`);
    return NextResponse.json(token);
  } catch (e) {
    console.error("[token] lookup failed", e);
    return fail(502, "Could not load that Chog's metadata. Try again.");
  }
}
