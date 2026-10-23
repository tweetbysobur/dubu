import { NextResponse } from "next/server";
import type { Address, Hex } from "viem";
import { getSessionAddress } from "@/lib/session";
import { softBurst } from "@/lib/limits";
import { fail, readJson } from "@/lib/http";
import { sendSignedWithdraw, trackWithdraw, withdrawOpen, WithdrawError } from "@/lib/withdraw";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RAW = /^0x[0-9a-fA-F]{2,8000}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;

/**
 * { raw }: a withdrawal signed by the passkey wallet. Checked, then broadcast once.
 * { hash }: a withdrawal already sent. Read back and confirmed.
 */
export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in first.");
  if (!(await softBurst(`withdraw-send:${address}`, 60, 60_000))) return fail(429, "Too many tries. Wait a minute.");

  const body = await readJson<{ raw?: unknown; hash?: unknown }>(req);
  try {
    if (typeof body?.raw === "string" && RAW.test(body.raw)) {
      if (!withdrawOpen()) return fail(403, "Withdrawals are paused for now.");
      return NextResponse.json(await sendSignedWithdraw(body.raw as Hex, address as Address));
    }
    if (typeof body?.hash === "string" && HASH.test(body.hash)) {
      return NextResponse.json(await trackWithdraw(body.hash as Hex, address as Address));
    }
    return fail(400, "Send a signed withdrawal or a transaction hash.");
  } catch (e) {
    if (e instanceof WithdrawError) return fail(400, e.message);
    console.error("[withdraw] send failed", e);
    return fail(502, "Could not confirm the withdrawal. Check MonadScan before trying again.");
  }
}
