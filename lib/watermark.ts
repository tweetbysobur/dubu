"use client";

/**
 * Re-encodes a video in the browser with a burned-in watermark. Records WebM where the
 * browser can, and MP4 where it cannot (iPhone and iPad Safari only record MP4).
 */
export async function burnWatermark(src: Blob, text = "Made with Dubu"): Promise<{ blob: Blob; ext: "webm" | "mp4" }> {
  if (typeof MediaRecorder === "undefined") throw new Error("This browser cannot add the watermark. Try Safari or Chrome.");
  const mime = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error("This browser cannot add the watermark. Try Safari or Chrome.");
  const type = mime.startsWith("video/mp4") ? "video/mp4" : "video/webm";

  const url = URL.createObjectURL(src);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((ok, bad) => {
    video.onloadedmetadata = () => ok();
    video.onerror = () => bad(new Error("Could not read the video."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  const fontSize = Math.max(14, Math.round(canvas.height * 0.045));

  const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((ok) => (recorder.onstop = () => ok(new Blob(chunks, { type }))));

  const draw = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(text, canvas.width - fontSize + 2, canvas.height - fontSize + 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(text, canvas.width - fontSize, canvas.height - fontSize);
    if (!video.ended) requestAnimationFrame(draw);
  };

  recorder.start(250);
  await video.play();
  draw();
  // Some phones never fire "ended" for an off-screen video: stop at its length plus a margin.
  const limitMs = (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10) * 1000 + 3000;
  await new Promise<void>((ok) => {
    video.onended = () => ok();
    setTimeout(ok, limitMs);
  });
  recorder.stop();
  const out = await done;
  URL.revokeObjectURL(url);
  return { blob: out, ext: type === "video/mp4" ? "mp4" : "webm" };
}

/**
 * Phones save media through the share sheet ("Save Video", "Save Image"). It must open
 * inside a tap, so on phones the file is prepared first and saved on a second tap.
 */
export function needsShareSheet(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  try {
    return touch && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Call from a tap. Opens the share sheet, or falls back to a plain download. */
export async function shareOrSave(file: File) {
  try {
    await navigator.share({ files: [file] });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return; // the person closed the sheet
    saveBlob(file, file.name);
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
