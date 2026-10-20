import { getSessionAddress } from "@/lib/session";
import { getJob } from "@/lib/jobs";
import { getVideo } from "@/lib/video";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Streams the finished video through our backend so the client never calls the provider. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in with your wallet first.");

  const job = getJob(id);
  if (!job || job.address !== address) return fail(404, "Video not found.");

  const v = await getVideo(id);
  if (v.status !== "succeeded" || !v.url) return fail(409, "Video is not ready yet.");

  const range = req.headers.get("range");
  const upstream = await fetch(v.url, { headers: range ? { range } : {} });
  if (!upstream.ok && upstream.status !== 206) return fail(502, "Could not load the video file.");

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const val = upstream.headers.get(h);
    if (val) headers.set(h, val);
  }
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
  headers.set("cache-control", "private, max-age=3600");

  return new Response(upstream.body, { status: upstream.status, headers });
}
