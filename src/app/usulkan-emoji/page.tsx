"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccount, type Account } from "@/lib/session";
import { CreateEmojiError, suggestEmoji } from "@/lib/gameActions";
import { emojiInputCls, useEmojiFiles } from "@/components/EmojiFileFields";
import { EMOJI_NAME_MAX } from "@/lib/emojiLimits";
import { stagger } from "@/lib/motion";

const ERR: Record<string, string> = {
  NOT_LOGGED_IN: "Masuk dengan akun dulu. Pilih akun di halaman utama.",
  INVALID_NAME: `Nama harus 1–${EMOJI_NAME_MAX} karakter.`,
  NAME_TAKEN: "Nama itu sudah dipakai atau sedang diusulkan. Pakai nama lain.",
  TOO_MANY_PENDING: "Kamu sudah punya 3 usulan yang menunggu konfirmasi. Tunggu salah satunya diproses.",
  FILES_REQUIRED: "Pilih gambar dan file suara.",
  IMAGE_TOO_LARGE: "Gambar terlalu besar.",
  SOUND_TOO_LARGE: "File suara terlalu besar.",
  IMAGE_TYPE: "Format gambar tidak didukung (PNG, WebP, JPEG, GIF).",
  SOUND_TYPE: "Format suara tidak didukung (MP3, OGG, M4A, WebM, WAV).",
  STORAGE: "Gagal mengunggah. Coba lagi.",
  UPSTREAM: "Server tidak merespons. Coba lagi.",
  NETWORK: "Koneksi bermasalah. Coba lagi.",
  OTHER: "Gagal mengirim usulan. Coba lagi.",
};

/** Pemain mengusulkan emoji (gambar + suara). Admin yang menentukan harga & menyetujui di /kamus-admin. */
export default function SuggestEmojiPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const files = useEmojiFiles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setAccount(getAccount());
  }, []);

  const { image, sound } = files;
  const nameOk = name.trim().length >= 1 && name.trim().length <= EMOJI_NAME_MAX;
  const canSubmit = !!account && nameOk && !!image && !!sound && !busy;

  async function handleSend() {
    if (!canSubmit || !image || !sound) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await suggestEmoji({
        name: name.trim(),
        image: image.blob,
        imageName: image.blob.type === "image/webp" ? "emoji.webp" : "emoji.png",
        sound: sound.file,
      });
      setOk(`✓ Usulan “${name.trim()}” terkirim. Menunggu konfirmasi admin.`);
      setName("");
      files.reset();
    } catch (e) {
      setError(ERR[e instanceof CreateEmojiError ? e.code : "OTHER"] ?? ERR.OTHER);
    } finally {
      setBusy(false);
    }
  }

  const shownError = error ?? files.fileError;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
      <div className="rise mb-4 flex items-center justify-between gap-2" style={stagger(0)}>
        <Link href="/toko" className="shrink-0 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-soft-sm">
          ← Toko
        </Link>
        <h1 className="min-w-0 truncate text-base font-extrabold text-ink min-[360px]:text-xl">💡 Usulkan Emoji</h1>
        <span className="w-12 shrink-0" aria-hidden />
      </div>

      {!account && (
        <p className="rise mb-4 rounded-2xl bg-white/80 p-3 text-center text-xs text-ink-soft shadow-soft-sm" style={stagger(1)}>
          Kamu belum memakai akun. Pilih atau buat akun di halaman utama untuk mengusulkan emoji.
        </p>
      )}

      <section className="rise w-full rounded-3xl bg-white p-4 shadow-soft" style={stagger(1)}>
        <p className="text-xs text-ink-soft">
          Punya ide emoji? Unggah gambar dan suaranya. Kalau disetujui admin, emoji tampil di Toko dan bisa dibeli pemain.
          Maksimal 3 usulan menunggu sekaligus.
        </p>

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

          {files.fields}
        </div>

        {shownError && (
          <p key={shownError} className="mt-3 animate-shake text-sm font-medium text-coral-text" role="alert">
            {shownError}
          </p>
        )}
        {ok && <p className="mt-3 animate-pop-in text-sm font-semibold text-sage-text">{ok}</p>}

        <button
          onClick={handleSend}
          disabled={!canSubmit}
          className="sheen mt-4 min-h-[44px] w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
        >
          {busy ? "Mengirim…" : "Kirim Usulan"}
        </button>
      </section>
    </main>
  );
}
