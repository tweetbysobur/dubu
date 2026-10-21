import { NextResponse } from "next/server";
import { swapOpen } from "@/lib/swap";
import { chogMinSetting, clipSeconds, dailyLimit, TIER_INFO } from "@/lib/tiers";

export const dynamic = "force-dynamic";

/** Public tier facts, read from server config so the UI never shows a number the backend does not enforce. */
export function GET() {
  return NextResponse.json({
    holder: { ...TIER_INFO.holder, limit: dailyLimit("holder") },
    token: { ...TIER_INFO.token, limit: dailyLimit("token") },
    free: { ...TIER_INFO.free, limit: dailyLimit("free") },
    /** Minimum CHOG for the CHOG holder level; null while that level is off. */
    chogMin: chogMinSetting(),
    clipSeconds: clipSeconds(),
    /** True once the MON to CHOG swap is open to everyone. */
    swap: swapOpen(),
  });
}
