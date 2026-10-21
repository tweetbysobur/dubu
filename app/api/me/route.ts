import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/session";
import { getHolderStatus } from "@/lib/chog";
import { dailyLimit, TIER_INFO } from "@/lib/tiers";
import { getUsed } from "@/lib/limits";
import { MOCK } from "@/lib/video";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Verifies the signed-in wallet's Chog ownership and returns its tier. */
export async function GET() {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Not signed in.");

  let status;
  try {
    status = await getHolderStatus(address);
  } catch (e) {
    console.error("[me] ownership check failed", e);
    return fail(502, "Could not reach Monad to check your Chog. Try again.");
  }

  let used: number;
  try {
    used = await getUsed(address);
  } catch (e) {
    console.error("[me] store error", e);
    return fail(503, "Usage service is unavailable. Try again shortly.");
  }

  const tier = status.holder ? "holder" : "free";
  return NextResponse.json({
    address,
    tier,
    ...TIER_INFO[tier],
    tokens: status.tokens,
    used,
    limit: dailyLimit(tier),
    mock: MOCK,
  });
}
