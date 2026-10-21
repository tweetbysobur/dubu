import { decr, getCount, incr } from "./store";

const DAY_TTL_S = 26 * 60 * 60;

function dayKey(address: string) {
  return `dubu:use:${address.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`;
}

/** Generations used today by this wallet (UTC day). */
export function getUsed(address: string) {
  return getCount(dayKey(address));
}

/**
 * Atomically takes one generation from today's quota.
 * Increment first, then check, so two parallel requests cannot both slip past the limit.
 */
export async function reserveUse(address: string, limit: number): Promise<{ ok: boolean; used: number }> {
  const key = dayKey(address);
  const n = await incr(key, DAY_TTL_S);
  if (n > limit) {
    await decr(key);
    return { ok: false, used: limit };
  }
  return { ok: true, used: n };
}

/** Gives a generation back when the provider never started the job. */
export function refundUse(address: string) {
  return decr(dayKey(address));
}

function ipDayKey(ip: string) {
  return `dubu:free-ip:${ip}:${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Daily cap on free videos per network. Passkey wallets cost nothing to create,
 * so the per-wallet quota alone would not protect the video credit.
 */
export async function reserveFreeIp(ip: string, limit: number): Promise<boolean> {
  const key = ipDayKey(ip);
  const n = await incr(key, DAY_TTL_S);
  if (n > limit) {
    await decr(key);
    return false;
  }
  return true;
}

export function refundFreeIp(ip: string) {
  return decr(ipDayKey(ip));
}

export function freeIpDailyLimit() {
  const n = Number(process.env.FREE_IP_DAILY_LIMIT ?? 6);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

/** Fixed-window limiter. Returns true when the call is allowed. */
export async function allowBurst(key: string, max: number, windowMs: number) {
  const bucket = Math.floor(Date.now() / windowMs);
  const n = await incr(`dubu:burst:${key}:${bucket}`, Math.ceil(windowMs / 1000) + 5);
  return n <= max;
}

/**
 * Same as allowBurst but allows the call if the store is down.
 * For sign-in and lookups only. Never for anything that spends money.
 */
export async function softBurst(key: string, max: number, windowMs: number) {
  try {
    return await allowBurst(key, max, windowMs);
  } catch (e) {
    console.error("[limits] store error, allowing", e);
    return true;
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
