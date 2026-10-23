import { getSessionAddress } from "@/lib/session";
import { decodeJob } from "@/lib/jobs";
import { videoFetchHeaders } from "@/lib/video";
import { progress } from "@/lib/film";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Streams the finished video through our backend so the client never calls the provider. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in with your wallet first.");

  const job = decodeJob(id);
  if (!job || job.address !== address.toLowerCase()) return fail(404, "Video not found.");

  let v;
  try {
    v = await progress(job);
  } catch {
    return fail(502, "Could not reach the video service.");
  }
  if (v.status !== "succeeded" || !v.url) return fail(409, "Video is not ready yet.");

  const range = req.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(v.url, {
      headers: { ...videoFetchHeaders(v.videoId ?? job.id, v.url), ...(range ? { range } : {}) },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return fail(502, "Could not load the video file.");
  }
  if (!upstream.ok && upstream.status !== 206) {
    console.error("[video] upstream", upstream.status);
    return fail(502, "Could not load the video file.");
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const val = upstream.headers.get(h);
    if (val) headers.set(h, val);
  }
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
  headers.set("cache-control", "private, max-age=3600");

  return new Response(upstream.body, { status: upstream.status, headers });
}
