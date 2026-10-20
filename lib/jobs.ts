import type { Tier } from "./tiers";

export type Job = { id: string; address: string; tier: Tier; prompt: string; createdAt: number };

// In-memory job registry: links a provider job to the wallet that made it.
const g = globalThis as unknown as { __dubuJobs?: Map<string, Job> };
const jobs = (g.__dubuJobs ??= new Map<string, Job>());

export function saveJob(job: Job) {
  jobs.set(job.id, job);
}

export function getJob(id: string) {
  return jobs.get(id);
}
