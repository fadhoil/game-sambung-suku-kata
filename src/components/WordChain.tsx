"use client";

import { useEffect, useRef } from "react";

interface Props {
  words: string[];
}

/**
 * Menampilkan rantai kata berjalan secara horizontal. Kartu terakhir disorot.
 */
export default function WordChain({ words }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
  }, [words.length]);

  return (
    <div className="chain-scroll flex items-center gap-2 overflow-x-auto pb-2">
      {words.map((w, i) => {
        const isLast = i === words.length - 1;
        return (
          <div key={`${w}-${i}`} className="flex items-center gap-2 animate-slide-in">
            <span
              className={[
                "whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-semibold uppercase tracking-wide shadow-soft-sm",
                isLast
                  ? "chain-land bg-gradient-to-r from-accent-from to-accent-to text-ink"
                  : "bg-white text-ink",
              ].join(" ")}
            >
              {w}
            </span>
            {!isLast && <span className="text-ink-soft">→</span>}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
