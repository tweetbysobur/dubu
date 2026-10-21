# Dubu

Turn your Chog into a short AI video. Built on Monad.

Connect a wallet, sign once to prove you own it, write a prompt, get a clip. Chog holders get their own Chog auto-loaded, trait-aware prompts, higher quality, a higher daily limit and no watermark. Everyone else uploads an image and gets the basic version.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Video provider: deAPI when `DEAPI_API_KEY` is set (free $5 credit at signup, no card), else Replicate when `REPLICATE_API_TOKEN` is set, else demo mode, which returns a sample clip after about 8 seconds. The UI says when it is in demo mode. `/api/health` shows which provider is active.

## Config

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_MONAD_NETWORK` | `mainnet` (chain 143) or `testnet` (chain 10143) |
| `SESSION_SECRET` | Signs the session cookie. 32+ chars. Required in production |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project ID. Injected wallets work without it |
| `CHOG_TOKEN_ADDRESS` / `CHOG_TOKEN_MIN` | CHOG token on Monad (`0x3500...7777`) and the minimum for the CHOG holder level. Empty minimum keeps that level off |
| `CHOG_CONTRACT_ADDRESS` | Chog Genesis ERC-721, `0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763` on mainnet. Without it, every wallet is free tier |
| `ALCHEMY_API_KEY` | Lists token IDs when the contract is not ERC721Enumerable |
| `DEAPI_API_KEY` | deAPI key (free credits). Takes priority over Replicate. Server only |
| `DEAPI_MODEL` / `DEAPI_SIZE_*` / `DEAPI_FRAMES` / `DEAPI_FPS` / `DEAPI_STEPS` | deAPI model and output settings. Defaults: LTX-Video 13B distilled, 512 free / 768 holder, 120 frames at 30 fps |
| `REPLICATE_API_TOKEN` | Replicate key (paid). Server only |
| `REPLICATE_MODEL` | Image-to-video model. Default `wan-video/wan-2.2-i2v-fast` |
| `REPLICATE_INPUT_HOLDER` / `_FREE` | Extra model inputs per tier, as JSON |
| `HOLDER_DAILY_LIMIT` / `FREE_DAILY_LIMIT` | Generations per wallet per UTC day. Defaults 50 and 3 |
| `DEMO_HOLDER_ADDRESSES` / `DEMO_CHOG_IMAGE_URL` | Treat listed wallets as holders for a demo |

## Sign-in

Two ways, both end in the same signed server session:

- **Passkey (default).** [Mera](https://github.com/category-labs/mera) (`@category-labs/mera`, pinned to 0.3.0) turns a passkey's PRF output into a standard EVM account (BIP-39 entropy, path `m/44'/60'/0'/0/0`, same as MetaMask). Face ID or a fingerprint creates the wallet on first use and reopens it after. The key exists only in the tab, only long enough to sign the login message, then it is wiped. No backend, no API key, no custody, no transactions.
- **External wallet.** RainbowKit, for Chog holders whose Chog lives in an existing wallet. Connecting prompts the sign-in signature straight away.

Passkey wallets can be exported from Profile: after a fresh passkey prompt, Dubu shows the 24-word recovery phrase (the PRF output as BIP-39 entropy) and the private key, after checking both open the account's address. Nothing is sent to the server or stored, and the view hides itself after two minutes.

Passkeys are bound to the site's hostname (`dubuai.vercel.app`). Moving to another domain means passkeys from the old one stop working there, so plan any domain move before users store anything in a passkey wallet.

Mera 0.3 declares an optional peer on `@wagmi/core` v3 for its wagmi connector, which Dubu does not use. An npm `overrides` entry pins that peer to the project's wagmi v2 so the install resolves.

## Levels

| Level | Unlocks with | Gets |
| --- | --- | --- |
| Genesis holder | A Chog Genesis NFT in any linked wallet | Own Chog loaded in, trait-aware prompt, sharper video, no watermark, `HOLDER_DAILY_LIMIT` (50) a day |
| CHOG holder | At least `CHOG_TOKEN_MIN` CHOG summed across linked wallets | Upload any image, sharper video, no watermark, `TOKEN_DAILY_LIMIT` (10) a day |
| Free | Signing in | Upload any image, standard video, watermark, `FREE_DAILY_LIMIT` (3) a day |

The CHOG holder level stays off until `CHOG_TOKEN_MIN` is set. Balances are still read and shown on Profile when `CHOG_TOKEN_ADDRESS` is set. The level is re-checked on every generation.

## Linked wallets

From Profile, a signed-in account can link up to 3 more wallets. The wallet being linked signs a link message (worded differently from the sign-in message, so neither signature works as the other). Holder mode counts Chogs across the sign-in wallet and every linked wallet, so a passkey user can link the wallet that holds their Chog instead of signing in with it.

A wallet can be linked to one Dubu account at a time (`SET NX` claim in Redis), so one Chog cannot grant holder mode to many accounts. Unlinking releases it.

## How it works

1. The user signs in with a passkey, or connects a wallet with RainbowKit on Monad.
2. The account signs a nonce message. `/api/auth/verify` checks it with viem (EOAs and EIP-1271 smart wallets) and sets an httpOnly session cookie.
3. `/api/me` reads `balanceOf` on the Chog contract for the signed-in wallet, then lists its tokens (ERC721Enumerable, then Alchemy) and loads metadata, image and traits. If neither can list them, the holder enters a token ID and `/api/token/:id` accepts it only when `ownerOf` matches the wallet.
4. `/api/generate` re-checks ownership on every call. The client never decides the tier. Holders can only pick a token they own. Traits are appended to the prompt.
5. The server calls Replicate. The browser polls `/api/jobs/:id` and plays the video from `/api/jobs/:id/video`, which streams through the backend. The browser never talks to the provider.
6. Free-tier downloads get the watermark burned in client-side (WebM). Holder downloads are the original MP4.

## Limits

- Daily quota per wallet, by tier.
- Daily cap on free videos per network (`FREE_IP_DAILY_LIMIT`, default 6), because passkey wallets cost nothing to create.
- Burst limit: 3 valid generations per wallet per minute, 6 per IP.
- Sign-in endpoints are rate limited per IP.

Counters live in Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set (Vercel Marketplace, Upstash integration, sets both). Without them, counters fall back to process memory, which is fine locally but does not hold on Vercel, where each request can hit a different instance.

Generation fails closed if Redis is unreachable. Sign-in rate limits fail open, so an outage does not lock users out.

Jobs need no storage. The job ID is a signed token (HMAC with `SESSION_SECRET`) carrying the provider ID, wallet, tier and prompt, so any instance can serve it. Tokens expire after 24 hours.

## Checks

```bash
npm run typecheck
npm run build
SESSION_SECRET=$(openssl rand -hex 32) npm start
npm run smoke   # in another terminal, demo mode
```

`scripts/cross-instance.mjs` runs against two servers sharing one Redis and checks that jobs and quotas work across instances.

## Out of scope

User accounts, galleries, token payments, editing, multiple models.
