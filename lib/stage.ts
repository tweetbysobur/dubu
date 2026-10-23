import type { ChogToken } from "./chog";
import { getText, putText, setOnce } from "./store";
import type { Tier } from "./tiers";

/**
 * Staging: when the action needs a place, a prop or a body that the close-up does not
 * have, an image editor draws a new first frame with the same character, then that
 * frame is filmed. The image editor is deAPI's Qwen Image Edit Plus.
 *
 * Off unless STAGING_ENABLED=true, so production only changes when it is switched on.
 *
 * Flow (no long requests): /api/generate submits the edit and hands out a job token
 * whose id is "stage:<edit request id>". Each status check reads the edit; when it is
 * done, exactly one check (a SET NX claim) submits the video and stores its id, and
 * every later check follows that id.
 */

const DEAPI_BASE = (process.env.DEAPI_BASE_URL || "https://api.deapi.ai").replace(/\/$/, "");
const EDIT_MODEL = process.env.STAGE_MODEL?.trim() || "QwenImageEdit_Plus_NF4";
const TTL_S = 24 * 60 * 60;
const CANVAS = 1024;

export function stagingEnabled() {
  return !!process.env.DEAPI_API_KEY && process.env.STAGING_ENABLED?.trim() === "true";
}

/** What the later status checks need to film the staged frame. Kept in Redis by edit id. */
export type StageContext = {
  idea: string;
  tier: Tier;
  direct: boolean;
  chog: Pick<ChogToken, "name" | "traits"> | null;
  matched: string[];
};

const key = (kind: string, id: string) => `dubu:stage:${kind}:${id}`;

/**
 * Puts the close-up in the middle of a wider square, filled with the art's own corner
 * color, so the editor has room to draw a body and a scene around the same character.
 * The editor keeps the input's shape, so this is how the frame "zooms out".
 */
export async function padForStage(bytes: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp"); // only loaded when staging runs
  const img = sharp(bytes).rotate();
  const { data } = await img.clone().resize(4, 4, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const background = { r: data[0], g: data[1], b: data[2], alpha: 1 };
  const inner = Math.round(CANVAS * 0.56);
  const face = await img.resize(inner, inner, { fit: "cover" }).png().toBuffer();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background } })
    .composite([{ input: face, left: Math.round((CANVAS - inner) / 2), top: Math.round((CANVAS - inner) * 0.38) }])
    .png()
    .toBuffer();
}

/** Submits the edit. Returns deAPI's request id. */
export async function submitStage(padded: Buffer, prompt: string, negative: string): Promise<string> {
  const form = new FormData();
  form.append("model", EDIT_MODEL);
  form.append("prompt", prompt);
  form.append("negative_prompt", negative);
  form.append("steps", "40");
  form.append("seed", String(Math.floor(Math.random() * 2_147_483_647)));
  form.append("image", new Blob([new Uint8Array(padded)], { type: "image/png" }), "stage.png");
  const res = await fetch(`${DEAPI_BASE}/api/v2/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.DEAPI_API_KEY}`, Accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.request_id) {
    console.error("[stage] submit failed", res.status, JSON.stringify(data).slice(0, 400));
    throw new Error("stage submit failed");
  }
  return String(data.data.request_id);
}

export type StageStatus = { status: "processing" } | { status: "done"; url: string } | { status: "failed" };

export async function readStage(editId: string): Promise<StageStatus> {
  const res = await fetch(`${DEAPI_BASE}/api/v2/jobs/${encodeURIComponent(editId)}`, {
    headers: { Authorization: `Bearer ${process.env.DEAPI_API_KEY}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { status: "processing" }; // a hiccup reading status is not a failed scene
  const job = data?.data ?? {};
  if (job.status === "done" && job.result_url) return { status: "done", url: String(job.result_url) };
  if (job.status === "error") return { status: "failed" };
  return { status: "processing" };
}

/** Downloads the staged frame. Sends the key only to deAPI's own host. */
export async function fetchStagedImage(url: string): Promise<Buffer> {
  const headers: Record<string, string> = {};
  try {
    if (new URL(url).host === new URL(DEAPI_BASE).host) headers.Authorization = `Bearer ${process.env.DEAPI_API_KEY}`;
  } catch {
    // relative or bad URL: fetch will fail below
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`staged image ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function saveContext(editId: string, ctx: StageContext) {
  await putText(key("ctx", editId), JSON.stringify(ctx), TTL_S);
}
export async function loadContext(editId: string): Promise<StageContext | null> {
  const raw = await getText(key("ctx", editId));
  try {
    return raw ? (JSON.parse(raw) as StageContext) : null;
  } catch {
    return null;
  }
}

/** What happened after staging, once known: the video job and the shot it was filmed with. */
export type Filmed = { video: string; shot: string | null; scene: string } | { failed: string; scene?: string };

export async function readFilmed(editId: string): Promise<Filmed | null> {
  const raw = await getText(key("film", editId));
  try {
    return raw ? (JSON.parse(raw) as Filmed) : null;
  } catch {
    return null;
  }
}
export async function writeFilmed(editId: string, f: Filmed) {
  await putText(key("film", editId), JSON.stringify(f), TTL_S);
}

/** Only one status check may submit the video for a staged frame. */
export async function claimFilming(editId: string): Promise<boolean> {
  return setOnce(key("lock", editId), "1", 120);
}
