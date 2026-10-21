import { NextResponse } from "next/server";
import { clipSeconds, dailyLimit, TIER_INFO } from "@/lib/tiers";

export const dynamic = "force-dynamic";

/** Public tier facts, read from server config so the UI never shows a number the backend does not enforce. */
export function GET() {
  return NextResponse.json({
    holder: { ...TIER_INFO.holder, limit: dailyLimit("holder") },
    free: { ...TIER_INFO.free, limit: dailyLimit("free") },
    clipSeconds: clipSeconds(),
  });
}
