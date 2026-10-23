"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { isAddress, keccak256 } from "viem";
import { api, ApiError, formatChog, formatMon } from "@/lib/api";
import { activeChain } from "@/lib/chain";
import { passkeyErrorMessage, signWithPasskey } from "@/lib/passkey";
import { notify } from "@/lib/notify";
import { TokenIcon } from "./TokenIcon";
import { Mascot } from "./Mascot";
import { Alert, Button, Panel, Spinner, buttonClass } from "./ui";

type Token = "mon" | "chog";
type Built = {
  token: Token;
  amount: string;
  recipient: `0x${string}`;
  recipientIsContract: boolean;
  fee: string;
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
};
type Result =
  | { hash: `0x${string}`; status: "pending" }
  | {
      hash: `0x${string}`;
      status: "success" | "reverted";
      token: Token;
      recipient: `0x${string}`;
      amount: string | null;
      fee: string | null;
    };
type Done = Exclude<Result, { status: "pending" }>;

const SYMBOL = { mon: "MON", chog: "CHOG" } as const;
const AMOUNT = /^\d{0,12}(\.\d{0,18})?$/;
const fmt = (t: Token, v: string | null | undefined) => (t === "mon" ? formatMon(v) : formatChog(v));

function explorer(path: string) {
  return `${activeChain.blockExplorers?.default.url ?? "https://monadscan.com"}/${path}`;
}

/** A full address in groups of four, so it can be checked against the source character by character. */
function Address({ value, className = "" }: { value: string; className?: string }) {
  const body = value.slice(2).match(/.{1,4}/g) ?? [];
  return (
    <span className={`font-mono tabular-nums ${className}`} aria-label={value}>
      <span aria-hidden>
        0x
        {body.map((g, i) => (
          <span key={i} className={i % 2 ? "text-mute" : ""}>
            {g}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Sends MON or CHOG out of the signed-in wallet to any Monad address.
 * Form, then a review that reads like a document, then one confirmation, then a receipt
 * built only from what the chain reports.
 */
export function Withdraw({
  address,
  monBalance,
  chogBalance,
  chogEnabled,
  isPasskey,
}: {
  address: `0x${string}`;
  monBalance: string | null;
  chogBalance: string | null;
  chogEnabled: boolean;
  isPasskey: boolean;
}) {
  const qc = useQueryClient();
  const ids = { amount: useId(), to: useId(), toHelp: useId() };
  const [token, setToken] = useState<Token>("mon");
  const [amount, setAmount] = useState("");
  const [max, setMax] = useState(false);
  const [to, setTo] = useState("");
  const [toTouched, setToTouched] = useState(false);
  const [review, setReview] = useState<Built | null>(null);
  const [sent, setSent] = useState<`0x${string}` | null>(null);
  const [result, setResult] = useState<Done | null>(null);

  const balance = token === "mon" ? monBalance : chogBalance;
  const n = Number(amount);
  const tooMuch = balance !== null && !max && amount !== "" && n > Number(balance);
  const toClean = to.trim();
  const toValid = isAddress(toClean, { strict: false });
  const toSelf = toValid && toClean.toLowerCase() === address.toLowerCase();
  const toError = !toClean ? null : !toValid ? "That is not a Monad address. It starts with 0x and has 42 characters." : toSelf ? "That is this wallet. Send to a different address." : null;
  const canReview = (max || (amount !== "" && n > 0 && !tooMuch)) && toValid && !toSelf;

  const { address: connected, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const walletReady = isConnected && connected?.toLowerCase() === address.toLowerCase();

  const prepare = useMutation<Built, ApiError>({
    mutationFn: () => api<Built>("/api/withdraw/build", { method: "POST", body: JSON.stringify({ token, amount: max ? "max" : amount, to: toClean }) }),
    onSuccess: (b) => setReview(b),
  });

  /** Follows a sent withdrawal by hash until Monad confirms it. Never signs anything. */
  async function follow(hash: `0x${string}`, first?: Result): Promise<Done> {
    setSent(hash);
    let r = first;
    const until = Date.now() + 90_000;
    while (!r || r.status === "pending") {
      if (Date.now() > until) throw new Error("Your withdrawal was sent. Monad has not confirmed it yet. Tap Check again in a moment. Do not send it again.");
      if (r) await new Promise((ok) => setTimeout(ok, 1500));
      r = await api<Result>("/api/withdraw/send", { method: "POST", body: JSON.stringify({ hash }) }).catch((e) => {
        if (e instanceof ApiError && e.status === 400) throw e;
        return undefined;
      });
    }
    return r;
  }

  async function send(b: Built): Promise<Done> {
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
      const hash = keccak256(raw);
      setSent(hash);
      let first: Result | undefined;
      try {
        first = await api<Result>("/api/withdraw/send", { method: "POST", body: JSON.stringify({ raw }) });
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          setSent(null); // refused before it reached the network: signing again is safe
          throw e;
        }
      }
      return follow(hash, first);
    }
    if (chainId !== activeChain.id) await switchChainAsync({ chainId: activeChain.id });
    let hash: `0x${string}`;
    try {
      hash = await sendTransactionAsync({ to: tx.to, data: tx.data, value: tx.value, gas: tx.gas, chainId: activeChain.id });
    } catch {
      throw new Error("Cancelled in your wallet. Nothing was sent.");
    }
    return follow(hash);
  }

  const confirm = useMutation<void, Error>({
    mutationFn: async () => {
      const r = sent ? await follow(sent) : await send(review!);
      setSent(null);
      setResult(r);
      qc.invalidateQueries({ queryKey: ["me"] });
      if (r.status === "success") {
        notify({ tone: "info", title: `${fmt(r.token, r.amount)} ${SYMBOL[r.token]} sent`, body: `To ${r.recipient.slice(0, 6)}…${r.recipient.slice(-4)}` });
      }
    },
  });

  function back() {
    setReview(null);
    prepare.reset();
    confirm.reset();
  }

  function again() {
    setResult(null);
    setReview(null);
    setSent(null);
    setAmount("");
    setMax(false);
    prepare.reset();
    confirm.reset();
  }

  function pickToken(t: Token) {
    if (t === token) return;
    setToken(t);
    setAmount("");
    setMax(false);
    prepare.reset();
  }

  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setTo(text);
        setToTouched(true);
      }
    } catch {
      // Clipboard read blocked: the field still takes a long-press paste.
    }
  }

  if (result) return <Receipt result={result} onAgain={again} />;

  if (review) {
    const busyLabel = sent ? "Confirming on Monad" : isPasskey ? "Confirm with your passkey" : "Confirm in your wallet";
    return (
      <Panel className="mt-6">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Check before you send</h2>
        <p className="mt-1 text-sm leading-relaxed text-mute">A withdrawal cannot be undone. Make sure the address is right.</p>

        <div className="mt-5 flex items-center gap-3">
          <TokenIcon token={review.token} size={36} />
          <p className="font-display text-[40px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
            {fmt(review.token, review.amount)}
            <span className="ml-2 text-2xl text-mute">{SYMBOL[review.token]}</span>
          </p>
        </div>

        <dl className="mt-5 divide-y divide-line rounded-2xl border border-line">
          <div className="px-4 py-3">
            <dt className="text-sm text-mute">To</dt>
            <dd className="mt-1 break-all text-[15px] font-semibold leading-relaxed">
              <Address value={review.recipient} />
            </dd>
          </div>
          <Row label="Network">{activeChain.name}</Row>
          <Row label="Network fee">Up to {formatMon(review.fee)} MON</Row>
          {review.token === "mon" && max && <Row label="Left in this wallet">About 0 MON</Row>}
        </dl>

        {review.recipientIsContract && (
          <div className="mt-4">
            <Alert tone="info">This address is a contract, not a personal wallet. Send only if you know it can receive {SYMBOL[review.token]}.</Alert>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {isPasskey || walletReady ? (
            <Button size="lg" className="w-full sm:w-auto" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
              {confirm.isPending ? (
                <>
                  <Spinner /> {busyLabel}
                </>
              ) : sent ? (
                "Check again"
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
          <Button size="lg" variant="ghost" disabled={confirm.isPending || !!sent} onClick={back}>
            Edit
          </Button>
        </div>
        {!isPasskey && !walletReady && <p className="mt-3 text-sm text-mute">Connect the wallet you signed in with to confirm.</p>}
        {confirm.error && (
          <div className="mt-4">
            <Alert>{confirm.error.message}</Alert>
          </div>
        )}
      </Panel>
    );
  }

  const tokens: Token[] = chogEnabled ? ["mon", "chog"] : ["mon"];

  return (
    <Panel className="mt-6">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setToTouched(true);
          if (canReview) prepare.mutate();
        }}
      >
        {tokens.length > 1 && (
          <div role="radiogroup" aria-label="What to withdraw" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
            {tokens.map((t) => {
              const on = token === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickToken(t)}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors ${
                    on ? "bg-white text-ink shadow-[0_1px_3px_rgba(11,18,32,0.12)]" : "text-mute hover:text-ink"
                  }`}
                >
                  <TokenIcon token={t} size={22} />
                  {SYMBOL[t]}
                </button>
              );
            })}
          </div>
        )}

        <div className={`${tokens.length > 1 ? "mt-4" : ""} rounded-2xl bg-surface p-4 ring-brand focus-within:ring-2`}>
          <div className="flex items-center justify-between gap-3 text-sm text-mute">
            <label htmlFor={ids.amount}>Amount</label>
            <span className="tabular-nums">
              Available {balance === null ? "-" : `${fmt(token, balance)} ${SYMBOL[token]}`}
              {balance !== null && Number(balance) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMax(true);
                    setAmount(balance);
                  }}
                  aria-pressed={max}
                  className="ml-2 font-semibold text-brand hover:underline"
                >
                  Max
                </button>
              )}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              id={ids.amount}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={max ? fmt(token, balance) : amount}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".");
                if (AMOUNT.test(v)) {
                  setMax(false);
                  setAmount(v);
                }
              }}
              aria-invalid={tooMuch || undefined}
              className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold tabular-nums outline-none focus-visible:outline-none placeholder:text-mute/50"
            />
            <span className="shrink-0 font-display text-xl font-bold text-mute">{SYMBOL[token]}</span>
          </div>
          {tooMuch && <p className="mt-2 text-sm font-medium text-danger">More than this wallet has.</p>}
          {max && token === "mon" && <p className="mt-2 text-sm text-mute">Max keeps back exactly the network fee.</p>}
        </div>

        <div className="mt-4 rounded-2xl bg-surface p-4 ring-brand focus-within:ring-2">
          <div className="flex items-center justify-between text-sm text-mute">
            <label htmlFor={ids.to}>To</label>
            <button type="button" onClick={paste} className="font-semibold text-brand hover:underline">
              Paste
            </button>
          </div>
          <textarea
            id={ids.to}
            rows={2}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            placeholder="0x… Monad address"
            value={to}
            onChange={(e) => setTo(e.target.value.replace(/\s/g, ""))}
            onBlur={() => setToTouched(true)}
            aria-invalid={(toTouched && !!toError) || undefined}
            aria-describedby={ids.toHelp}
            className="mt-2 block w-full resize-none bg-transparent font-mono text-[17px] leading-relaxed break-all outline-none focus-visible:outline-none placeholder:font-sans placeholder:text-mute/60"
          />
          <p id={ids.toHelp} className={`mt-1 text-sm ${toTouched && toError ? "font-medium text-danger" : "text-mute"}`}>
            {toTouched && toError ? toError : "A wallet on Monad. If it is an exchange, check that it accepts Monad deposits."}
          </p>
        </div>

        <Button type="submit" size="lg" className="mt-5 w-full" loading={prepare.isPending} disabled={!canReview && toTouched}>
          {prepare.isPending ? "Preparing" : "Review withdrawal"}
        </Button>
        {prepare.error && (
          <div className="mt-4">
            <Alert>{prepare.error.message}</Alert>
          </div>
        )}
      </form>
    </Panel>
  );
}

/** What the chain says happened. Status is plain text with a dot; every value can be checked on MonadScan. */
function Receipt({ result, onAgain }: { result: Done; onAgain: () => void }) {
  const ok = result.status === "success";
  return (
    <Panel className="mt-6">
      <div aria-live="polite" className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden className={`size-2 rounded-full ${ok ? "bg-brand" : "bg-danger"}`} />
            {ok ? "Confirmed on Monad" : "Did not go through"}
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.03em]">{ok ? "Withdrawal sent" : "Nothing was sent"}</h2>
        </div>
        <Mascot mood={ok ? "done" : "oops"} size={64} className="h-auto w-14 shrink-0" />
      </div>

      {ok ? (
        <div className="mt-4 flex items-center gap-3">
          <TokenIcon token={result.token} size={36} />
          <p className="font-display text-[40px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
            {result.amount ? fmt(result.token, result.amount) : "-"}
            <span className="ml-2 text-2xl text-mute">{SYMBOL[result.token]}</span>
          </p>
        </div>
      ) : (
        <p className="mt-2 leading-relaxed text-mute">The network refused it. Your {SYMBOL[result.token]} stayed in your wallet. Only the network fee was spent.</p>
      )}

      <dl className="mt-5 divide-y divide-line rounded-2xl border border-line">
        <div className="px-4 py-3">
          <dt className="text-sm text-mute">To</dt>
          <dd className="mt-1 break-all text-[15px] font-semibold leading-relaxed">
            <Address value={result.recipient} />
          </dd>
        </div>
        <Row label="Network">{activeChain.name}</Row>
        {result.fee && <Row label="Network fee">{formatMon(result.fee)} MON</Row>}
        <Row label="Transaction">
          <a href={explorer(`tx/${result.hash}`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-brand hover:underline">
            {result.hash.slice(0, 6)}…{result.hash.slice(-4)}
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
            <span className="sr-only">View on MonadScan</span>
          </a>
        </Row>
      </dl>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={onAgain}>
          {ok ? "Withdraw more" : "Try again"}
        </Button>
        <Link href="/profile" className={buttonClass("ghost", "lg")}>
          Back to Profile
        </Link>
      </div>
    </Panel>
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
