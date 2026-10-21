"use client";

/**
 * Passkey wallet, built on Mera (@category-labs/mera, by Category Labs).
 *
 * Mera turns a passkey's PRF output into a standard EVM account: the PRF output
 * is the entropy of a BIP-39 phrase, and the key sits at m/44'/60'/0'/0/0, the
 * same path MetaMask uses. No backend, no API key, no custody. The key exists
 * only in this tab, only for as long as it takes to sign.
 *
 * Dubu signs two things with it: the sign-in message, and a MON to CHOG swap the
 * user reviews and confirms with a fresh passkey prompt.
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

const MEMORY_KEY = "dubu.passkeys";
const LEGACY_KEY = "dubu.passkey";
const MAX_REMEMBERED = 5;

/**
 * Public data only: a credential id and an address. Neither can sign anything,
 * so forgetting one never touches the passkey or the wallet. It only stops
 * this device from offering it first.
 */
export type PasskeyMemory = { credentialId: string; address: string; transports?: string[]; usedAt?: number };

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

function valid(m: PasskeyMemory) {
  return typeof m?.credentialId === "string" && /^0x[0-9a-fA-F]{40}$/.test(m.address);
}

/** Accounts this device has used, most recent first. */
export function rememberedPasskeys(): PasskeyMemory[] {
  try {
    const list = JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]") as PasskeyMemory[];
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const m = JSON.parse(legacy) as PasskeyMemory;
      if (valid(m) && !list.some((x) => x.credentialId === m.credentialId)) list.push(m);
      localStorage.removeItem(LEGACY_KEY);
      localStorage.setItem(MEMORY_KEY, JSON.stringify(list));
    }
    return list.filter(valid).sort((a, b) => (b.usedAt ?? 0) - (a.usedAt ?? 0));
  } catch {
    return [];
  }
}

export function rememberedPasskey(): PasskeyMemory | null {
  return rememberedPasskeys()[0] ?? null;
}

function remember(m: PasskeyMemory) {
  try {
    const rest = rememberedPasskeys().filter((x) => x.credentialId !== m.credentialId);
    localStorage.setItem(MEMORY_KEY, JSON.stringify([{ ...m, usedAt: Date.now() }, ...rest].slice(0, MAX_REMEMBERED)));
  } catch {
    // Private mode or blocked storage: sign-in still works, it just asks which passkey next time.
  }
}

/** The remembered entry for an address, so prompts ask for that account's passkey. */
export function memoryFor(address: string): PasskeyMemory | null {
  return rememberedPasskeys().find((m) => m.address.toLowerCase() === address.toLowerCase()) ?? null;
}

/** Removes one account (or all) from this device's list. The passkey and wallet are untouched. */
export function forgetPasskey(credentialId?: string) {
  try {
    const left = credentialId ? rememberedPasskeys().filter((x) => x.credentialId !== credentialId) : [];
    localStorage.setItem(MEMORY_KEY, JSON.stringify(left));
    localStorage.removeItem(LEGACY_KEY);
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
  // Mera gives every new passkey a fresh random user handle, so this adds an
  // account and never replaces one already on the device. The dated name tells
  // them apart in the device's passkey picker.
  const label = `Dubu wallet ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const result = await createPasskeyWithPrfOutput({
    rp: rp(),
    user: { name: label, displayName: label },
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
 * Opens an existing passkey wallet: the one given, else the last used. With
 * `anyPasskey`, the browser offers every Dubu passkey it knows, including ones
 * synced from another device.
 */
export async function openPasskeyWallet(anyPasskey = false, credentialId?: string): Promise<Unlocked> {
  const known = anyPasskey
    ? null
    : (credentialId ? rememberedPasskeys().find((m) => m.credentialId === credentialId) : null) ?? rememberedPasskey();
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

export type WalletExport = { phrase: string[]; privateKey: `0x${string}` };

/**
 * Re-derives the wallet's 24-word recovery phrase and private key for export.
 *
 * Always runs a fresh passkey prompt. Before returning anything it checks that
 * the phrase and the key both open `expected`, so a wrong passkey (or a bug) can
 * never show a phrase for a different wallet. Nothing is stored or sent anywhere.
 */
export async function exportPasskeyWallet(expected: string): Promise<WalletExport> {
  const [{ entropyToMnemonic }, { wordlist }, { mnemonicToAccount, privateKeyToAccount }] = await Promise.all([
    import("@scure/bip39"),
    import("@scure/bip39/wordlists/english"),
    import("viem/accounts"),
  ]);

  const known = memoryFor(expected) ?? rememberedPasskey();
  const result = await getPasskeyPrfOutput({
    rpId: rp().id,
    ...(known ? { credential: { credentialId: known.credentialId, transports: known.transports } } : {}),
  });
  const prf = result.prfOutput;
  try {
    const phrase = entropyToMnemonic(prf, wordlist);
    const keyBytes = deriveEvmPrivateKey({ prfOutput: prf, accountIndex: 0 });
    const privateKey = `0x${Array.from(keyBytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
    keyBytes.fill(0);

    const want = expected.toLowerCase();
    if (mnemonicToAccount(phrase).address.toLowerCase() !== want || privateKeyToAccount(privateKey).address.toLowerCase() !== want) {
      throw new Error("That passkey opens a different wallet. Use the passkey for this account. Nothing was shown.");
    }
    return { phrase: phrase.split(" "), privateKey };
  } finally {
    prf.fill(0);
  }
}

export type PasskeyTx = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  gas: bigint;
  nonce: number;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  chainId: number;
};

/**
 * Signs one transaction with the passkey wallet, after a fresh passkey prompt.
 * Refuses if the passkey opens a different wallet than `expected`. The key is
 * wiped as soon as the signature exists. Broadcasting is the server's job.
 */
export async function signWithPasskey(expected: string, tx: PasskeyTx): Promise<`0x${string}`> {
  const { account, end } = await openPasskeyWallet(false, memoryFor(expected)?.credentialId);
  try {
    if (account.address.toLowerCase() !== expected.toLowerCase()) {
      throw new Error("That passkey opens a different wallet. Use the passkey for this account. Nothing was signed.");
    }
    return await account.signTransaction({ ...tx, type: "eip1559" });
  } finally {
    end();
  }
}
