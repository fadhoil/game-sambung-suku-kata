"use client";

import { useEffect, useState } from "react";

// Dominan palet Airy Blue, plus sedikit peach/cream agar terasa meriah.
const COLORS = ["#AECBEB", "#83B0E1", "#71A5DE", "#AECBEB", "#FBCFE8", "#FDE2C8"];

interface Piece {
  id: number;
  left: number;
  delay: number;
  color: string;
  size: number;
}

/**
 * Confetti lembut (CSS-only), dipakai di halaman hasil.
 */
export default function Confetti() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    const arr: Piece[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 8,
    }));
    setPieces(arr);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: `${p.delay}s`,
          }}
          className="confetti-piece absolute top-[-20px] rounded-sm"
        />
      ))}
      <style jsx>{`
        .confetti-piece {
          animation: fall 3s linear infinite;
          opacity: 0.85;
        }
        @keyframes fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 0.9;
          }
          100% {
            transform: translateY(105vh) rotate(540deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
