import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/session";
import { decodeJob } from "@/lib/jobs";
import { progress } from "@/lib/film";
import { TIER_INFO } from "@/lib/tiers";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in with your wallet first.");

  const job = decodeJob(id);
  if (!job) return fail(404, "Video not found. It may have expired.");
  if (job.address !== address.toLowerCase()) return fail(403, "This video belongs to another wallet.");

  try {
    const v = await progress(job);
    return NextResponse.json({
      id,
      status: v.status,
      phase: v.phase,
      error: v.error,
      tier: job.tier,
      watermark: TIER_INFO[job.tier].watermark,
      prompt: job.prompt,
      shot: v.shot ?? job.shot ?? null,
      // The scene Dubu set up before filming, when the action needed one.
      sceneUrl: v.scene ? `/api/jobs/${encodeURIComponent(id)}/scene` : undefined,
      // The browser only ever sees our own URL, never the provider's
      videoUrl: v.status === "succeeded" ? `/api/jobs/${encodeURIComponent(id)}/video` : undefined,
    });
  } catch (e) {
    console.error("[jobs] status error", e);
    return fail(502, "Could not reach the video service.");
  }
}
