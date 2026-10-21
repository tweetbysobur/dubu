"use client";

/**
 * Passkey wallet, built on Mera (@category-labs/mera, by Category Labs).
 *
 * Mera turns a passkey's PRF output into a standard EVM account: the PRF output
 * is the entropy of a BIP-39 phrase, and the key sits at m/44'/60'/0'/0/0, the
 * same path MetaMask uses. No backend, no API key, no custody. The key exists
 * only in this tab, only for as long as it takes to sign the login message.
 *
 * Dubu only ever signs one thing with it: the sign-in message. No transactions.
 *
 * Passkeys are bound to the relying party ID, which is this site's hostname.
 * Moving Dubu to another domain means passkeys from the old one stop working
 * there, so the rpId must stay stable.
 */
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  deriveEvmPrivateKey,
  getPasskeyPrfOutput,
  MeraError,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import type { LocalAccount } from "viem";

const MEMORY_KEY = "dubu.passkey";

/** Public data only: a credential id and an address. Neither can sign anything. */
type PasskeyMemory = { credentialId: string; address: string; transports?: string[] };

export function passkeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator?.credentials?.get === "function"
  );
}

function rp() {
  return { id: window.location.hostname, name: "Dubu" };
}

export function rememberedPasskey(): PasskeyMemory | null {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as PasskeyMemory;
    return typeof m.credentialId === "string" && /^0x[0-9a-fA-F]{40}$/.test(m.address) ? m : null;
  } catch {
    return null;
  }
}

function remember(m: PasskeyMemory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch {
    // Private mode or blocked storage: sign-in still works, it just asks which passkey next time.
  }
}

export function forgetPasskey() {
  try {
    localStorage.removeItem(MEMORY_KEY);
  } catch {
    // nothing to clear
  }
}

type Unlocked = { account: LocalAccount; end: () => void };

function unlock(prfOutput: Uint8Array): Unlocked {
  const privateKey = deriveEvmPrivateKey({ prfOutput, accountIndex: 0 });
  // The session copies the key, so both buffers can be wiped right away.
  const session = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0);
  prfOutput.fill(0);
  return { account: toViemAccount(session), end: () => session.end() };
}

/** Creates a new passkey on this device and the wallet it derives. */
export async function createPasskeyWallet(): Promise<Unlocked> {
  const result = await createPasskeyWithPrfOutput({
    rp: rp(),
    user: { name: "Dubu wallet", displayName: "Dubu wallet" },
  });
  const unlocked = unlock(result.prfOutput);
  remember({
    credentialId: result.credentialId,
    address: unlocked.account.address,
    ...(result.transports ? { transports: [...result.transports] } : {}),
  });
  return unlocked;
}

/**
 * Opens an existing passkey wallet. With `anyPasskey`, the browser offers every
 * Dubu passkey it knows, including ones synced from another device.
 */
export async function openPasskeyWallet(anyPasskey = false): Promise<Unlocked> {
  const known = anyPasskey ? null : rememberedPasskey();
  const result = await getPasskeyPrfOutput({
    rpId: rp().id,
    ...(known ? { credential: { credentialId: known.credentialId, transports: known.transports } } : {}),
  });
  const unlocked = unlock(result.prfOutput);
  remember({
    credentialId: result.credentialId,
    address: unlocked.account.address,
    ...(known?.transports && known.credentialId === result.credentialId ? { transports: known.transports } : {}),
  });
  return unlocked;
}

/** Plain-language messages for what can go wrong at the passkey prompt. */
export function passkeyErrorMessage(e: unknown): string {
  if (e instanceof MeraError) {
    switch (e.code) {
      case "PASSKEY_CANCELLED":
        return "Passkey sign-in was cancelled. Try again when you are ready.";
      case "PRF_UNAVAILABLE":
        return "This device's passkeys cannot hold a wallet yet. Try another phone or browser, or connect a wallet instead.";
      case "CRYPTO_UNAVAILABLE":
        return "This browser is missing secure crypto support. Update it, or connect a wallet instead.";
      case "PASSKEY_OPERATION_FAILED":
        return "The passkey prompt did not finish. Try again, or connect a wallet instead.";
      default:
        return e.message;
    }
  }
  return e instanceof Error ? e.message : "Passkey sign-in failed.";
}
