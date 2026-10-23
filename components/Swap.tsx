"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSendTransaction, useSignTypedData, useSwitchChain } from "wagmi";
import { keccak256, parseSignature } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { api, ApiError, formatChog, formatMon } from "@/lib/api";
import { activeChain } from "@/lib/chain";
import { passkeyErrorMessage, signWithPasskey, withPasskeySession, type PasskeyTx } from "@/lib/passkey";
import { notify } from "@/lib/notify";
import { TokenIcon } from "./TokenIcon";
import { Alert, Button, Panel, Spinner, buttonClass } from "./ui";

type Side = "buy" | "sell";
type Quote = {
  side: Side;
  venue: "nadfun" | "uniswap";
  amountIn: string;
  amountOut: string;
  minOut: string;
  slippageBps: number;
  impact: number | null;
  venues: { nadfun: string | null; uniswap: string | null };
};
type TypedPermit = {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
  types: { Permit: { name: string; type: string }[] };
  primaryType: "Permit";
  message: { owner: `0x${string}`; spender: `0x${string}`; value: string; nonce: string; deadline: string };
};
/** A sale that carries its own approval as a signature: one transaction instead of two. */
type PermitStep = { step: "permit"; typedData: TypedPermit; router: `0x${string}`; minOutRaw: string; quote: Quote; networkFee: string };
type Built = PermitStep | TxStep;
type TxStep = {
  step: "approve" | "swap";
  tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
    gas: string;
    nonce: number;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    chainId: number;
  };
  quote: Quote;
  networkFee: string;
};
type Result = { hash: `0x${string}`; kind: "buy" | "sell" | "approve"; status: "success" | "reverted" | "pending"; received: string | null; paid?: string | null; fee?: string | null };

const VENUE: Record<Quote["venue"], string> = { nadfun: "Nad.fun", uniswap: "Uniswap" };
const SLIPPAGES = [50, 100, 300];
/** Left in the wallet for network fees when using Max on a buy. */
const GAS_RESERVE = 0.1;
const AMOUNT = /^\d{0,12}(\.\d{0,18})?$/;

const TOKENS = {
  buy: { pay: "mon", get: "chog" },
  sell: { pay: "chog", get: "mon" },
} as const;
const SYMBOL = { mon: "MON", chog: "CHOG" } as const;
const fmt = (token: "mon" | "chog", v: string | null | undefined) => (token === "mon" ? formatMon(v) : formatChog(v));

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function txUrl(hash: string) {
  return `${activeChain.blockExplorers?.default.url ?? "https://monadscan.com"}/tx/${hash}`;
}

/** A balance string cut to `places` decimals without rounding up, so Max never asks for more than is there. */
function floorString(v: string, places: number) {
  const [w, f = ""] = v.split(".");
  const cut = f.slice(0, places).replace(/0+$/, "");
  return cut ? `${w}.${cut}` : w;
}

/** MON to CHOG and back. The signed-in wallet pays and receives. Dubu never holds anything. */
export function Swap({
  address,
  monBalance,
  chogBalance,
  isPasskey,
}: {
  address: string;
  monBalance: string | null;
  chogBalance: string | null;
  isPasskey: boolean;
}) {
  const qc = useQueryClient();
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(100);
  const [review, setReview] = useState<Built | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [approved, setApproved] = useState(false);
  const debounced = useDebounced(amount, 400);
  const n = Number(debounced);
  const valid = debounced !== "" && Number.isFinite(n) && n > 0;
  // Only ask for, and only show, a quote for exactly what is typed right now.
  const settled = debounced === amount;

  const pay = TOKENS[side].pay;
  const get = TOKENS[side].get;
  const payBalance = pay === "mon" ? monBalance : chogBalance;
  const balance = payBalance === null ? null : Number(payBalance);
  const tooMuch = balance !== null && Number(amount) > balance;

  const quote = useQuery<Quote, ApiError>({
    queryKey: ["swap-quote", side, debounced, slippage],
    queryFn: () => api<Quote>(`/api/swap/quote?side=${side}&amount=${encodeURIComponent(debounced)}&slippageBps=${slippage}`),
    enabled: valid && settled && !review,
    refetchInterval: review ? false : 15_000,
    retry: false,
  });

  const { address: connected, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { signTypedDataAsync } = useSignTypedData();
  const walletReady = isConnected && connected?.toLowerCase() === address.toLowerCase();

  const build = (extra: Record<string, unknown> = {}) =>
    api<Built>("/api/swap/build", { method: "POST", body: JSON.stringify({ side, amount, slippageBps: slippage, ...extra }) });

  const prepare = useMutation<Built, ApiError>({ mutationFn: () => build(), onSuccess: (b) => setReview(b) });

  /** Set once a swap is signed: from then on Dubu follows it and never asks to sign it again. */
  const [sent, setSent] = useState<`0x${string}` | null>(null);

  /** Follows a sent swap by its hash until Monad confirms it. Never signs anything. */
  async function follow(hash: `0x${string}`, first?: Result): Promise<Result> {
    setSent(hash);
    let r = first;
    const until = Date.now() + 90_000;
    while (!r || r.status === "pending") {
      if (Date.now() > until) {
        throw new Error("Your swap was sent. Monad has not confirmed it yet. Tap Check again in a moment. Do not swap again.");
      }
      if (r) await new Promise((ok) => setTimeout(ok, 1500));
      r = await api<Result>("/api/swap/send", { method: "POST", body: JSON.stringify({ hash }) }).catch((e) => {
        if (e instanceof ApiError && e.status === 400) throw e;
        return undefined; // a slow reply: ask again
      });
    }
    return r;
  }

  /** Sends a signed passkey swap once, then follows it. A failed reply is followed, not re-signed. */
  async function submitRaw(raw: `0x${string}`): Promise<Result> {
    const hash = keccak256(raw);
    setSent(hash);
    let first: Result | undefined;
    try {
      first = await api<Result>("/api/swap/send", { method: "POST", body: JSON.stringify({ raw }) });
    } catch (e) {
      // Monad refused it: nothing was sent, so signing again is safe.
      if (e instanceof ApiError && e.status === 400) {
        setSent(null);
        throw e;
      }
    }
    return follow(hash, first);
  }

  async function send(b: TxStep): Promise<Result> {
    const tx = toTx(b);
    if (isPasskey) {
      let raw: `0x${string}`;
      try {
        raw = await signWithPasskey(address, tx);
      } catch (e) {
        throw new Error(e instanceof Error && e.message.startsWith("That passkey") ? e.message : passkeyErrorMessage(e));
      }
      return submitRaw(raw);
    }
    if (chainId !== activeChain.id) await switchChainAsync({ chainId: activeChain.id });
    let hash: `0x${string}`;
    try {
      // The wallet sets its own nonce and fees.
      hash = await sendTransactionAsync({ to: tx.to, data: tx.data, value: tx.value, gas: tx.gas, chainId: activeChain.id });
    } catch {
      throw new Error("Cancelled in your wallet. Nothing was spent.");
    }
    return follow(hash);
  }

  /** Rebuilds the sale with the signed permit. Must come back as the sale itself. */
  async function buildWithPermit(p: PermitStep, signature: `0x${string}`): Promise<TxStep> {
    const sig = parseSignature(signature);
    const v = sig.v !== undefined ? Number(sig.v) : sig.yParity + 27;
    const permit = { v, r: sig.r, s: sig.s, deadline: p.typedData.message.deadline, minOut: p.minOutRaw, router: p.router };
    const b = await build({ permit });
    if (b.step !== "swap") throw new Error("Dubu could not prepare the sale. Review it again.");
    return b;
  }

  /** One passkey prompt, or one signature and one transaction in a wallet, for the whole sale. */
  async function sellWithPermit(p: PermitStep): Promise<Result> {
    const typed = { ...p.typedData, message: { ...p.typedData.message, value: BigInt(p.typedData.message.value), nonce: BigInt(p.typedData.message.nonce), deadline: BigInt(p.typedData.message.deadline) } };
    if (isPasskey) {
      let raw: `0x${string}`;
      try {
        raw = await withPasskeySession(address, async (signer) => {
          const signature = await signer.signTypedData(typed);
          return signer.signTransaction(toTx(await buildWithPermit(p, signature)));
        });
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new Error(e instanceof Error && /^(That passkey|Dubu could not)/.test(e.message) ? e.message : passkeyErrorMessage(e));
      }
      return submitRaw(raw);
    }
    if (chainId !== activeChain.id) await switchChainAsync({ chainId: activeChain.id });
    let signature: `0x${string}`;
    try {
      signature = await signTypedDataAsync(typed);
    } catch {
      throw new Error("Cancelled in your wallet. Nothing was signed.");
    }
    return send(await buildWithPermit(p, signature));
  }

  const confirm = useMutation<void, Error>({
    mutationFn: async () => {
      let r: Result;
      if (sent) {
        r = await follow(sent); // already signed: only check on it
      } else if (review!.step === "permit") {
        try {
          r = await sellWithPermit(review!);
        } catch (e) {
          // The one-step sale was refused (an old token, a moved price). Fall back to allow, then sell.
          if (e instanceof ApiError && e.status === 400) {
            setReview(await build({ noPermit: true }));
            throw new Error(`${e.message} You can also allow CHOG first, then sell.`);
          }
          throw e;
        }
      } else {
        r = await send(review!);
      }
      setSent(null);
      if (r.kind === "approve") {
        if (r.status !== "success") throw new Error("The approval did not go through. Only the network fee was spent. Try again.");
        // Step 2: the sale itself, re-quoted now that CHOG is approved.
        setApproved(true);
        setReview(await build());
        return;
      }
      setResult(r);
      qc.invalidateQueries({ queryKey: ["me"] });
      if (r.status === "success") {
        notify({
          tone: "celebrate",
          token: r.kind === "buy" ? "chog" : "mon",
          title: r.received
            ? r.kind === "buy"
              ? `${formatChog(r.received)} CHOG bought`
              : `${formatMon(r.received)} MON received`
            : "Swap complete",
          body: "It is in your wallet now.",
        });
      }
    },
  });

  function reset() {
    setSent(null);
    setReview(null);
    setResult(null);
    setApproved(false);
    prepare.reset();
    confirm.reset();
  }

  function pickSide(s: Side) {
    if (s === side) return;
    reset();
    setSide(s);
    setAmount("");
  }

  function setMax() {
    if (payBalance === null || balance === null) return;
    if (pay === "mon") {
      const max = Math.max(0, balance - GAS_RESERVE);
      setAmount(max > 0 ? String(Math.floor(max * 10_000) / 10_000) : "");
    } else {
      setAmount(balance > 0 ? floorString(payBalance, 6) : "");
    }
  }

  const q = quote.data && quote.data.side === side && settled && Number(quote.data.amountIn) === Number(amount) ? quote.data : undefined;

  return (
    <Panel className="mt-6">
      {result && review ? (
        <SwapDone
          result={result}
          quote={review.quote}
          onAgain={() => {
            reset();
            setAmount("");
          }}
        />
      ) : review ? (
        <div>
          {side === "sell" && review.step !== "permit" && (
            <ol className="mb-5 grid grid-cols-2 gap-2 text-sm font-semibold">
              <StepPill n={1} label="Allow CHOG" state={review.step === "approve" ? "now" : "done"} />
              <StepPill n={2} label="Sell" state={review.step === "swap" ? "now" : "next"} />
            </ol>
          )}
          {review.step === "approve" ? (
            <p className="mb-4 leading-relaxed text-mute">
              First, let {VENUE[review.quote.venue]} use exactly {formatChog(review.quote.amountIn)} CHOG from your wallet.
              Nothing is sold yet. Then you confirm the sale.
            </p>
          ) : (
            approved && <p className="mb-4 leading-relaxed text-mute">CHOG allowed. Now confirm the sale.</p>
          )}

          <dl className="divide-y divide-line rounded-2xl border border-line">
            <Row label="You pay">
              <span className="flex items-center gap-2">
                <TokenIcon token={pay} size={20} /> {fmt(pay, review.quote.amountIn)} {SYMBOL[pay]}
              </span>
            </Row>
            <Row label="You get about">
              <span className="flex items-center gap-2">
                <TokenIcon token={get} size={20} /> {fmt(get, review.quote.amountOut)} {SYMBOL[get]}
              </span>
            </Row>
            <Row label="At least">
              {fmt(get, review.quote.minOut)} {SYMBOL[get]}
            </Row>
            <Row label="Route">{VENUE[review.quote.venue]}</Row>
            <Row label="Network fee">Up to {formatMon(review.networkFee)} MON</Row>
          </dl>
          {review.step !== "approve" && (
            <p className="mt-3 text-sm text-mute">
              If the price moves more than {review.quote.slippageBps / 100}% before it lands, the swap cancels itself.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {isPasskey || walletReady ? (
              <Button size="lg" className="w-full sm:w-auto" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                {confirm.isPending ? (
                  <>
                    <Spinner /> {sent ? "Confirming on Monad" : isPasskey ? "Confirm with your passkey" : "Confirm in your wallet"}
                  </>
                ) : sent ? (
                  "Check again"
                ) : review.step === "approve" ? (
                  isPasskey ? "Allow with passkey" : "Allow in wallet"
                ) : isPasskey ? (
                  "Confirm with passkey"
                ) : (
                  "Confirm in wallet"
                )}
              </Button>
            ) : (
              <Button size="lg" className="w-full sm:w-auto" onClick={() => openConnectModal?.()}>
                Connect {address.slice(0, 6)}…{address.slice(-4)}
              </Button>
            )}
            <Button size="lg" variant="ghost" disabled={confirm.isPending || !!sent} onClick={reset}>
              Back
            </Button>
          </div>
          {!isPasskey && !walletReady && <p className="mt-3 text-sm text-mute">Connect the wallet you signed in with to confirm.</p>}
          {confirm.error && (
            <div className="mt-4">
              <Alert>{confirm.error.message}</Alert>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div role="tablist" aria-label="Swap direction" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={side === s}
                onClick={() => pickSide(s)}
                className={`h-11 rounded-xl text-[15px] font-semibold transition-colors ${
                  side === s ? "bg-white text-ink shadow-[0_1px_3px_rgba(11,18,32,0.12)]" : "text-mute hover:text-ink"
                }`}
              >
                {s === "buy" ? "Buy CHOG" : "Sell CHOG"}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-surface p-4 ring-brand focus-within:ring-2">
            <div className="flex items-center justify-between text-sm text-mute">
              <label htmlFor="swap-amount">You pay</label>
              <span className="tabular-nums">
                Balance {payBalance === null ? "-" : `${fmt(pay, payBalance)} ${SYMBOL[pay]}`}
                {balance !== null && balance > (pay === "mon" ? GAS_RESERVE : 0) && (
                  <button type="button" onClick={setMax} className="ml-2 font-semibold text-brand hover:underline">
                    Max
                  </button>
                )}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="swap-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".");
                  if (AMOUNT.test(v)) setAmount(v);
                }}
                className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold tabular-nums outline-none focus-visible:outline-none placeholder:text-mute/50"
              />
              <TokenChip token={pay} />
            </div>
          </div>

          <div className="relative z-10 -my-3 flex justify-center">
            <button
              type="button"
              onClick={() => pickSide(side === "buy" ? "sell" : "buy")}
              aria-label={side === "buy" ? "Switch to selling CHOG" : "Switch to buying CHOG"}
              className="flex size-10 items-center justify-center rounded-xl border-4 border-white bg-surface text-ink hover:bg-wash"
            >
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
              </svg>
            </button>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm text-mute">You get about</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate font-display text-3xl font-bold tabular-nums">
                {valid && !q && (quote.isFetching || !settled) ? (
                  <span className="skeleton inline-block h-8 w-32 rounded-xl align-middle" />
                ) : q ? (
                  fmt(get, q.amountOut)
                ) : (
                  "0"
                )}
              </p>
              <TokenChip token={get} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-mute">Slippage</span>
            {SLIPPAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlippage(s)}
                aria-pressed={slippage === s}
                className={`h-9 rounded-full px-3.5 font-semibold tabular-nums ring-1 ${slippage === s ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:ring-ink/30"}`}
              >
                {s / 100}%
              </button>
            ))}
          </div>

          {q && valid && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-mute">Route</dt>
              <dd className="text-right font-medium">{VENUE[q.venue]}</dd>
              <dt className="text-mute">At least</dt>
              <dd className="text-right font-medium tabular-nums">
                {fmt(get, q.minOut)} {SYMBOL[get]}
              </dd>
              {q.impact !== null && (
                <>
                  <dt className="text-mute">Price impact</dt>
                  <dd className={`text-right font-medium tabular-nums ${q.impact > 0.05 ? "text-danger" : ""}`}>{(q.impact * 100).toFixed(2)}%</dd>
                </>
              )}
              {side === "sell" && (
                <>
                  <dt className="text-mute">Steps</dt>
                  <dd className="text-right font-medium">{q.venue === "nadfun" ? "One confirmation" : "Allow CHOG, then sell"}</dd>
                </>
              )}
            </dl>
          )}

          <Button
            size="lg"
            className="mt-5 w-full"
            disabled={!q || !valid || tooMuch || quote.isError || prepare.isPending || debounced !== amount}
            loading={prepare.isPending}
            onClick={() => prepare.mutate()}
          >
            {tooMuch ? `Not enough ${SYMBOL[pay]}` : side === "buy" ? "Review buy" : "Review sale"}
          </Button>

          {pay === "mon" && monBalance !== null && Number(monBalance) === 0 && (
            <p className="mt-3 text-sm leading-relaxed text-mute">
              This wallet has no MON yet.{" "}
              <Link href="/deposit" className="font-semibold text-brand hover:underline">
                Deposit MON
              </Link>{" "}
              on Monad, then swap.
            </p>
          )}
          {pay === "chog" && chogBalance !== null && Number(chogBalance) === 0 && (
            <p className="mt-3 text-sm leading-relaxed text-mute">This wallet has no CHOG to sell yet.</p>
          )}
          {(quote.error || prepare.error) && valid && (
            <div className="mt-4">
              <Alert>{(prepare.error ?? quote.error)!.message}</Alert>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function TokenChip({ token }: { token: "mon" | "chog" }) {
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-line">
      <TokenIcon token={token} size={22} /> {SYMBOL[token]}
    </span>
  );
}

function StepPill({ n, label, state }: { n: number; label: string; state: "done" | "now" | "next" }) {
  return (
    <li
      aria-current={state === "now" ? "step" : undefined}
      className={`flex h-10 items-center gap-2 rounded-xl px-3 ${state === "now" ? "bg-wash text-brand" : state === "done" ? "bg-surface text-ink" : "bg-surface text-mute"}`}
    >
      <span
        className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${state === "now" ? "bg-brand text-white" : state === "done" ? "bg-ink text-white" : "bg-white text-mute ring-1 ring-line"}`}
      >
        {state === "done" ? (
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          n
        )}
      </span>
      {label}
    </li>
  );
}

function short(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** The receipt after a swap lands: what came in, what went out, and the proof onchain. */
function SwapDone({ result, quote, onAgain }: { result: Result; quote: Quote; onAgain: () => void }) {
  const ok = result.status === "success";
  const { pay, get } = TOKENS[quote.side];
  return (
    <div aria-live="polite">
      <div className="flex flex-col items-center text-center">
        <span aria-hidden className={`dubu-cut flex size-14 items-center justify-center rounded-full ${ok ? "bg-brand text-white" : "bg-danger-wash text-danger"}`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            {ok ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M7 7l10 10M17 7L7 17" />}
          </svg>
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.03em]">{ok ? "Swap complete" : "Swap did not go through"}</h2>
        {ok ? (
          <>
            <p className="mt-3 flex items-center gap-2.5 font-display text-[40px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
              <TokenIcon token={get} size={36} />
              {result.received ? `+${fmt(get, result.received)}` : SYMBOL[get]}
              {result.received && <span className="text-2xl text-mute">{SYMBOL[get]}</span>}
            </p>
            <p className="mt-2 text-sm text-mute">In your wallet now.</p>
          </>
        ) : (
          <p className="mt-2 max-w-[24rem] leading-relaxed text-mute">
            The price moved or the network refused it. Your {SYMBOL[pay]} stayed in your wallet. Only the network fee was spent.
          </p>
        )}
      </div>

      <dl className="mt-6 divide-y divide-line rounded-2xl border border-line">
        <Row label={ok ? "You paid" : "You tried to pay"}>
          <span className="flex items-center gap-2">
            <TokenIcon token={pay} size={20} /> {fmt(pay, result.paid ?? quote.amountIn)} {SYMBOL[pay]}
          </span>
        </Row>
        {result.fee && <Row label="Network fee">{formatMon(result.fee)} MON</Row>}
        <Row label="Route">{VENUE[quote.venue]}</Row>
        <Row label="Network">{activeChain.name}</Row>
        <Row label="Transaction">
          <a href={txUrl(result.hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-brand hover:underline">
            {short(result.hash)}
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
            <span className="sr-only">View on MonadScan</span>
          </a>
        </Row>
      </dl>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={onAgain}>
          {ok ? "Swap again" : "Try again"}
        </Button>
        <Link href="/profile" className={buttonClass("ghost", "lg")}>
          Back to Profile
        </Link>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function toTx(b: TxStep): PasskeyTx {
  return {
    to: b.tx.to,
    data: b.tx.data,
    value: BigInt(b.tx.value),
    gas: BigInt(b.tx.gas),
    nonce: b.tx.nonce,
    maxFeePerGas: BigInt(b.tx.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(b.tx.maxPriorityFeePerGas),
    chainId: b.tx.chainId,
  };
}
