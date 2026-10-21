// Counter store. Uses Upstash Redis (REST) when configured, so limits hold across
// serverless instances. Falls back to process memory for local dev.
// Vercel Marketplace's Upstash integration sets KV_REST_API_URL and KV_REST_API_TOKEN.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const persistent = Boolean(URL_ && TOKEN);

if (!persistent && process.env.VERCEL) {
  console.warn("[store] No Redis configured. Limits are per-instance and will not hold in production.");
}

type Entry = { v: number; exp: number };
const g = globalThis as unknown as { __dubuMem?: Map<string, Entry> };
const mem = (g.__dubuMem ??= new Map<string, Entry>());

async function pipeline(cmds: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`store HTTP ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string }[];
  const bad = data.find((d) => d.error);
  if (bad) throw new Error(`store ${bad.error}`);
  return data.map((d) => d.result);
}

function memGet(key: string) {
  const e = mem.get(key);
  if (!e || e.exp <= Date.now()) {
    mem.delete(key);
    return 0;
  }
  return e.v;
}

/** Increments a counter. The TTL is set on first write only. Returns the new value. */
export async function incr(key: string, ttlSec: number): Promise<number> {
  if (persistent) {
    const [n] = await pipeline([
      ["INCR", key],
      ["EXPIRE", key, ttlSec, "NX"],
    ]);
    return Number(n);
  }
  const current = memGet(key);
  const exp = current > 0 ? mem.get(key)!.exp : Date.now() + ttlSec * 1000;
  mem.set(key, { v: current + 1, exp });
  return current + 1;
}

export async function decr(key: string): Promise<void> {
  if (persistent) {
    await pipeline([["DECR", key]]);
    return;
  }
  const e = mem.get(key);
  if (e) e.v = Math.max(0, e.v - 1);
}

export async function getCount(key: string): Promise<number> {
  if (persistent) {
    const [v] = await pipeline([["GET", key]]);
    return Number(v ?? 0);
  }
  return memGet(key);
}
