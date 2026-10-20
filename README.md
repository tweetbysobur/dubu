# Dubu

Turn your Chog into a short AI video. Built on Monad.

Connect a wallet, sign once to prove you own it, write a prompt, get a clip. Chog holders get their own Chog auto-loaded, trait-aware prompts, higher quality, a higher daily limit and no watermark. Everyone else uploads an image and gets the basic version.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

With no `REPLICATE_API_TOKEN`, Dubu runs in demo mode and returns a sample clip after about 8 seconds. The UI says so.

## Config

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_MONAD_NETWORK` | `mainnet` (chain 143) or `testnet` (chain 10143) |
| `SESSION_SECRET` | Signs the session cookie. 32+ chars. Required in production |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project ID. Injected wallets work without it |
| `CHOG_CONTRACT_ADDRESS` | Chog ERC-721 contract. Without it, every wallet is free tier |
| `ALCHEMY_API_KEY` | Lists token IDs when the contract is not ERC721Enumerable |
| `REPLICATE_API_TOKEN` | Video provider key. Server only |
| `REPLICATE_MODEL` | Image-to-video model. Default `wan-video/wan-2.2-i2v-fast` |
| `REPLICATE_INPUT_HOLDER` / `_FREE` | Extra model inputs per tier, as JSON |
| `HOLDER_DAILY_LIMIT` / `FREE_DAILY_LIMIT` | Generations per wallet per UTC day. Defaults 50 and 3 |
| `DEMO_HOLDER_ADDRESSES` / `DEMO_CHOG_IMAGE_URL` | Treat listed wallets as holders for a demo |

## How it works

1. Wallet connects with RainbowKit on Monad.
2. The user signs a nonce message. `/api/auth/verify` checks it with viem (EOAs and EIP-1271 smart wallets) and sets an httpOnly session cookie.
3. `/api/me` reads `balanceOf` on the Chog contract for the signed-in wallet, then loads token metadata, image and traits.
4. `/api/generate` re-checks ownership on every call. The client never decides the tier. Holders can only pick a token they own. Traits are appended to the prompt.
5. The server calls Replicate. The browser polls `/api/jobs/:id` and plays the video from `/api/jobs/:id/video`, which streams through the backend. The browser never talks to the provider.
6. Free-tier downloads get the watermark burned in client-side (WebM). Holder downloads are the original MP4.

## Limits

- Daily quota per wallet, by tier.
- Burst limit: 3 valid generations per wallet per minute, 6 per IP.
- Sign-in endpoints are rate limited per IP.

Counters live in memory. That holds for one server. Move them to Redis or Upstash before running more than one instance.

## Checks

```bash
npm run typecheck
npm run build
SESSION_SECRET=$(openssl rand -hex 32) npm start
npm run smoke   # in another terminal, demo mode
```

## Out of scope

User accounts, galleries, token payments, editing, multiple models.
