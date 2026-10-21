// Regression: free videos are capped per network, so new wallets cannot drain the video credit.
// Run against a server started with FREE_IP_DAILY_LIMIT=4.
// Usage: SMOKE_URL=http://localhost:3000 node scripts/ip-cap.mjs
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
let failures = 0;
const expect = (label, actual, wanted) => {
  const ok = actual === wanted;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (got ${actual}, want ${wanted})`);
};

async function wallet() {
  const acct = privateKeyToAccount(generatePrivateKey());
  let cookie = "";
  const call = async (path, body) => {
    const res = await fetch(BASE + path, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const name = pair.split("=")[0];
      cookie = cookie.split("; ").filter((x) => x && !x.startsWith(`${name}=`)).concat(pair).join("; ");
    }
    return res;
  };
  const { message } = await (await call(`/api/auth/nonce?address=${acct.address}`)).json();
  await call("/api/auth/verify", { address: acct.address, signature: await acct.signMessage({ message }) });
  return (prompt) => call("/api/generate", { prompt, image: PNG });
}

const a = await wallet();
expect("wallet A video 1", (await a("chog one")).status, 200);
expect("wallet A video 2", (await a("chog two")).status, 200);
expect("wallet A video 3", (await a("chog three")).status, 200);

// Wait out the 3-per-minute burst window for this IP before the next wallet
const wait = 61_000 - (Date.now() % 60_000);
await new Promise((r) => setTimeout(r, wait));

const b = await wallet();
expect("new wallet B video 1 (4th on this network)", (await b("chog four")).status, 200);
const blocked = await b("chog five");
expect("new wallet B video 2 blocked by network cap", blocked.status, 429);

const c = await wallet();
expect("brand new wallet C also blocked", (await c("chog six")).status, 429);
const cAgain = await c("chog seven");
expect("blocked attempts do not use wallet C quota", cAgain.status, 429);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll network cap checks passed");
process.exit(failures ? 1 : 0);
