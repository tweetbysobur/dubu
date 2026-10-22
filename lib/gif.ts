"use client";

import { applyPalette, GIFEncoder, quantize } from "gifenc";

/**
 * Turns the finished video into a looping GIF in the browser: 12 frames a
 * second, up to 480 px wide, one shared palette so colors do not flicker.
 * Watermarked tiers get the same "Made with Dubu" mark as the video download.
 */
export async function videoToGif(src: Blob, opts: { watermark?: string; fps?: number; maxWidth?: number } = {}): Promise<Blob> {
  const fps = opts.fps ?? 12;
  const url = URL.createObjectURL(src);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise<void>((ok, bad) => {
      const t = setTimeout(() => bad(new Error("This browser could not open the video to make a GIF.")), 15_000);
      video.onloadeddata = () => (clearTimeout(t), ok());
      video.onerror = () => (clearTimeout(t), bad(new Error("This browser could not open the video to make a GIF.")));
    });

    const scale = Math.min(1, (opts.maxWidth ?? 480) / video.videoWidth);
    const w = Math.max(2, Math.round(video.videoWidth * scale));
    const h = Math.max(2, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const fontSize = Math.max(11, Math.round(h * 0.045));

    const seek = (t: number) =>
      new Promise<void>((ok, bad) => {
        const timer = setTimeout(() => bad(new Error("Making the GIF took too long. Try again.")), 8_000);
        video.onseeked = () => (clearTimeout(timer), ok());
        video.currentTime = t;
      });

    const duration = Number.isFinite(video.duration) ? video.duration : 5;
    const count = Math.max(1, Math.floor(duration * fps));
    const frames: Uint8ClampedArray[] = [];
    for (let i = 0; i < count; i++) {
      await seek(Math.min(duration - 0.001, i / fps));
      ctx.drawImage(video, 0, 0, w, h);
      if (opts.watermark) {
        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillText(opts.watermark, w - fontSize + 1, h - fontSize + 1);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(opts.watermark, w - fontSize, h - fontSize);
      }
      frames.push(ctx.getImageData(0, 0, w, h).data);
    }

    // One palette from a sample of frames keeps colors steady across the loop.
    const step = Math.max(1, Math.floor(frames.length / 6));
    const sample = new Uint8ClampedArray(w * h * 4 * Math.ceil(frames.length / step));
    let o = 0;
    for (let i = 0; i < frames.length; i += step) {
      sample.set(frames[i], o);
      o += frames[i].length;
    }
    const palette = quantize(sample.subarray(0, o), 256);

    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    for (const f of frames) gif.writeFrame(applyPalette(f, palette), w, h, { palette, delay });
    gif.finish();
    return new Blob([new Uint8Array(gif.bytes())], { type: "image/gif" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
