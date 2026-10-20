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

export type Me = {
  address: string;
  tier: "holder" | "free";
  label: string;
  quality: string;
  watermark: boolean;
  tokens: { tokenId: string; name: string; image: string; traits: { trait_type: string; value: string }[] }[];
  used: number;
  limit: number;
  mock: boolean;
};

export type JobStatus = {
  id: string;
  status: "processing" | "succeeded" | "failed";
  error?: string;
  tier: "holder" | "free";
  watermark: boolean;
  prompt: string;
  videoUrl?: string;
};
