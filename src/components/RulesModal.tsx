"use client";

import { useEffect, useState } from "react";
import { stagger } from "@/lib/motion";

interface Props {
  open: boolean;
  onClose: () => void;
  timerSeconds: number;
  maxLives: number;
  mode: "ffa" | "team";
  /** Tutup otomatis setelah sekian detik (mis. 20). Omit = tidak auto-close. */
  autoCloseSeconds?: number;
}

/**
 * Pop-up cara bermain, ditampilkan di dalam room (lobby).
 * Tiap pemain bisa membuka & menutup sendiri, atau tertutup otomatis.
 */
export default function RulesModal({
  open,
  onClose,
  timerSeconds,
  maxLives,
  mode,
  autoCloseSeconds,
}: Props) {
  // Animasi keluar: tunda onClose sampai animasi fade-out selesai.
  const [closing, setClosing] = useState(false);

  // Auto-close setelah N detik.
  useEffect(() => {
    if (!open || !autoCloseSeconds) return;
    const id = setTimeout(() => setClosing(true), autoCloseSeconds * 1000);
    return () => clearTimeout(id);
  }, [open, autoCloseSeconds]);

  if (!open) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm",
        closing ? "fade-out" : "fade-in",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label="Cara bermain"
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) {
          setClosing(false);
          onClose();
        }
      }}
    >
      <div
        className={[
          "w-full max-w-sm rounded-3xl bg-white p-6 shadow-soft",
          closing ? "sheet-out" : "spring-in",
        ].join(" ")}
      >
        <div className="mb-3 text-center">
          <div className="text-4xl">🔗</div>
          <h2 className="mt-1 text-xl font-extrabold text-ink">Cara Bermain</h2>
        </div>

        <ul className="space-y-3 text-sm text-ink">
          <li className="rise flex gap-2" style={stagger(2)}>
            <span>1️⃣</span>
            <span>
              Sambung kata dari <b>suku kata terakhir</b> kata sebelumnya. Contoh:
              LUKISAN → sambung <b>-SAN</b> → SANTAI.
            </span>
          </li>
          <li className="rise flex gap-2" style={stagger(3)}>
            <span>2️⃣</span>
            <span>
              Kata harus ada di <b>kamus Bahasa Indonesia</b> dan <b>belum pernah dipakai</b>.
            </span>
          </li>
          <li className="rise flex gap-2" style={stagger(4)}>
            <span>⏱️</span>
            <span>
              Setiap giliran punya <b>{timerSeconds} detik</b>. Telat atau tak menemukan kata =
              gagal.
            </span>
          </li>
          <li className="rise flex gap-2" style={stagger(5)}>
            <span>❤️</span>
            <span>
              Tiap pemain punya <b>{maxLives} nyawa</b>. Gagal menjawab mengurangi 1 nyawa.
              Nyawa habis = <b>tereliminasi</b>.
            </span>
          </li>
          <li className="rise flex gap-2" style={stagger(6)}>
            <span>🏆</span>
            <span>
              {mode === "ffa"
                ? "Pemain terakhir yang bertahan menang."
                : "Tim terakhir yang masih punya anggota hidup menang."}
            </span>
          </li>
          <li className="rise flex gap-2" style={stagger(7)}>
            <span>👀</span>
            <span>Pemain yang tereliminasi tetap di room sebagai penonton.</span>
          </li>
        </ul>

        <button
          onClick={() => setClosing(true)}
          className="sheen mt-5 w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm active:scale-95"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}
