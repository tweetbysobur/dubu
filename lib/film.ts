import type { ChogToken } from "./chog";
import { direct, expandPrompt } from "./director";
import type { Job } from "./jobs";
import { refundUse } from "./limits";
import { setOnce } from "./store";
import { claimFilming, fetchStagedImage, loadContext, readFilmed, readStage, writeFilmed } from "./stage";
import { createVideo, getVideo, type VideoStatus } from "./video";

/**
 * Where any job stands, staged or not, in one shape for the status and download routes.
 * For a staged job, the first check that finds the scene ready films it (once).
 */
export type Progress = VideoStatus & {
  phase: "staging" | "filming" | "done" | "failed";
  /** The provider's video job, once there is one. */
  videoId?: string;
  shot?: string | null;
  /** The staged frame's URL at the provider (served to the browser through our own route). */
  scene?: string;
};

export function isStaged(job: Job) {
  return job.id.startsWith("stage:");
}

/** A job still running after this long is reported as failed, so no page waits forever. */
const GIVE_UP_MS = 15 * 60 * 1000;

export async function progress(job: Job): Promise<Progress> {
  const p = await progressRaw(job);
  if (p.status === "processing" && Date.now() - job.createdAt > GIVE_UP_MS) {
    // Only the first check gives the video back.
    if (await setOnce(`dubu:giveup:${job.id}`, "1", 2 * 24 * 60 * 60).catch(() => false)) await refundUse(job.address).catch(() => {});
    return { ...p, status: "failed", phase: "failed", error: "This video took too long, so Dubu stopped waiting. Try again. This one did not count." };
  }
  return p;
}

async function progressRaw(job: Job): Promise<Progress> {
  if (!isStaged(job)) {
    const v = await getVideo(job.id);
    return { ...v, phase: v.status === "processing" ? "filming" : v.status === "succeeded" ? "done" : "failed", videoId: job.id };
  }

  const editId = job.id.slice("stage:".length);
  const filmed = await readFilmed(editId);
  if (filmed && "failed" in filmed) return { status: "failed", error: filmed.failed, phase: "failed", scene: filmed.scene };
  if (filmed) {
    const v = await getVideo(filmed.video);
    return {
      ...v,
      phase: v.status === "processing" ? "filming" : v.status === "succeeded" ? "done" : "failed",
      videoId: filmed.video,
      shot: filmed.shot,
      scene: filmed.scene,
    };
  }

  const stage = await readStage(editId);
  if (stage.status === "processing") return { status: "processing", phase: "staging" };
  if (stage.status === "failed") {
    // Nothing was filmed, so the video goes back. Only the first check refunds.
    if (await claimFilming(editId)) {
      await refundUse(job.address).catch(() => {});
      await writeFilmed(editId, { failed: "Dubu could not set up that scene. Try again, or describe a simpler action. This one did not count." });
    }
    return { status: "failed", error: "Dubu could not set up that scene. Try again, or describe a simpler action. This one did not count.", phase: "failed" };
  }

  // The scene is ready. Exactly one check films it; the rest wait for the stored video id.
  if (!(await claimFilming(editId))) return { status: "processing", phase: "filming", scene: stage.url };
  try {
    const ctx = await loadContext(editId);
    const raw = await fetchStagedImage(stage.url);
    const { default: sharp } = await import("sharp"); // only loaded when staging actually runs
    const jpg = await sharp(raw).jpeg({ quality: 92 }).toBuffer();
    const image = `data:image/jpeg;base64,${jpg.toString("base64")}`;
    const chog = (ctx?.chog ?? null) as ChogToken | null;
    const idea = ctx?.idea ?? job.prompt;
    let shot: string | null = null;
    let prompt = expandPrompt(idea, chog);
    if (ctx?.direct !== false) {
      const d = await direct({ prompt: idea, image, tier: job.tier, chog });
      if (d.kind === "shot") {
        shot = d.shot;
        prompt = d.shot;
      }
    }
    const video = await createVideo({ tier: job.tier, image, prompt });
    await writeFilmed(editId, { video, shot, scene: stage.url });
    return { status: "processing", phase: "filming", videoId: video, shot, scene: stage.url };
  } catch (e) {
    console.error("[film] could not film the staged scene", e);
    await refundUse(job.address).catch(() => {});
    const msg = "Dubu set up the scene but could not start filming. Try again. This one did not count.";
    await writeFilmed(editId, { failed: msg, scene: stage.url });
    return { status: "failed", error: msg, phase: "failed", scene: stage.url };
  }
}
