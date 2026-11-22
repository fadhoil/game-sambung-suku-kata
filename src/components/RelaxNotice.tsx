"use client";

import { useEffect, useState } from "react";
import { sfxCountdownTick, sfxCountdownGo } from "@/lib/sound";

interface Props {
  /** suku kata baru yang dilonggarkan (1 huruf) */
  syllable: string;
  /** suku kata penuh sebelumnya (untuk info) */
  fullSyllable: string;
  /** detik hold, default 3 */
  seconds?: number;
  onDone?: () => void;
}

/**
 * Pop-up "Keringanan" tampil di semua layar saat target dilonggarkan jadi
 * 1 huruf. Menahan 3 detik lalu permainan lanjut.
 */
export default function RelaxNotice({ syllable, fullSyllable, seconds = 3, onDone }: Props) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-pop-in rounded-3xl bg-white p-6 text-center shadow-soft">
        <div className="text-4xl">🎁</div>
        <h2 className="mt-2 text-xl font-extrabold text-ink">Keringanan!</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Suku kata <b className="uppercase text-ink">-{fullSyllable}</b> terlalu sulit.
        </p>
        <p className="mt-3 text-sm text-ink">Sekarang cukup sambung dari:</p>
        <p className="mt-1 text-5xl font-extrabold uppercase text-accent-to">-{syllable}</p>
        <p className="mt-4 text-xs text-ink-soft">Permainan lanjut dalam {left}…</p>
      </div>
    </div>
  );
}
