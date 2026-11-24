"use client";

import { useEffect, useState } from "react";
import { GIF_TOO_LARGE, GIF_UNSUPPORTED, toEmojiImage, readSoundDuration } from "@/lib/imageProcess";
import {
  EMOJI_IMAGE_ACCEPT,
  EMOJI_IMAGE_MAX_BYTES,
  EMOJI_IMAGE_MAX_SIDE,
  EMOJI_SOUND_ACCEPT,
  EMOJI_SOUND_MAX_BYTES,
  EMOJI_SOUND_RECOMMENDED_SECONDS,
  EMOJI_SOUND_TIP,
} from "@/lib/emojiLimits";

export const emojiInputCls =
  "w-full rounded-2xl bg-bg-end px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-accent-to";
const fileCls =
  "block w-full text-xs text-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-bg-end file:px-3 file:py-2 file:text-xs file:font-bold file:text-ink";

const kb = (n: number) => `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;

interface ImageState {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}
interface SoundState {
  file: File;
  url: string;
  duration: number;
}

/**
 * Pemilih gambar + suara emoji (dipakai form admin dan form usulan pemain).
 * Gambar otomatis diperkecil; suara dicek ukuran & bisa diputar. Render `fields` di dalam form;
 * `fileError` = galat pemilihan file; `reset()` mengosongkan pilihan setelah sukses.
 */
export function useEmojiFiles() {
  const [image, setImage] = useState<ImageState | null>(null);
  const [sound, setSound] = useState<SoundState | null>(null);
  const [fileKey, setFileKey] = useState(0); // mengosongkan <input type=file>
  const [fileError, setFileError] = useState<string | null>(null);

  // Lepas object URL saat berganti / tertutup.
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url);
    };
  }, [image]);
  useEffect(() => {
    return () => {
      if (sound) URL.revokeObjectURL(sound.url);
    };
  }, [sound]);

  async function onImage(f: File | undefined) {
    setImage(null);
    setFileError(null);
    if (!f) return;
    try {
      const r = await toEmojiImage(f, EMOJI_IMAGE_MAX_SIDE, EMOJI_IMAGE_MAX_BYTES);
      setImage({ blob: r.blob, url: URL.createObjectURL(r.blob), width: r.width, height: r.height });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setFileError(
        code === GIF_TOO_LARGE
          ? `GIF ${kb(f.size)} masih lebih dari ${kb(EMOJI_IMAGE_MAX_BYTES)} setelah dikecilkan otomatis. Coba GIF yang lebih pendek (mis. potong di ezgif.com), lalu unggah lagi.`
          : code === GIF_UNSUPPORTED
            ? `Browser ini belum bisa mengubah GIF animasi jadi WebP. Coba Chrome/Edge/Safari versi terbaru, atau unggah GIF di bawah ${kb(EMOJI_IMAGE_MAX_BYTES)}.`
            : "Gambar tidak bisa dibaca atau terlalu rumit. Coba gambar lain."
      );
    }
  }

  async function onSound(f: File | undefined) {
    setSound(null);
    setFileError(null);
    if (!f) return;
    if (f.size > EMOJI_SOUND_MAX_BYTES) {
      setFileError(`Suara ${kb(f.size)} melebihi batas ${kb(EMOJI_SOUND_MAX_BYTES)}. ${EMOJI_SOUND_TIP}`);
      return;
    }
    const url = URL.createObjectURL(f);
    const duration = await readSoundDuration(url);
    if (duration === null) {
      URL.revokeObjectURL(url);
      setFileError("Browser ini tidak bisa memutar file suara itu. Coba format MP3.");
      return;
    }
    setSound({ file: f, url, duration });
  }

  function reset() {
    setImage(null);
    setSound(null);
    setFileKey((k) => k + 1);
  }

  const fields = (
    <>
      <div>
        <span className="mb-1 block text-xs font-bold text-ink">Gambar</span>
        <input
          key={`img-${fileKey}`}
          type="file"
          accept={EMOJI_IMAGE_ACCEPT}
          onChange={(e) => onImage(e.target.files?.[0])}
          className={fileCls}
          aria-label="File gambar"
        />
        <p className="mt-1 text-[11px] text-ink-soft">
          PNG/WebP/JPEG/GIF, otomatis diperkecil (maks {EMOJI_IMAGE_MAX_SIDE}px, latar transparan tetap). GIF
          animasi yang lebih dari {kb(EMOJI_IMAGE_MAX_BYTES)} dikecilkan dan diubah jadi WebP animasi di browser,
          jadi tetap bergerak dan tetap muat diunggah.
        </p>
        {image && (
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-bg-end/60 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="Pratinjau gambar" className="h-16 w-16 object-contain" />
            <span className="text-[11px] font-semibold text-ink-soft">
              {image.width}×{image.height}px · {kb(image.blob.size)}
            </span>
          </div>
        )}
      </div>

      <div>
        <span className="mb-1 block text-xs font-bold text-ink">Suara</span>
        <input
          key={`snd-${fileKey}`}
          type="file"
          accept={EMOJI_SOUND_ACCEPT}
          onChange={(e) => onSound(e.target.files?.[0])}
          className={fileCls}
          aria-label="File suara"
        />
        <p className="mt-1 text-[11px] text-ink-soft">{EMOJI_SOUND_TIP}</p>
        {sound && (
          <div className="mt-2 rounded-2xl bg-bg-end/60 p-2">
            <audio src={sound.url} controls className="h-9 w-full" />
            <p className="mt-1 text-[11px] font-semibold text-ink-soft">
              {sound.file.name} · {kb(sound.file.size)} · {sound.duration.toFixed(1)} dtk
              {sound.duration > EMOJI_SOUND_RECOMMENDED_SECONDS && (
                <span className="text-coral-text"> · lebih panjang dari {EMOJI_SOUND_RECOMMENDED_SECONDS} dtk</span>
              )}
            </p>
          </div>
        )}
      </div>
    </>
  );

  return { image, sound, fields, fileError, reset };
}
