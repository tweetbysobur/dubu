import {
  decodeFunctionData,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  parseAbi,
  parseEventLogs,
  parseTransaction,
  parseUnits,
  recoverTransactionAddress,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { activeChain } from "./chain";
import { client } from "./chog";
import { chogAddress, knownContracts } from "./swap";

/**
 * Withdraw: a plain transfer of MON or CHOG out of the signed-in wallet, nothing else.
 *
 * The server builds the transfer, the person signs it (passkey or their own wallet),
 * and before a signed transfer is broadcast the server decodes it again: the signer is
 * the signed-in wallet, it is either a bare MON send or CHOG `transfer`, and the
 * recipient is not blocked. Dubu never holds keys or funds.
 */

export class WithdrawError extends Error {}
export type WithdrawToken = "mon" | "chog";

const ERC20 = parseAbi([
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

/** On unless WITHDRAW_ENABLED=false: a kill switch, not a gate. People must be able to move their own funds out. */
export function withdrawOpen() {
  return process.env.WITHDRAW_ENABLED?.trim() !== "false";
}

export function chogWithdrawable() {
  return !!chogAddress();
}

let chogDecimals: number | null = null;
async function decimals() {
  if (chogDecimals === null) chogDecimals = Number(await client.readContract({ address: chogAddress()!, abi: ERC20, functionName: "decimals" }));
  return chogDecimals;
}

export function parseToken(raw: unknown): WithdrawToken {
  if (raw === "mon") return "mon";
  if (raw === "chog" && chogWithdrawable()) return "chog";
  throw new WithdrawError("Pick MON or CHOG.");
}

const AMOUNT = /^\d{1,12}(\.\d{1,18})?$/;

/** Hard blocks only. Each one would lose the funds or do nothing. */
export function checkRecipient(raw: unknown, from: string): Address {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!isAddress(v, { strict: false })) throw new WithdrawError("That is not a Monad address. It starts with 0x and has 42 characters.");
  const to = getAddress(v);
  const low = to.toLowerCase();
  if (low === zeroAddress) throw new WithdrawError("That address burns whatever is sent to it. Use a real wallet address.");
  if (low === from.toLowerCase()) throw new WithdrawError("That is this wallet. Send to a different address.");
  if (knownContracts().has(low)) throw new WithdrawError("That is a token or exchange contract. Funds sent there are lost. Use a wallet address.");
  return to;
}

export type UnsignedWithdraw = {
  to: Address;
  data: Hex;
  value: string;
  gas: string;
  nonce: number;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  chainId: number;
};

export type BuiltWithdraw = {
  token: WithdrawToken;
  /** Exactly what arrives, formatted. */
  amount: string;
  recipient: Address;
  /** True when the recipient is a contract: allowed, but worth a second look. */
  recipientIsContract: boolean;
  fee: string;
  tx: UnsignedWithdraw;
};

/**
 * Builds the transfer. `amount` "max" sends everything: all CHOG, or all MON minus the
 * network fee (Monad charges the full gas limit, so the fee is known up front).
 */
export async function buildWithdraw(from: Address, token: WithdrawToken, rawAmount: unknown, rawTo: unknown): Promise<BuiltWithdraw> {
  const recipient = checkRecipient(rawTo, from);
  const max = rawAmount === "max";
  if (!max && (typeof rawAmount !== "string" || !AMOUNT.test(rawAmount.trim()))) throw new WithdrawError("Enter an amount.");

  const chog = chogAddress();
  const [monBal, chogBal, d, fees, nonce, code] = await Promise.all([
    client.getBalance({ address: from }),
    token === "chog" ? client.readContract({ address: chog!, abi: ERC20, functionName: "balanceOf", args: [from] }) : 0n,
    token === "chog" ? decimals() : 18,
    client.estimateFeesPerGas(),
    client.getTransactionCount({ address: from, blockTag: "pending" }),
    client.getCode({ address: recipient }).catch(() => undefined),
  ]);
  const recipientIsContract = !!code && code !== "0x";

  let amount = max ? (token === "chog" ? chogBal : monBal) : parseUnits((rawAmount as string).trim(), d);
  if (amount <= 0n) throw new WithdrawError(max ? "Nothing to withdraw." : "Enter an amount above zero.");
  if (token === "chog" && amount > chogBal) throw new WithdrawError("This wallet does not have that much CHOG.");
  if (token === "mon" && amount > monBal) throw new WithdrawError("This wallet does not have that much MON.");

  const to = token === "mon" ? recipient : chog!;
  const dataFor = (a: bigint): Hex => (token === "mon" ? "0x" : encodeFunctionData({ abi: ERC20, functionName: "transfer", args: [recipient, a] }));

  let gas: bigint;
  try {
    // For Max on MON, estimate with a small amount: the real amount depends on the fee.
    const probe = token === "mon" && max ? 1n : amount;
    gas = await client.estimateGas({ account: from, to, data: dataFor(probe), value: token === "mon" ? probe : 0n });
  } catch (e) {
    console.error("[withdraw] simulation failed", e);
    throw new WithdrawError(
      recipientIsContract && token === "mon" ? "That contract does not accept MON. Use a wallet address." : "This transfer would fail right now. Try again.",
    );
  }
  if (gas > 21_000n) gas = (gas * 115n) / 100n; // a plain MON send to a wallet is exactly 21,000
  const fee = gas * fees.maxFeePerGas;

  if (token === "mon" && max) amount = monBal - fee;
  if (token === "mon" && amount <= 0n) throw new WithdrawError("Not enough MON to cover the network fee.");
  const needMon = (token === "mon" ? amount : 0n) + fee;
  if (monBal < needMon) {
    throw new WithdrawError(
      token === "mon" ? "Not enough MON for this amount plus the network fee. Use Max, or a smaller amount." : "Not enough MON for the network fee. Deposit a little MON first.",
    );
  }

  const tx: UnsignedWithdraw = {
    to,
    data: dataFor(amount),
    value: (token === "mon" ? amount : 0n).toString(),
    gas: gas.toString(),
    nonce,
    maxFeePerGas: fees.maxFeePerGas.toString(),
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    chainId: activeChain.id,
  };
  checkTransfer(tx.to, tx.data, from, BigInt(tx.value));
  return { token, amount: formatUnits(amount, d), recipient, recipientIsContract, fee: formatEther(fee), tx };
}

/** The guard on every signed withdrawal: a bare MON send or a CHOG transfer, to an allowed recipient. */
export function checkTransfer(to: string | null | undefined, data: Hex | undefined, from: string, value: bigint): { token: WithdrawToken; recipient: Address } {
  const bad = () => new WithdrawError("That is not a Dubu withdrawal.");
  if (!to) throw bad();
  const chog = chogAddress();
  if (chog && to.toLowerCase() === chog.toLowerCase()) {
    if (value !== 0n || !data) throw bad();
    try {
      const call = decodeFunctionData({ abi: ERC20, data });
      if (call.functionName !== "transfer" || call.args[1] <= 0n) throw bad();
      return { token: "chog", recipient: checkRecipient(call.args[0], from) };
    } catch (e) {
      if (e instanceof WithdrawError && e.message !== "That is not a Dubu withdrawal.") throw e;
      throw bad();
    }
  }
  if ((data && data !== "0x") || value <= 0n) throw bad();
  return { token: "mon", recipient: checkRecipient(to, from) };
}

export type WithdrawResult = {
  hash: Hex;
  /** "pending": sent, not confirmed yet. Ask again with the hash; never sign again. */
  status: "success" | "reverted" | "pending";
  token: WithdrawToken;
  recipient: Address;
  /** What arrived, read from the chain. */
  amount: string | null;
  fee: string | null;
};

async function settle(hash: Hex, from: string, token: WithdrawToken, recipient: Address, value: bigint): Promise<WithdrawResult> {
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash, timeout: 20_000, pollingInterval: 500 });
  } catch {
    return { hash, status: "pending", token, recipient, amount: null, fee: null };
  }
  const fee = receipt.effectiveGasPrice ? formatEther(receipt.gasUsed * receipt.effectiveGasPrice) : null;
  if (receipt.status !== "success") return { hash, status: "reverted", token, recipient, amount: null, fee };
  if (token === "mon") return { hash, status: "success", token, recipient, amount: formatEther(value), fee };
  const moved = parseEventLogs({ abi: ERC20, logs: receipt.logs, eventName: "Transfer" })
    .filter(
      (l) =>
        l.address.toLowerCase() === chogAddress()!.toLowerCase() &&
        l.args.from.toLowerCase() === from.toLowerCase() &&
        l.args.to.toLowerCase() === recipient.toLowerCase(),
    )
    .reduce((s, l) => s + l.args.value, 0n);
  return { hash, status: "success", token, recipient, amount: formatUnits(moved, await decimals()), fee };
}

/** Passkey path: the browser signed it, Dubu checks it, then broadcasts it once. */
export async function sendSignedWithdraw(raw: Hex, from: Address): Promise<WithdrawResult> {
  let tx: ReturnType<typeof parseTransaction>;
  let signer: Address;
  try {
    tx = parseTransaction(raw);
    signer = await recoverTransactionAddress({ serializedTransaction: raw as Parameters<typeof recoverTransactionAddress>[0]["serializedTransaction"] });
  } catch {
    throw new WithdrawError("That signed withdrawal could not be read.");
  }
  if (signer.toLowerCase() !== from.toLowerCase()) throw new WithdrawError("That withdrawal was signed by a different wallet.");
  if (tx.chainId !== activeChain.id) throw new WithdrawError("That withdrawal is for a different network.");
  const { token, recipient } = checkTransfer(tx.to, tx.data, from, tx.value ?? 0n);

  // A signed transaction's hash is fixed, so the same withdrawal sent twice is one withdrawal.
  const hash = keccak256(raw);
  try {
    await client.sendRawTransaction({ serializedTransaction: raw });
  } catch (e) {
    const known = await client.getTransaction({ hash }).catch(() => null);
    if (!known) {
      console.error("[withdraw] broadcast failed", e);
      throw new WithdrawError("Monad did not accept the withdrawal. Nothing was sent. Try again.");
    }
  }
  return settle(hash, from, token, recipient, tx.value ?? 0n);
}

/** External wallet path, or following a sent withdrawal: read it back and confirm it. */
export async function trackWithdraw(hash: Hex, from: Address): Promise<WithdrawResult | { hash: Hex; status: "pending" }> {
  const tx = await client.getTransaction({ hash }).catch(() => null);
  if (!tx) return { hash, status: "pending" };
  if (tx.from.toLowerCase() !== from.toLowerCase()) throw new WithdrawError("That transaction is from a different wallet.");
  const { token, recipient } = checkTransfer(tx.to, tx.input, from, tx.value);
  return settle(hash, from, token, recipient, tx.value);
}
