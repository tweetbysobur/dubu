import { hmac, safeEqual } from "./session";
import type { Tier } from "./tiers";

export type Job = { id: string; address: string; tier: Tier; prompt: string; shot?: string; createdAt: number };

const JOB_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Jobs are stateless: the ID the browser holds is a signed token that carries the job.
 * Any serverless instance can read it, so nothing is lost between requests.
 */
export function encodeJob(job: Job): string {
  const payload = Buffer.from(
    JSON.stringify({ i: job.id, a: job.address.toLowerCase(), t: job.tier, p: job.prompt, ...(job.shot ? { s: job.shot } : {}), c: job.createdAt }),
  ).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function decodeJob(token: string): Job | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, mac] = parts;
  if (!payload || !mac || !safeEqual(mac, hmac(payload))) return null;

  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof d.i !== "string" || typeof d.a !== "string" || typeof d.p !== "string" || typeof d.c !== "number") {
      return null;
    }
    if (d.t !== "holder" && d.t !== "token" && d.t !== "free") return null;
    if (Date.now() - d.c > JOB_TTL_MS) return null;
    return { id: d.i, address: d.a, tier: d.t, prompt: d.p, ...(typeof d.s === "string" ? { shot: d.s } : {}), createdAt: d.c };
  } catch {
    return null;
  }
}
