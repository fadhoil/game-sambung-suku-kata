"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  listSuggestions,
  reviewSuggestion,
  listActiveRooms,
  joinRoom,
  type WordSuggestion,
  type ActiveRoom,
} from "@/lib/gameActions";
import { saveIdentity, ADMIN_AVATAR } from "@/lib/session";
import EmojiAdmin from "@/components/EmojiAdmin";

/**
 * Halaman khusus (direct link) untuk mengonfirmasi usulan kata satu per satu.
 * Dilindungi PIN: daftar & aksi review hanya bisa dipanggil dengan PIN benar
 * (diverifikasi di server, bukan di sini). Setuju -> kata langsung masuk kamus.
 */
export default function KamusAdmin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [list, setList] = useState<WordSuggestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [view, setView] = useState<"suggestions" | "lobbies" | "emoji">("suggestions");
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);

  async function handleUnlock() {
    setError(null);
    setBusy(true);
    try {
      const rows = await listSuggestions(pin.trim());
      setAuthed(true);
      setList(rows);
      setIdx(0);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("BAD_PIN")) setError("PIN salah.");
      else setError("Gagal memuat usulan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(approve: boolean) {
    const current = list[idx];
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await reviewSuggestion(current.id, approve, pin.trim());
      if (res.ok) {
        setInfo(
          approve
            ? res.already
              ? `"${res.word}" sudah ada di kamus (dilewati)`
              : `"${res.word}" ditambahkan ke kamus ✓`
            : `"${res.word}" ditolak`
        );
      }
      // Lanjut ke usulan berikutnya.
      setIdx((i) => i + 1);
      setTimeout(() => setInfo(null), 1800);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("BAD_PIN")) setError("Sesi PIN kedaluwarsa, buka ulang halaman.");
      else setError("Gagal memproses. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    setBusy(true);
    setError(null);
    try {
      const rows = await listSuggestions(pin.trim());
      setList(rows);
      setIdx(0);
    } catch {
      setError("Gagal memuat ulang.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadRooms() {
    setBusy(true);
    setError(null);
    try {
      const rows = await listActiveRooms(pin.trim());
      setRooms(rows);
      setRoomsLoaded(true);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("BAD_PIN")) setError("Sesi PIN kedaluwarsa, buka ulang halaman.");
      else setError("Gagal memuat lobi aktif. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinAsAdmin(roomCode: string) {
    setJoiningCode(roomCode);
    setError(null);
    try {
      const res = await joinRoom(roomCode, "Admin-SSK", ADMIN_AVATAR, true);
      saveIdentity(roomCode, {
        playerId: res.player_id,
        name: "Admin-SSK",
        avatar: ADMIN_AVATAR,
        isAdmin: true,
      });
      router.push(`/room/${roomCode}`);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("ROOM_NOT_FOUND")) setError("Room tidak ditemukan.");
      else if (msg.includes("ROOM_NOT_JOINABLE")) setError("Room sudah selesai atau dibubarkan.");
      else if (msg.includes("ROOM_FULL")) setError("Room penuh (maks 16).");
      else if (msg.includes("BAD_PIN")) setError("Sesi PIN kedaluwarsa, buka ulang halaman.");
      else setError("Gagal ikut bermain. Coba lagi.");
      setJoiningCode(null);
    }
  }

  const STATUS_LABEL: Record<ActiveRoom["status"], string> = {
    lobby: "Menunggu",
    playing: "Bermain",
    finished: "Selesai",
  };
  const STATUS_CLASS: Record<ActiveRoom["status"], string> = {
    lobby: "bg-sage-bg/40 text-sage-text",
    playing: "bg-cream text-ink",
    finished: "bg-bg-end text-ink-soft",
  };

  // ---- Gerbang PIN ----
  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-5 px-5">
        <div className="w-full rounded-3xl bg-white p-6 text-center shadow-soft">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 text-lg font-extrabold text-ink">Konfirmasi Usulan Kata</h1>
          <p className="mt-1 text-xs text-ink-soft">Masukkan PIN akses untuk melanjutkan.</p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            inputMode="numeric"
            placeholder="PIN"
            className="mt-4 w-full rounded-2xl bg-bg-end px-4 py-3 text-center text-xl font-bold tracking-[0.4em] text-ink outline-none focus:ring-2 focus:ring-accent-to"
          />
          {error && <p className="mt-3 text-sm font-medium text-coral-text">{error}</p>}
          <button
            onClick={handleUnlock}
            disabled={busy || pin.trim().length === 0}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "Membuka…" : "Buka"}
          </button>
        </div>
      </main>
    );
  }

  // ---- Panel review ----
  const current = list[idx];
  const done = idx >= list.length;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-5 py-10">
      {/* Pemilih tampilan: Usulan Kata / Lobi Aktif */}
      <div className="grid w-full grid-cols-3 gap-2">
        <button
          onClick={() => setView("suggestions")}
          className={[
            "rounded-2xl py-2.5 text-sm font-bold shadow-soft-sm transition active:scale-95",
            view === "suggestions"
              ? "bg-gradient-to-r from-accent-from to-accent-to text-ink"
              : "bg-white text-ink-soft",
          ].join(" ")}
        >
          Usulan Kata
        </button>
        <button
          onClick={() => {
            setView("lobbies");
            setError(null);
            if (!roomsLoaded) handleLoadRooms();
          }}
          className={[
            "rounded-2xl py-2.5 text-sm font-bold shadow-soft-sm transition active:scale-95",
            view === "lobbies"
              ? "bg-gradient-to-r from-accent-from to-accent-to text-ink"
              : "bg-white text-ink-soft",
          ].join(" ")}
        >
          Lobi Aktif
        </button>
        <button
          onClick={() => {
            setView("emoji");
            setError(null);
          }}
          className={[
            "rounded-2xl py-2.5 text-sm font-bold shadow-soft-sm transition active:scale-95",
            view === "emoji"
              ? "bg-gradient-to-r from-accent-from to-accent-to text-ink"
              : "bg-white text-ink-soft",
          ].join(" ")}
        >
          Emoji
        </button>
      </div>

      {view === "emoji" ? (
        <EmojiAdmin pin={pin.trim()} />
      ) : view === "lobbies" ? (
        <div className="w-full rounded-3xl bg-white p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-base font-extrabold text-ink">Lobi Aktif</h1>
            <button
              onClick={handleLoadRooms}
              disabled={busy}
              className="rounded-full bg-bg-end px-3 py-1 text-xs font-semibold text-ink-soft transition active:scale-95 disabled:opacity-50"
            >
              {busy ? "Memuat…" : "🔄 Muat ulang"}
            </button>
          </div>

          {error && (
            <p className="mb-3 text-center text-sm font-medium text-coral-text">{error}</p>
          )}

          {!roomsLoaded ? (
            <p className="text-center text-sm text-ink-soft">Memuat lobi…</p>
          ) : rooms.length === 0 ? (
            <p className="text-center text-sm text-ink-soft">Belum ada room aktif.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {rooms.map((r) => (
                <div
                  key={r.code}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-bg-end p-3"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold tracking-widest text-ink">{r.code}</p>
                    <p className="text-[11px] text-ink-soft">
                      {r.player_count} pemain · {new Date(r.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={[
                        "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                        STATUS_CLASS[r.status],
                      ].join(" ")}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.status === "lobby" && (
                      <button
                        onClick={() => handleJoinAsAdmin(r.code)}
                        disabled={joiningCode === r.code}
                        className="rounded-xl bg-gradient-to-r from-accent-from to-accent-to px-3 py-1.5 text-xs font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
                      >
                        {joiningCode === r.code ? "Masuk…" : "Ikut Bermain"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="w-full rounded-3xl bg-white p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-base font-extrabold text-ink">Usulan Kata</h1>
          <span className="rounded-full bg-bg-end px-3 py-1 text-xs font-semibold text-ink-soft">
            {done ? list.length : idx + 1} / {list.length}
          </span>
        </div>

        {info && (
          <p className="mb-3 rounded-2xl bg-sage-bg/30 px-3 py-2 text-center text-sm font-medium text-sage-text">
            {info}
          </p>
        )}
        {error && (
          <p className="mb-3 text-center text-sm font-medium text-coral-text">{error}</p>
        )}

        {done ? (
          <div className="text-center">
            <div className="text-4xl">✅</div>
            <p className="mt-2 text-sm text-ink-soft">
              Semua usulan sudah ditinjau.
            </p>
            <button
              onClick={handleRefresh}
              disabled={busy}
              className="mt-4 w-full rounded-2xl bg-white py-3 font-semibold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
            >
              {busy ? "Memuat…" : "🔄 Muat usulan baru"}
            </button>
          </div>
        ) : current ? (
          <>
            <div className="rounded-2xl bg-bg-end p-5 text-center">
              <p className="text-3xl font-extrabold tracking-wide text-ink">{current.word}</p>
              <p className="mt-2 text-[11px] text-ink-soft">
                {current.suggested_by ? `oleh ${current.suggested_by}` : "anonim"}
                {current.room_code ? ` · room ${current.room_code}` : ""}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleReview(false)}
                disabled={busy}
                className="rounded-2xl bg-coral-bg/20 py-3.5 font-bold text-coral-text transition active:scale-95 disabled:opacity-50"
              >
                ✕ Tolak
              </button>
              <button
                onClick={() => handleReview(true)}
                disabled={busy}
                className="rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3.5 font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
              >
                ✓ Setuju
              </button>
            </div>
          </>
        ) : null}
      </div>
      )}
    </main>
  );
}
