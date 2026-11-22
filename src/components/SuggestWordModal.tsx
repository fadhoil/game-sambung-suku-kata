"use client";

import { useState } from "react";
import { suggestWords } from "@/lib/gameActions";

interface Props {
  open: boolean;
  onClose: () => void;
  roomCode?: string;
  playerName?: string;
}

/**
 * Modal usulan kata dari pemain. Boleh mengisi lebih dari satu kata,
 * dipisah koma. Usulan masuk antrean konfirmasi admin (halaman /kamus-admin),
 * dan baru masuk kamus setelah disetujui.
 */
export default function SuggestWordModal({ open, onClose, roomCode, playerName }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSend() {
    setError(null);
    setMsg(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Tulis dulu kata yang ingin diusulkan.");
      return;
    }
    setBusy(true);
    try {
      const n = await suggestWords(trimmed, roomCode, playerName);
      if (n > 0) {
        setMsg(`${n} usulan terkirim. Menunggu konfirmasi admin.`);
        setText("");
      } else {
        setMsg("Tidak ada usulan baru (mungkin sudah ada di kamus / antrean).");
      }
    } catch {
      setError("Gagal mengirim usulan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Usulkan kata"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm animate-pop-in rounded-3xl bg-white p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold text-ink">💡 Usulkan Kata</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Kata belum ada di kamus? Usulkan di sini. Bisa beberapa kata sekaligus,
          pisahkan dengan <b>koma</b>. Contoh: <i>gajah, kuda, berlari</i>
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="gajah, kuda, berlari"
          rows={3}
          className="mt-3 w-full resize-none rounded-2xl bg-bg-end px-4 py-3 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent-to"
        />

        {msg && <p className="mt-2 text-sm font-medium text-sage-text">{msg}</p>}
        {error && <p className="mt-2 text-sm font-medium text-coral-text">{error}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl bg-bg-end py-3 font-semibold text-ink-soft transition active:scale-95"
          >
            Tutup
          </button>
          <button
            onClick={handleSend}
            disabled={busy}
            className="rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "Mengirim…" : "Kirim Usulan"}
          </button>
        </div>
      </div>
    </div>
  );
}
