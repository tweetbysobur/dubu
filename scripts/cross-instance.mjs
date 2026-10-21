// Regression: a job created on one server instance must be readable on another,
// and the daily quota must be shared. Mirrors Vercel, where each route can run
// on a different instance. Usage: SMOKE_A=http://localhost:3201 SMOKE_B=http://localhost:3202 node scripts/cross-instance.mjs
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const A = process.env.SMOKE_A || "http://localhost:3201";
const B = process.env.SMOKE_B || "http://localhost:3202";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const acct = privateKeyToAccount(generatePrivateKey());
let cookie = "";
let failures = 0;

async function call(base, path, body) {
  const res = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    cookie = cookie.split("; ").filter((x) => x && !x.startsWith(`${name}=`)).concat(pair).join("; ");
  }
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function expect(label, actual, wanted) {
  const ok = actual === wanted;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (got ${actual}, want ${wanted})`);
}

// Sign in on A
const { data } = await call(A, `/api/auth/nonce?address=${acct.address}`);
const signature = await acct.signMessage({ message: data.message });
expect("sign in on A", (await call(A, "/api/auth/verify", { address: acct.address, signature })).status, 200);
expect("session valid on B", (await call(B, "/api/me")).status, 200);

// Generate on A, poll on B
const gen = await call(A, "/api/generate", { prompt: "chog on a rocket", image: PNG });
expect("generate on A", gen.status, 200);
expect("job readable on B", (await call(B, `/api/jobs/${gen.data.id}`)).status, 200);

// Quota shared: 1 used on A, 2 more on B, 4th on A must be refused
expect("generate 2 on B", (await call(B, "/api/generate", { prompt: "chog two", image: PNG })).status, 200);
expect("generate 3 on B", (await call(B, "/api/generate", { prompt: "chog three", image: PNG })).status, 200);
expect("limit holds across instances", (await call(A, "/api/generate", { prompt: "chog four", image: PNG })).status, 403);
expect("me on A shows shared count", (await call(A, "/api/me")).data.used, 3);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll cross-instance checks passed");
process.exit(failures ? 1 : 0);
