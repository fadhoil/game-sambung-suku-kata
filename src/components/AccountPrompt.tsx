"use client";

import { useEffect, useState } from "react";
import { getAccounts, MAX_ACCOUNTS_PER_DEVICE } from "@/lib/session";
import { registerAccount, AccountError } from "@/lib/gameActions";

interface Props {
  /** Ronde yang baru selesai; dipakai untuk klaim poin dan agar "Nanti saja" tidak muncul lagi saat refresh. */
  roundId: string | null;
  playerId?: string;
  name?: string;
  avatar?: string;
  isAdmin?: boolean;
  /** Dipanggil setelah akun terdaftar (mis. untuk memuat ulang poin di halaman hasil). */
  onRegistered?: () => void;
}

type Phase = "ask" | "busy" | "rename" | "limit" | "done";

/**
 * Konfirmasi di halaman hasil: daftarkan perangkat ini sebagai akun dengan nama
 * pemain. Hanya untuk perangkat yang belum punya akun. Poin game yang baru selesai
 * ikut masuk ke akun baru. Bila nama sudah dipakai akun lain, pemain diminta
 * mengganti nama akun (nama di room tidak berubah).
 */
export default function AccountPrompt({ roundId, playerId, name, avatar, isAdmin, onRegistered }: Props) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<Phase>("ask");
  const [accountName, setAccountName] = useState(name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [awarded, setAwarded] = useState(0);

  const dismissKey = `ssk:acct-prompt:${roundId}`;

  // Tampil sedikit tertunda supaya momen kemenangan (mahkota, confetti) tidak tertutup.
  useEffect(() => {
    if (!roundId || !playerId || !name || isAdmin) return;
    if (getAccounts().length > 0) return;
    try {
      if (sessionStorage.getItem(dismissKey)) return;
    } catch {
      /* sessionStorage bisa diblokir; abaikan */
    }
    const id = setTimeout(() => setVisible(true), 2200);
    return () => clearTimeout(id);
  }, [roundId, playerId, name, isAdmin, dismissKey]);

  useEffect(() => {
    if (name) setAccountName((n) => n || name);
  }, [name]);

  function close(remember: boolean) {
    if (remember) {
      try {
        sessionStorage.setItem(dismissKey, "1");
      } catch {
        /* abaikan */
      }
    }
    setClosing(true);
  }

  async function handleRegister(nameToUse: string) {
    const trimmed = nameToUse.trim();
    if (!trimmed || phase === "busy") return;
    const from: Phase = phase === "rename" ? "rename" : "ask";
    setPhase("busy");
    setError(null);
    try {
      const res = await registerAccount(trimmed, avatar ?? "🙂", {
        playerId,
        roundId: roundId ?? undefined,
      });
      setAwarded(res.awarded);
      setPhase("done");
      onRegistered?.();
      setTimeout(() => close(false), res.awarded > 0 ? 2600 : 1800);
    } catch (e: any) {
      const code = e instanceof AccountError ? e.code : "OTHER";
      if (code === "NAME_TAKEN") {
        setAccountName(trimmed);
        setError(`Nama “${trimmed}” sudah dipakai akun lain. Ganti nama akunmu:`);
        setPhase("rename");
      } else if (code === "DEVICE_LIMIT") {
        setPhase("limit");
      } else {
        // eslint-disable-next-line no-console
        console.error("register_account error:", e);
        setError(code === "INVALID_NAME" ? "Nama akun tidak valid." : "Gagal mendaftarkan akun. Coba lagi.");
        setPhase(from);
      }
    }
  }

  if (!visible) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm",
        closing ? "fade-out" : "fade-in",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acct-title"
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) setVisible(false);
      }}
    >
      <div
        className={[
          "w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-soft",
          closing ? "sheet-out" : "spring-in",
        ].join(" ")}
      >
        {phase === "done" ? (
          <div className="animate-pop-in py-2">
            <div className="text-5xl">✅</div>
            <h2 id="acct-title" className="mt-2 text-xl font-extrabold text-ink">
              Akun terdaftar
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {avatar} {accountName} sekarang dikenali di perangkat ini.
            </p>
            <p className="mt-2 text-sm font-semibold text-accent-deep">
              {awarded > 0
                ? `Poin game ini masuk: +${awarded} 🏆 +${awarded} 🪙`
                : "Poin dihitung mulai game berikutnya."}
            </p>
          </div>
        ) : phase === "limit" ? (
          <>
            <div className="text-5xl">🚫</div>
            <h2 id="acct-title" className="mt-2 text-xl font-extrabold text-ink">
              Batas akun tercapai
            </h2>
            <p className="mt-2 text-sm text-ink">
              Perangkat ini sudah memiliki {MAX_ACCOUNTS_PER_DEVICE} akun dan tidak bisa menambah akun baru lagi.
            </p>
            <button
              onClick={() => close(true)}
              className="mt-5 w-full rounded-2xl bg-bg-end py-3 text-sm font-semibold text-ink transition active:scale-95"
            >
              Mengerti
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl">{avatar ?? "🙂"}</div>
            <h2 id="acct-title" className="mt-2 text-xl font-extrabold text-ink">
              Daftarkan akun?
            </h2>

            {phase === "rename" ? (
              <>
                <p className="mt-2 animate-shake text-sm font-medium text-coral-text" role="alert">
                  {error}
                </p>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  maxLength={16}
                  autoFocus
                  aria-label="Nama akun"
                  placeholder="Nama akun"
                  className="mt-3 w-full rounded-2xl bg-bg-end px-4 py-3 text-center font-semibold text-ink outline-none focus:ring-2 focus:ring-accent-to"
                />
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink">
                  Daftarkan perangkat ini sebagai akun dengan nama <b>{name}</b>?
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Poin game ini ikut masuk ke akunmu. Kalau tidak, kamu tetap bisa main sebagai guest.
                </p>
                {error && (
                  <p className="mt-3 animate-shake text-sm font-medium text-coral-text" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => handleRegister(phase === "rename" ? accountName : name ?? "")}
                disabled={phase === "busy" || (phase === "rename" && !accountName.trim())}
                className="sheen w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
              >
                {phase === "busy" ? "Mendaftarkan…" : phase === "rename" ? "Daftarkan dengan nama ini" : "Ya, daftarkan"}
              </button>
              <button
                onClick={() => close(true)}
                disabled={phase === "busy"}
                className="w-full rounded-2xl bg-bg-end py-3 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-50"
              >
                Nanti saja (tetap guest)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
