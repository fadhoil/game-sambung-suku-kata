"use client";

import { useEffect, useState } from "react";

interface Props {
  className?: string;
  /** Label ringkas untuk header sempit. */
  compact?: boolean;
}

/**
 * Tombol toggle layar penuh (Fullscreen API).
 * Catatan: iOS Safari membatasi Fullscreen API; pada perangkat itu tombol
 * mungkin tidak berefek.
 */
export default function FullscreenButton({ className, compact }: Props) {
  const [isFull, setIsFull] = useState(false);
  const [supported, setSupported] = useState(true);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    setSupported(
      typeof document !== "undefined" && !!document.documentElement.requestFullscreen
    );
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggle() {
    // iOS Safari tidak mengizinkan Fullscreen API untuk elemen biasa.
    // Alih-alih tombol hilang, tampilkan tip "Add to Home Screen".
    if (!supported) {
      setShowTip(true);
      setTimeout(() => setShowTip(false), 5000);
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* diabaikan: sebagian browser membatasi */
    }
  }

  const label = compact
    ? isFull
      ? "🗗 Keluar"
      : "⛶ Full"
    : isFull
      ? "🗗 Keluar Layar Penuh"
      : "⛶ Layar Penuh";

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className={
          className ??
          "rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-soft-sm active:scale-95"
        }
        aria-label={isFull ? "Keluar layar penuh" : "Layar penuh"}
      >
        {label}
      </button>
      {showTip && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl bg-white p-3 text-left text-[11px] font-medium text-ink shadow-soft">
          Di iPhone, layar penuh lewat Safari dibatasi. Untuk tampilan penuh:
          ketuk <b>Bagikan</b> → <b>Add to Home Screen</b>, lalu buka game dari
          ikon di layar utama.
        </div>
      )}
    </div>
  );
}
