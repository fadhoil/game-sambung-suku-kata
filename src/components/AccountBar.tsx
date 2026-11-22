"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccounts, getAccount, setActiveAccount, type Account } from "@/lib/session";
import { fetchAccountStats, type AccountStats } from "@/lib/gameActions";
import AccountSwitcher from "@/components/AccountSwitcher";

interface Props {
  /** Avatar yang sedang dipilih di halaman utama (dipakai untuk akun baru). */
  defaultAvatar: string;
  /** Akun aktif berubah (null = guest): halaman utama mengisi ulang nama/avatar. */
  onActiveChange: (account: Account | null) => void;
}

const pill = "shrink-0 whitespace-nowrap rounded-full bg-white py-1.5 text-xs font-bold text-ink shadow-soft-sm max-[339px]:text-[11px]";

/** Angka ringkas agar baris tetap muat di layar sempit: 1250 -> "1.3k", 98765 -> "99k". Angka persis ada di daftar akun. */
function fmt(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}

/**
 * Ringkas, untuk baris atas halaman utama (sebaris dengan tombol suara & layar penuh):
 * tombol Ganti/Pilih akun + skor 🏆 + koin 🪙. Daftar akun muncul saat tombol diklik.
 * Tidak tampil bila perangkat belum punya akun.
 */
export default function AccountBar({ defaultAvatar, onActiveChange }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [active, setActive] = useState<Account | null>(null);
  const [stats, setStats] = useState<Record<string, AccountStats>>({});
  const [open, setOpen] = useState(false);

  const reload = useCallback(() => {
    setAccounts(getAccounts());
    setActive(getAccount());
    fetchAccountStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (accounts.length === 0) return null;

  const st = active ? stats[active.id] : undefined;
  const label = active ? "Ganti akun" : "Pilih akun";

  function handleSelect(id: string | null) {
    setActiveAccount(id);
    reload();
    onActiveChange(getAccount());
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${pill} px-2.5 transition active:scale-95`}
        aria-label={label}
      >
        {/* Layar sangat sempit (<340px): label dipersingkat supaya tetap sebaris */}
        <span className="min-[340px]:hidden">Akun</span>
        <span className="hidden min-[340px]:inline">{label}</span>
      </button>
      {active && (
        <>
          <span className={`${pill} bg-white/80 px-2`} title="Skor 🏆">
            🏆 {st ? fmt(st.score) : "…"}
          </span>
          <span className={`${pill} bg-white/80 px-2`} title="Koin 🪙">
            🪙 {st ? fmt(st.coins) : "…"}
          </span>
        </>
      )}

      {open && (
        <AccountSwitcher
          accounts={accounts}
          activeId={active?.id ?? null}
          stats={stats}
          newAvatar={defaultAvatar}
          onSelect={handleSelect}
          onCreated={() => {
            reload();
            onActiveChange(getAccount());
            setOpen(false);
          }}
          onDeleted={() => {
            // Akun sudah dilepas dari perangkat; bila yang aktif terhapus, jadi guest.
            reload();
            onActiveChange(getAccount());
            if (getAccounts().length === 0) setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
