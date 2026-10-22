import type { ChogToken } from "./chog";
import { fetchImage } from "./images";
import type { Tier } from "./tiers";

/**
 * The director: one Claude call before each render. It looks at the image and
 * the user's sentence and writes the shot the video model gets: one clear
 * action, a camera move, light and mood, the same character from start to end.
 * For uploads it also says whether the image is usable at all, so a bad image
 * costs no video credit.
 *
 * Off when ANTHROPIC_API_KEY is unset. Any failure (timeout, outage, odd reply)
 * falls back to the user's own sentence, so videos never stop because of it.
 */

const API = `${(process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`;
const TIMEOUT_MS = 15_000;
const MAX_SHOT = 600;

export function directorEnabled() {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

function model() {
  return process.env.DIRECTOR_MODEL?.trim() || "claude-haiku-5-5";
}

export type Direction =
  | { kind: "shot"; shot: string }
  | { kind: "rejected"; reason: string }
  | { kind: "skipped" };

const SYSTEM = `You direct short image-to-video clips for Dubu. The video model animates the given image for about 4 seconds, guided by one text prompt you write.

Write the prompt so the clip looks good:
- One clear action that fits 4 seconds. No scene changes, no cuts, no text on screen.
- Name one camera move (slow push in, gentle orbit, handheld follow, static wide) and the light and mood.
- Keep the subject exactly as it looks in the image: same face, colors, outfit and accessories. Describe it briefly by what you see.
- Follow the user's idea. Make it vivid, not longer. Under 70 words, plain present tense, no lists, no quotes.
- Never add real people's names, brands, logos or anything sexual, violent or hateful, even if asked.

For uploaded images, first decide if the image can be animated: it needs a clear subject. Reject it, with a short plain reason a person would understand, if it is blank or unreadable, shows nudity or sexual content, graphic violence, a real child, or hateful symbols. A Chog Genesis image is always usable.`;

const TOOL = {
  name: "write_shot",
  description: "Return the shot for the video model, or say why the image cannot be used.",
  input_schema: {
    type: "object",
    properties: {
      usable: { type: "boolean", description: "False only when the image must not be animated." },
      reason: { type: "string", description: "When not usable: one short sentence for the user. Else empty." },
      shot: { type: "string", description: "The prompt for the video model. Empty when not usable." },
    },
    required: ["usable", "reason", "shot"],
  },
};

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/;

async function imageBlock(image: string) {
  const m = image.match(DATA_URL);
  if (m) return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  const fetched = await fetchImage(image).catch(() => null);
  if (!fetched || !/^image\/(png|jpeg|webp|gif)$/.test(fetched.type)) return null;
  return { type: "image", source: { type: "base64", media_type: fetched.type, data: Buffer.from(fetched.body).toString("base64") } };
}

function clean(s: string) {
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_SHOT);
}

export async function direct(args: { prompt: string; image: string; tier: Tier; chog?: ChogToken | null }): Promise<Direction> {
  if (!directorEnabled()) return { kind: "skipped" };
  const { prompt, image, chog } = args;

  try {
    const img = await imageBlock(image);
    if (!img) return { kind: "skipped" };

    const context = chog
      ? `This is ${chog.name}, the user's own Chog Genesis NFT.${
          chog.traits.length ? ` Its traits: ${chog.traits.map((t) => `${t.trait_type}: ${t.value}`).join("; ")}.` : ""
        } Use the traits that suit the scene.`
      : "This is an image the user uploaded.";

    const res = await fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model(),
        max_tokens: 400,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: [img, { type: "text", text: `${context}\n\nThe user's idea: ${prompt}` }],
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[director] API error", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return { kind: "skipped" };
    }
    const data = (await res.json()) as { content?: { type: string; input?: { usable?: unknown; reason?: unknown; shot?: unknown } }[] };
    const out = data.content?.find((c) => c.type === "tool_use")?.input;
    if (!out) return { kind: "skipped" };

    // A Chog Genesis is never rejected: the holder owns it and it is known art.
    if (out.usable === false && !chog) {
      const reason = typeof out.reason === "string" && out.reason.trim() ? clean(out.reason) : "Dubu cannot animate this image.";
      return { kind: "rejected", reason };
    }
    const shot = typeof out.shot === "string" ? clean(out.shot) : "";
    return shot.length >= 10 ? { kind: "shot", shot } : { kind: "skipped" };
  } catch (e) {
    console.error("[director] failed, using the user's prompt", e instanceof Error ? e.message : e);
    return { kind: "skipped" };
  }
}
