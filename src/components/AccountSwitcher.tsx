"use client";

import { useState } from "react";
import { MAX_ACCOUNTS_PER_DEVICE, type Account } from "@/lib/session";
import { registerAccount, deleteAccount, AccountError, type AccountStats } from "@/lib/gameActions";

interface Props {
  accounts: Account[];
  activeId: string | null;
  stats: Record<string, AccountStats>;
  /** Avatar yang dipakai untuk akun baru (avatar yang sedang dipilih di halaman utama). */
  newAvatar: string;
  onSelect: (id: string | null) => void;
  /** Akun baru berhasil dibuat (sudah disimpan & aktif). */
  onCreated: () => void;
  /** Akun berhasil dihapus (sudah dilepas dari perangkat). */
  onDeleted: () => void;
  onClose: () => void;
}

/** Pilih akun / main sebagai guest / tambah akun (maks. 3 per perangkat) / hapus akun. */
export default function AccountSwitcher({ accounts, activeId, stats, newAvatar, onSelect, onCreated, onDeleted, onClose }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const full = accounts.length >= MAX_ACCOUNTS_PER_DEVICE;

  async function handleDelete(a: Account) {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(a);
      setConfirmId(null);
      onDeleted();
    } catch {
      setDeleteError("Gagal menghapus akun. Periksa koneksi lalu coba lagi.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    try {
      await registerAccount(n, newAvatar);
      onCreated();
    } catch (e: any) {
      const code = e instanceof AccountError ? e.code : "OTHER";
      setError(
        code === "NAME_TAKEN"
          ? `Nama “${n}” sudah dipakai akun lain. Coba nama lain.`
          : code === "DEVICE_LIMIT"
            ? `Perangkat ini sudah memiliki ${MAX_ACCOUNTS_PER_DEVICE} akun dan tidak bisa menambah akun lagi.`
            : code === "INVALID_NAME"
              ? "Nama akun tidak valid."
              : "Gagal membuat akun. Coba lagi."
      );
      setBusy(false);
    }
  }

  const rowCls = (active: boolean) =>
    [
      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.98]",
      active ? "bg-accent-to/20 ring-2 ring-accent-to" : "bg-bg-end hover:bg-bg-end/70",
    ].join(" ");

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-title"
    >
      <div className="spring-in w-full max-w-sm rounded-3xl bg-white p-5 shadow-soft">
        <h2 id="switch-title" className="text-center text-lg font-extrabold text-ink">
          Pilih akun
        </h2>

        <ul className="mt-3 flex flex-col gap-2">
          {accounts.map((a) => {
            const st = stats[a.id];
            return (
              <li key={a.id}>
                {confirmId === a.id ? (
                  <div className="animate-pop-in rounded-2xl bg-coral-bg/20 p-3" role="alertdialog" aria-label={`Hapus akun ${a.name}`}>
                    <p className="text-sm font-bold text-ink">Hapus akun “{a.name}”?</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      Skor 🏆 dan koin 🪙 akun ini ditahan dan tidak berlaku lagi. Kamu bisa membuat akun baru.
                    </p>
                    {deleteError && (
                      <p className="mt-2 text-xs font-medium text-coral-text" role="alert">
                        {deleteError}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={deleting}
                        className="flex-1 rounded-xl bg-white py-2 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-50"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        disabled={deleting}
                        className="flex-1 rounded-xl bg-coral-text py-2 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
                      >
                        {deleting ? "Menghapus…" : "Ya, hapus"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-stretch gap-2">
                    <button onClick={() => onSelect(a.id)} className={`${rowCls(a.id === activeId)} min-w-0 flex-1`}>
                      <span className="text-2xl">{a.avatar}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-ink">{a.name}</span>
                        <span className="block text-xs text-ink-soft">
                          🏆 {st ? st.score : "…"} · 🪙 {st ? st.coins : "…"}
                        </span>
                      </span>
                      {a.id === activeId && <span className="text-sm font-bold text-accent-deep">✓ Dipakai</span>}
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmId(a.id);
                      }}
                      className="shrink-0 rounded-2xl bg-bg-end px-3 text-base transition hover:bg-coral-bg/20 active:scale-95"
                      aria-label={`Hapus akun ${a.name}`}
                      title="Hapus akun"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          <li>
            <button onClick={() => onSelect(null)} className={rowCls(activeId === null)}>
              <span className="text-2xl">👤</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">Main sebagai Guest</span>
                <span className="block text-xs text-ink-soft">Tanpa poin</span>
              </span>
              {activeId === null && <span className="text-sm font-bold text-accent-deep">✓ Dipakai</span>}
            </button>
          </li>
        </ul>

        <div className="mt-3">
          {full ? (
            <p className="rounded-2xl bg-coral-bg/20 p-3 text-center text-sm font-medium text-coral-text" role="status">
              Perangkat ini sudah memiliki {MAX_ACCOUNTS_PER_DEVICE} akun. Tidak bisa menambah akun lagi.
            </p>
          ) : adding ? (
            <div className="animate-pop-in">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                autoFocus
                aria-label="Nama akun baru"
                placeholder="Nama akun baru"
                className="w-full rounded-2xl bg-bg-end px-4 py-3 font-semibold text-ink outline-none focus:ring-2 focus:ring-accent-to"
              />
              {error && (
                <p key={error} className="mt-2 animate-shake text-sm font-medium text-coral-text" role="alert">
                  {error}
                </p>
              )}
              <button
                onClick={handleCreate}
                disabled={busy || !name.trim()}
                className="sheen mt-2 w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
              >
                {busy ? "Membuat…" : "Buat akun"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full rounded-2xl border-2 border-dashed border-accent-to/60 py-2.5 text-sm font-bold text-accent-deep transition hover:bg-accent-to/10 active:scale-95"
            >
              ＋ Akun baru ({accounts.length}/{MAX_ACCOUNTS_PER_DEVICE})
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-2xl bg-bg-end py-2.5 text-sm font-semibold text-ink transition active:scale-95"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
