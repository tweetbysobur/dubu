import { NextResponse } from "next/server";
import type { Address } from "viem";
import { getSessionAddress } from "@/lib/session";
import { softBurst } from "@/lib/limits";
import { fail, readJson } from "@/lib/http";
import { buildSwap, parseAmount, parseSide, parseSlippage, swapAvailableFor, SwapError, type SignedPermit } from "@/lib/swap";
import { isAddress, type Hex } from "viem";

export const dynamic = "force-dynamic";

/**
 * Builds the next unsigned call for the signed-in wallet, which is always the recipient:
 * a buy, a sell, or the exact CHOG approval a sell needs first.
 */
const B32 = /^0x[0-9a-fA-F]{64}$/;
const UINT = /^\d{1,30}$/;

/** A signed permit coming back from the browser. Shape only; buildSwap checks the meaning. */
function parsePermit(raw: unknown): SignedPermit {
  const p = raw as Record<string, unknown> | null;
  if (
    !p ||
    (p.v !== 27 && p.v !== 28) ||
    typeof p.r !== "string" || !B32.test(p.r) ||
    typeof p.s !== "string" || !B32.test(p.s) ||
    typeof p.deadline !== "string" || !UINT.test(p.deadline) ||
    typeof p.minOut !== "string" || !UINT.test(p.minOut) ||
    typeof p.router !== "string" || !isAddress(p.router)
  ) {
    throw new SwapError("That signature could not be read. Review the sale again.");
  }
  return { v: p.v, r: p.r as Hex, s: p.s as Hex, deadline: BigInt(p.deadline), minOut: BigInt(p.minOut), router: p.router };
}

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in first.");
  if (!swapAvailableFor(address)) return fail(403, "Swap is not open yet.");
  if (!(await softBurst(`swap-build:${address}`, 20, 60_000))) return fail(429, "Too many tries. Wait a minute.");

  const body = await readJson<{ side?: unknown; amount?: unknown; mon?: unknown; slippageBps?: unknown; permit?: unknown; noPermit?: unknown }>(req);
  try {
    const side = parseSide(body?.side);
    const amountIn = await parseAmount(side, body?.amount ?? body?.mon);
    const slippage = parseSlippage(body?.slippageBps);
    const permit = body?.permit === undefined ? undefined : parsePermit(body.permit);
    const built = await buildSwap(address as Address, side, amountIn, slippage, permit, body?.noPermit === true);
    return NextResponse.json(built, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof SwapError) return fail(400, e.message);
    console.error("[swap] build failed", e);
    return fail(502, "Could not prepare the swap. Try again.");
  }
}
