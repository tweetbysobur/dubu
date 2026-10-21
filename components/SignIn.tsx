"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { markWalletSignInIntent, type useSession } from "@/lib/useSession";
import { forgetPasskey, passkeySupported, rememberedPasskeys, type PasskeyMemory } from "@/lib/passkey";
import { Alert, buttonClass, Spinner } from "./ui";

type Session = ReturnType<typeof useSession>;

function shortAddress(a: string) {
  const l = a.toLowerCase();
  return `${l.slice(0, 6)}…${l.slice(-4)}`;
}

const link = "inline-flex h-11 items-center text-sm font-semibold text-brand hover:text-brand-press disabled:text-mute";

/**
 * Passkey first, wallet second. Browser-only facts are read after mount.
 *
 * A device can hold several Dubu accounts. Switching or adding one never
 * changes another: a new account is a new passkey with its own wallet, and
 * "Forget" only removes this device's shortcut (a public credential id and
 * address), never the passkey or the wallet.
 */
export function SignIn({ session }: { session: Session }) {
  const { passkey, walletSignIn } = session;
  const { isConnected } = useAccount();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<PasskeyMemory[]>([]);
  const [switching, setSwitching] = useState(false);
  const [confirmForget, setConfirmForget] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  const refresh = () => setAccounts(rememberedPasskeys());
  useEffect(() => {
    setSupported(passkeySupported());
    refresh();
  }, [passkey.isSuccess]);

  // Arriving from "Switch account": open the list straight away.
  useEffect(() => {
    if (window.location.hash === "#sign-in" && rememberedPasskeys().length > 0) setSwitching(true);
  }, []);

  const busy = passkey.isPending;
  const error = passkey.error ?? walletSignIn.error;
  const current = accounts[0] ?? null;

  const walletButton = (variant: "primary" | "ghost") => (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <button
          type="button"
          onClick={() => {
            markWalletSignInIntent();
            // Already connected (for example from linking earlier): go straight to the signature.
            if (isConnected) walletSignIn.mutate();
            else openConnectModal();
          }}
          disabled={!mounted || busy}
          className={`${buttonClass(variant, "lg")} w-full sm:w-auto`}
        >
          Connect a wallet
        </button>
      )}
    </ConnectButton.Custom>
  );

  function forget(id: string) {
    forgetPasskey(id);
    setConfirmForget(null);
    refresh();
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {supported !== false && (
          <button
            type="button"
            disabled={supported === null || busy}
            onClick={() => passkey.mutate(current ? { credentialId: current.credentialId } : "create")}
            className={`${buttonClass("primary", "lg")} w-full sm:w-auto`}
          >
            {busy ? (
              <>
                <Spinner /> Waiting for your passkey
              </>
            ) : current ? (
              <>Continue as {shortAddress(current.address)}</>
            ) : (
              "Continue with a passkey"
            )}
          </button>
        )}
        {walletButton(supported === false ? "primary" : "ghost")}
      </div>

      {supported === false ? (
        <p className="mt-4 max-w-[34rem] text-sm leading-relaxed text-mute">This browser cannot use passkeys. Connect a wallet to continue.</p>
      ) : current ? (
        <div className="mt-2">
          <button
            type="button"
            className={link}
            aria-expanded={switching}
            aria-controls="passkey-accounts"
            onClick={() => {
              setSwitching((v) => !v);
              setConfirmForget(null);
              setConfirmNew(false);
            }}
          >
            {switching ? "Hide accounts" : "Switch account"}
          </button>

          {switching && (
            <div id="passkey-accounts" className="mt-1 max-w-[30rem] rounded-2xl border border-line bg-white p-2">
              <p className="px-2 pb-1 pt-1.5 text-sm text-mute">On this device</p>
              <ul>
                {accounts.map((a, i) => (
                  <li key={a.credentialId} className="rounded-xl px-2 py-2">
                    {confirmForget === a.credentialId ? (
                      <div>
                        <p className="text-sm leading-relaxed">
                          Remove <span className="font-semibold tabular-nums">{shortAddress(a.address)}</span> from this
                          device? The wallet and its passkey stay safe. Sign back in any time with “Use another passkey”.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => forget(a.credentialId)} className={buttonClass("ghost")}>
                            Remove from device
                          </button>
                          <button type="button" onClick={() => setConfirmForget(null)} className={buttonClass("ghost")}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => passkey.mutate({ credentialId: a.credentialId })}
                          className="flex min-h-11 flex-1 items-center gap-3 rounded-xl px-1 text-left hover:text-brand"
                        >
                          <span className="font-semibold tabular-nums">{shortAddress(a.address)}</span>
                          {i === 0 && <span className="text-sm text-mute">Last used</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmForget(a.credentialId)}
                          className="h-11 rounded-xl px-3 text-sm font-semibold text-mute hover:bg-surface hover:text-ink"
                          aria-label={`Remove ${shortAddress(a.address)} from this device`}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-1 border-t border-line px-2 pt-2">
                <button type="button" disabled={busy} onClick={() => passkey.mutate("open-any")} className={`${link} w-full`}>
                  Use another passkey
                </button>
                {confirmNew ? (
                  <div className="pb-2">
                    <p className="text-sm leading-relaxed text-mute">
                      This makes a new passkey with its own wallet. Your other accounts are not changed or replaced.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy} onClick={() => passkey.mutate("create")} className={buttonClass("primary")}>
                        Create new account
                      </button>
                      <button type="button" onClick={() => setConfirmNew(false)} className={buttonClass("ghost")}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" disabled={busy} onClick={() => setConfirmNew(true)} className={`${link} w-full`}>
                    Create a new account
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="mt-4 max-w-[34rem] text-sm leading-relaxed text-mute">
            A passkey makes a free Dubu wallet on this device with Face ID or your fingerprint. No app, no seed phrase, no
            gas. Hold a Chog? Connect the wallet it is in.
          </p>
          {supported && (
            <button type="button" disabled={busy} onClick={() => passkey.mutate("open-any")} className={`${link} mt-2`}>
              Already made a Dubu passkey? Use it
            </button>
          )}
        </>
      )}

      {error && (
        <div className="mt-3 max-w-[34rem]">
          <Alert>{error.message}</Alert>
        </div>
      )}
    </div>
  );
}
