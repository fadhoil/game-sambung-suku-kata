"use client";

import { useEffect, useState } from "react";
import { getEndPreview, type EndPreview } from "@/lib/gameActions";

interface Props {
  open: boolean;
  roomId: string;
  playerId: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Batas putaran bebas penalti ada di server (fn_pts_cfg('free_putaran')); ini hanya teks. */
function consequence(p: EndPreview): string {
  const noPoints = "Tidak ada poin untuk siapa pun.";
  if (p.stage === "lock") {
    const menit = Math.round(p.lock_seconds / 60);
    return `${noPoints} Kamu juga tidak bisa memulai game selama ${menit} menit.`;
  }
  if (p.stage === "points") {
    return `${noPoints} Koin 🪙 kamu dikurangi ${p.points} (tidak kurang dari 0).`;
  }
  return p.putaran <= 3 ? `${noPoints} Tanpa penalti karena game baru berjalan.` : noPoints;
}

/**
 * Konfirmasi sebelum host mengakhiri game. Menjelaskan konsekuensi
 * (tanpa poin + penalti bertahap) berdasarkan pratinjau dari server.
 */
export default function EndGameConfirm({ open, roomId, playerId, busy, onCancel, onConfirm }: Props) {
  const [preview, setPreview] = useState<EndPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPreview(null);
    setFailed(false);
    getEndPreview(roomId, playerId)
      .then((p) => alive && setPreview(p))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [open, roomId, playerId]);

  if (!open) return null;

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-title"
    >
      <div className="spring-in w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-soft">
        <div className="text-5xl">⚠️</div>
        <h2 id="end-title" className="mt-2 text-xl font-extrabold text-ink">
          Akhiri game sekarang?
        </h2>

        {preview ? (
          <>
            <p className="mt-2 text-sm text-ink">
              Game sudah berjalan <b>{preview.putaran} putaran</b>.
            </p>
            <p className="mt-1 text-sm font-medium text-coral-text">{consequence(preview)}</p>
          </>
        ) : failed ? (
          <p className="mt-2 text-sm text-ink">
            Mengakhiri game lebih awal tidak memberi poin dan bisa terkena penalti.
          </p>
        ) : (
          <p className="mt-2 animate-pulse-soft text-sm text-ink-soft">Memeriksa…</p>
        )}
        <p className="mt-2 text-xs text-ink-soft">1 putaran = semua pemain sudah mendapat giliran.</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="sheen w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            Lanjut main
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || (!preview && !failed)}
            className="w-full rounded-2xl bg-coral-bg/20 py-3 text-sm font-semibold text-coral-text transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "Mengakhiri…" : "Tetap akhiri"}
          </button>
        </div>
      </div>
    </div>
  );
}
