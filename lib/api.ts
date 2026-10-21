// Client-side fetch helper. Only ever calls our own /api routes.
export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Network error. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data);
  return data as T;
}

export type TierId = "holder" | "token" | "free";

export const TIER_NAME: Record<TierId, string> = {
  holder: "Genesis holder",
  token: "CHOG holder",
  free: "Free mode",
};

/** Whole-token CHOG amount for display, e.g. "12,500.5". */
export function formatChog(amount: string | null | undefined): string {
  const n = Number(amount ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) : "0";
}

/** MON amount for display, up to 4 decimals. */
export function formatMon(amount: string | null | undefined): string {
  const n = Number(amount ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n) : "0";
}

export type Me = {
  address: string;
  tier: TierId;
  label: string;
  quality: string;
  watermark: boolean;
  tokens: { tokenId: string; name: string; image: string; traits: { trait_type: string; value: string }[]; owner?: string }[];
  /** Sign-in address first, then linked wallets. */
  wallets: { address: string; chogs: number; holder: boolean; chogBalance: string }[];
  chog: { tracked: boolean; balance: string; min: string | null };
  /** MON in the sign-in wallet; null when it could not be read. */
  mon: { balance: string | null };
  /** True when this account can use the MON to CHOG swap. */
  swap: boolean;
  used: number;
  limit: number;
  mock: boolean;
};

type TierFact = { label: string; quality: string; watermark: boolean; limit: number };
export type TierFacts = {
  holder: TierFact;
  token: TierFact;
  free: TierFact;
  chogMin: string | null;
  clipSeconds: number | null;
  /** True when the MON to CHOG swap is open to everyone. */
  swap: boolean;
};

export type JobStatus = {
  id: string;
  status: "processing" | "succeeded" | "failed";
  error?: string;
  tier: TierId;
  watermark: boolean;
  prompt: string;
  videoUrl?: string;
};
