import { NextResponse } from "next/server";
import { persistent, ping } from "@/lib/store";
import { PROVIDER } from "@/lib/video";
import { chogTracked } from "@/lib/standing";
import { chogMinSetting } from "@/lib/tiers";
import { chogListing } from "@/lib/chog";
import { swapConfigured, swapOpen } from "@/lib/swap";
import { directorEnabled } from "@/lib/director";
import { clientIp, softBurst } from "@/lib/limits";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Which backends are configured and reachable. Names and booleans only, never values. */
export async function GET(req: Request) {
  if (!(await softBurst(`health:${clientIp(req)}`, 30, 60_000))) return fail(429, "Too many checks. Wait a minute.");
  const storeOk = await ping();
  return NextResponse.json(
    {
      store: persistent ? "redis" : "memory",
      storeOk,
      video: PROVIDER,
      chogContract: Boolean(process.env.CHOG_CONTRACT_ADDRESS),
      chogListing: await chogListing().catch(() => "error"),
      chogToken: chogTracked(),
      chogTokenMin: chogMinSetting() !== null,
      swapConfigured: swapConfigured(),
      swapOpen: swapOpen(),
      director: directorEnabled(),
      sessionSecret: (process.env.SESSION_SECRET?.length ?? 0) >= 32,
    },
    { status: storeOk ? 200 : 503 },
  );
}
