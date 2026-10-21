import { claim, readString, remove, setAdd, setMembers, setRemove } from "./store";

// A Dubu account (the address it signed in with) can link up to MAX_LINKED other
// wallets. Each linked wallet belongs to one account at a time, so one Chog holder
// cannot hand holder mode to an unlimited number of free accounts.
export const MAX_LINKED = 3;

const linksKey = (account: string) => `dubu:links:${account.toLowerCase()}`;
const ownerKey = (wallet: string) => `dubu:linked-to:${wallet.toLowerCase()}`;

export async function getLinked(account: string): Promise<string[]> {
  return (await setMembers(linksKey(account))).map((a) => a.toLowerCase()).sort();
}

/** Every address that counts for this account: the sign-in address first, then linked ones. */
export async function accountAddresses(account: string): Promise<string[]> {
  return [account.toLowerCase(), ...(await getLinked(account))];
}

export type LinkResult = { ok: true } | { ok: false; status: number; error: string };

export async function linkWallet(account: string, wallet: string): Promise<LinkResult> {
  const a = account.toLowerCase();
  const w = wallet.toLowerCase();
  if (a === w) return { ok: false, status: 400, error: "That is the wallet you signed in with." };

  const linked = await getLinked(a);
  if (linked.includes(w)) return { ok: true };
  if (linked.length >= MAX_LINKED) {
    return { ok: false, status: 400, error: `You can link up to ${MAX_LINKED} wallets. Unlink one first.` };
  }

  // Claim the wallet for this account. Fails if another account already holds it.
  if (!(await claim(ownerKey(w), a))) {
    const owner = await readString(ownerKey(w));
    if (owner !== a) {
      return {
        ok: false,
        status: 409,
        error: "This wallet is linked to another Dubu account. Unlink it there first.",
      };
    }
  }
  await setAdd(linksKey(a), w);
  return { ok: true };
}

export async function unlinkWallet(account: string, wallet: string): Promise<void> {
  const a = account.toLowerCase();
  const w = wallet.toLowerCase();
  await setRemove(linksKey(a), w);
  if ((await readString(ownerKey(w))) === a) await remove(ownerKey(w));
}
