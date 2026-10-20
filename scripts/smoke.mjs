// End-to-end API check against a running server in mock mode.
// Usage: npm run build && SESSION_SECRET=... npm start, then: npm run smoke
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const acct = privateKeyToAccount(generatePrivateKey());
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

let cookie = "";
let failures = 0;

function keep(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    cookie = cookie.split("; ").filter((x) => x && !x.startsWith(`${name}=`)).concat(pair).join("; ");
  }
}

async function call(path, body, opts = {}) {
  const res = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", cookie: opts.noCookie ? "" : cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  keep(res);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function expect(label, actual, wanted) {
  const ok = actual === wanted;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (got ${actual}, want ${wanted})`);
}

expect("me without session", (await call("/api/me")).status, 401);
expect("generate without session", (await call("/api/generate", { prompt: "test" })).status, 401);

const { data: nonce } = await call(`/api/auth/nonce?address=${acct.address}`);
expect("bad signature rejected", (await call("/api/auth/verify", { address: acct.address, signature: "0x1234" })).status, 401);
const signature = await acct.signMessage({ message: nonce.message });
expect("valid signature accepted", (await call("/api/auth/verify", { address: acct.address, signature })).status, 200);

const me = await call("/api/me");
expect("me after sign-in", me.status, 200);
expect("random wallet is free tier", me.data.tier, "free");

expect("short prompt rejected", (await call("/api/generate", { prompt: "hi", image: PNG })).status, 400);
expect("free tier cannot use tokenId", (await call("/api/generate", { prompt: "chog rocket", tokenId: "0" })).status, 400);
expect("non-image rejected", (await call("/api/generate", { prompt: "chog rocket", image: "data:text/plain;base64,aGk=" })).status, 400);

// Regression: invalid requests must not consume the per-minute burst quota
const first = await call("/api/generate", { prompt: "chog on a rocket", image: PNG });
expect("valid generate after invalid ones", first.status, 200);

const job = await call(`/api/jobs/${first.data.id}`);
expect("job readable by owner", job.status, 200);
expect("job hides provider URL", String(job.data.videoUrl ?? "/api/").startsWith("/api/"), true);
expect("job unreadable without session", (await call(`/api/jobs/${first.data.id}`, null, { noCookie: true })).status, 401);

expect("second generate", (await call("/api/generate", { prompt: "chog two", image: PNG })).status, 200);
expect("third generate", (await call("/api/generate", { prompt: "chog three", image: PNG })).status, 200);
expect("daily free limit enforced", (await call("/api/generate", { prompt: "chog four", image: PNG })).status, 403);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
