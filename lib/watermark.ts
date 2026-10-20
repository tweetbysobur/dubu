"use client";

/** Re-encodes a video in the browser with a burned-in watermark. Returns a WebM blob. */
export async function burnWatermark(src: Blob, text = "Made with Dubu"): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") throw new Error("Your browser cannot export video. Try Chrome or Firefox.");
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  if (!mime) throw new Error("Your browser cannot export WebM video. Try Chrome or Firefox.");

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
  const done = new Promise<Blob>((ok) => (recorder.onstop = () => ok(new Blob(chunks, { type: "video/webm" }))));

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
  await new Promise<void>((ok) => (video.onended = () => ok()));
  recorder.stop();
  const out = await done;
  URL.revokeObjectURL(url);
  return out;
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
