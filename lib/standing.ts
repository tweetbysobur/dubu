import { formatUnits, isAddress, parseAbi, parseUnits, type Address } from "viem";
import { client, getAccountHolderStatus, getOwnedTokenAny, type ChogToken } from "./chog";
import { setAdd, setMembers, setRemove } from "./store";
import { chogMinSetting, type Tier } from "./tiers";

// CHOG token (ERC-20) balances across an account's wallets, plus the tier decision.
// The token address comes from config, never from code.
const erc20 = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const tokenAddress = (process.env.CHOG_TOKEN_ADDRESS?.trim() || undefined) as Address | undefined;

let decimalsCache: number | null = null;

/** Demo balances for testing without RPC: "0xabc:5000,0xdef:12.5" in whole tokens. */
function demoBalances(): Map<string, string> {
  const m = new Map<string, string>();
  for (const pair of (process.env.DEMO_CHOG_BALANCES || "").split(",")) {
    const [addr, amount] = pair.split(":").map((s) => s?.trim());
    if (addr && amount && isAddress(addr) && /^\d+(\.\d+)?$/.test(amount)) m.set(addr.toLowerCase(), amount);
  }
  return m;
}

async function chogDecimals(): Promise<number> {
  if (decimalsCache !== null) return decimalsCache;
  if (!tokenAddress) return 18;
  decimalsCache = Number(await client.readContract({ address: tokenAddress, abi: erc20, functionName: "decimals" }));
  return decimalsCache;
}

/** True when CHOG balances are read at all (token address set, or demo balances given). */
export function chogTracked() {
  return !!tokenAddress || demoBalances().size > 0;
}

async function chogBalance(address: string, decimals: number): Promise<bigint> {
  const demo = demoBalances().get(address.toLowerCase());
  if (demo) return parseUnits(demo, decimals);
  if (!tokenAddress) return 0n;
  return client.readContract({ address: tokenAddress, abi: erc20, functionName: "balanceOf", args: [address as Address] });
}

export type WalletStanding = { address: string; chogs: number; holder: boolean; chogBalance: string };

export type Standing = {
  tier: Tier;
  /** Chog Genesis NFTs found, with their owner. */
  tokens: ChogToken[];
  wallets: WalletStanding[];
  chog: {
    tracked: boolean;
    /** Total across all wallets, as a decimal string in whole tokens. */
    balance: string;
    /** Minimum for the CHOG holder level, or null while the level is off. */
    min: string | null;
  };
};

/** Native MON balance of one wallet, as a decimal string in whole MON. */
export async function monBalance(address: string): Promise<string> {
  const demo = (process.env.DEMO_MON_BALANCES || "")
    .split(",")
    .map((p) => p.split(":").map((s) => s.trim()))
    .find(([a, v]) => a?.toLowerCase() === address.toLowerCase() && /^\d+(\.\d+)?$/.test(v ?? ""));
  if (demo) return demo[1];
  if (!isAddress(address)) return "0";
  return formatUnits(await client.getBalance({ address: address as Address }), 18);
}

// Chogs a holder added by number, kept per account so they never have to type it twice.
// Each one is re-checked with ownerOf on every read, so a sold Chog drops off by itself.
const savedKey = (account: string) => `dubu:chogs:${account.toLowerCase()}`;

export async function rememberChog(account: string, tokenId: string) {
  await setAdd(savedKey(account), tokenId);
}

async function savedChogs(addresses: string[], known: ChogToken[]): Promise<ChogToken[]> {
  let ids: string[];
  try {
    ids = (await setMembers(savedKey(addresses[0]))).slice(0, 20);
  } catch {
    return [];
  }
  const have = new Set(known.map((t) => t.tokenId));
  const found = await Promise.all(
    ids.filter((id) => !have.has(id)).map(async (id) => {
      const t = await getOwnedTokenAny(addresses, id).catch(() => undefined);
      if (t === null) await setRemove(savedKey(addresses[0]), id).catch(() => {});
      return t ?? null;
    }),
  );
  return found.filter((t): t is ChogToken => !!t);
}

/** Everything that decides an account's level: NFTs and CHOG balance across all its wallets. */
export async function getStanding(addresses: string[]): Promise<Standing> {
  const tracked = chogTracked();
  const decimals = tracked ? await chogDecimals() : 18;

  const [nft, balances] = await Promise.all([
    getAccountHolderStatus(addresses),
    tracked ? Promise.all(addresses.map((a) => chogBalance(a, decimals))) : Promise.resolve(addresses.map(() => 0n)),
  ]);

  const extra = await savedChogs(addresses, nft.tokens);
  if (extra.length) {
    nft.tokens = [...nft.tokens, ...extra];
    nft.holder = true;
    for (const t of extra) {
      const w = nft.perWallet.find((p) => p.address === t.owner);
      if (w) {
        w.holder = true;
        w.chogs = Math.max(w.chogs, nft.tokens.filter((x) => x.owner === w.address).length);
      }
    }
  }

  const total = balances.reduce((s, b) => s + b, 0n);
  const minSetting = chogMinSetting();
  const minUnits = minSetting ? parseUnits(minSetting, decimals) : null;

  const tier: Tier = nft.holder ? "holder" : minUnits !== null && tracked && total >= minUnits ? "token" : "free";

  return {
    tier,
    tokens: nft.tokens,
    wallets: nft.perWallet.map((w, i) => ({ ...w, chogBalance: formatUnits(balances[i], decimals) })),
    chog: { tracked, balance: formatUnits(total, decimals), min: minSetting },
  };
}
