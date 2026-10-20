import type { Tier } from "./tiers";

const TOKEN = process.env.REPLICATE_API_TOKEN;
export const MOCK = !TOKEN;
const MOCK_DELAY_MS = 8000;
const MOCK_VIDEO = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

export type VideoStatus = { status: "processing" | "succeeded" | "failed"; url?: string; error?: string };

function extraInput(tier: Tier): Record<string, unknown> {
  const raw = tier === "holder" ? process.env.REPLICATE_INPUT_HOLDER : process.env.REPLICATE_INPUT_FREE;
  try {
    return raw ? JSON.parse(raw) : { resolution: tier === "holder" ? "720p" : "480p" };
  } catch {
    return {};
  }
}

export async function createVideo(args: { tier: Tier; image: string; prompt: string }): Promise<string> {
  if (MOCK) return `mock-${Date.now()}`;

  const model = process.env.REPLICATE_MODEL || "wan-video/wan-2.2-i2v-fast";
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: { image: args.image, prompt: args.prompt, ...extraInput(args.tier) } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.title || "Video API error");
  return data.id as string;
}

export async function getVideo(id: string): Promise<VideoStatus> {
  if (id.startsWith("mock-")) {
    const started = Number(id.slice(5));
    return Date.now() - started > MOCK_DELAY_MS ? { status: "succeeded", url: MOCK_VIDEO } : { status: "processing" };
  }

  const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
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
