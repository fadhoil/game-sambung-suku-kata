"use client";

import { useEffect, useState } from "react";
import { getAccount, type Account } from "@/lib/session";
import type { RoundPlayerPoints } from "@/lib/gameActions";
import { stagger } from "@/lib/motion";

/** Sama dengan fn_pts_cfg('min_chain') di supabase/migration-v12.sql (hanya untuk teks penjelasan). */
const MIN_CHAIN = 8;

interface Props {
  /** Baris poin milikku di game ini (saved=false bila game ini dimainkan sebagai guest); null = tidak ada. */
  myRow: RoundPlayerPoints | null;
  /** Poin game ini sudah selesai dimuat. */
  loaded: boolean;
  endedByHost: boolean;
  chainLength: number;
  /** Urutan masuk (class .rise). */
  index: number;
  /** Naik tiap kali ada perubahan akun (mis. baru mendaftar) agar kartu ikut diperbarui. */
  refreshKey: number;
}

/**
 * Kartu poin di halaman hasil, hanya untuk perangkat yang sedang memakai akun.
 * Poin dihitung server saat game selesai; di sini hanya ditampilkan.
 */
export default function RoundPoints({ myRow, loaded, endedByHost, chainLength, index, refreshKey }: Props) {
  const [account, setAccount] = useState<Account | null>(null);

  // Baca ulang akun aktif (mis. setelah mendaftar di halaman ini).
  useEffect(() => {
    setAccount(getAccount());
  }, [refreshKey, loaded]);

  if (!account || !loaded) return null;

  let body: React.ReactNode;
  if (endedByHost) {
    body = <p className="text-sm text-ink-soft">Game diakhiri host — tidak ada poin.</p>;
  } else if (myRow?.saved) {
    const chips: [string, number][] = [
      ["Juara", myRow.placement],
      ["Rantai", myRow.chain_bonus],
      ["Kata terpanjang", myRow.longest_bonus],
      ["Bonus tim", myRow.team_bonus],
    ];
    body = (
      <>
        <p className="animate-pop-in text-3xl font-extrabold text-accent-deep">
          +{myRow.total} 🏆 <span className="mx-1 text-ink-soft">·</span> +{myRow.total} 🪙
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-semibold text-ink">
          {chips
            .filter(([label, n]) => label === "Juara" || n > 0)
            .map(([label, n]) => (
              <span key={label} className="rounded-full bg-bg-end px-3 py-1">
                {label} +{n}
              </span>
            ))}
        </div>
      </>
    );
  } else if (chainLength < MIN_CHAIN) {
    body = <p className="text-sm text-ink-soft">Rantai terlalu pendek (min. {MIN_CHAIN} kata) — tidak ada poin.</p>;
  } else {
    body = (
      <p className="text-sm text-ink-soft">
        Game ini dimainkan sebagai guest — poin tidak tersimpan ke akunmu. Mulai game berikutnya dengan akunmu.
      </p>
    );
  }

  return (
    <div className="rise z-10 mt-4 w-full rounded-3xl bg-white/80 p-4 text-center shadow-soft-sm" style={stagger(index)}>
      <p className="mb-1 text-xs font-semibold text-ink-soft">Poin game ini · {account.name}</p>
      {body}
    </div>
  );
}
