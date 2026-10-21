// Fetches a remote image for our own image routes, so the browser only ever talks to Dubu.
// Only hosts on this list are fetched, and only real images under the size cap come back.
const ALLOWED_HOSTS = new Set([
  "coin-images.coingecko.com",
  "assets.coingecko.com",
  "chog.xyz",
  "www.chog.xyz",
  "storage.nadapp.net",
  "raw.githubusercontent.com",
  "ipfs.io",
  "gateway.pinata.cloud",
  "cloudflare-ipfs.com",
  "nftstorage.link",
  "arweave.net",
]);

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(png|jpeg|webp|gif|svg\+xml|avif)$/;

/** The configured IPFS gateway is trusted too. */
function gatewayHost() {
  try {
    return process.env.IPFS_GATEWAY ? new URL(process.env.IPFS_GATEWAY).hostname : null;
  } catch {
    return null;
  }
}

export function hostAllowed(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (ALLOWED_HOSTS.has(u.hostname) || u.hostname === gatewayHost() || u.hostname.endsWith(".ipfs.dweb.link"));
  } catch {
    return false;
  }
}

export async function fetchImage(url: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!hostAllowed(url)) return null;
  const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.test(type)) return null;
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return null;
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return null;
  return { body, type };
}

/** Long cache at the edge: these images do not change. */
export function imageResponse(img: { body: ArrayBuffer; type: string }) {
  return new Response(img.body, {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      // SVGs from elsewhere cannot run script when opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
