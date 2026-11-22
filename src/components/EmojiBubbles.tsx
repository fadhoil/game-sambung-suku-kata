"use client";

import { useRef, useState } from "react";

interface Bubble {
  id: number;
  left: number; // persen posisi horizontal
  char?: string;
  src?: string;
}

/**
 * Balon emoji melayang (animasi .emoji-rise) — dipakai ReactionLayer (room/play/result)
 * dan pratinjau di toko & admin agar tampilannya identik.
 * Render `layer` sekali di halaman; panggil `spawn` tiap balon baru.
 */
export function useEmojiBubbles() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const idRef = useRef(0);

  function spawn(item: { char?: string; src?: string }) {
    const id = ++idRef.current;
    // Sebar posisi horizontal acak di sekitar tengah (30%-70%).
    const left = 30 + Math.random() * 40;
    setBubbles((prev) => [...prev, { id, left, ...item }]);
    // Hapus setelah animasi selesai (~2s).
    setTimeout(() => setBubbles((prev) => prev.filter((b) => b.id !== id)), 2100);
  }

  // Overlay ber-pointer-events:none agar tidak pernah merebut fokus/menutupi input.
  const layer = (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {bubbles.map((b) => (
        <span key={b.id} className="emoji-rise absolute bottom-24 text-5xl" style={{ left: `${b.left}%` }}>
          {b.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.src} alt="" className="h-12 w-12 object-contain" />
          ) : (
            b.char
          )}
        </span>
      ))}
    </div>
  );

  return { spawn, layer };
}

/** Putar suara emoji (fire-and-forget; autoplay yang diblokir browser diabaikan). */
export function playEmojiSound(src: string) {
  new Audio(src).play().catch(() => {});
}
