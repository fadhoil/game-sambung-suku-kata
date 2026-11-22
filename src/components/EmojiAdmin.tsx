"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminDeleteEmoji,
  adminListEmojis,
  adminSetEmojiActive,
  createEmoji,
  CreateEmojiError,
  emojiAssetUrl,
  type AdminEmoji,
} from "@/lib/gameActions";
import { playEmojiSound, useEmojiBubbles } from "@/components/EmojiBubbles";
import { emojiInputCls, useEmojiFiles } from "@/components/EmojiFileFields";
import EmojiSuggestionsAdmin from "@/components/EmojiSuggestionsAdmin";
import { EMOJI_NAME_MAX, EMOJI_PRICE_MAX } from "@/lib/emojiLimits";

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

/** Tab "Emoji" di /kamus-admin: konfirmasi usulan pemain, buat emoji baru, dan kelola daftar. */
export default function EmojiAdmin({ pin }: { pin: string }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const files = useEmojiFiles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [list, setList] = useState<AdminEmoji[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminEmoji | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { spawn, layer } = useEmojiBubbles();

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

  const priceNum = /^\d+$/.test(price.trim()) ? Number(price.trim()) : NaN;
  const nameOk = name.trim().length >= 1 && name.trim().length <= EMOJI_NAME_MAX;
  const priceOk = Number.isInteger(priceNum) && priceNum >= 0 && priceNum <= EMOJI_PRICE_MAX;
  const { image, sound } = files;
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
      files.reset();
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

  async function handleDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await adminDeleteEmoji(pin, confirmDel.id);
      setConfirmDel(null);
      await load();
    } catch (err) {
      setConfirmDel(null);
      setListError(err instanceof CreateEmojiError && err.code === "BAD_PIN" ? MSG.BAD_PIN : "Gagal menghapus emoji.");
    } finally {
      setDeleting(false);
    }
  }

  /** Pratinjau seperti di room: balon melayang + suara (termasuk emoji yang disembunyikan). */
  function preview(e: { image_path: string; sound_path: string }) {
    spawn({ src: emojiAssetUrl(e.image_path) });
    playEmojiSound(emojiAssetUrl(e.sound_path));
  }

  const shownError = error ?? files.fileError;

  return (
    <div className="w-full space-y-4">
      {layer}

      <EmojiSuggestionsAdmin pin={pin} onApproved={load} onPreview={preview} />

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
              className={emojiInputCls}
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
              className={emojiInputCls}
              aria-label="Harga koin"
            />
          </label>

          {files.fields}
        </div>

        {shownError && (
          <p key={shownError} className="mt-3 animate-shake text-sm font-medium text-coral-text" role="alert">
            {shownError}
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
                    onClick={() => toggle(e)}
                    disabled={togglingId === e.id}
                    className="min-h-[44px] rounded-xl bg-white px-2 text-xs font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
                  >
                    {e.is_active ? "Sembunyikan" : "Tampilkan"}
                  </button>
                  <button
                    onClick={() => setConfirmDel(e)}
                    aria-label={`Hapus ${e.name}`}
                    className="min-h-[44px] rounded-xl bg-white px-2 text-xs font-bold text-coral-text shadow-soft-sm transition active:scale-95"
                  >
                    🗑 Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus emoji"
        >
          <div className="w-full max-w-sm animate-pop-in rounded-3xl bg-white p-6 shadow-soft">
            <h3 className="text-base font-extrabold text-ink">Hapus “{confirmDel.name}”?</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Emoji hilang permanen dari toko
              {confirmDel.owners > 0 ? `, inventory ${confirmDel.owners} pemain,` : ""} dan slot mereka. Koin
              pembelian tidak dikembalikan. Tidak bisa dibatalkan.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmDel(null)}
                disabled={deleting}
                className="min-h-[44px] rounded-xl bg-bg-end text-sm font-bold text-ink transition active:scale-95 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="min-h-[44px] rounded-xl bg-coral-text text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
              >
                {deleting ? "Menghapus…" : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
