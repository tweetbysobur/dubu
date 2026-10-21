import { NextResponse } from "next/server";
import { clientIp, softBurst } from "@/lib/limits";
import { fail } from "@/lib/http";
import { parseMonAmount, parseSlippage, quote, swapConfigured, SwapError } from "@/lib/swap";

export const dynamic = "force-dynamic";

/** Read-only quote for MON to CHOG. Public: it moves nothing. */
export async function GET(req: Request) {
  if (!swapConfigured()) return fail(404, "Swap is not set up.");
  if (!(await softBurst(`swap-quote:${clientIp(req)}`, 60, 60_000))) return fail(429, "Too many quotes. Wait a minute.");

  const url = new URL(req.url);
  try {
    const amountIn = parseMonAmount(url.searchParams.get("mon"));
    const slippage = parseSlippage(url.searchParams.get("slippageBps") ?? undefined);
    return NextResponse.json(await quote(amountIn, slippage));
  } catch (e) {
    if (e instanceof SwapError) return fail(400, e.message);
    console.error("[swap] quote failed", e);
    return fail(502, "Could not get a quote from Monad. Try again.");
  }
}
