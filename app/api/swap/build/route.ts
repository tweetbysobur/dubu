import { NextResponse } from "next/server";
import type { Address } from "viem";
import { getSessionAddress } from "@/lib/session";
import { softBurst } from "@/lib/limits";
import { fail, readJson } from "@/lib/http";
import { buildSwap, parseMonAmount, parseSlippage, swapAvailableFor, SwapError } from "@/lib/swap";

export const dynamic = "force-dynamic";

/** Builds an unsigned MON to CHOG swap for the signed-in wallet, which is always the recipient. */
export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in first.");
  if (!swapAvailableFor(address)) return fail(403, "Swap is not open yet.");
  if (!(await softBurst(`swap-build:${address}`, 20, 60_000))) return fail(429, "Too many tries. Wait a minute.");

  const body = await readJson<{ mon?: unknown; slippageBps?: unknown }>(req);
  try {
    const amountIn = parseMonAmount(body?.mon);
    const slippage = parseSlippage(body?.slippageBps);
    return NextResponse.json(await buildSwap(address as Address, amountIn, slippage));
  } catch (e) {
    if (e instanceof SwapError) return fail(400, e.message);
    console.error("[swap] build failed", e);
    return fail(502, "Could not prepare the swap. Try again.");
  }
}
