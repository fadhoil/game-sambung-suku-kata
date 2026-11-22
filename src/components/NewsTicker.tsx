"use client";

import { useEffect, useRef, useState } from "react";
import { fetchTodayNews, type NewsItem } from "@/lib/gameActions";

const SPEED = 60; // px per detik
const GAP_MS = 3000; // jeda setelah satu berita selesai, sebelum berita berikutnya

/**
 * Running text 1 baris di beranda: berita hari ini (usulan kata/emoji yang diterima).
 * Satu berita berjalan dari kanan ke kiri; setelah selesai, jeda 3 detik, lalu berita berikutnya
 * (berputar). Disentuh/di-hover = berhenti sebentar. Tanpa berita hari ini, tidak tampil.
 */
export default function NewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [tick, setTick] = useState(0); // naik terus; berita ke-(tick mod jumlah) => berputar ke awal, juga untuk 1 berita
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const animRef = useRef<Animation | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTodayNews().then((n) => alive && setItems(n));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text || items.length === 0) return;

    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => setTick((n) => n + 1), GAP_MS);
    };

    // Hormati "kurangi gerakan": tampil diam di tengah, berganti tiap 4 detik.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      text.style.cssText = "left:50%;transform:translateX(-50%)";
      timer = setTimeout(() => setTick((n) => n + 1), 4000);
      return () => clearTimeout(timer);
    }

    // Teks mulai tepat di luar tepi kanan (left:100%), berakhir tepat di luar tepi kiri.
    const dist = box.offsetWidth + text.offsetWidth;
    const anim = text.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(-${dist}px)` }],
      { duration: (dist / SPEED) * 1000, easing: "linear", fill: "forwards" }
    );
    animRef.current = anim;
    anim.onfinish = next;
    return () => {
      anim.cancel();
      animRef.current = null;
      clearTimeout(timer);
    };
  }, [tick, items]);

  if (items.length === 0) return null;
  const n = items[tick % items.length];
  const label = n.kind === "word" ? "kata" : "emoji";

  return (
    <div
      ref={boxRef}
      // Jeda hanya saat berjalan; play() pada animasi yang sudah selesai akan mengulanginya dari awal.
      onPointerEnter={() => animRef.current?.playState === "running" && animRef.current.pause()}
      onPointerLeave={() => animRef.current?.playState === "paused" && animRef.current.play()}
      className="relative h-9 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-accent-from to-accent-to text-sm text-ink shadow-soft-sm"
      role="status"
      aria-live="off"
      aria-label={`Berita hari ini: usulan ${label} ${n.name} diterima`}
    >
      <span key={tick} ref={textRef} className="absolute left-full top-0 flex h-full items-center whitespace-nowrap font-medium">
        📰&nbsp;Penambahan usulan {label}&nbsp;<b className="font-extrabold">“{n.name}”</b>&nbsp;diterima
      </span>
    </div>
  );
}
