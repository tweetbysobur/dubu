import { NextResponse } from "next/server";
import { persistent, ping } from "@/lib/store";
import { MOCK } from "@/lib/video";

export const dynamic = "force-dynamic";

/** Which backends are configured and reachable. Names and booleans only, never values. */
export async function GET() {
  const storeOk = await ping();
  return NextResponse.json(
    {
      store: persistent ? "redis" : "memory",
      storeOk,
      video: MOCK ? "demo" : "replicate",
      chogContract: Boolean(process.env.CHOG_CONTRACT_ADDRESS),
      sessionSecret: (process.env.SESSION_SECRET?.length ?? 0) >= 32,
    },
    { status: storeOk ? 200 : 503 },
  );
}
