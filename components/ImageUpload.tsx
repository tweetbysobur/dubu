"use client";

import { useRef, useState } from "react";
import { Spinner } from "./ui";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1024;

/** Downscale on the client so the upload stays small. */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export function ImageUpload({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file?: File) {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Use a PNG, JPG or WebP image.");
    if (file.size > MAX_INPUT_BYTES) return setError("Image is over 10 MB.");
    setBusy(true);
    try {
      onChange(await toDataUrl(file));
    } catch {
      setError("Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handle(e.dataTransfer.files[0]);
        }}
        className="group relative grid aspect-square w-full max-w-60 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-ink text-sm text-mute hover:border-monad"
      >
        {busy ? (
          <Spinner />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Your upload" className="size-full object-cover" />
        ) : (
          <span className="px-4 text-center">
            Drop an image or <span className="text-monad-soft">browse</span>
            <br />
            <span className="text-xs">PNG, JPG, WebP</span>
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      {value && !busy && (
        <button type="button" onClick={() => onChange(null)} className="mt-2 text-xs text-mute hover:text-white">
          Remove image
        </button>
      )}
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
