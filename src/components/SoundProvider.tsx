"use client";

import { useEffect } from "react";
import { unlockAudio, sfxClick } from "@/lib/sound";

/**
 * Menyalakan efek suara klik global untuk semua tombol/link,
 * dan membuka audio pada interaksi pertama (syarat browser mobile).
 * Dipasang sekali di root layout.
 */
export default function SoundProvider() {
  useEffect(() => {
    const onPointerDown = () => unlockAudio();
    window.addEventListener("pointerdown", onPointerDown, { once: true });

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      // Bunyi klik hanya untuk elemen interaktif.
      if (el && el.closest("button, a, [role='button']")) {
        // Elemen yang menandai dirinya tanpa-suara dilewati.
        if (el.closest("[data-no-click-sound]")) return;
        sfxClick();
      }
    };
    document.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
