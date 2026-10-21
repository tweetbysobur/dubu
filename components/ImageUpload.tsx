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
        aria-label={value ? "Replace image" : "Add an image"}
        className={`group relative grid aspect-[4/3] w-full place-items-center sm:aspect-square overflow-hidden rounded-2xl text-mute transition-colors ${
          value ? "bg-surface" : "border-2 border-dashed border-line bg-surface hover:border-brand hover:bg-wash"
        }`}
      >
        {busy ? (
          <Spinner className="text-brand" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Your upload" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-3 px-6 text-center">
            <svg aria-hidden width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1F4FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="9" cy="9" r="1.8" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-base font-semibold text-ink">Add an image</span>
            <span className="text-sm">Tap to choose, or drop a file here. PNG, JPG or WebP, up to 10 MB.</span>
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
        <div className="mt-3 flex gap-4 text-sm font-medium">
          <button type="button" onClick={() => input.current?.click()} className="text-brand hover:text-brand-press">
            Replace image
          </button>
          <button type="button" onClick={() => onChange(null)} className="text-mute hover:text-ink">
            Remove
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
