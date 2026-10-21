"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { useSession } from "@/lib/useSession";
import { passkeySupported, rememberedPasskey } from "@/lib/passkey";
import { Alert, buttonClass, Spinner } from "./ui";

type Session = ReturnType<typeof useSession>;

function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Passkey first, wallet second. Browser-only facts are read after mount. */
export function SignIn({ session }: { session: Session }) {
  const { passkey, walletSignIn } = session;
  const [env, setEnv] = useState<{ supported: boolean; remembered: string | null } | null>(null);

  useEffect(() => {
    setEnv({ supported: passkeySupported(), remembered: rememberedPasskey()?.address ?? null });
  }, [passkey.isSuccess]);

  const busy = passkey.isPending;
  const error = passkey.error ?? walletSignIn.error;

  const walletButton = (variant: "primary" | "ghost") => (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <button
          type="button"
          onClick={openConnectModal}
          disabled={!mounted || busy}
          className={`${buttonClass(variant, "lg")} w-full sm:w-auto`}
        >
          Connect a wallet
        </button>
      )}
    </ConnectButton.Custom>
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {env?.supported !== false && (
          <button
            type="button"
            disabled={!env || busy}
            onClick={() => passkey.mutate(env?.remembered ? "open" : "create")}
            className={`${buttonClass("primary", "lg")} w-full sm:w-auto`}
          >
            {busy ? (
              <>
                <Spinner /> Waiting for your passkey
              </>
            ) : env?.remembered ? (
              <>Continue as {shortAddress(env.remembered)}</>
            ) : (
              "Continue with a passkey"
            )}
          </button>
        )}
        {walletButton(env?.supported === false ? "primary" : "ghost")}
      </div>

      {env?.supported !== false ? (
        <p className="mt-4 max-w-[34rem] text-sm leading-relaxed text-mute">
          A passkey makes a free Dubu wallet on this device with Face ID or your fingerprint. No app, no seed
          phrase, no gas. Hold a Chog? Connect the wallet it is in.
        </p>
      ) : (
        <p className="mt-4 max-w-[34rem] text-sm leading-relaxed text-mute">
          This browser cannot use passkeys. Connect a wallet to continue.
        </p>
      )}

      {env?.supported && (
        <button
          type="button"
          disabled={busy}
          onClick={() => passkey.mutate("open-any")}
          className="mt-2 inline-flex h-11 items-center text-sm font-semibold text-brand hover:text-brand-press"
        >
          {env.remembered ? "Use a different passkey" : "Already made a Dubu passkey? Use it"}
        </button>
      )}

      {error && (
        <div className="mt-3 max-w-[34rem]">
          <Alert>{error.message}</Alert>
        </div>
      )}
    </div>
  );
}
