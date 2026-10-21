import {
  decodeFunctionData,
  encodeFunctionData,
  formatEther,
  formatUnits,
  isAddress,
  parseAbi,
  parseEventLogs,
  parseTransaction,
  parseUnits,
  recoverTransactionAddress,
  type Address,
  type Hex,
} from "viem";
import { activeChain } from "./chain";
import { client } from "./chog";

/**
 * MON to CHOG, nothing else.
 *
 * With PAYAI_PARTNER_URL and PAYAI_PARTNER_KEY set, PayAI's partner swap API
 * quotes and builds the call, and Dubu checks it like any other. Without them,
 * or when PayAI is unreachable, Dubu routes directly. Either way:
 *
 * Two venues, quoted side by side, best output wins:
 * - Nad.fun: its Lens returns a quote and the router that quote is valid for
 *   (bonding curve or Nad.fun DEX). The router must be one of the two configured.
 * - Uniswap v3: QuoterV2 across the standard fee tiers, SwapRouter02 to trade.
 *
 * Dubu never holds funds or keys. The server builds the call with the user as the
 * only recipient, the user signs it, and before any signed swap is broadcast the
 * server decodes it again: right router, CHOG out, MON in, user as recipient.
 *
 * Every address comes from config. Nothing here is typed in.
 */

export class SwapError extends Error {}

function addr(name: string): Address | null {
  const v = process.env[name]?.trim();
  return v && isAddress(v) ? (v as Address) : null;
}

const cfg = {
  chog: addr("CHOG_TOKEN_ADDRESS"),
  wmon: addr("WMON_ADDRESS"),
  nadLens: addr("NADFUN_LENS"),
  nadCurveRouter: addr("NADFUN_BONDING_ROUTER"),
  nadDexRouter: addr("NADFUN_DEX_ROUTER"),
  uniRouter: addr("UNISWAP_V3_ROUTER"),
  uniQuoter: addr("UNISWAP_V3_QUOTER"),
};

const nadfunReady = () => !!(cfg.chog && cfg.nadLens && cfg.nadCurveRouter && cfg.nadDexRouter);
const uniswapReady = () => !!(cfg.chog && cfg.wmon && cfg.uniRouter && cfg.uniQuoter);

/** The only contracts a Dubu swap can ever be sent to. */
function nadRouters(): Set<string> {
  return new Set([cfg.nadCurveRouter, cfg.nadDexRouter].filter(Boolean).map((a) => a!.toLowerCase()));
}

export function swapConfigured() {
  return !activeChain.testnet && (nadfunReady() || uniswapReady());
}

/** Open to everyone. Off until SWAP_ENABLED=true, after a real canary swap has passed. */
export function swapOpen() {
  return swapConfigured() && process.env.SWAP_ENABLED?.trim() === "true";
}

function canaries() {
  return (process.env.SWAP_CANARY_ADDRESSES || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

/** Open to this wallet: everyone once enabled, canary wallets before that. */
export function swapAvailableFor(address: string) {
  return swapConfigured() && (swapOpen() || canaries().includes(address.toLowerCase()));
}

function numEnv(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const SWAP_LIMITS = {
  minMon: numEnv("SWAP_MIN_MON", 0.01),
  maxMon: numEnv("SWAP_MAX_MON", 100),
  /** Slippage tolerance, in basis points. */
  minSlippageBps: 10,
  maxSlippageBps: 500,
  defaultSlippageBps: 100,
  /** Refuse a quote when the trade alone moves the price more than this. */
  maxImpact: 0.15,
};

/** "1.5" MON to wei, within the configured bounds. */
export function parseMonAmount(raw: unknown): bigint {
  const s = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
  if (!/^\d{1,9}(\.\d{1,18})?$/.test(s)) throw new SwapError("Enter an amount of MON, like 1.5.");
  const n = Number(s);
  if (n < SWAP_LIMITS.minMon) throw new SwapError(`The smallest swap is ${SWAP_LIMITS.minMon} MON.`);
  if (n > SWAP_LIMITS.maxMon) throw new SwapError(`The largest swap is ${SWAP_LIMITS.maxMon} MON.`);
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(frac.padEnd(18, "0"));
}

export function parseSlippage(raw: unknown): number {
  const n = raw === undefined ? SWAP_LIMITS.defaultSlippageBps : Number(raw);
  if (!Number.isInteger(n) || n < SWAP_LIMITS.minSlippageBps || n > SWAP_LIMITS.maxSlippageBps) {
    throw new SwapError("Slippage must be between 0.1% and 5%.");
  }
  return n;
}

/** Never lets a positive quote floor to a zero minimum, which would mean no protection at all. */
export function minOut(amountOut: bigint, slippageBps: number) {
  const floored = (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  return floored === 0n && amountOut > 0n ? 1n : floored;
}

// ABIs, trimmed to what is called. Nad.fun: github.com/Naddotfun/contract-v3-abi.
const LENS_ABI = parseAbi([
  "function getAmountOut(address _token, uint256 _amountIn, bool _isBuy) view returns (address router, uint256 amountOut)",
]);
const NAD_ROUTER_ABI = parseAbi([
  "struct BuyParams { uint256 amountOutMin; address token; address to; uint256 deadline; }",
  "function buy(BuyParams params) payable",
]);
const QUOTER_ABI = parseAbi([
  "struct QuoteParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const UNI_ROUTER_ABI = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
]);
const ERC20_EVENTS = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
const FEE_TIERS = [500, 3000, 10000] as const;

export type Venue = "nadfun" | "uniswap";
type Route = { venue: Venue; router: Address; amountOut: bigint; fee?: number; impact: number | null };

/** Price impact from a quote 1/1000 the size, scaled up. Best effort: null when it cannot be measured. */
function impactFrom(amountIn: bigint, amountOut: bigint, refIn: bigint, refOut: bigint | null): number | null {
  if (!refOut || refIn === 0n) return null;
  const expected = (refOut * amountIn) / refIn;
  if (expected === 0n) return null;
  const shortfall = expected > amountOut ? expected - amountOut : 0n;
  return Number((shortfall * 1_000_000n) / expected) / 1_000_000;
}

async function lensOut(amountIn: bigint): Promise<{ router: Address; out: bigint } | null> {
  try {
    const [router, out] = await client.readContract({
      address: cfg.nadLens!,
      abi: LENS_ABI,
      functionName: "getAmountOut",
      args: [cfg.chog!, amountIn, true],
    });
    // The Lens picks the router; we only accept one we configured.
    if (!nadRouters().has(router.toLowerCase()) || out <= 0n) return null;
    return { router, out };
  } catch {
    return null;
  }
}

async function quoteNadfun(amountIn: bigint): Promise<Route | null> {
  if (!nadfunReady()) return null;
  const refIn = amountIn / 1000n;
  const [main, ref] = await Promise.all([lensOut(amountIn), refIn > 0n ? lensOut(refIn) : null]);
  if (!main) return null;
  return {
    venue: "nadfun",
    router: main.router,
    amountOut: main.out,
    impact: ref && ref.router.toLowerCase() === main.router.toLowerCase() ? impactFrom(amountIn, main.out, refIn, ref.out) : null,
  };
}

async function uniOut(amountIn: bigint, fee: number): Promise<bigint | null> {
  try {
    const { result } = await client.simulateContract({
      address: cfg.uniQuoter!,
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: cfg.wmon!, tokenOut: cfg.chog!, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });
    return result[0] > 0n ? result[0] : null;
  } catch {
    return null; // no pool at this fee tier
  }
}

async function quoteUniswap(amountIn: bigint): Promise<Route | null> {
  if (!uniswapReady()) return null;
  const outs = await Promise.all(FEE_TIERS.map((fee) => uniOut(amountIn, fee)));
  let best: { fee: number; out: bigint } | null = null;
  outs.forEach((out, i) => {
    if (out && (!best || out > best.out)) best = { fee: FEE_TIERS[i], out };
  });
  if (!best) return null;
  const { fee, out } = best as { fee: number; out: bigint };
  const refIn = amountIn / 1000n;
  const refOut = refIn > 0n ? await uniOut(refIn, fee) : null;
  return { venue: "uniswap", router: cfg.uniRouter!, amountOut: out, fee, impact: impactFrom(amountIn, out, refIn, refOut) };
}

export type Quote = {
  venue: Venue;
  amountIn: string;
  amountOut: string;
  minOut: string;
  slippageBps: number;
  impact: number | null;
  /** Output each venue offered, for transparency. Null means no route there. */
  venues: Record<Venue, string | null>;
};

async function bestRoute(amountIn: bigint) {
  const [nad, uni] = await Promise.all([quoteNadfun(amountIn), quoteUniswap(amountIn)]);
  const best = [nad, uni].filter((r): r is Route => !!r).sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1))[0] ?? null;
  return { best, nad, uni };
}

let chogDecimals: number | null = null;
async function decimals() {
  if (chogDecimals === null) {
    chogDecimals = Number(
      await client.readContract({ address: cfg.chog!, abi: parseAbi(["function decimals() view returns (uint8)"]), functionName: "decimals" }),
    );
  }
  return chogDecimals;
}

async function routeOrThrow(amountIn: bigint) {
  const r = await bestRoute(amountIn);
  if (!r.best) throw new SwapError("No route to CHOG for that amount right now. Try a smaller amount or try again soon.");
  if (r.best.impact !== null && r.best.impact > SWAP_LIMITS.maxImpact) {
    throw new SwapError("That amount would move the CHOG price too much. Try a smaller amount.");
  }
  return r as { best: Route; nad: Route | null; uni: Route | null };
}

function toQuote(r: { best: Route; nad: Route | null; uni: Route | null }, amountIn: bigint, slippageBps: number, d: number): Quote {
  return {
    venue: r.best.venue,
    amountIn: formatEther(amountIn),
    amountOut: formatUnits(r.best.amountOut, d),
    minOut: formatUnits(minOut(r.best.amountOut, slippageBps), d),
    slippageBps,
    impact: r.best.impact,
    venues: {
      nadfun: r.nad ? formatUnits(r.nad.amountOut, d) : null,
      uniswap: r.uni ? formatUnits(r.uni.amountOut, d) : null,
    },
  };
}

export async function quote(amountIn: bigint, slippageBps: number): Promise<Quote> {
  const viaPayai = await payai<PayaiQuote>("quote", amountIn, slippageBps);
  if (viaPayai) {
    const d = await decimals();
    return {
      venue: viaPayai.venue,
      amountIn: formatEther(amountIn),
      amountOut: viaPayai.amountOut,
      minOut: formatUnits(minOut(parseUnits(viaPayai.amountOut, d), slippageBps), d),
      slippageBps,
      impact: parseImpact(viaPayai.priceImpact),
      venues: viaPayai.venues,
    };
  }
  const [r, d] = await Promise.all([routeOrThrow(amountIn), decimals()]);
  return toQuote(r, amountIn, slippageBps, d);
}

// ---------------------------------------------------------------------------
// PayAI partner API. When PAYAI_PARTNER_URL and PAYAI_PARTNER_KEY are set,
// quotes and swap calls come from PayAI's swap engine. Dubu still checks every
// call itself (checkCall) before showing or broadcasting it, and falls back to
// its own direct route when PayAI is unreachable.

type PayaiQuote = {
  venue: Venue;
  amountOut: string;
  priceImpact: string | null;
  venues: Record<Venue, string | null>;
};
type PayaiBuild = { venue: Venue; amountOut: string; priceImpact: string | null; tx: { to: string; data: Hex; value: string } };

export function payaiEnabled() {
  return !!(process.env.PAYAI_PARTNER_URL?.trim() && process.env.PAYAI_PARTNER_KEY?.trim());
}

function parseImpact(s: string | null | undefined): number | null {
  const n = s ? parseFloat(s) : NaN;
  return Number.isFinite(n) ? n / 100 : null;
}

/** Calls PayAI. Returns null when PayAI is off or unreachable, so Dubu falls back. Throws PayAI's own 4xx message. */
async function payai<T>(kind: "quote" | "build", amountIn: bigint, slippageBps: number, wallet?: string): Promise<T | null> {
  if (!payaiEnabled() || !cfg.chog) return null;
  const url = `${process.env.PAYAI_PARTNER_URL!.trim().replace(/\/$/, "")}/api/partner/swap/${kind}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PAYAI_PARTNER_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.chog, amountMon: formatEther(amountIn), slippageBps, ...(wallet ? { wallet } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error(`[swap] PayAI ${kind} unreachable, using direct route`, e instanceof Error ? e.message : e);
    return null;
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (res.ok && data.ok) return data;
  // A clear answer about this swap (no route, too much impact) is shown as is.
  if (res.status === 400 || res.status === 404) throw new SwapError(data.message || "No route to CHOG for that amount right now.");
  console.error(`[swap] PayAI ${kind} answered ${res.status}, using direct route`, data.message);
  return null;
}

/** The minimum a checked swap call guarantees, read from the call itself. */
function minOutOf(to: string, data: Hex): bigint {
  if (nadRouters().has(to.toLowerCase())) return decodeFunctionData({ abi: NAD_ROUTER_ABI, data }).args[0].amountOutMin;
  return decodeFunctionData({ abi: UNI_ROUTER_ABI, data }).args[0].amountOutMinimum;
}

export type UnsignedSwap = {
  to: Address;
  data: Hex;
  value: string;
  gas: string;
  nonce: number;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  chainId: number;
};

/** Re-quotes, then builds the swap call with `from` as the only recipient and checks it would go through. */
export async function buildSwap(from: Address, amountIn: bigint, slippageBps: number) {
  const viaPayai = await payai<PayaiBuild>("build", amountIn, slippageBps, from);
  if (viaPayai) {
    const to = viaPayai.tx.to as Address;
    const data = viaPayai.tx.data;
    checkCall(to, data, from); // PayAI's call gets the same check as any signed swap
    if (BigInt(viaPayai.tx.value) !== amountIn) throw new SwapError("The swap amount came back different. Nothing was prepared.");
    const d = await decimals();
    const q: Quote = {
      venue: viaPayai.venue,
      amountIn: formatEther(amountIn),
      amountOut: viaPayai.amountOut,
      minOut: formatUnits(minOutOf(to, data), d),
      slippageBps,
      impact: parseImpact(viaPayai.priceImpact),
      venues: { nadfun: null, uniswap: null, [viaPayai.venue]: viaPayai.amountOut },
    };
    return packageSwap(from, to, data, amountIn, q);
  }

  const [r, d] = await Promise.all([routeOrThrow(amountIn), decimals()]);
  const best = r.best;
  const floor = minOut(best.amountOut, slippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);

  const data =
    best.venue === "nadfun"
      ? encodeFunctionData({
          abi: NAD_ROUTER_ABI,
          functionName: "buy",
          args: [{ amountOutMin: floor, token: cfg.chog!, to: from, deadline }],
        })
      : encodeFunctionData({
          abi: UNI_ROUTER_ABI,
          functionName: "exactInputSingle",
          args: [
            {
              tokenIn: cfg.wmon!,
              tokenOut: cfg.chog!,
              fee: best.fee!,
              recipient: from,
              amountIn,
              amountOutMinimum: floor,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });
  checkCall(best.router, data, from); // the same check every signed swap gets
  return packageSwap(from, best.router, data, amountIn, toQuote(r, amountIn, slippageBps, d));
}

/** Adds what signing needs (gas, fees, nonce) and checks the swap would go through. */
async function packageSwap(from: Address, to: Address, data: Hex, amountIn: bigint, q: Quote) {
  const [balance, fees, nonce] = await Promise.all([
    client.getBalance({ address: from }),
    client.estimateFeesPerGas(),
    client.getTransactionCount({ address: from, blockTag: "pending" }),
  ]);
  if (balance < amountIn) throw new SwapError("This wallet does not have that much MON.");

  let gas: bigint;
  try {
    gas = await client.estimateGas({ account: from, to, data, value: amountIn });
  } catch (e) {
    console.error("[swap] simulation failed", e);
    throw new SwapError("The swap would fail right now. Try a smaller amount or a higher slippage.");
  }
  // Monad charges for the gas limit, so the buffer stays small.
  gas = (gas * 115n) / 100n;
  if (balance < amountIn + gas * fees.maxFeePerGas) {
    throw new SwapError("Not enough MON to cover this amount plus the network fee. Try a smaller amount.");
  }

  const tx: UnsignedSwap = {
    to,
    data,
    value: amountIn.toString(),
    gas: gas.toString(),
    nonce,
    maxFeePerGas: fees.maxFeePerGas.toString(),
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    chainId: activeChain.id,
  };
  return { tx, quote: q, networkFee: formatEther(gas * fees.maxFeePerGas) };
}

/**
 * The guard on every swap call: one of our routers, the right function,
 * CHOG out, and `from` as the recipient. Throws on anything else.
 */
export function checkCall(to: string | null | undefined, data: Hex | undefined, from: string) {
  const target = to?.toLowerCase() ?? "";
  const me = from.toLowerCase();
  const chog = cfg.chog?.toLowerCase();
  if (!data || !chog) throw new SwapError("That is not a Dubu swap.");

  if (nadRouters().has(target)) {
    const call = decodeFunctionData({ abi: NAD_ROUTER_ABI, data });
    const p = call.args[0];
    if (call.functionName === "buy" && p.token.toLowerCase() === chog && p.to.toLowerCase() === me && p.amountOutMin > 0n) return;
  } else if (cfg.uniRouter && target === cfg.uniRouter.toLowerCase()) {
    const call = decodeFunctionData({ abi: UNI_ROUTER_ABI, data });
    const p = call.args[0];
    if (
      call.functionName === "exactInputSingle" &&
      p.tokenIn.toLowerCase() === cfg.wmon?.toLowerCase() &&
      p.tokenOut.toLowerCase() === chog &&
      p.recipient.toLowerCase() === me &&
      p.amountOutMinimum > 0n
    ) {
      return;
    }
  }
  throw new SwapError("That is not a Dubu swap.");
}

export type SwapResult = { hash: Hex; status: "success" | "reverted"; received: string | null };

async function settle(hash: Hex, from: string): Promise<SwapResult> {
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash, timeout: 25_000 });
  } catch {
    throw new SwapError("The swap was sent but is not confirmed yet. Check MonadScan in a minute.");
  }
  if (receipt.status !== "success") return { hash, status: "reverted", received: null };
  const d = await decimals();
  const got = parseEventLogs({ abi: ERC20_EVENTS, logs: receipt.logs, eventName: "Transfer" })
    .filter((l) => l.address.toLowerCase() === cfg.chog!.toLowerCase() && l.args.to.toLowerCase() === from.toLowerCase())
    .reduce((s, l) => s + l.args.value, 0n);
  return { hash, status: "success", received: formatUnits(got, d) };
}

/** Passkey path: the browser signs, Dubu checks the signed swap, then broadcasts it. */
export async function sendSignedSwap(raw: Hex, from: Address): Promise<SwapResult> {
  let signer: Address;
  let tx: ReturnType<typeof parseTransaction>;
  try {
    tx = parseTransaction(raw);
    signer = await recoverTransactionAddress({ serializedTransaction: raw as Parameters<typeof recoverTransactionAddress>[0]["serializedTransaction"] });
  } catch {
    throw new SwapError("That signed swap could not be read.");
  }
  if (signer.toLowerCase() !== from.toLowerCase()) throw new SwapError("That swap was signed by a different wallet.");
  if (tx.chainId !== activeChain.id) throw new SwapError("That swap is for a different network.");
  checkCall(tx.to, tx.data, from);

  let hash: Hex;
  try {
    hash = await client.sendRawTransaction({ serializedTransaction: raw });
  } catch (e) {
    console.error("[swap] broadcast failed", e);
    throw new SwapError("Monad did not accept the swap. Nothing was spent. Try again.");
  }
  return settle(hash, from);
}

/** External wallet path: the wallet broadcast it. Dubu only confirms it and reads what arrived. */
export async function trackSwap(hash: Hex, from: Address): Promise<SwapResult> {
  const result = await settle(hash, from);
  const tx = await client.getTransaction({ hash });
  if (tx.from.toLowerCase() !== from.toLowerCase()) throw new SwapError("That transaction is from a different wallet.");
  checkCall(tx.to, tx.input, from);
  return result;
}
