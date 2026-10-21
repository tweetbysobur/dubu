import { NextResponse } from "next/server";
import type { Address, Hex } from "viem";
import { getSessionAddress } from "@/lib/session";
import { softBurst } from "@/lib/limits";
import { fail, readJson } from "@/lib/http";
import { sendSignedSwap, swapAvailableFor, SwapError, trackSwap } from "@/lib/swap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RAW = /^0x[0-9a-fA-F]{2,8000}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;

/**
 * { raw }: a swap signed by the passkey wallet. Checked, then broadcast.
 * { hash }: a swap an external wallet already sent. Confirmed and read back.
 */
export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in first.");
  if (!swapAvailableFor(address)) return fail(403, "Swap is not open yet.");
  if (!(await softBurst(`swap-send:${address}`, 10, 60_000))) return fail(429, "Too many tries. Wait a minute.");

  const body = await readJson<{ raw?: unknown; hash?: unknown }>(req);
  try {
    if (typeof body?.raw === "string" && RAW.test(body.raw)) {
      return NextResponse.json(await sendSignedSwap(body.raw as Hex, address as Address));
    }
    if (typeof body?.hash === "string" && HASH.test(body.hash)) {
      return NextResponse.json(await trackSwap(body.hash as Hex, address as Address));
    }
    return fail(400, "Send a signed swap or a transaction hash.");
  } catch (e) {
    if (e instanceof SwapError) return fail(400, e.message);
    console.error("[swap] send failed", e);
    return fail(502, "Could not confirm the swap. Check MonadScan before trying again.");
  }
}
