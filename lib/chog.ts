import { createPublicClient, http, parseAbi, isAddress, type Address } from "viem";
import { activeChain } from "./chain";

export type Trait = { trait_type: string; value: string };
export type ChogToken = { tokenId: string; name: string; image: string; traits: Trait[]; owner?: string };
export type HolderStatus = { holder: boolean; tokens: ChogToken[] };

const abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

export const TOKEN_ID = /^\d{1,7}$/;

export const client = createPublicClient({
  chain: activeChain,
  transport: http(process.env.MONAD_RPC_URL || undefined),
});

const contract = process.env.CHOG_CONTRACT_ADDRESS as Address | undefined;
const gateway = (process.env.IPFS_GATEWAY || "https://ipfs.io").replace(/\/$/, "");

function demoHolders() {
  return (process.env.DEMO_HOLDER_ADDRESSES || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveUri(uri: string) {
  if (uri.startsWith("ipfs://")) return `${gateway}/ipfs/${uri.slice(7).replace(/^ipfs\//, "")}`;
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

async function readMetadata(uri: string): Promise<Record<string, unknown>> {
  if (uri.startsWith("data:application/json")) {
    const [, body] = uri.split(",");
    const json = uri.includes(";base64,") ? Buffer.from(body, "base64").toString() : decodeURIComponent(body);
    return JSON.parse(json);
  }
  const res = await fetch(resolveUri(uri), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`metadata ${res.status}`);
  return res.json();
}

function toTraits(raw: unknown): Trait[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === "object" && "value" in t)
    .map((t) => ({ trait_type: String(t.trait_type ?? "trait"), value: String(t.value) }));
}

async function tokenFromChain(tokenId: bigint): Promise<ChogToken> {
  const uri = await client.readContract({ address: contract!, abi, functionName: "tokenURI", args: [tokenId] });
  const meta = await readMetadata(uri);
  return {
    tokenId: tokenId.toString(),
    name: String(meta.name ?? `Chog #${tokenId}`),
    image: resolveUri(String(meta.image ?? meta.image_url ?? "")),
    traits: toTraits(meta.attributes),
  };
}

async function tokensFromEnumerable(owner: Address, count: number) {
  const ids = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      client.readContract({ address: contract!, abi, functionName: "tokenOfOwnerByIndex", args: [owner, BigInt(i)] }),
    ),
  );
  return Promise.all(ids.map(tokenFromChain));
}

async function tokensFromAlchemy(owner: Address): Promise<ChogToken[]> {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return [];
  const net = activeChain.testnet ? "monad-testnet" : "monad-mainnet";
  const url = `https://${net}.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${owner}&contractAddresses[]=${contract}&withMetadata=true&pageSize=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.ownedNfts ?? []).map((n: any) => ({
    tokenId: String(n.tokenId),
    name: n.name ?? `Chog #${n.tokenId}`,
    image: resolveUri(n.image?.cachedUrl ?? n.image?.originalUrl ?? n.raw?.metadata?.image ?? ""),
    traits: toTraits(n.raw?.metadata?.attributes),
  }));
}

/**
 * Fallback when the wallet's tokens cannot be listed: the holder names a token ID
 * and we only accept it if ownerOf matches the signed-in wallet.
 */
export async function getOwnedToken(address: string, tokenId: string): Promise<ChogToken | null> {
  if (!contract || !isAddress(address) || !TOKEN_ID.test(tokenId)) return null;
  let owner: Address;
  try {
    owner = await client.readContract({ address: contract, abi, functionName: "ownerOf", args: [BigInt(tokenId)] });
  } catch {
    return null; // nonexistent token
  }
  if (owner.toLowerCase() !== address.toLowerCase()) return null;
  const token = await tokenFromChain(BigInt(tokenId));
  return token.image ? token : null;
}

export async function getHolderStatus(address: string): Promise<HolderStatus> {
  if (!isAddress(address)) return { holder: false, tokens: [] };

  if (demoHolders().includes(address.toLowerCase())) {
    return {
      holder: true,
      tokens: [
        {
          tokenId: "0",
          name: "Demo Chog",
          image: process.env.DEMO_CHOG_IMAGE_URL || "",
          traits: [],
        },
      ].filter((t) => t.image),
    };
  }

  if (!contract) return { holder: false, tokens: [] };

  const balance = await client.readContract({ address: contract, abi, functionName: "balanceOf", args: [address] });
  if (balance === 0n) return { holder: false, tokens: [] };

  const count = Math.min(Number(balance), 5);
  let tokens: ChogToken[] = [];
  try {
    tokens = await tokensFromEnumerable(address, count);
  } catch {
    tokens = await tokensFromAlchemy(address).catch(() => []);
  }
  return { holder: true, tokens: tokens.filter((t) => t.image) };
}

export type AccountHolderStatus = HolderStatus & {
  /** Chogs found per address, for the profile page. */
  perWallet: { address: string; chogs: number; holder: boolean }[];
};

/** Holder status across the sign-in address and every linked wallet. */
export async function getAccountHolderStatus(addresses: string[]): Promise<AccountHolderStatus> {
  const results = await Promise.all(addresses.map((a) => getHolderStatus(a)));
  const tokens: ChogToken[] = [];
  const perWallet = results.map((r, i) => {
    for (const t of r.tokens) tokens.push({ ...t, owner: addresses[i].toLowerCase() });
    return { address: addresses[i].toLowerCase(), chogs: r.tokens.length, holder: r.holder };
  });
  return { holder: results.some((r) => r.holder), tokens, perWallet };
}

/** Finds a Chog by ID owned by any of the account's addresses. */
export async function getOwnedTokenAny(addresses: string[], tokenId: string): Promise<ChogToken | null> {
  for (const a of addresses) {
    const t = await getOwnedToken(a, tokenId);
    if (t) return { ...t, owner: a.toLowerCase() };
  }
  return null;
}
