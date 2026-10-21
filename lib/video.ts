import { imageSize } from "image-size";
import { isSharp, type Tier } from "./tiers";

// Provider selection: deAPI (free credits at signup), then Replicate, then demo mode.
const DEAPI_KEY = process.env.DEAPI_API_KEY;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
export const PROVIDER: "deapi" | "replicate" | "demo" = DEAPI_KEY ? "deapi" : REPLICATE_TOKEN ? "replicate" : "demo";
export const MOCK = PROVIDER === "demo";

const DEAPI_BASE = (process.env.DEAPI_BASE_URL || "https://api.deapi.ai").replace(/\/$/, "");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MOCK_DELAY_MS = 8000;
const MOCK_VIDEO = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

export type VideoStatus = { status: "processing" | "succeeded" | "failed"; url?: string; error?: string };
type CreateArgs = { tier: Tier; image: string; prompt: string };

/** Job IDs are prefixed with the provider so polling goes to the right place. */
export async function createVideo(args: CreateArgs): Promise<string> {
  if (PROVIDER === "deapi") return `deapi:${await deapiCreate(args)}`;
  if (PROVIDER === "replicate") return `rep:${await replicateCreate(args)}`;
  return `mock-${Date.now()}`;
}

export async function getVideo(id: string): Promise<VideoStatus> {
  if (id.startsWith("mock-")) {
    const started = Number(id.slice(5));
    return Date.now() - started > MOCK_DELAY_MS ? { status: "succeeded", url: MOCK_VIDEO } : { status: "processing" };
  }
  if (id.startsWith("deapi:")) return deapiGet(id.slice(6));
  if (id.startsWith("rep:")) return replicateGet(id.slice(4));
  return { status: "failed", error: "Unknown video job." };
}

/**
 * Headers for downloading a finished video. Sends the deAPI key only when the file
 * lives on deAPI's own API host, never to third-party storage.
 */
export function videoFetchHeaders(jobId: string, url: string): Record<string, string> {
  try {
    if (jobId.startsWith("deapi:") && new URL(url).host === new URL(DEAPI_BASE).host) {
      return { Authorization: `Bearer ${DEAPI_KEY}` };
    }
  } catch {
    // bad URL: no auth
  }
  return {};
}

// ---------- shared image handling ----------

/** Turns a data URL or a remote URL into bytes, with a size cap. */
async function loadImage(image: string): Promise<{ bytes: Buffer; type: string }> {
  const m = image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (m) return { bytes: Buffer.from(m[2], "base64"), type: m[1] };

  const res = await fetch(image, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES) throw new Error("image too large");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("image too large");
  return { bytes, type: res.headers.get("content-type")?.split(";")[0] || "image/png" };
}

/** Output size keeps the image's aspect ratio. Long side by tier, both sides multiples of 32. */
function outputSize(bytes: Buffer, longSide: number) {
  let w = 1;
  let h = 1;
  try {
    const d = imageSize(bytes);
    if (d.width && d.height) {
      w = d.width;
      h = d.height;
    }
  } catch {
    // unknown format: fall back to square
  }
  const scale = longSide / Math.max(w, h);
  const snap = (n: number) => Math.max(256, Math.round((n * scale) / 32) * 32);
  return { width: snap(w), height: snap(h) };
}

function envInt(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------- deAPI (https://docs.deapi.ai) ----------

async function deapiCreate({ tier, image, prompt }: CreateArgs): Promise<string> {
  const { bytes, type } = await loadImage(image);
  const longSide = isSharp(tier) ? envInt("DEAPI_SIZE_HOLDER", 768) : envInt("DEAPI_SIZE_FREE", 512);
  const { width, height } = outputSize(bytes, longSide);

  const form = new FormData();
  form.append("model", process.env.DEAPI_MODEL || "Ltxv_13B_0_9_8_Distilled_FP8");
  form.append("prompt", prompt);
  form.append("width", String(width));
  form.append("height", String(height));
  form.append("frames", String(envInt("DEAPI_FRAMES", 120)));
  form.append("fps", String(envInt("DEAPI_FPS", 30)));
  form.append("steps", String(envInt("DEAPI_STEPS", 1)));
  form.append("guidance", process.env.DEAPI_GUIDANCE || "1");
  form.append("seed", String(Math.floor(Math.random() * 2_147_483_647)));
  const ext = type.split("/")[1] || "png";
  form.append("first_frame_image", new Blob([new Uint8Array(bytes)], { type }), `frame.${ext}`);

  const res = await fetch(`${DEAPI_BASE}/api/v2/videos/animations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${DEAPI_KEY}`, Accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.request_id) {
    // Log field errors so a wrong model setting is visible in Vercel logs
    console.error("[deapi] create failed", res.status, JSON.stringify(data).slice(0, 500));
    throw new Error(data?.message || `deAPI error ${res.status}`);
  }
  return String(data.data.request_id);
}

async function deapiGet(requestId: string): Promise<VideoStatus> {
  const res = await fetch(`${DEAPI_BASE}/api/v2/jobs/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${DEAPI_KEY}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[deapi] status failed", res.status, JSON.stringify(data).slice(0, 300));
    return { status: "failed", error: "Could not read the video status." };
  }
  const job = data?.data ?? {};
  // Per deAPI docs: finished when status is "done" or "error". progress 100 alone is not ready.
  if (job.status === "done" && job.result_url) return { status: "succeeded", url: String(job.result_url) };
  if (job.status === "error") return { status: "failed", error: "Generation failed. Try another image or prompt." };
  return { status: "processing" };
}

// ---------- Replicate ----------

function replicateExtra(tier: Tier): Record<string, unknown> {
  const raw = isSharp(tier) ? process.env.REPLICATE_INPUT_HOLDER : process.env.REPLICATE_INPUT_FREE;
  try {
    return raw ? JSON.parse(raw) : { resolution: isSharp(tier) ? "720p" : "480p" };
  } catch {
    return {};
  }
}

async function replicateCreate({ tier, image, prompt }: CreateArgs): Promise<string> {
  const model = process.env.REPLICATE_MODEL || "wan-video/wan-2.2-i2v-fast";
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REPLICATE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: { image, prompt, ...replicateExtra(tier) } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.title || "Video API error");
  return data.id as string;
}

async function replicateGet(id: string): Promise<VideoStatus> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) return { status: "failed", error: data.detail || "Lookup failed" };
  if (data.status === "succeeded") {
    const url = Array.isArray(data.output) ? data.output[0] : data.output;
    return { status: "succeeded", url };
  }
  if (data.status === "failed" || data.status === "canceled") {
    return { status: "failed", error: data.error || "Generation failed" };
  }
  return { status: "processing" };
}
