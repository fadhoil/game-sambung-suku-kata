"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminListEmojis,
  adminSetEmojiActive,
  createEmoji,
  CreateEmojiError,
  emojiAssetUrl,
  type AdminEmoji,
} from "@/lib/gameActions";
import { toEmojiImage, readSoundDuration } from "@/lib/imageProcess";
import { playEmojiSound, useEmojiBubbles } from "@/components/EmojiBubbles";
import {
  EMOJI_IMAGE_ACCEPT,
  EMOJI_IMAGE_MAX_BYTES,
  EMOJI_IMAGE_MAX_SIDE,
  EMOJI_NAME_MAX,
  EMOJI_PRICE_MAX,
  EMOJI_SOUND_ACCEPT,
  EMOJI_SOUND_MAX_BYTES,
  EMOJI_SOUND_RECOMMENDED_SECONDS,
  EMOJI_SOUND_TIP,
} from "@/lib/emojiLimits";

const MSG: Record<string, string> = {
  BAD_PIN: "Sesi PIN kedaluwarsa, buka ulang halaman.",
  INVALID_NAME: `Nama harus 1–${EMOJI_NAME_MAX} karakter.`,
  INVALID_PRICE: `Harga harus bilangan bulat 0–${EMOJI_PRICE_MAX.toLocaleString("id-ID")}.`,
  FILES_REQUIRED: "Pilih gambar dan file suara.",
  IMAGE_TOO_LARGE: "Gambar terlalu besar.",
  SOUND_TOO_LARGE: "File suara terlalu besar.",
  IMAGE_TYPE: "Format gambar tidak didukung (PNG, WebP, JPEG, GIF).",
  SOUND_TYPE: "Format suara tidak didukung (MP3, OGG, M4A, WebM, WAV).",
  NAME_TAKEN: "Nama emoji itu sudah dipakai. Pakai nama lain.",
  CONFIG_SERVICE_KEY: "SUPABASE_SERVICE_ROLE_KEY belum diatur di server (env Vercel).",
  CONFIG_SUPABASE: "Konfigurasi Supabase di server belum lengkap.",
  STORAGE: "Gagal mengunggah ke Storage. Coba lagi.",
  UPSTREAM: "Server database tidak merespons. Coba lagi.",
  NETWORK: "Koneksi bermasalah. Coba lagi.",
  OTHER: "Gagal membuat emoji.",
};

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

/** Tab "Emoji" di /kamus-admin: buat emoji baru (gambar + suara + harga) dan kelola daftar. */
export default function EmojiAdmin({ pin }: { pin: string }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState<ImageState | null>(null);
  const [sound, setSound] = useState<SoundState | null>(null);
  const [fileKey, setFileKey] = useState(0); // mengosongkan <input type=file> setelah sukses
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [list, setList] = useState<AdminEmoji[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { spawn, layer } = useEmojiBubbles();

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
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const load = useCallback(async () => {
    try {
      setList(await adminListEmojis(pin));
      setListError(null);
    } catch (e: any) {
      setListError(String(e?.message || "").includes("BAD_PIN") ? MSG.BAD_PIN : "Gagal memuat daftar emoji.");
    }
  }, [pin]);

  useEffect(() => {
    load();
  }, [load]);

  async function onImage(f: File | undefined) {
    setImage(null);
    setError(null);
    if (!f) return;
    try {
      const r = await toEmojiImage(f, EMOJI_IMAGE_MAX_SIDE, EMOJI_IMAGE_MAX_BYTES);
      setImage({ blob: r.blob, url: URL.createObjectURL(r.blob), width: r.width, height: r.height });
    } catch {
      setError("Gambar tidak bisa dibaca atau terlalu rumit. Coba gambar lain.");
    }
  }

  async function onSound(f: File | undefined) {
    setSound(null);
    setError(null);
    if (!f) return;
    if (f.size > EMOJI_SOUND_MAX_BYTES) {
      setError(`Suara ${kb(f.size)} melebihi batas ${kb(EMOJI_SOUND_MAX_BYTES)}. ${EMOJI_SOUND_TIP}`);
      return;
    }
    const url = URL.createObjectURL(f);
    const duration = await readSoundDuration(url);
    if (duration === null) {
      URL.revokeObjectURL(url);
      setError("Browser ini tidak bisa memutar file suara itu. Coba format MP3.");
      return;
    }
    setSound({ file: f, url, duration });
  }

  const priceNum = /^\d+$/.test(price.trim()) ? Number(price.trim()) : NaN;
  const nameOk = name.trim().length >= 1 && name.trim().length <= EMOJI_NAME_MAX;
  const priceOk = Number.isInteger(priceNum) && priceNum >= 0 && priceNum <= EMOJI_PRICE_MAX;
  const canSubmit = nameOk && priceOk && !!image && !!sound && !busy;

  async function handleCreate() {
    if (!canSubmit || !image || !sound) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await createEmoji(pin, {
        name: name.trim(),
        price: priceNum,
        image: image.blob,
        imageName: image.blob.type === "image/webp" ? "emoji.webp" : "emoji.png",
        sound: sound.file,
      });
      setOk(`✓ Emoji “${name.trim()}” dibuat dan tampil di toko.`);
      setName("");
      setPrice("");
      setImage(null);
      setSound(null);
      setFileKey((k) => k + 1);
      load();
    } catch (e: any) {
      setError(MSG[e instanceof CreateEmojiError ? e.code : "OTHER"] ?? MSG.OTHER);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(e: AdminEmoji) {
    setTogglingId(e.id);
    try {
      await adminSetEmojiActive(pin, e.id, !e.is_active);
      await load();
    } catch (err: any) {
      setListError(String(err?.message || "").includes("BAD_PIN") ? MSG.BAD_PIN : "Gagal mengubah status emoji.");
    } finally {
      setTogglingId(null);
    }
  }

  /** Pratinjau seperti di room: balon melayang + suara (termasuk emoji yang disembunyikan). */
  function preview(e: AdminEmoji) {
    spawn({ src: emojiAssetUrl(e.image_path) });
    playEmojiSound(emojiAssetUrl(e.sound_path));
  }

  function play(e: AdminEmoji) {
    audioRef.current?.pause();
    if (playingId === e.id) {
      setPlayingId(null);
      return;
    }
    const a = new Audio(emojiAssetUrl(e.sound_path));
    audioRef.current = a;
    a.onended = () => setPlayingId((id) => (id === e.id ? null : id));
    a.play().catch(() => setPlayingId(null));
    setPlayingId(e.id);
  }

  const inputCls =
    "w-full rounded-2xl bg-bg-end px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-accent-to";
  const fileCls =
    "block w-full text-xs text-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-bg-end file:px-3 file:py-2 file:text-xs file:font-bold file:text-ink";

  return (
    <div className="w-full space-y-4">
      {layer}
      <section className="rise w-full rounded-3xl bg-white p-4 shadow-soft">
        <h1 className="text-base font-extrabold text-ink">Buat Emoji</h1>
        <p className="mt-1 text-xs text-ink-soft">Emoji baru langsung tampil di Toko dan bisa dibeli dengan koin 🪙.</p>

        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink">Nama</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={EMOJI_NAME_MAX}
              placeholder="mis. Ketawa Ngakak"
              className={inputCls}
              aria-label="Nama emoji"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink">Harga (koin 🪙)</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="mis. 50"
              className={inputCls}
              aria-label="Harga koin"
            />
          </label>

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
              PNG/WebP/JPEG/GIF. Otomatis diperkecil (maks {EMOJI_IMAGE_MAX_SIDE}px, latar transparan tetap). GIF
              animasi jadi gambar diam.
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
        </div>

        {error && (
          <p key={error} className="mt-3 animate-shake text-sm font-medium text-coral-text" role="alert">
            {error}
          </p>
        )}
        {ok && <p className="mt-3 animate-pop-in text-sm font-semibold text-sage-text">{ok}</p>}

        <button
          onClick={handleCreate}
          disabled={!canSubmit}
          className="sheen mt-4 w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
        >
          {busy ? "Mengunggah…" : "Buat Emoji"}
        </button>
      </section>

      <section className="rise w-full rounded-3xl bg-white p-4 shadow-soft" style={{ ["--i" as string]: 1 } as React.CSSProperties}>
        <h2 className="text-base font-extrabold text-ink">Daftar Emoji</h2>
        {listError && <p className="mt-2 text-sm font-medium text-coral-text">{listError}</p>}
        {list === null && !listError ? (
          <p className="mt-2 animate-pulse-soft text-sm text-ink-soft">Memuat…</p>
        ) : list && list.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Belum ada emoji.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {list?.map((e) => (
              <li key={e.id} className="rounded-2xl bg-bg-end/60 p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={emojiAssetUrl(e.image_path)} alt="" className="h-14 w-14 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-[15px] font-semibold text-ink">{e.name}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      🪙 {e.price.toLocaleString("id-ID")} · dibeli {e.owners}×
                      {!e.is_active && <span className="font-bold text-coral-text"> · disembunyikan</span>}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => preview(e)}
                    aria-label={`Preview ${e.name}`}
                    className="min-h-[44px] rounded-xl bg-white px-2 text-xs font-bold text-ink shadow-soft-sm transition active:scale-95"
                  >
                    👁 Preview
                  </button>
                  <button
                    onClick={() => play(e)}
                    aria-label={`Putar suara ${e.name}`}
                    className="min-h-[44px] rounded-xl bg-white px-2 text-xs font-bold text-ink shadow-soft-sm transition active:scale-95"
                  >
                    {playingId === e.id ? "⏹ Stop" : "🔊 Suara"}
                  </button>
                  <button
                    onClick={() => toggle(e)}
                    disabled={togglingId === e.id}
                    className="min-h-[44px] rounded-xl bg-white px-2 text-xs font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
                  >
                    {e.is_active ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
