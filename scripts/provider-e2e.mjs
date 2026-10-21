// End-to-end check of a real provider path (run against a fake or real deAPI).
// Signs in, generates from a 300x200 PNG, polls until done, downloads through our proxy.
// Usage: SMOKE_URL=http://localhost:3000 node scripts/provider-e2e.mjs
import { deflateSync } from "node:zlib";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const acct = privateKeyToAccount(generatePrivateKey());
let cookie = "";
let failures = 0;

function png(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0x40);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function call(path, body) {
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
}

function expect(label, actual, wanted) {
  const ok = actual === wanted;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (got ${actual}, want ${wanted})`);
}

const { message } = await (await call(`/api/auth/nonce?address=${acct.address}`)).json();
const signature = await acct.signMessage({ message });
expect("sign in", (await call("/api/auth/verify", { address: acct.address, signature })).status, 200);

const image = `data:image/png;base64,${png(300, 200).toString("base64")}`;
const gen = await call("/api/generate", { prompt: "a chog dancing in the rain", image });
const genBody = await gen.json();
expect("generate accepted", gen.status, 200);

let status;
for (let i = 0; i < 30; i++) {
  status = await (await call(`/api/jobs/${genBody.id}`)).json();
  if (status.status !== "processing") break;
  await new Promise((r) => setTimeout(r, 1000));
}
expect("job finished", status?.status, "succeeded");
expect("video served by our backend", String(status?.videoUrl).startsWith("/api/jobs/"), true);

const video = await call(status.videoUrl);
expect("video download status", video.status, 200);
expect("video content type", video.headers.get("content-type"), "video/mp4");
console.log(`video bytes: ${(await video.arrayBuffer()).byteLength}`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll provider checks passed");
process.exit(failures ? 1 : 0);
