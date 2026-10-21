// Linked wallets: proof by signature, holder mode through a linked wallet, abuse rules.
// Run against a server with DEMO_HOLDER_ADDRESSES set to HOLDER_KEY's address
// (the script prints it) or pass HOLDER_PK so the address is known in advance.
// Usage: SMOKE_URL=http://localhost:3000 HOLDER_PK=0x... node scripts/links.mjs
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const holder = privateKeyToAccount(process.env.HOLDER_PK || generatePrivateKey());
let failures = 0;
const expect = (label, actual, wanted) => {
  const ok = actual === wanted;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (got ${actual}, want ${wanted})`);
};

function client() {
  let cookie = "";
  return async (path, { method = "GET", body } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
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

async function link(call, wallet, signer = wallet) {
  const n = await call(`/api/links/nonce?address=${wallet.address}`);
  if (n.status !== 200) return n;
  const signature = await signer.signMessage({ message: n.data.message });
  return call("/api/links", { method: "POST", body: { address: wallet.address, signature } });
}

const primary = privateKeyToAccount(generatePrivateKey());
const a = await signedIn(primary);
expect("passkey-style account starts in free mode", (await a("/api/me")).data.tier, "free");

expect("cannot link the sign-in wallet to itself", (await a(`/api/links/nonce?address=${primary.address}`)).status, 400);

const stranger = privateKeyToAccount(generatePrivateKey());
const impostor = privateKeyToAccount(generatePrivateKey());
expect("link refused when another key signs", (await link(a, stranger, impostor)).status, 401);

expect("link the Chog wallet with its own signature", (await link(a, holder)).status, 200);
let me = (await a("/api/me")).data;
expect("linked wallet listed on the account", me.wallets.map((w) => w.address).includes(holder.address.toLowerCase()), true);
expect("holder mode through the linked wallet", me.tier, "holder");

// A link signature must not work as a login
const n2 = await a(`/api/links/nonce?address=${holder.address}`);
const linkSig = await holder.signMessage({ message: n2.data.message });
const replay = client();
await replay(`/api/auth/nonce?address=${holder.address}`);
expect("link signature rejected as a login", (await replay("/api/auth/verify", { method: "POST", body: { address: holder.address, signature: linkSig } })).status, 401);

// One account per linked wallet
const other = await signedIn(privateKeyToAccount(generatePrivateKey()));
expect("same Chog wallet cannot be linked to a second account", (await link(other, holder)).status, 409);
expect("second account stays in free mode", (await other("/api/me")).data.tier, "free");

// Unlink frees it
expect("unlink", (await a("/api/links", { method: "DELETE", body: { address: holder.address } })).status, 200);
expect("back to free mode after unlink", (await a("/api/me")).data.tier, "free");
expect("now the second account can link it", (await link(other, holder)).status, 200);
expect("second account now in holder mode", (await other("/api/me")).data.tier, "holder");

// Cap of 3 linked wallets
for (let i = 1; i <= 3; i++) {
  expect(`link extra wallet ${i}`, (await link(a, privateKeyToAccount(generatePrivateKey()))).status, 200);
}
expect("fourth linked wallet refused", (await link(a, privateKeyToAccount(generatePrivateKey()))).status, 400);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll linked-wallet checks passed");
process.exit(failures ? 1 : 0);
