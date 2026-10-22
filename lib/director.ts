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
const MAX_SHOT = 1400;

/**
 * Used when the director is off or unavailable. A bare sentence like "dancing
 * in the rain" is too short for the video model, which then makes generic,
 * barely moving clips. This wraps it in the structure the model follows best,
 * without changing what the person asked for.
 */
export function expandPrompt(prompt: string, chog?: ChogToken | null) {
  const who = chog ? `${chog.name}, the character from the image,` : "The main character from the image";
  const traits = chog?.traits.length
    ? ` It keeps its traits: ${chog.traits.map((t) => `${t.trait_type.toLowerCase()} ${t.value}`).join(", ")}.`
    : "";
  return [
    `${who} ${prompt.replace(/[.!?]+$/, "")}.`,
    "The action starts right away and stays the focus for the whole clip, with clear, natural motion and small details like blinking and breathing.",
    "The camera holds steady with a slow push in.",
    `It keeps exactly the same face, colors, outfit and art style as the image, and the same lighting throughout.${traits}`,
  ].join(" ");
}

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

const SYSTEM = `You direct short image-to-video clips for Dubu. People upload a character, often their NFT, and say what it should do. The video model (LTX-2.3) animates the image for about 5 seconds from one prompt you write. Your job is that the clip shows exactly what the person asked for.

The person's intent comes first:
- The action they asked for must happen, clearly, starting in the first second, and stay the main thing on screen. Never swap it for a different or "safer" action, never water it down, never add a second unrelated action.
- Keep every specific they gave: objects, places, emotions, direction, speed, style. If they wrote "waves with the left paw", the left paw waves.
- If the idea is vague ("make it cool"), choose one clear, fun action that fits the character.

How LTX-2.3 follows a prompt best:
- One flowing paragraph in present tense, 60 to 150 words. No lists, no quotes, no headings.
- The image already sets who the character is and the composition. Spend the words on motion: write the action as a short chain of beats (it lifts its head, then grins, then waves), with the physical results (ears bounce, fur ruffles, rain splashes off its shoulders).
- Name small life motions so nothing freezes: blinking, breathing, a slight sway.
- Give motion a direction (wind from left to right, it walks toward the camera).
- One camera move only, slow and steady: static, slow push in, gentle orbit or slow pan. Close-ups stay steady.
- Keep the character exactly as in the image: same face, colors, outfit, accessories and art style (cartoon stays cartoon, pixel art stays pixel art). Restate the image's lighting and colors so they do not drift.
- No cuts, no scene changes, no on-screen text.
- Never add real people's names, brands or logos, or anything sexual, violent or hateful, even if asked.

For uploaded images, first decide if the image can be animated: it needs a clear subject. Reject it, with one short plain reason a person would understand, if it is blank or unreadable, shows nudity or sexual content, graphic violence, a real child, or hateful symbols. Cartoon and NFT characters are welcome. A Chog Genesis image is always usable.`;

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
        max_tokens: 700,
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
    return shot.length >= 40 ? { kind: "shot", shot } : { kind: "skipped" };
  } catch (e) {
    console.error("[director] failed, using the user's prompt", e instanceof Error ? e.message : e);
    return { kind: "skipped" };
  }
}
