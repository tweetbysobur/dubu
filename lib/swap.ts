import {
  decodeFunctionData,
  encodeFunctionData,
  formatEther,
  formatUnits,
  isAddress,
  parseAbi,
  parseEventLogs,
  parseTransaction,
  keccak256,
  recoverTransactionAddress,
  type Address,
  type Hex,
  domainSeparator,
} from "viem";
import { activeChain } from "./chain";
import { client } from "./chog";

/**
 * MON to CHOG (buy) and CHOG to MON (sell), nothing else.
 *
 * Two venues, quoted side by side, best output wins:
 * - Nad.fun: its Lens returns a quote and the router that quote is valid for
 *   (bonding curve or Nad.fun DEX). The router must be one of the two configured.
 * - Uniswap v3: QuoterV2 across the standard fee tiers, SwapRouter02 to trade.
 *
 * Dubu never holds funds or keys. The server builds the call with the user as the
 * only recipient, the user signs it, and before any signed swap is broadcast the
 * server decodes it again: right router, right token, user as recipient, a real
 * minimum. A sell first needs a CHOG approval for exactly the amount, to the
 * router the quote picked; that approval goes through the same check.
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
  minChog: numEnv("SWAP_MIN_CHOG", 0.01),
  maxChog: numEnv("SWAP_MAX_CHOG", 10_000_000),
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

export type Side = "buy" | "sell";

export function parseSide(raw: unknown): Side {
  if (raw === undefined || raw === null || raw === "" || raw === "buy") return "buy";
  if (raw === "sell") return "sell";
  throw new SwapError("Pick buy or sell.");
}

/** "250" CHOG to base units, within the configured bounds. */
export async function parseChogAmount(raw: unknown): Promise<bigint> {
  const s = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
  const d = await decimals();
  if (!new RegExp(`^\\d{1,12}(\\.\\d{1,${d}})?$`).test(s)) throw new SwapError("Enter an amount of CHOG, like 250.");
  const n = Number(s);
  if (n < SWAP_LIMITS.minChog) throw new SwapError(`The smallest sale is ${SWAP_LIMITS.minChog} CHOG.`);
  if (n > SWAP_LIMITS.maxChog) throw new SwapError(`The largest sale is ${SWAP_LIMITS.maxChog} CHOG.`);
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 10n ** BigInt(d) + BigInt(frac.padEnd(d, "0") || "0");
}

/** The amount for either side. */
export async function parseAmount(side: Side, raw: unknown): Promise<bigint> {
  return side === "buy" ? parseMonAmount(raw) : parseChogAmount(raw);
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
  "struct SellParams { uint256 amountIn; uint256 amountOutMin; address token; address to; uint256 deadline; }",
  "function sell(SellParams params)",
  "struct SellPermitParams { uint256 amountIn; uint256 amountOutMin; uint256 amountAllowance; address token; address to; uint256 deadline; uint8 v; bytes32 r; bytes32 s; }",
  "function sellPermit(SellPermitParams params)",
]);
const QUOTER_ABI = parseAbi([
  "struct QuoteParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const UNI_ROUTER_ABI = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) payable",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[])",
]);
/** SwapRouter02 keeps the output itself when the recipient is this, so it can unwrap WMON to MON. */
const ROUTER_SELF = "0x0000000000000000000000000000000000000002";
const ERC20_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
]);
const WMON_EVENTS = parseAbi(["event Withdrawal(address indexed src, uint256 wad)"]);
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

async function lensOut(side: Side, amountIn: bigint): Promise<{ router: Address; out: bigint } | null> {
  try {
    const [router, out] = await client.readContract({
      address: cfg.nadLens!,
      abi: LENS_ABI,
      functionName: "getAmountOut",
      args: [cfg.chog!, amountIn, side === "buy"],
    });
    // The Lens picks the router; we only accept one we configured.
    if (!nadRouters().has(router.toLowerCase()) || out <= 0n) return null;
    return { router, out };
  } catch {
    return null;
  }
}

async function quoteNadfun(side: Side, amountIn: bigint): Promise<Route | null> {
  if (!nadfunReady()) return null;
  const refIn = amountIn / 1000n;
  const [main, ref] = await Promise.all([lensOut(side, amountIn), refIn > 0n ? lensOut(side, refIn) : null]);
  if (!main) return null;
  return {
    venue: "nadfun",
    router: main.router,
    amountOut: main.out,
    impact: ref && ref.router.toLowerCase() === main.router.toLowerCase() ? impactFrom(amountIn, main.out, refIn, ref.out) : null,
  };
}

async function uniOut(side: Side, amountIn: bigint, fee: number): Promise<bigint | null> {
  const [tokenIn, tokenOut] = side === "buy" ? [cfg.wmon!, cfg.chog!] : [cfg.chog!, cfg.wmon!];
  try {
    const { result } = await client.simulateContract({
      address: cfg.uniQuoter!,
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });
    return result[0] > 0n ? result[0] : null;
  } catch {
    return null; // no pool at this fee tier
  }
}

async function quoteUniswap(side: Side, amountIn: bigint): Promise<Route | null> {
  if (!uniswapReady()) return null;
  const outs = await Promise.all(FEE_TIERS.map((fee) => uniOut(side, amountIn, fee)));
  let best: { fee: number; out: bigint } | null = null;
  outs.forEach((out, i) => {
    if (out && (!best || out > best.out)) best = { fee: FEE_TIERS[i], out };
  });
  if (!best) return null;
  const { fee, out } = best as { fee: number; out: bigint };
  const refIn = amountIn / 1000n;
  const refOut = refIn > 0n ? await uniOut(side, refIn, fee) : null;
  return { venue: "uniswap", router: cfg.uniRouter!, amountOut: out, fee, impact: impactFrom(amountIn, out, refIn, refOut) };
}

export type Quote = {
  side: Side;
  venue: Venue;
  amountIn: string;
  amountOut: string;
  minOut: string;
  slippageBps: number;
  impact: number | null;
  /** Output each venue offered, for transparency. Null means no route there. */
  venues: Record<Venue, string | null>;
};

async function bestRoute(side: Side, amountIn: bigint) {
  const [nad, uni] = await Promise.all([quoteNadfun(side, amountIn), quoteUniswap(side, amountIn)]);
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

async function routeOrThrow(side: Side, amountIn: bigint) {
  const r = await bestRoute(side, amountIn);
  if (!r.best) {
    throw new SwapError(`No route ${side === "buy" ? "to" : "from"} CHOG for that amount right now. Try a smaller amount or try again soon.`);
  }
  if (r.best.impact !== null && r.best.impact > SWAP_LIMITS.maxImpact) {
    throw new SwapError("That amount would move the CHOG price too much. Try a smaller amount.");
  }
  return r as { best: Route; nad: Route | null; uni: Route | null };
}

function toQuote(side: Side, r: { best: Route; nad: Route | null; uni: Route | null }, amountIn: bigint, slippageBps: number, d: number): Quote {
  const [inD, outD] = side === "buy" ? [18, d] : [d, 18];
  return {
    side,
    venue: r.best.venue,
    amountIn: formatUnits(amountIn, inD),
    amountOut: formatUnits(r.best.amountOut, outD),
    minOut: formatUnits(minOut(r.best.amountOut, slippageBps), outD),
    slippageBps,
    impact: r.best.impact,
    venues: {
      nadfun: r.nad ? formatUnits(r.nad.amountOut, outD) : null,
      uniswap: r.uni ? formatUnits(r.uni.amountOut, outD) : null,
    },
  };
}

export async function quote(side: Side, amountIn: bigint, slippageBps: number): Promise<Quote> {
  const [r, d] = await Promise.all([routeOrThrow(side, amountIn), decimals()]);
  return toQuote(side, r, amountIn, slippageBps, d);
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

/**
 * What to sign next:
 *  - "permit": a gasless ERC-2612 signature that lets the Nad.fun router take exactly the
 *    amount being sold, so the sale is one transaction (and one passkey prompt).
 *  - "approve": the CHOG approval transaction, for routes or tokens without permits.
 *  - "swap": the swap itself.
 */
export type BuildStep = "permit" | "approve" | "swap";

/** A permit the user signed, sent back to build the one-transaction sale. */
export type SignedPermit = { v: number; r: Hex; s: Hex; deadline: bigint; router: Address; minOut: bigint };

const PERMIT_TTL_S = 10 * 60;
/** Gas a Nad.fun sale with a permit usually takes; only for the fee shown before signing. */
const SELL_GAS_GUESS = 250_000n;

function encodeSwap(side: Side, best: Route, from: Address, amountIn: bigint, floor: bigint) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
  if (best.venue === "nadfun") {
    return side === "buy"
      ? encodeFunctionData({ abi: NAD_ROUTER_ABI, functionName: "buy", args: [{ amountOutMin: floor, token: cfg.chog!, to: from, deadline }] })
      : encodeFunctionData({
          abi: NAD_ROUTER_ABI,
          functionName: "sell",
          args: [{ amountIn, amountOutMin: floor, token: cfg.chog!, to: from, deadline }],
        });
  }
  if (side === "buy") {
    return encodeFunctionData({
      abi: UNI_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [{ tokenIn: cfg.wmon!, tokenOut: cfg.chog!, fee: best.fee!, recipient: from, amountIn, amountOutMinimum: floor, sqrtPriceLimitX96: 0n }],
    });
  }
  // CHOG to WMON kept by the router, then unwrapped to MON for the user, in one call.
  const swap = encodeFunctionData({
    abi: UNI_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [{ tokenIn: cfg.chog!, tokenOut: cfg.wmon!, fee: best.fee!, recipient: ROUTER_SELF, amountIn, amountOutMinimum: floor, sqrtPriceLimitX96: 0n }],
  });
  const unwrap = encodeFunctionData({ abi: UNI_ROUTER_ABI, functionName: "unwrapWETH9", args: [floor, from] });
  return encodeFunctionData({ abi: UNI_ROUTER_ABI, functionName: "multicall", args: [deadline, [swap, unwrap]] });
}

/**
 * Re-quotes, then builds the next call with `from` as the only recipient and checks it would go through.
 * A sale without enough CHOG allowance returns the approval first: exactly `amountIn`, to the quoted router.
 */
export async function buildSwap(from: Address, side: Side, amountIn: bigint, slippageBps: number, permit?: SignedPermit, noPermit = false) {
  const [r, d] = await Promise.all([routeOrThrow(side, amountIn), decimals()]);
  const best = r.best;
  const floor = minOut(best.amountOut, slippageBps);
  if (permit) {
    if (side !== "sell" || best.venue !== "nadfun") throw new SwapError("That signature is only for a Nad.fun sale. Review the sale again.");
    if (best.router.toLowerCase() !== permit.router.toLowerCase()) throw new SwapError("The route changed since you reviewed. Review the sale again.");
    // Never fill a sale for less than the person reviewed.
    if (floor < permit.minOut) throw new SwapError("The price moved since you reviewed. Review the sale again.");
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (permit.deadline < now + 30n || permit.deadline > now + BigInt(PERMIT_TTL_S) + 60n) throw new SwapError("That signature expired. Review the sale again.");
  }

  const [monBal, chogBal, allowance, fees, nonce] = await Promise.all([
    client.getBalance({ address: from }),
    side === "sell" ? client.readContract({ address: cfg.chog!, abi: ERC20_ABI, functionName: "balanceOf", args: [from] }) : 0n,
    side === "sell"
      ? client.readContract({ address: cfg.chog!, abi: ERC20_ABI, functionName: "allowance", args: [from, best.router] })
      : 0n,
    client.estimateFeesPerGas(),
    client.getTransactionCount({ address: from, blockTag: "pending" }),
  ]);
  if (side === "buy" && monBal < amountIn) throw new SwapError("This wallet does not have that much MON.");
  if (side === "sell" && chogBal < amountIn) throw new SwapError("This wallet does not have that much CHOG.");

  const needsAllowance = side === "sell" && allowance < amountIn;

  // A Nad.fun sale can carry its own approval as a signature: one transaction, one prompt.
  if (needsAllowance && !permit && !noPermit && best.venue === "nadfun") {
    const typed = await permitRequest(from, best.router, amountIn).catch(() => null);
    if (typed) {
      const q = toQuote(side, r, amountIn, slippageBps, d);
      // A rough fee for the review: a Nad.fun sale, plus the same 15% buffer the real build adds.
      const fee = (SELL_GAS_GUESS * 115n * fees.maxFeePerGas) / 100n;
      if (monBal < fee) throw new SwapError("Not enough MON for the network fee. Deposit a little MON first.");
      return { step: "permit" as const, typedData: typed, router: best.router, minOutRaw: floor.toString(), quote: q, networkFee: formatEther(fee) };
    }
  }

  const step: BuildStep = needsAllowance && !permit ? "approve" : "swap";
  const to = step === "approve" ? cfg.chog! : best.router;
  const data =
    step === "approve"
      ? encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [best.router, amountIn] })
      : permit
        ? encodeFunctionData({
            abi: NAD_ROUTER_ABI,
            functionName: "sellPermit",
            args: [{ amountIn, amountOutMin: floor, amountAllowance: amountIn, token: cfg.chog!, to: from, deadline: permit.deadline, v: permit.v, r: permit.r, s: permit.s }],
          })
        : encodeSwap(side, best, from, amountIn, floor);
  const value = side === "buy" ? amountIn : 0n;
  checkCall(to, data, from, value); // the same check every signed call gets

  let gas: bigint;
  try {
    gas = await client.estimateGas({ account: from, to, data, value });
  } catch (e) {
    console.error("[swap] simulation failed", e);
    throw new SwapError(
      step === "approve" ? "Could not prepare the CHOG approval. Try again." : "The swap would fail right now. Try a smaller amount or a higher slippage.",
    );
  }
  // Monad charges for the gas limit, so the buffer stays small.
  gas = (gas * 115n) / 100n;
  if (monBal < value + gas * fees.maxFeePerGas) {
    throw new SwapError(
      side === "buy"
        ? "Not enough MON to cover this amount plus the network fee. Try a smaller amount."
        : "Not enough MON for the network fee. Deposit a little MON first.",
    );
  }

  const tx: UnsignedSwap = {
    to,
    data,
    value: value.toString(),
    gas: gas.toString(),
    nonce,
    maxFeePerGas: fees.maxFeePerGas.toString(),
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    chainId: activeChain.id,
  };
  return { step, tx, quote: toQuote(side, r, amountIn, slippageBps, d), networkFee: formatEther(gas * fees.maxFeePerGas) };
}

/**
 * The EIP-2612 permit to sign: exactly amountIn, to the router the quote picked, for ten
 * minutes. Returns null when the token has no permit support (the caller falls back to
 * an approval transaction). Values are strings so the result survives JSON.
 */
async function permitRequest(owner: Address, spender: Address, value: bigint) {
  const [nonce, name, separator] = await Promise.all([
    client.readContract({ address: cfg.chog!, abi: ERC20_ABI, functionName: "nonces", args: [owner] }),
    client.readContract({ address: cfg.chog!, abi: ERC20_ABI, functionName: "name" }),
    client.readContract({ address: cfg.chog!, abi: ERC20_ABI, functionName: "DOMAIN_SEPARATOR" }),
  ]);
  const domain = { name, version: "1", chainId: activeChain.id, verifyingContract: cfg.chog! };
  // Only ask for a signature the token will accept. Anything else falls back to an approval.
  if (domainSeparator({ domain }).toLowerCase() !== separator.toLowerCase()) throw new Error("permit domain mismatch");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + PERMIT_TTL_S);
  return {
    domain,
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit" as const,
    message: { owner, spender, value: value.toString(), nonce: nonce.toString(), deadline: deadline.toString() },
  };
}

export type CallKind = "buy" | "sell" | "approve";

/**
 * The guard on every call Dubu builds or broadcasts. Allowed, and nothing else:
 * - buy: a router, CHOG out, `from` as recipient, a real minimum, paid in MON.
 * - sell: a router, CHOG in, MON to `from`, a real minimum, no MON attached.
 * - approve: CHOG approving one of the routers, no MON attached.
 */
export function checkCall(to: string | null | undefined, data: Hex | undefined, from: string, value: bigint = 0n): CallKind {
  const target = to?.toLowerCase() ?? "";
  const me = from.toLowerCase();
  const chog = cfg.chog?.toLowerCase();
  const wmon = cfg.wmon?.toLowerCase();
  const uni = cfg.uniRouter?.toLowerCase();
  if (!data || !chog) throw new SwapError("That is not a Dubu swap.");
  const bad = () => new SwapError("That is not a Dubu swap.");

  try {
    if (target === chog) {
      const call = decodeFunctionData({ abi: ERC20_ABI, data });
      if (call.functionName !== "approve" || value !== 0n) throw bad();
      const [spender, amount] = call.args as [Address, bigint];
      const routers = new Set([...nadRouters(), ...(uni ? [uni] : [])]);
      if (routers.has(spender.toLowerCase()) && amount > 0n) return "approve";
      throw bad();
    }

    if (nadRouters().has(target)) {
      const call = decodeFunctionData({ abi: NAD_ROUTER_ABI, data });
      if (call.functionName === "buy") {
        const p = call.args[0];
        if (p.token.toLowerCase() === chog && p.to.toLowerCase() === me && p.amountOutMin > 0n && value > 0n) return "buy";
      } else if (call.functionName === "sellPermit") {
        const p = call.args[0];
        if (
          p.token.toLowerCase() === chog &&
          p.to.toLowerCase() === me &&
          p.amountOutMin > 0n &&
          p.amountIn > 0n &&
          p.amountAllowance === p.amountIn &&
          value === 0n
        ) {
          return "sell";
        }
      } else if (call.functionName === "sell") {
        const p = call.args[0];
        if (p.token.toLowerCase() === chog && p.to.toLowerCase() === me && p.amountOutMin > 0n && p.amountIn > 0n && value === 0n) {
          return "sell";
        }
      }
      throw bad();
    }

    if (uni && target === uni) {
      const call = decodeFunctionData({ abi: UNI_ROUTER_ABI, data });
      if (call.functionName === "exactInputSingle") {
        const p = call.args[0];
        if (p.tokenIn.toLowerCase() === wmon && p.tokenOut.toLowerCase() === chog && p.recipient.toLowerCase() === me && p.amountOutMinimum > 0n && value > 0n) {
          return "buy";
        }
      } else if (call.functionName === "multicall" && value === 0n) {
        const calls = call.args[1];
        if (calls.length === 2) {
          const a = decodeFunctionData({ abi: UNI_ROUTER_ABI, data: calls[0] });
          const b = decodeFunctionData({ abi: UNI_ROUTER_ABI, data: calls[1] });
          if (a.functionName === "exactInputSingle" && b.functionName === "unwrapWETH9") {
            const p = a.args[0];
            const [unwrapMin, recipient] = b.args as [bigint, Address];
            if (
              p.tokenIn.toLowerCase() === chog &&
              p.tokenOut.toLowerCase() === wmon &&
              p.recipient.toLowerCase() === ROUTER_SELF &&
              p.amountOutMinimum > 0n &&
              unwrapMin > 0n &&
              recipient.toLowerCase() === me
            ) {
              return "sell";
            }
          }
        }
      }
    }
  } catch (e) {
    if (e instanceof SwapError) throw e;
    // undecodable data falls through
  }
  throw bad();
}

export type SwapResult = {
  hash: Hex;
  kind: CallKind;
  /** "pending": sent, not confirmed yet. Ask again with the hash; never sign again. */
  status: "success" | "reverted" | "pending";
  /** CHOG for a buy, MON for a sell, null for an approval or when it cannot be read. */
  received: string | null;
  /** What left the wallet for the swap, read from the chain: MON for a buy, CHOG for a sell. */
  paid?: string | null;
  /** Network fee in MON, read from the receipt. */
  fee?: string | null;
};

/** MON a sale paid out: WMON unwrapped in the same transaction, which both venues do. */
function monFromLogs(logs: Parameters<typeof parseEventLogs>[0]["logs"]) {
  if (!cfg.wmon) return 0n;
  return parseEventLogs({ abi: WMON_EVENTS, logs, eventName: "Withdrawal" })
    .filter((l) => l.address.toLowerCase() === cfg.wmon!.toLowerCase())
    .reduce((s, l) => s + l.args.wad, 0n);
}

async function settle(hash: Hex, from: string, kind: CallKind, value: bigint): Promise<SwapResult> {
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash, timeout: 20_000, pollingInterval: 500 });
  } catch {
    return { hash, kind, status: "pending", received: null };
  }
  const fee = receipt.effectiveGasPrice ? formatEther(receipt.gasUsed * receipt.effectiveGasPrice) : null;
  if (receipt.status !== "success") return { hash, kind, status: "reverted", received: null, paid: null, fee };
  if (kind === "approve") return { hash, kind, status: "success", received: null, paid: null, fee };
  const d = await decimals();
  const chogMoves = parseEventLogs({ abi: ERC20_ABI, logs: receipt.logs, eventName: "Transfer" }).filter(
    (l) => l.address.toLowerCase() === cfg.chog!.toLowerCase(),
  );
  const me = from.toLowerCase();
  if (kind === "sell") {
    const mon = monFromLogs(receipt.logs);
    const sold = chogMoves.filter((l) => l.args.from.toLowerCase() === me).reduce((s, l) => s + l.args.value, 0n);
    return { hash, kind, status: "success", received: mon > 0n ? formatEther(mon) : null, paid: sold > 0n ? formatUnits(sold, d) : null, fee };
  }
  const got = chogMoves.filter((l) => l.args.to.toLowerCase() === me).reduce((s, l) => s + l.args.value, 0n);
  return { hash, kind, status: "success", received: formatUnits(got, d), paid: formatEther(value), fee };
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
  const kind = checkCall(tx.to, tx.data, from, tx.value ?? 0n);

  // A signed transaction's hash is fixed, so the same swap sent twice is still one swap.
  const hash = keccak256(raw);
  try {
    await client.sendRawTransaction({ serializedTransaction: raw });
  } catch (e) {
    // Already on the network (a retry after a slow reply): follow it instead of failing.
    const known = await client.getTransaction({ hash }).catch(() => null);
    if (!known) {
      console.error("[swap] broadcast failed", e);
      throw new SwapError("Monad did not accept the swap. Nothing was spent. Try again.");
    }
  }
  return settle(hash, from, kind, tx.value ?? 0n);
}

/** External wallet path: the wallet broadcast it. Dubu only confirms it and reads what arrived. */
export async function trackSwap(hash: Hex, from: Address): Promise<SwapResult> {
  const tx = await client.getTransaction({ hash }).catch(() => null);
  if (!tx) return { hash, kind: "buy", status: "pending", received: null }; // not seen yet: ask again
  if (tx.from.toLowerCase() !== from.toLowerCase()) throw new SwapError("That transaction is from a different wallet.");
  const kind = checkCall(tx.to, tx.input, from, tx.value);
  return settle(hash, from, kind, tx.value); // waits for the receipt, or says "pending"
}
