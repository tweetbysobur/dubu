// Levels: Genesis holder (NFT), CHOG holder (token balance summed across linked wallets), Free.
// Run against a server started with:
//   CHOG_TOKEN_MIN=1000
//   DEMO_CHOG_BALANCES=<A>:500,<B>:600     (A and B printed below via fixed keys)
//   DEMO_HOLDER_ADDRESSES=<G>
// Usage: SMOKE_URL=... A_PK=... B_PK=... G_PK=... node scripts/levels.mjs
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const A = privateKeyToAccount(process.env.A_PK);
const B = privateKeyToAccount(process.env.B_PK);
const G = privateKeyToAccount(process.env.G_PK);
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
let failures = 0;
const expect = (label, actual, wanted) => {
  const ok = actual === wanted;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (got ${actual}, want ${wanted})`);
};

function client() {
  let cookie = "";
  return async (path, { method = "GET", body } = {}) => {
    const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const name = pair.split("=")[0];
      cookie = cookie.split("; ").filter((x) => x && !x.startsWith(`${name}=`)).concat(pair).join("; ");
    }
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
}
async function signedIn(acct) {
  const call = client();
  const { data } = await call(`/api/auth/nonce?address=${acct.address}`);
  await call("/api/auth/verify", { method: "POST", body: { address: acct.address, signature: await acct.signMessage({ message: data.message }) } });
  return call;
}
async function link(call, wallet) {
  const n = await call(`/api/links/nonce?address=${wallet.address}`);
  return call("/api/links", { method: "POST", body: { address: wallet.address, signature: await wallet.signMessage({ message: n.data.message }) } });
}

const tiers = (await client()("/api/tiers")).data;
expect("tiers API exposes CHOG minimum", tiers.chogMin, "1000");
expect("tiers API exposes CHOG holder limit", tiers.token.limit, 10);
expect("CHOG holder has no watermark", tiers.token.watermark, false);

// A holds 500 CHOG: below the minimum
const a = await signedIn(A);
let me = (await a("/api/me")).data;
expect("500 CHOG alone is free", me.tier, "free");
expect("balance reported", me.chog.balance, "500");

// Link B (600 CHOG): 1100 total crosses the minimum
expect("link B", (await link(a, B)).status, 200);
me = (await a("/api/me")).data;
expect("500 + 600 CHOG across wallets is CHOG holder", me.tier, "token");
expect("summed balance", me.chog.balance, "1100");
expect("CHOG holder daily limit", me.limit, 10);
expect("per-wallet balance for B", me.wallets.find((w) => w.address === B.address.toLowerCase())?.chogBalance, "600");

// A CHOG holder generates without a watermark, from an uploaded image
const gen = await a("/api/generate", { method: "POST", body: { prompt: "chog surfing", image: PNG } });
expect("CHOG holder can generate", gen.status, 200);
expect("job recorded at CHOG holder level", gen.data.tier, "token");
const job = await a(`/api/jobs/${gen.data.id}`);
expect("CHOG holder video has no watermark", job.data.watermark, false);
expect("CHOG holder cannot claim a Chog token id", (await a("/api/generate", { method: "POST", body: { prompt: "chog surfing", tokenId: "1" } })).status, 400);

// Unlink B: back below the minimum
await a("/api/links", { method: "DELETE", body: { address: B.address } });
expect("unlinking B drops to free", (await a("/api/me")).data.tier, "free");

// Genesis NFT outranks CHOG
expect("link Genesis wallet G", (await link(a, G)).status, 200);
expect("NFT makes Genesis holder", (await a("/api/me")).data.tier, "holder");
expect("link B again", (await link(a, B)).status, 200);
me = (await a("/api/me")).data;
expect("NFT plus CHOG stays Genesis holder", me.tier, "holder");
expect("Genesis holder limit", me.limit, 50);

// Fresh wallet with nothing
expect("empty wallet is free", (await (await signedIn(privateKeyToAccount(generatePrivateKey())))("/api/me")).data.tier, "free");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll level checks passed");
process.exit(failures ? 1 : 0);
