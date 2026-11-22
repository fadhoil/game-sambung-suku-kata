"use client";

import { useEffect, useState } from "react";
import { sfxCountdownTick, sfxCountdownGo } from "@/lib/sound";

interface Props {
  /** detik awal, mis. 5 */
  seconds: number;
  /** dipanggil saat hitung mundur selesai */
  onDone?: () => void;
}

/**
 * Overlay hitung mundur sebelum kata awal muncul.
 * Muncul di semua layar saat permainan dimulai.
 */
export default function Countdown({ seconds, onDone }: Props) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) {
      sfxCountdownGo();
      onDone?.();
      return;
    }
    sfxCountdownTick();
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  return (
    <div className="fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <p className="mb-2 text-sm font-semibold text-ink-soft">Bersiap…</p>
      <div className="relative flex h-44 min-w-[11rem] items-center justify-center">
        {/* Gelombang yang memancar tiap angka berganti */}
        <span
          key={`ripple-${left}`}
          aria-hidden
          className="ripple absolute inset-0 m-auto h-40 w-40 rounded-full border-4 border-airy-300"
        />
        <div
          key={left}
          className="count-num bg-gradient-to-r from-accent-to to-accent-deep bg-clip-text text-8xl font-extrabold text-transparent"
          aria-live="assertive"
        >
          {left > 0 ? left : "GO!"}
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-soft">Kata awal akan segera muncul</p>
    </div>
  );
}
