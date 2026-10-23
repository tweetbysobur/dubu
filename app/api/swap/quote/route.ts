import { NextResponse } from "next/server";
import { clientIp, softBurst } from "@/lib/limits";
import { fail } from "@/lib/http";
import { monForChog, parseAmount, parseChogAmount, parseSide, parseSlippage, quote, swapConfigured, SwapError } from "@/lib/swap";

export const dynamic = "force-dynamic";

/**
 * Read-only quote, MON to CHOG (side=buy) or CHOG to MON (side=sell). Public: it moves nothing.
 * With forChog=N: the buy that brings at least N CHOG even at the slippage floor.
 */
export async function GET(req: Request) {
  if (!swapConfigured()) return fail(404, "Swap is not set up.");
  if (!(await softBurst(`swap-quote:${clientIp(req)}`, 60, 60_000))) return fail(429, "Too many quotes. Wait a minute.");

  const url = new URL(req.url);
  try {
    const forChog = url.searchParams.get("forChog");
    if (forChog !== null) {
      const slippage = parseSlippage(url.searchParams.get("slippageBps") ?? undefined);
      return NextResponse.json(await monForChog(await parseChogAmount(forChog), slippage));
    }
    const side = parseSide(url.searchParams.get("side") ?? undefined);
    const amountIn = await parseAmount(side, url.searchParams.get("amount") ?? url.searchParams.get("mon"));
    const slippage = parseSlippage(url.searchParams.get("slippageBps") ?? undefined);
    return NextResponse.json(await quote(side, amountIn, slippage));
  } catch (e) {
    if (e instanceof SwapError) return fail(400, e.message);
    console.error("[swap] quote failed", e);
    return fail(502, "Could not get a quote from Monad. Try again.");
  }
}
