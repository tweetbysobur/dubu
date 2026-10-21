"use client";

import { useEffect, useState } from "react";
import { exportPasskeyWallet, passkeyErrorMessage, type WalletExport } from "@/lib/passkey";
import { Alert, Button, Panel, Spinner } from "./ui";

const AUTO_HIDE_MS = 2 * 60 * 1000;

/** Reveals the passkey wallet's recovery phrase after a fresh passkey check. Client only. */
export function ExportWallet({ address }: { address: string }) {
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WalletExport | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<"phrase" | "key" | null>(null);

  // Hide on its own after two minutes, and when leaving the page.
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => hide(), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [data]);
  useEffect(() => () => setData(null), []);

  function hide() {
    setData(null);
    setShowKey(false);
    setUnderstood(false);
    setCopied(null);
  }

  async function reveal() {
    setError(null);
    setBusy(true);
    try {
      setData(await exportPasskeyWallet(address));
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("That passkey") ? e.message : passkeyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "phrase" | "key", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard blocked: the words are on screen to write down.
    }
  }

  return (
    <Panel className="mt-6">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Export wallet</h2>
      <p className="mt-1 max-w-[36rem] text-sm leading-relaxed text-mute">
        Your passkey wallet comes from a 24-word recovery phrase. Import it into MetaMask, Rabby or any wallet that
        accepts a recovery phrase and the same address appears. Dubu never sees or stores it.
      </p>

      {!data ? (
        <div className="mt-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[#1F4FFF]"
            />
            <span>
              I understand that anyone with this phrase controls this wallet. I will write it down offline and never
              share it, not even with Dubu.
            </span>
          </label>
          <Button size="lg" className="mt-4 w-full sm:w-auto" disabled={!understood || busy} onClick={reveal}>
            {busy ? (
              <>
                <Spinner /> Confirm with your passkey
              </>
            ) : (
              "Show recovery phrase"
            )}
          </Button>
          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Recovery phrase">
            {data.phrase.map((word, i) => (
              <li key={i} className="flex items-baseline gap-2 rounded-xl border border-line px-3 py-2.5">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-mute">{i + 1}</span>
                <span className="font-medium">{word}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => copy("phrase", data.phrase.join(" "))}>
              {copied === "phrase" ? "Phrase copied" : "Copy phrase"}
            </Button>
            <Button variant="ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Hide private key" : "Show private key"}
            </Button>
            <Button onClick={hide}>Hide</Button>
          </div>

          {showKey && (
            <div className="mt-4 rounded-2xl bg-surface p-4">
              <p className="text-sm text-mute">Private key</p>
              <p className="mt-1 break-all font-medium tabular-nums">{data.privateKey}</p>
              <Button variant="ghost" className="mt-3" onClick={() => copy("key", data.privateKey)}>
                {copied === "key" ? "Key copied" : "Copy private key"}
              </Button>
            </div>
          )}

          <p className="mt-4 text-sm text-mute">This hides by itself in two minutes.</p>
        </div>
      )}
    </Panel>
  );
}
