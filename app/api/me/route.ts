import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/session";
import { getStanding, monBalance } from "@/lib/standing";
import { accountAddresses } from "@/lib/links";
import { dailyLimit, TIER_INFO } from "@/lib/tiers";
import { getUsed } from "@/lib/limits";
import { MOCK } from "@/lib/video";
import { fail } from "@/lib/http";
import { swapAvailableFor } from "@/lib/swap";

export const dynamic = "force-dynamic";

/** The signed-in account's level, from Chog Genesis NFTs and CHOG balance across its wallets. */
export async function GET() {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Not signed in.");

  let status;
  // MON is only read for the sign-in wallet: it is the one that can swap. A failed read shows as unknown.
  const mon = monBalance(address).catch(() => null);
  try {
    status = await getStanding(await accountAddresses(address));
  } catch (e) {
    console.error("[me] ownership check failed", e);
    return fail(502, "Could not reach Monad to check your Chog holdings. Try again.");
  }

  let used: number;
  try {
    used = await getUsed(address);
  } catch (e) {
    console.error("[me] store error", e);
    return fail(503, "Usage service is unavailable. Try again shortly.");
  }

  const tier = status.tier;
  return NextResponse.json({
    address,
    tier,
    ...TIER_INFO[tier],
    tokens: status.tokens,
    wallets: status.wallets,
    chog: status.chog,
    mon: { balance: await mon },
    swap: swapAvailableFor(address),
    used,
    limit: dailyLimit(tier),
    mock: MOCK,
  });
}
