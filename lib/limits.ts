// In-memory counters. Fine for a single-server demo.
// Swap for Redis/Upstash before running more than one instance.
const g = globalThis as unknown as {
  __dubuUsage?: Map<string, number>;
  __dubuBurst?: Map<string, number[]>;
};
const usage = (g.__dubuUsage ??= new Map<string, number>());
const burst = (g.__dubuBurst ??= new Map<string, number[]>());

function dayKey(address: string) {
  return `${address.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`;
}

/** Daily generation quota per wallet. */
export function getUsed(address: string) {
  return usage.get(dayKey(address)) ?? 0;
}

export function addUse(address: string) {
  usage.set(dayKey(address), getUsed(address) + 1);
}

/** Sliding-window limiter. Returns true when the call is allowed. */
export function allowBurst(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (burst.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    burst.set(key, hits);
    return false;
  }
  hits.push(now);
  burst.set(key, hits);
  return true;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
