"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeaderboard, type LeaderboardPeriod, type LeaderboardRow } from "@/lib/gameActions";
import { stagger } from "@/lib/motion";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const TOP_N = 20;

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setFailed(false);
    getLeaderboard(period, TOP_N)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [period]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
      <div className="rise mb-4 flex items-center justify-between" style={stagger(0)}>
        <Link href="/" className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-soft-sm">
          ← Kembali
        </Link>
        <h1 className="text-xl font-extrabold text-ink">🏆 Papan Peringkat</h1>
        <span className="w-[72px]" aria-hidden />
      </div>

      <div className="rise relative mb-4 grid grid-cols-2 rounded-2xl bg-bg-end p-1" style={stagger(1)}>
        <span
          aria-hidden
          className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-xl bg-white shadow-soft-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ transform: period === "all" ? "translateX(100%)" : "translateX(0)" }}
        />
        {(
          [
            ["week", "Top Minggu Ini"],
            ["all", "Sepanjang Masa"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={[
              "relative z-10 rounded-xl py-2 text-sm font-bold transition-colors",
              period === key ? "text-ink" : "text-ink-soft",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rise rounded-3xl bg-white p-3 shadow-soft" style={stagger(2)}>
        {failed ? (
          <p className="animate-shake p-6 text-center text-sm font-medium text-coral-text">
            Gagal memuat peringkat. Coba lagi nanti.
          </p>
        ) : rows === null ? (
          <p className="animate-pulse-soft p-6 text-center text-sm text-ink-soft">Memuat…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-soft">
            {period === "week"
              ? "Belum ada poin minggu ini. Main dan jadilah yang pertama!"
              : "Belum ada poin. Daftarkan akun, lalu mainkan game!"}
          </p>
        ) : (
          <ol key={period} className="flex flex-col gap-1.5">
            {rows.map((r, i) => {
              const gap = i > 0 && r.rank > rows[i - 1].rank + 1 && r.is_me;
              return (
                <li key={r.account_id}>
                  {gap && <p className="py-1 text-center text-xs text-ink-soft">⋯</p>}
                  <div
                    className={[
                      "rise flex items-center gap-3 rounded-2xl px-3 py-2",
                      r.is_me ? "bg-accent-to/20 ring-2 ring-accent-to" : "bg-bg-end/60",
                    ].join(" ")}
                    style={stagger(Math.min(i, 10))}
                  >
                    <span className="w-8 text-center text-lg font-extrabold text-ink">
                      {MEDAL[r.rank] ?? r.rank}
                    </span>
                    <span className="text-2xl">{r.account_avatar}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-ink">
                      {r.account_name}
                      {r.is_me && <span className="ml-1 text-xs font-semibold text-accent-deep">(kamu)</span>}
                    </span>
                    <span className="font-extrabold text-accent-deep">{r.points} 🏆</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <p className="rise mt-3 text-center text-xs text-ink-soft" style={stagger(3)}>
        Dihitung dari skor 🏆 yang didapat di game (penalti dan penggunaan koin tidak mengurangi skor). Top Minggu Ini di-reset tiap Senin 00:00 WIB.
      </p>
    </main>
  );
}
