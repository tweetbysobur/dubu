"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { api, ApiError, formatChog, formatMon } from "@/lib/api";
import { activeChain } from "@/lib/chain";
import { passkeyErrorMessage, signWithPasskey } from "@/lib/passkey";
import { notify } from "@/lib/notify";
import { TokenIcon } from "./TokenIcon";
import { Alert, Button, Panel, Spinner } from "./ui";

type Quote = {
  venue: "nadfun" | "uniswap";
  amountIn: string;
  amountOut: string;
  minOut: string;
  slippageBps: number;
  impact: number | null;
  venues: { nadfun: string | null; uniswap: string | null };
};
type Built = {
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
type Result = { hash: `0x${string}`; status: "success" | "reverted"; received: string | null };

const VENUE: Record<Quote["venue"], string> = { nadfun: "Nad.fun", uniswap: "Uniswap" };
const SLIPPAGES = [50, 100, 300];
/** Left in the wallet for network fees when using Max. */
const GAS_RESERVE = 0.1;
const AMOUNT = /^\d{0,9}(\.\d{0,18})?$/;

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

/** MON to CHOG. The signed-in wallet pays and receives. Dubu never holds anything. */
export function Swap({ address, monBalance, isPasskey }: { address: string; monBalance: string | null; isPasskey: boolean }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(100);
  const [review, setReview] = useState<Built | null>(null);
  const debounced = useDebounced(amount, 400);
  const n = Number(debounced);
  const valid = debounced !== "" && Number.isFinite(n) && n > 0;
  const balance = monBalance === null ? null : Number(monBalance);
  const tooMuch = balance !== null && Number(amount) > balance;

  const quote = useQuery<Quote, ApiError>({
    queryKey: ["swap-quote", debounced, slippage],
    queryFn: () => api<Quote>(`/api/swap/quote?mon=${encodeURIComponent(debounced)}&slippageBps=${slippage}`),
    enabled: valid && !review,
    refetchInterval: review ? false : 15_000,
    retry: false,
  });

  const { address: connected, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const walletReady = isConnected && connected?.toLowerCase() === address.toLowerCase();

  const prepare = useMutation<Built, ApiError>({
    mutationFn: () => api<Built>("/api/swap/build", { method: "POST", body: JSON.stringify({ mon: amount, slippageBps: slippage }) }),
    onSuccess: (b) => setReview(b),
  });

  const confirm = useMutation<Result, Error>({
    mutationFn: async () => {
      const b = review!;
      const tx = {
        to: b.tx.to,
        data: b.tx.data,
        value: BigInt(b.tx.value),
        gas: BigInt(b.tx.gas),
        nonce: b.tx.nonce,
        maxFeePerGas: BigInt(b.tx.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(b.tx.maxPriorityFeePerGas),
        chainId: b.tx.chainId,
      };
      if (isPasskey) {
        let raw: `0x${string}`;
        try {
          raw = await signWithPasskey(address, tx);
        } catch (e) {
          throw new Error(e instanceof Error && e.message.startsWith("That passkey") ? e.message : passkeyErrorMessage(e));
        }
        return api<Result>("/api/swap/send", { method: "POST", body: JSON.stringify({ raw }) });
      }
      if (chainId !== activeChain.id) await switchChainAsync({ chainId: activeChain.id });
      let hash: `0x${string}`;
      try {
        // The wallet sets its own nonce and fees.
        hash = await sendTransactionAsync({ to: tx.to, data: tx.data, value: tx.value, gas: tx.gas, chainId: activeChain.id });
      } catch {
        throw new Error("The swap was cancelled in your wallet. Nothing was spent.");
      }
      return api<Result>("/api/swap/send", { method: "POST", body: JSON.stringify({ hash }) });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["me"] });
      if (r.status === "success") {
        notify({
          tone: "celebrate",
          token: "chog",
          title: r.received ? `${formatChog(r.received)} CHOG bought` : "Swap complete",
          body: "It is in your wallet now.",
        });
      }
    },
  });

  function reset() {
    setReview(null);
    prepare.reset();
    confirm.reset();
  }

  function setMax() {
    if (balance === null) return;
    const max = Math.max(0, balance - GAS_RESERVE);
    setAmount(max > 0 ? String(Math.floor(max * 10_000) / 10_000) : "");
  }

  const q = quote.data;
  const result = confirm.data;

  return (
    <Panel className="mt-6">
      <div id="swap" className="scroll-mt-24">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Get CHOG</h2>
        <p className="mt-1 max-w-[36rem] text-sm leading-relaxed text-mute">
          Swap MON for CHOG in this wallet. Dubu compares Nad.fun and Uniswap and uses the better price. You confirm every
          swap yourself.
        </p>
      </div>

      {result ? (
        <div className="mt-5">
          {result.status === "success" ? (
            <Alert tone="info">
              Swap complete.{result.received ? ` You received ${formatChog(result.received)} CHOG.` : ""}
            </Alert>
          ) : (
            <Alert>The swap did not go through, so your CHOG was not bought. Only the network fee was spent.</Alert>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a href={txUrl(result.hash)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-5 text-[15px] font-semibold hover:border-ink/30">
              View on MonadScan
            </a>
            <Button
              onClick={() => {
                reset();
                setAmount("");
              }}
            >
              New swap
            </Button>
          </div>
        </div>
      ) : review ? (
        <div className="mt-5">
          <dl className="divide-y divide-line rounded-2xl border border-line">
            <Row label="You pay">
              <span className="flex items-center gap-2">
                <TokenIcon token="mon" size={20} /> {formatMon(review.quote.amountIn)} MON
              </span>
            </Row>
            <Row label="You get about">
              <span className="flex items-center gap-2">
                <TokenIcon token="chog" size={20} /> {formatChog(review.quote.amountOut)} CHOG
              </span>
            </Row>
            <Row label="At least">{formatChog(review.quote.minOut)} CHOG</Row>
            <Row label="Route">{VENUE[review.quote.venue]}</Row>
            <Row label="Network fee">Up to {formatMon(review.networkFee)} MON</Row>
            <Row label="Network">{activeChain.name}</Row>
          </dl>
          <p className="mt-3 text-sm text-mute">
            If the price moves more than {review.quote.slippageBps / 100}% before it lands, the swap cancels itself.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {isPasskey || walletReady ? (
              <Button size="lg" className="w-full sm:w-auto" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                {confirm.isPending ? (
                  <>
                    <Spinner /> {isPasskey ? "Confirm with your passkey" : "Confirm in your wallet"}
                  </>
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
            <Button size="lg" variant="ghost" disabled={confirm.isPending} onClick={reset}>
              Back
            </Button>
          </div>
          {!isPasskey && !walletReady && (
            <p className="mt-3 text-sm text-mute">Connect the wallet you signed in with to confirm this swap.</p>
          )}
          {confirm.error && (
            <div className="mt-4">
              <Alert>{confirm.error.message}</Alert>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <div className="rounded-2xl bg-surface p-4 ring-brand focus-within:ring-2">
            <div className="flex items-center justify-between text-sm text-mute">
              <label htmlFor="swap-amount">You pay</label>
              <span className="tabular-nums">
                Balance {monBalance === null ? "-" : `${formatMon(monBalance)} MON`}
                {balance !== null && balance > GAS_RESERVE && (
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
              <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-line">
                <TokenIcon token="mon" size={22} /> MON
              </span>
            </div>
          </div>

          <div className="mt-2 rounded-2xl bg-surface p-4">
            <p className="text-sm text-mute">You get about</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate font-display text-3xl font-bold tabular-nums">
                {valid && quote.isFetching && !q ? <span className="skeleton inline-block h-8 w-32 rounded-xl align-middle" /> : q ? formatChog(q.amountOut) : "0"}
              </p>
              <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-line">
                <TokenIcon token="chog" size={22} /> CHOG
              </span>
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
              <dd className="text-right font-medium tabular-nums">{formatChog(q.minOut)} CHOG</dd>
              {q.impact !== null && (
                <>
                  <dt className="text-mute">Price impact</dt>
                  <dd className={`text-right font-medium tabular-nums ${q.impact > 0.05 ? "text-danger" : ""}`}>
                    {(q.impact * 100).toFixed(2)}%
                  </dd>
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
            {tooMuch ? "Not enough MON" : "Review swap"}
          </Button>

          {monBalance !== null && Number(monBalance) === 0 && (
            <p className="mt-3 text-sm leading-relaxed text-mute">
              This wallet has no MON yet. Send MON on Monad to the address above, then swap.
            </p>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{children}</dd>
    </div>
  );
}
