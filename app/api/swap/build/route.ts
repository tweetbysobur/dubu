import { NextResponse } from "next/server";
import type { Address } from "viem";
import { getSessionAddress } from "@/lib/session";
import { softBurst } from "@/lib/limits";
import { fail, readJson } from "@/lib/http";
import { buildSwap, parseAmount, parseSide, parseSlippage, swapAvailableFor, SwapError } from "@/lib/swap";

export const dynamic = "force-dynamic";

/**
 * Builds the next unsigned call for the signed-in wallet, which is always the recipient:
 * a buy, a sell, or the exact CHOG approval a sell needs first.
 */
export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in first.");
  if (!swapAvailableFor(address)) return fail(403, "Swap is not open yet.");
  if (!(await softBurst(`swap-build:${address}`, 20, 60_000))) return fail(429, "Too many tries. Wait a minute.");

  const body = await readJson<{ side?: unknown; amount?: unknown; mon?: unknown; slippageBps?: unknown }>(req);
  try {
    const side = parseSide(body?.side);
    const amountIn = await parseAmount(side, body?.amount ?? body?.mon);
    const slippage = parseSlippage(body?.slippageBps);
    return NextResponse.json(await buildSwap(address as Address, side, amountIn, slippage));
  } catch (e) {
    if (e instanceof SwapError) return fail(400, e.message);
    console.error("[swap] build failed", e);
    return fail(502, "Could not prepare the swap. Try again.");
  }
}
