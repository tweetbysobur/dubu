import { getChogMeta, TOKEN_ID } from "@/lib/chog";
import { fetchImage, imageResponse } from "@/lib/images";
import { clientIp, softBurst } from "@/lib/limits";
import { fail } from "@/lib/http";

/**
 * The image of one Chog Genesis, served through Dubu and cached at the edge.
 * Used by the landing page showcase. Public: NFT art is public on-chain.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!TOKEN_ID.test(id)) return fail(400, "Token ID must be a number.");
  if (!(await softBurst(`chog-img:${clientIp(req)}`, 120, 60_000))) return fail(429, "Too many requests.");

  const meta = await getChogMeta(id);
  if (!meta) return fail(404, "No image for that Chog.");
  const img = await fetchImage(meta.image).catch(() => null);
  if (!img) return fail(502, "Could not load that Chog's image.");
  return imageResponse(img);
}
