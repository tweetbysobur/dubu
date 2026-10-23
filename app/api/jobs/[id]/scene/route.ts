import { getSessionAddress } from "@/lib/session";
import { decodeJob } from "@/lib/jobs";
import { isStaged } from "@/lib/film";
import { readFilmed, readStage, fetchStagedImage } from "@/lib/stage";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The scene Dubu set up before filming, served through our backend like the video. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in first.");
  const job = decodeJob(id);
  if (!job || job.address !== address.toLowerCase() || !isStaged(job)) return fail(404, "No scene for this video.");

  const editId = job.id.slice("stage:".length);
  const filmed = await readFilmed(editId).catch(() => null);
  let url = filmed && "scene" in filmed ? filmed.scene : undefined;
  if (!url) {
    const s = await readStage(editId).catch(() => null);
    if (s?.status === "done") url = s.url;
  }
  if (!url) return fail(409, "The scene is not ready yet.");

  try {
    const bytes = await fetchStagedImage(url);
    const type = bytes[0] === 0x89 ? "image/png" : bytes[0] === 0xff ? "image/jpeg" : bytes.subarray(8, 12).toString() === "WEBP" ? "image/webp" : null;
    if (!type) return fail(502, "The scene is not an image.");
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": type, "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" },
    });
  } catch {
    return fail(502, "Could not load the scene.");
  }
}
