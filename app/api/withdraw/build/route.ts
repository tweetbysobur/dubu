import { NextResponse } from "next/server";
import type { Address } from "viem";
import { getSessionAddress } from "@/lib/session";
import { softBurst } from "@/lib/limits";
import { fail, readJson } from "@/lib/http";
import { buildWithdraw, parseToken, withdrawOpen, WithdrawError } from "@/lib/withdraw";

export const dynamic = "force-dynamic";

/** Builds the unsigned transfer out of the signed-in wallet. The person reviews and signs it. */
export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in first.");
  if (!withdrawOpen()) return fail(403, "Withdrawals are paused for now.");
  if (!(await softBurst(`withdraw-build:${address}`, 20, 60_000))) return fail(429, "Too many tries. Wait a minute.");

  const body = await readJson<{ token?: unknown; amount?: unknown; to?: unknown }>(req);
  try {
    const built = await buildWithdraw(address as Address, parseToken(body?.token), body?.amount, body?.to);
    return NextResponse.json(built, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof WithdrawError) return fail(400, e.message);
    console.error("[withdraw] build failed", e);
    return fail(502, "Could not prepare the withdrawal. Try again.");
  }
}
