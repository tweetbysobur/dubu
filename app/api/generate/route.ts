import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/session";
import { getOwnedTokenAny, type ChogToken } from "@/lib/chog";
import { getStanding } from "@/lib/standing";
import { accountAddresses } from "@/lib/links";
import { dailyLimit, type Tier } from "@/lib/tiers";
import {
  allowBurst,
  clientIp,
  freeIpDailyLimit,
  getUsed,
  refundFreeIp,
  refundUse,
  reserveFreeIp,
  reserveUse,
} from "@/lib/limits";
import { createVideo } from "@/lib/video";
import { encodeJob } from "@/lib/jobs";
import { fail, readJson } from "@/lib/http";
import { direct } from "@/lib/director";

const MAX_IMAGE_CHARS = 2_000_000; // ~1.5 MB after base64
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

type Body = { prompt?: string; tokenId?: string; image?: string; direct?: boolean };

function cleanPrompt(p: unknown) {
  if (typeof p !== "string") return null;
  const s = p.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.length >= 3 && s.length <= 500 ? s : null;
}

function holderPrompt(prompt: string, token: ChogToken) {
  const traits = token.traits.map((t) => `${t.trait_type.toLowerCase()}: ${t.value}`).join(", ");
  return [
    prompt,
    `The main character is the Chog from the reference image (${token.name})`,
    traits ? `with these traits: ${traits}.` : ".",
    "Keep its exact face, colors and accessories. Cinematic lighting, smooth camera motion.",
  ].join(" ");
}

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return fail(401, "Sign in with your wallet first.");

  const body = await readJson<Body>(req);
  if (!body) return fail(400, "Invalid request body.");

  const prompt = cleanPrompt(body.prompt);
  if (!prompt) return fail(400, "Prompt must be 3 to 500 characters.");

  // Ownership is re-checked on every generation. The client never decides the tier.
  let status;
  let addresses: string[];
  try {
    addresses = await accountAddresses(address);
    status = await getStanding(addresses);
  } catch (e) {
    console.error("[generate] ownership check failed", e);
    return fail(502, "Could not verify your Chog right now. Try again.");
  }
  const tier: Tier = status.tier;

  const limit = dailyLimit(tier);
  const limitMessage =
    tier === "free" ? "Daily free limit reached. Hold a Chog or CHOG to unlock more." : "Daily limit reached. Come back tomorrow.";

  // Cheap early exit. The atomic check happens in reserveUse below.
  try {
    if ((await getUsed(address)) >= limit) return fail(403, limitMessage, { used: limit, limit });
  } catch (e) {
    console.error("[generate] store error", e);
    return fail(503, "Usage service is unavailable. Try again shortly.");
  }

  let image: string;
  let finalPrompt = prompt;
  let chog: ChogToken | null = null;

  if (tier === "holder" && body.tokenId != null && body.tokenId !== "") {
    const id = String(body.tokenId);
    let token = status.tokens.find((t) => t.tokenId === id) ?? null;
    if (!token) {
      try {
        token = await getOwnedTokenAny(addresses, id);
      } catch {
        return fail(502, "Could not load your Chog's metadata. Try again.");
      }
    }
    if (!token) return fail(403, "That Chog is not in your wallets.");
    image = token.image;
    chog = token;
    finalPrompt = holderPrompt(prompt, token);
  } else {
    if (typeof body.image !== "string" || !DATA_URL.test(body.image)) {
      return fail(400, "Upload a PNG, JPG or WebP image.");
    }
    if (body.image.length > MAX_IMAGE_CHARS) return fail(413, "Image is too large. Use one under 1.5 MB.");
    image = body.image;
  }

  // Limits apply to valid requests only, right before we spend provider credits. Fail closed.
  const ip = clientIp(req);
  let used: number;
  try {
    const burstOk =
      (await allowBurst(`gen:${address}`, 3, 60_000)) && (await allowBurst(`gen-ip:${ip}`, 6, 60_000));
    if (!burstOk) return fail(429, "Slow down. Max 3 generations per minute.");

    const quota = await reserveUse(address, limit);
    if (!quota.ok) return fail(403, limitMessage, { used: limit, limit });
    used = quota.used;

    if (tier === "free" && !(await reserveFreeIp(ip, freeIpDailyLimit()))) {
      await refundUse(address);
      return fail(429, "Free videos from this network are used up for today. Hold a Chog for holder mode.");
    }
  } catch (e) {
    console.error("[generate] store error", e);
    return fail(503, "Usage service is unavailable. Try again shortly.");
  }

  // The director writes the shot (and screens uploads) after the quota is reserved, so it is rate limited too.
  let shot: string | null = null;
  if (body.direct !== false) {
    const d = await direct({ prompt, image, tier, chog });
    if (d.kind === "rejected") {
      await refundUse(address).catch(() => {});
      if (tier === "free") await refundFreeIp(ip).catch(() => {});
      return fail(422, `${d.reason} Try another image. This did not use a video.`, { rejected: true });
    }
    if (d.kind === "shot") {
      shot = d.shot;
      finalPrompt = chog ? `${shot} Keep the Chog exactly as in the reference image: same face, colors and accessories.` : shot;
    }
  }

  let providerId: string;
  try {
    providerId = await createVideo({ tier, image, prompt: finalPrompt });
  } catch (e) {
    console.error("[generate] provider error", e);
    await refundUse(address).catch(() => {});
    if (tier === "free") await refundFreeIp(ip).catch(() => {});
    return fail(502, "The video service rejected the request. Try a different image or prompt.");
  }

  const id = encodeJob({ id: providerId, address, tier, prompt, shot: shot ?? undefined, createdAt: Date.now() });
  return NextResponse.json({ id, tier, used, limit, shot });
}
