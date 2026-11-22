"use client";

import { useEffect, useState } from "react";
import { isSoundEnabled, toggleSound } from "@/lib/sound";

interface Props {
  className?: string;
}

/** Tombol nyala/mati suara global. */
export default function MuteButton({ className }: Props) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(isSoundEnabled());
  }, []);

  return (
    <button
      onClick={() => setOn(toggleSound())}
      className={
        className ??
        "rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-soft-sm active:scale-95"
      }
      aria-label={on ? "Matikan suara" : "Nyalakan suara"}
      title={on ? "Suara: nyala" : "Suara: mati"}
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}
