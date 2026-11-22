"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useRoomRealtime } from "@/lib/useRoomRealtime";
import { getIdentity } from "@/lib/session";
import { setRoomSettings, startGame, cancelRoom, kickPlayer, leaveRoom, getHostLock, setSpectator } from "@/lib/gameActions";
import PlayerChip from "@/components/PlayerChip";
import VoiceChat from "@/components/VoiceChat";
import TeamBuilder from "@/components/TeamBuilder";
import RulesModal from "@/components/RulesModal";
import FullscreenButton from "@/components/FullscreenButton";
import QrModal from "@/components/QrModal";
import SuggestWordModal from "@/components/SuggestWordModal";
import { usePresence } from "@/lib/usePresence";
import ReactionLayer from "@/components/ReactionLayer";
import { useRoomReactions } from "@/lib/useRoomReactions";
import { unlockAudio, sfxGameStart } from "@/lib/sound";
import { stagger } from "@/lib/motion";
import type { GameMode } from "@/types/game";

/** Durasi pop-up ready-check sebelum menutup sendiri. */
const READY_CHECK_MS = 7000;

const TIMER_OPTIONS = [5, 7, 10, 15];
const LIVES_OPTIONS = [1, 2, 3, 4, 5];

export default function Lobby() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const { room, players, teams, loading } = useRoomRealtime(code);
  const [identity, setIdentity] = useState(getIdentity(code));
  const [inviteCopied, setInviteCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  // Ready-check (informasional, broadcast-only — tidak ke DB).
  const [readyPrompt, setReadyPrompt] = useState(false);
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({});
  const reactionsApiRef = useRef<ReturnType<typeof useRoomReactions> | null>(null);
  const answeredRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);
  const readyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
  // Peran pemain/penonton. Ref dipakai handler broadcast agar selalu membaca nilai terbaru.
  const amSpectatorRef = useRef(false);
  const [specBusy, setSpecBusy] = useState(false);

  const online = usePresence(code, identity?.playerId ?? null);

  useEffect(() => {
    setIdentity(getIdentity(code));
  }, [code]);

  // Tampilkan pop-up Cara Bermain otomatis saat pertama masuk room (per room, sekali).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `ssk:rulesSeen:${code}`;
    if (!sessionStorage.getItem(key)) {
      setShowRules(true);
      sessionStorage.setItem(key, "1");
    }
  }, [code]);

  // Buka audio pada interaksi pertama (mobile butuh ini).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Saat game dimulai, pindah ke halaman play.
  // Dari lobby, status 'finished' berarti room DIBATALKAN host -> kembali ke Home.
  // Suara mulai besar: dibunyikan di SEMUA klien saat status berubah
  // lobby -> playing (host maupun pemain mengamati transisi via realtime).
  useEffect(() => {
    const status = room?.status ?? null;
    if (prevStatusRef.current === "lobby" && status === "playing") {
      sfxGameStart();
    }
    if (status) prevStatusRef.current = status;
    if (status === "playing") router.push(`/room/${code}/play`);
    if (status === "finished") {
      // Admin kembali ke kamus-admin; pemain biasa ke home dengan notifikasi.
      const me = getIdentity(code);
      router.push(me?.isAdmin ? "/kamus-admin" : "/?dismissed=1");
    }
  }, [room?.status, code, router]);

  // Ready-check: pemain menerima event 'open' -> tampilkan pop-up 7 detik.
  // Tanpa jawaban dalam 7 detik dianggap belum siap (not ready).
  useEffect(() => {
    if (!readyPrompt) return;
    const t = setTimeout(() => {
      if (!answeredRef.current && identity) {
        reactionsApiRef.current?.answerReadyCheck(identity.playerId, false);
      }
      setReadyPrompt(false);
    }, READY_CHECK_MS);
    return () => clearTimeout(t);
  }, [readyPrompt, identity]);

  function handleReadyOpen() {
    // Mulai sesi ready-check baru: reset peta + buka pop-up untuk semua PEMAIN.
    // Penonton tidak ikut main, jadi tidak diminta konfirmasi.
    setReadyMap({});
    answeredRef.current = false;
    if (!amSpectatorRef.current) setReadyPrompt(true);
    // Setelah jendela ready-check (7 detik) berakhir, warna badge pemain
    // kembali normal di SEMUA layar (hapus peta status ready).
    if (readyResetRef.current) clearTimeout(readyResetRef.current);
    readyResetRef.current = setTimeout(() => {
      setReadyMap({});
    }, READY_CHECK_MS);
  }

  function handleReadyAnswer(ev: { playerId: string; ready: boolean }) {
    setReadyMap((prev) => ({ ...prev, [ev.playerId]: ev.ready }));
  }

  // Bersihkan timer reset ready-check saat keluar halaman.
  useEffect(() => {
    return () => {
      if (readyResetRef.current) clearTimeout(readyResetRef.current);
    };
  }, []);

  function answerReady(ready: boolean) {
    if (!identity) return;
    answeredRef.current = true;
    reactionsApiRef.current?.answerReadyCheck(identity.playerId, ready);
    setReadyPrompt(false);
  }

  function startReadyCheck() {
    reactionsApiRef.current?.openReadyCheck();
  }

  // Deteksi di-kick: jika room sudah dimuat dan identitas saya ada, tetapi
  // playerId saya tidak lagi ada di daftar pemain, berarti host mengeluarkan
  // saya (atau saya keluar dari device lain). Lempar kembali ke halaman awal.
  // Ini tidak bergantung pada event DELETE realtime agar tetap andal.
  useEffect(() => {
    if (loading || !room || !identity) return;
    if (room.status !== "lobby") return;
    const stillHere = players.some((p) => p.id === identity.playerId);
    if (!stillHere) router.push("/?kicked=1");
  }, [loading, room, identity, players, router]);

  const isHost = !!identity && room?.host_player_id === identity.playerId;
  const me = players.find((p) => p.id === identity?.playerId);
  const amSpectator = !!me?.is_spectator;
  amSpectatorRef.current = amSpectator;
  // Pemain dulu, penonton dipisah (urutan relatif tetap).
  const playerList = players.filter((p) => !p.is_spectator);
  const spectatorList = players.filter((p) => p.is_spectator);

  async function handleToggleSpectator() {
    if (!room || !identity || specBusy) return;
    setSpecBusy(true);
    setError(null);
    try {
      await setSpectator(room.id, identity.playerId, !amSpectator);
    } catch (e: any) {
      const msg = String(e?.message || "");
      setError(msg.includes("ROOM_FULL") ? "Slot pemain penuh (maks 16)" : "Gagal mengubah peran");
    } finally {
      setSpecBusy(false);
    }
  }

  // Penalti host (mengakhiri game terlalu cepat): tombol Mulai terkunci sampai hitung mundur habis.
  const [lockLeft, setLockLeft] = useState(0);
  const hostPlayerId = identity?.playerId;
  const roomStatus = room?.status;
  useEffect(() => {
    if (!isHost || !hostPlayerId) return;
    let alive = true;
    getHostLock(hostPlayerId)
      .then((s) => alive && setLockLeft(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isHost, hostPlayerId, roomStatus]);
  const locked = lockLeft > 0;
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setLockLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [locked]);
  const lockLabel = `${Math.floor(lockLeft / 60)}:${String(lockLeft % 60).padStart(2, "0")}`;
  // Admin (Admin-SSK) dikenali dari identity (persisten) atau flag is_admin
  // pada data pemain miliknya sebagai cadangan.
  const isAdmin =
    !!identity &&
    (identity.isAdmin === true ||
      players.some((p) => p.id === identity.playerId && p.is_admin));
  // Tujuan kembali setelah keluar/batal: admin -> kamus-admin, lainnya -> home.
  const exitTo = isAdmin ? "/kamus-admin" : "/";

  async function handleKick(targetId: string) {
    if (!isHost || !room || !identity) return;
    try {
      await kickPlayer(room.id, identity.playerId, targetId);
    } catch {
      setError("Gagal mengeluarkan pemain");
    }
  }

  async function handleLeave() {
    if (!room || !identity) return;
    try {
      await leaveRoom(room.id, identity.playerId);
      router.push(exitTo);
    } catch {
      setError("Gagal keluar room");
    }
  }

  // Admin membubarkan permainan lalu kembali ke halaman kamus-admin.
  async function handleAdminCancel() {
    if (!isAdmin || !room || !identity) return;
    const yes = window.confirm("Batalkan permainan dan bubarkan room ini? Semua pemain akan keluar.");
    if (!yes) return;
    setBusy(true);
    try {
      await cancelRoom(room.id, identity.playerId);
      router.push("/kamus-admin");
    } catch {
      setBusy(false);
      setError("Gagal membatalkan room");
    }
  }

  async function changeMode(mode: GameMode) {
    if (!isHost || !room || !identity) return;
    await setRoomSettings(room.id, identity.playerId, mode, room.timer_seconds, room.max_lives);
  }

  async function changeTimer(t: number) {
    if (!isHost || !room || !identity) return;
    await setRoomSettings(room.id, identity.playerId, room.mode, t, room.max_lives);
  }

  async function changeLives(n: number) {
    if (!isHost || !room || !identity) return;
    await setRoomSettings(room.id, identity.playerId, room.mode, room.timer_seconds, n);
  }

  async function handleStart() {
    if (!room || !identity) return;
    setBusy(true);
    setError(null);
    try {
      await startGame(room.id, identity.playerId);
    } catch (e: any) {
      const msg = String(e?.message || "");
      const lock = msg.match(/HOST_LOCKED:(\d+)/);
      if (lock) setLockLeft(Number(lock[1]));
      else if (msg.includes("NEED_MIN_2_PLAYERS")) setError("Butuh minimal 2 pemain");
      else if (msg.includes("NEED_MIN_2_TEAMS")) setError("Butuh minimal 2 tim");
      else if (msg.includes("PLAYER_WITHOUT_TEAM")) setError("Semua pemain harus punya tim");
      else setError("Gagal memulai");
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!isHost || !room || !identity) return;
    const yes = window.confirm("Batalkan permainan dan bubarkan room ini? Semua pemain akan keluar.");
    if (!yes) return;
    setBusy(true);
    try {
      await cancelRoom(room.id, identity.playerId);
    } catch {
      setBusy(false);
      setError("Gagal membatalkan room");
    }
  }

  async function handleInvite() {
    const link =
      typeof window !== "undefined" ? `${window.location.origin}/?join=${code}` : "";
    // Coba Web Share (HP), fallback ke salin link.
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Sambung Suku Kata",
          text: `Yuk gabung main Sambung Suku Kata! Kode room: ${code}`,
          url: link,
        });
        return;
      }
    } catch {
      /* dibatalkan / tidak didukung -> fallback salin */
    }
    try {
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1800);
    } catch {
      setError("Gagal menyalin link");
    }
  }

  if (loading) {
    return (
      <Centered>
        <span className="animate-pulse-soft">Memuat room…</span>
      </Centered>
    );
  }
  if (!room) {
    return (
      <Centered>
        <p className="mb-3">Room tidak ditemukan.</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-2xl bg-white px-4 py-2 font-semibold shadow-soft-sm"
        >
          Kembali
        </button>
      </Centered>
    );
  }

  // Link undangan: buka Home dengan kode terisi otomatis (tab Gabung Room).
  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/?join=${code}` : "";

  return (
    <main className="mx-auto max-w-md px-5 py-4 pb-24">
      <div className="mb-2 flex justify-end">
        <FullscreenButton compact />
      </div>

      {/* Kode room */}
      <div className="rise mb-3 rounded-3xl bg-white p-4 text-center shadow-soft" style={stagger(0)}>
        <p className="text-[11px] font-semibold text-ink-soft">KODE ROOM</p>
        <div className="my-0.5 text-3xl font-extrabold tracking-[0.3em] text-ink" aria-label={code}>
          {code.split("").map((c, i) => (
            <span key={i} aria-hidden className="flip-in" style={{ animationDelay: `${250 + i * 80}ms` }}>
              {c}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={handleInvite}
            className="rounded-xl bg-gradient-to-r from-accent-from to-accent-to px-3 py-1.5 text-xs font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
          >
            <span key={String(inviteCopied)} className="inline-block animate-pop-in">
              {inviteCopied ? "✓ Link tersalin" : "✉️ Undang"}
            </span>
          </button>
          <button
            onClick={() => setShowQr(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-bg-end px-3 py-1.5 text-xs font-semibold text-ink transition hover:-translate-y-0.5 active:scale-95"
          >
            <Image src="/qr-icon.png" alt="" width={16} height={16} className="h-4 w-4" />
            Tampilkan QR
          </button>
        </div>
      </div>

      {/* Pemain */}
      <section className="rise mb-3" style={stagger(1)}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            Pemain <span className="text-ink-soft">({playerList.length}/16)</span>
            {spectatorList.length > 0 && (
              <span className="ml-1 text-xs font-semibold text-ink-soft">· 👀 {spectatorList.length}</span>
            )}
          </h2>
          <button
            onClick={handleToggleSpectator}
            disabled={specBusy}
            className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
            title={amSpectator ? "Ikut bermain" : "Menonton saja tanpa ikut bermain"}
          >
            {amSpectator ? "🎮 Jadi Pemain" : "👀 Jadi Penonton"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[...playerList, ...spectatorList].map((p) => (
            <PlayerChip
              key={p.id}
              player={p}
              teamColor={teams.find((t) => t.id === p.team_id)?.color}
              online={online.has(p.id)}
              isMe={p.id === identity?.playerId}
              speaking={speakingIds.has(p.id)}
              onKick={isHost && p.id !== identity?.playerId ? () => handleKick(p.id) : undefined}
              readyState={
                p.id in readyMap ? (readyMap[p.id] ? "ready" : "notready") : undefined
              }
            />
          ))}
        </div>
      </section>

      {/* Setting (host) */}
      {isHost ? (
        <section className="rise mb-3 space-y-2" style={stagger(2)}>
          <div className="rounded-2xl bg-bg-end p-3">
            <p className="mb-1.5 text-xs font-bold text-ink">Mode</p>
            <div className="grid grid-cols-2 gap-2">
              <ModeBtn active={room.mode === "ffa"} onClick={() => changeMode("ffa")}>
                👤 Free For All
              </ModeBtn>
              <ModeBtn active={room.mode === "team"} onClick={() => changeMode("team")}>
                👥 Tim
              </ModeBtn>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-bg-end p-3">
              <p className="mb-1.5 text-xs font-bold text-ink">Waktu/giliran ⏱️</p>
              <div className="grid grid-cols-4 gap-1.5">
                {TIMER_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => changeTimer(t)}
                    className={[
                      "rounded-lg py-1.5 text-xs font-bold transition active:scale-90",
                      room.timer_seconds === t
                        ? "bg-gradient-to-r from-accent-from to-accent-to text-ink shadow-soft-sm"
                        : "bg-white text-ink",
                    ].join(" ")}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-bg-end p-3">
              <p className="mb-1.5 text-xs font-bold text-ink">Nyawa ❤️</p>
              <div className="grid grid-cols-5 gap-1">
                {LIVES_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => changeLives(n)}
                    className={[
                      "rounded-lg py-1.5 text-xs font-bold transition active:scale-90",
                      room.max_lives === n
                        ? "bg-gradient-to-r from-accent-from to-accent-to text-ink shadow-soft-sm"
                        : "bg-white text-ink",
                    ].join(" ")}
                    title={`${n} nyawa`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {room.mode === "team" && (
            <TeamBuilder roomId={room.id} hostId={identity!.playerId} players={playerList} teams={teams} />
          )}
        </section>
      ) : (
        <section className="rise mb-3 rounded-2xl bg-bg-end p-3 text-center text-sm text-ink-soft" style={stagger(2)}>
          Mode: <b className="text-ink">{room.mode === "ffa" ? "Free For All" : "Tim"}</b> ·
          Timer: <b className="text-ink">{room.timer_seconds}s</b> ·
          Nyawa: <b className="text-ink">{room.max_lives}❤️</b>
          <p className="mt-0.5 text-xs"><span className="animate-pulse-soft">Menunggu host memulai…</span></p>
        </section>
      )}

      {/* Tombol Cara Bermain + Usulkan Kata untuk semua pemain */}
      <div className="rise mb-2 grid grid-cols-2 gap-2" style={stagger(3)}>
        <button
          onClick={() => setShowRules(true)}
          className="w-full rounded-2xl bg-white py-2.5 text-sm font-semibold text-ink shadow-soft-sm transition active:scale-95"
        >
          📖 Cara Bermain
        </button>
        <button
          onClick={() => setShowSuggest(true)}
          className="w-full rounded-2xl bg-white py-2.5 text-sm font-semibold text-ink shadow-soft-sm transition active:scale-95"
        >
          💡 Usulkan Kata
        </button>
      </div>

      {error && (
        <p key={error} className="mb-2 animate-shake text-center text-sm font-medium text-coral-text">
          {error}
        </p>
      )}

      {isHost && (
        <div className="rise mb-2 grid gap-2" style={stagger(4)}>
          {locked && (
            <p className="animate-pop-in text-center text-sm font-medium text-coral-text">
              Penalti karena mengakhiri game terlalu cepat. Bisa mulai lagi dalam {lockLabel}.
            </p>
          )}
          <button
            onClick={handleStart}
            disabled={busy || locked}
            className="sheen sheen-idle flex-1 rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3.5 text-base font-bold text-ink shadow-soft transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "Memulai…" : locked ? `⏳ Penalti ${lockLabel}` : "🚀 Mulai Main"}
          </button>
        </div>
      )}

      {isHost && (
        <div className="rise mb-2 grid grid-cols-2 gap-2" style={stagger(4)}>
          <button
            onClick={startReadyCheck}
            className="w-full rounded-2xl bg-white py-2.5 text-sm font-semibold text-ink shadow-soft-sm transition active:scale-95"
            aria-label="Cek kesiapan pemain"
            title="Cek kesiapan pemain"
          >
            ✅ Ready Check
          </button>
          <button
            onClick={handleCancel}
            disabled={busy}
            className="shrink-0 rounded-2xl bg-coral-bg/20 px-4 text-sm font-bold text-coral-text transition active:scale-95 disabled:opacity-50"
            aria-label="Batalkan permainan"
            title="Batalkan permainan"
          >
            ❌ Batalkan Room
          </button>
        </div>
      )}

      {/* Admin (bukan host): batalkan + keluar, keduanya balik ke kamus-admin */}
      {!isHost && (
        <div className="rise mt-2 flex items-stretch gap-2" style={stagger(5)}>
          {isAdmin && (
            <button
              onClick={handleAdminCancel}
              disabled={busy}
              className="shrink-0 rounded-2xl bg-coral-bg/20 px-4 text-sm font-bold text-coral-text transition active:scale-95 disabled:opacity-50"
              aria-label="Batalkan permainan"
              title="Batalkan permainan"
            >
              ❌ Batalkan Room
            </button>
          )}
          <button
            onClick={handleLeave}
            className="flex-1 rounded-2xl bg-white py-3 text-sm font-bold text-coral-text shadow-soft-sm transition active:scale-95"
          >
            🚪 {isAdmin ? "Keluar Room (Admin)" : "Keluar Room"}
          </button>
        </div>
      )}

      <RulesModal
        open={showRules}
        onClose={() => setShowRules(false)}
        timerSeconds={room.timer_seconds}
        maxLives={room.max_lives}
        mode={room.mode}
        autoCloseSeconds={20}
      />

      <QrModal
        open={showQr}
        onClose={() => setShowQr(false)}
        joinUrl={joinUrl}
        code={code}
      />

      <SuggestWordModal
        open={showSuggest}
        onClose={() => setShowSuggest(false)}
        roomCode={code}
        playerName={identity?.name}
      />

      <ReactionLayer
        roomCode={code}
        onReady={(api) => {
          reactionsApiRef.current = api;
        }}
        onReadyOpen={handleReadyOpen}
        onReadyAnswer={handleReadyAnswer}
        canSend={!amSpectator}
        equippable
      />

      {/* Pop-up ready-check (informasional, auto-close 7 detik). */}
      {readyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-6">
          <div className="animate-pop-in w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-soft">
            <p className="mb-1 text-lg font-bold text-ink">Sudah siap?</p>
            <p className="mb-5 text-sm text-ink-soft">
              Host mengecek kesiapan. Pop-up menutup otomatis dalam 7 detik.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => answerReady(true)}
                className="flex-1 rounded-2xl bg-sage-bg/50 py-3 text-lg font-bold text-sage-text transition hover:-translate-y-0.5 active:scale-95"
                aria-label="Siap"
              >
                ✅ Siap
              </button>
              <button
                onClick={() => answerReady(false)}
                className="flex-1 rounded-2xl bg-coral-bg/30 py-3 text-lg font-bold text-coral-text transition hover:-translate-y-0.5 active:scale-95"
                aria-label="Belum siap"
              >
                ❌ Belum
              </button>
            </div>
          </div>
        </div>
      )}

      <VoiceChat
        code={code}
        identity={identity?.playerId ?? null}
        name={identity?.name}
        onSpeakingChange={setSpeakingIds}
      />
    </main>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl py-3 text-sm font-bold transition hover:-translate-y-0.5 active:scale-95",
        active
          ? "scale-105 bg-gradient-to-r from-accent-from to-accent-to text-ink shadow-soft-sm"
          : "bg-white text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center text-ink-soft">
      {children}
    </main>
  );
}
