// Video model profiles. No imports, so any module can read them at load time.

/**
 * Model profiles. LTX-2.3 22B distilled follows prompts far better than the old
 * LTX-Video 13B setup, which ran at 1 step: too few for the model to act on the
 * prompt, so clips drifted away from what people asked for. Both run at the
 * steps their makers publish. Sizes come from the model's own preset list.
 */
export type Profile = { model: string; fps: number; frames: number; steps: number; guidance: string; sizes: { sharp: [number, number][]; standard: [number, number][] } };

export const LTX23: Profile = {
  model: "Ltx2_3_22B_Dist_INT8",
  fps: 24,
  frames: 121, // about 5 seconds
  steps: 8,
  guidance: "1",
  sizes: {
    sharp: [[1024, 1024], [1024, 576], [576, 1024], [1024, 768], [768, 1024]],
    standard: [[768, 768], [896, 512], [512, 896], [768, 576], [576, 768]],
  },
};

export const LTXV13: Profile = {
  model: "Ltxv_13B_0_9_8_Distilled_FP8",
  fps: 24,
  frames: 121,
  steps: 8,
  guidance: "1",
  sizes: {
    sharp: [[768, 768], [896, 512], [512, 896], [768, 576], [576, 768]],
    standard: [[512, 512], [640, 384], [384, 640], [576, 416], [416, 576]],
  },
};

/** VIDEO_MODEL picks the profile. The old DEAPI_MODEL/STEPS/FRAMES settings are no longer read. */
export function videoProfile(): Profile {
  const want = process.env.VIDEO_MODEL?.trim();
  return want === LTXV13.model ? LTXV13 : LTX23;
}

