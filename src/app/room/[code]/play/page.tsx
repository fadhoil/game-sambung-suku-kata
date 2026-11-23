"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoomRealtime } from "@/lib/useRoomRealtime";
import { getIdentity } from "@/lib/session";
import { submitWord, resolveTimeout, endGame } from "@/lib/gameActions";
import { supabase } from "@/lib/supabaseClient";
import TimerRing from "@/components/TimerRing";
import WordChain from "@/components/WordChain";
import WordInput from "@/components/WordInput";
import PlayerChip from "@/components/PlayerChip";
import Countdown from "@/components/Countdown";
import RelaxNotice from "@/components/RelaxNotice";
import { usePresence } from "@/lib/usePresence";
import ReactionLayer from "@/components/ReactionLayer";
import FullscreenButton from "@/components/FullscreenButton";
import { stagger } from "@/lib/motion";
import EndGameConfirm from "@/components/EndGameConfirm";
import { unlockAudio, sfxValid, sfxInvalid, sfxTick, sfxEliminated } from "@/lib/sound";
import { validateCandidate } from "@/lib/dictionary";
import type { Move } from "@/types/game";

export default function Play() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const { room, players, teams, round, loading } = useRoomRealtime(code);
  const identity = getIdentity(code);
  const online = usePresence(code, identity?.playerId ?? null);

  const [now, setNow] = useState(Date.now());
  const [words, setWords] = useState<string[]>([]);
  const [showCountdown, setShowCountdown] = useState(true);
  const [showRelax, setShowRelax] = useState(false);
  const relaxSeenRef = useRef<string | null>(null);
  const [endingBusy, setEndingBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const timeoutFiredRef = useRef<string | null>(null);
  const prevAliveCountRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(99);

  // Input mengambang (menempel di atas keyboard) HANYA untuk mobile non-Safari.
  // Safari (termasuk iOS) & desktop pakai input inline seperti biasa, karena
  // Safari tidak menyusutkan layout saat keyboard muncul (floating bisa ketutup).
  const [useFloatingInput, setUseFloatingInput] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
    const isTouchMobile =
      (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) ||
      /android|iphone|ipad|ipod/i.test(ua);
    setUseFloatingInput(isTouchMobile && !isSafari);
  }, []);

  // Buka audio pada interaksi pertama (mobile butuh ini).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Clock lokal (untuk render countdown). Kebenaran tetap di server.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Hitung mundur HANYA sekali di awal permainan (giliran pertama), bukan
  // setiap pergantian giliran. Patokannya: belum ada kata valid yang disambung
  // (rantai masih cuma kata awal) DAN ronde masih sangat muda.
  // words.length > 1 artinya sudah ada sambungan -> jangan tampilkan countdown.
  useEffect(() => {
    if (!round) {
      setShowCountdown(false);
      return;
    }
    if (words.length > 1) {
      setShowCountdown(false); // sudah ada sambungan -> permainan sudah jalan
      return;
    }
    const startedAt = new Date(round.turn_started_at).getTime();
    const ageSec = (Date.now() - startedAt) / 1000;
    // Hanya tampilkan bila ronde benar-benar baru (dalam jendela grace 5 detik).
    setShowCountdown(ageSec < 5);
  }, [round?.id, words.length]);

  // Pop-up keringanan: tampil sekali saat target baru saja dilonggarkan (relaxed).
  // Ditandai per-episode dengan kombinasi id + full_syllable agar tidak berulang.
  useEffect(() => {
    if (!round) return;
    const key = `${round.id}:${round.current_word}:${round.full_syllable}:${round.required_syllable}:${round.relaxed}`;
    if (round.relaxed && relaxSeenRef.current !== key) {
      // Tampil hanya jika turn masih dalam jendela hold (deadline - 3 detik belum lewat).
      const startedAt = new Date(round.turn_started_at).getTime();
      const ageSec = (Date.now() - startedAt) / 1000;
      if (ageSec < 3) {
        relaxSeenRef.current = key;
        setShowRelax(true);
      }
    }
    if (!round.relaxed) {
      // reset agar episode relaxed berikutnya bisa tampil lagi
      relaxSeenRef.current = null;
    }
  }, [round?.id, round?.current_word, round?.relaxed, round?.full_syllable, round?.required_syllable, round?.turn_started_at]);

  // Pindah halaman saat selesai
  useEffect(() => {
    if (room?.status === "finished") router.push(`/room/${code}/result`);
    if (room?.status === "lobby") router.push(`/room/${code}`);
  }, [room?.status, code, router]);

  // Muat rantai kata dari moves valid
  useEffect(() => {
    if (!round?.id) return;
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("moves")
        .select("*")
        .eq("round_id", round!.id)
        .eq("is_valid", true)
        .order("created_at", { ascending: true });
      if (!active) return;
      const valid = (data ?? []) as Move[];
      const chain = [round!.starting_word, ...valid.map((m) => m.word)];
      setWords(chain);
    }
    load();

    const ch = supabase
      .channel(`moves:${round.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "moves", filter: `round_id=eq.${round.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [round?.id, round?.starting_word]);

  const deadline = round ? new Date(round.turn_deadline).getTime() : 0;
  const total = room?.timer_seconds ?? 7;
  // Selama hitung mundur ATAU pop-up keringanan, bekukan timer di nilai penuh.
  // Deadline server sudah punya grace (5 detik countdown / 3 detik keringanan).
  const remaining = showCountdown || showRelax
    ? total
    : Math.max(0, (deadline - now) / 1000);

  const activePlayer = useMemo(
    () => players.find((p) => p.id === round?.active_subject_id),
    [players, round?.active_subject_id]
  );
  const activeTeam = useMemo(
    () => teams.find((t) => t.id === round?.active_team_id),
    [teams, round?.active_team_id]
  );
  const myPlayer = useMemo(
    () => players.find((p) => p.id === identity?.playerId),
    [players, identity?.playerId]
  );
  // Penonton (masuk saat game berjalan / memilih menonton) bukan pemain yang tereliminasi.
  const amSpectator = !!myPlayer?.is_spectator;
  const amEliminated = !!myPlayer && !myPlayer.is_alive && !amSpectator;
  const isHost = !!identity && room?.host_player_id === identity.playerId;
  const isMyTurn = !!identity && round?.active_subject_id === identity.playerId;

  // Resolusi timeout: begitu deadline lewat, SIAPA PUN klien yang melihatnya
  // memicu resolve_timeout. Fungsi SQL idempoten (cek deadline lagi + FOR UPDATE),
  // jadi aman meski beberapa klien memicu bersamaan. Ini memastikan giliran tetap
  // berjalan walau pemain yang sedang giliran menutup HP / disconnect.
  useEffect(() => {
    if (!round || round.status !== "active") return;
    if (showCountdown || showRelax) return; // tahan timeout selama countdown/keringanan
    if (remaining > 0) {
      timeoutFiredRef.current = null;
      return;
    }
    const fireKey = round.id + round.turn_deadline;
    if (timeoutFiredRef.current === fireKey) return;
    timeoutFiredRef.current = fireKey;
    resolveTimeout(round.id).catch(() => {});
  }, [remaining, round, showCountdown, showRelax]);

  // Bunyi tik pada 3 detik terakhir (sekali per detik).
  useEffect(() => {
    if (showCountdown || !round || round.status !== "active") return;
    const secs = Math.ceil(remaining);
    if (secs <= 3 && secs >= 1 && secs !== lastTickRef.current) {
      lastTickRef.current = secs;
      sfxTick();
    }
    if (secs > 3) lastTickRef.current = 99;
  }, [remaining, showCountdown, round]);

  // Bunyi eliminasi saat jumlah pemain hidup berkurang.
  useEffect(() => {
    const aliveNow = players.filter((p) => p.is_alive).length;
    if (prevAliveCountRef.current !== null && aliveNow < prevAliveCountRef.current) {
      sfxEliminated();
    }
    prevAliveCountRef.current = aliveNow;
  }, [players]);

  async function handleSubmit(word: string) {
    if (!round || !identity) return { ok: false };
    const res = await submitWord(round.id, identity.playerId, word);
    if (res.ok) sfxValid();
    else if (res.reason && res.reason !== "timeout") sfxInvalid();
    return res;
  }

  async function handleEndGame() {
    if (!room || !identity) return;
    setEndingBusy(true);
    try {
      await endGame(room.id, identity.playerId);
    } catch {
      setEndingBusy(false);
    }
    setConfirmEnd(false);
  }

  if (loading || !room || !round) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-soft">
        <span className="animate-pulse-soft">Memuat permainan…</span>
      </main>
    );
  }

  // Peserta = bukan penonton. Penonton ditampilkan terpisah dan tidak dihitung "bertahan".
  const participants = players.filter((p) => !p.is_spectator);
  const spectators = players.filter((p) => p.is_spectator);
  const alivePlayers = participants.filter((p) => p.is_alive);

  // Sisa detik hitung mundur, sinkron dari turn_started_at ronde pertama.
  const countdownLeft = round
    ? Math.ceil(5 - (now - new Date(round.turn_started_at).getTime()) / 1000)
    : 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6 pb-28">
      {showCountdown && (
        <Countdown
          seconds={Math.max(1, Math.min(5, countdownLeft))}
          onDone={() => setShowCountdown(false)}
        />
      )}

      {showRelax && !showCountdown && (
        <RelaxNotice
          syllable={round.required_syllable}
          fullSyllable={round.full_syllable ?? round.required_syllable}
          seconds={3}
          onDone={() => setShowRelax(false)}
        />
      )}

      {/* Header: status + tombol fullscreen + tombol host akhiri permainan */}
      <div className="rise mb-3 flex items-center justify-between gap-2" style={stagger(0)}>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-soft shadow-soft-sm">
          Room {code}
        </span>
        <div className="flex items-center gap-2">
          <FullscreenButton
            compact
            className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink shadow-soft-sm active:scale-95"
          />
          {isHost && (
            <button
              onClick={() => setConfirmEnd(true)}
              disabled={endingBusy}
              className="rounded-full bg-coral-bg/30 px-3 py-1 text-xs font-bold text-coral-text active:scale-95 disabled:opacity-50"
            >
              {endingBusy ? "…" : "⏹ Akhiri"}
            </button>
          )}
        </div>
      </div>

      {/* Banner penonton (bukan pemain) */}
      {amSpectator && (
        <div className="animate-pop-in mb-3 rounded-2xl bg-accent-to/15 p-3 text-center text-sm font-semibold text-accent-deep">
          👀 Kamu menonton. Kamu akan ikut bermain di ronde berikutnya jika host memulai lagi.
        </div>
      )}

      {/* Banner penonton jika tereliminasi */}
      {amEliminated && (
        <div className="animate-pop-in mb-3 rounded-2xl bg-coral-bg/20 p-3 text-center text-sm font-semibold text-coral-text">
          💀 Kamu sudah tereliminasi — mode menonton
        </div>
      )}

      {/* Rantai kata (di atas, agar kata yang sedang berlangsung mudah dilihat) */}
      <section className="rise mb-4" style={stagger(1)}>
        <p className="mb-1 text-xs font-semibold text-ink-soft">Rantai kata</p>
        <WordChain words={words} />
      </section>

      {/* Panel utama */}
      <section className="rise mb-4 flex flex-col items-center gap-3 rounded-3xl bg-white p-6 shadow-soft" style={stagger(1)}>
        <div className="text-center">
          <p className="text-xs font-semibold text-ink-soft">Sambung dari</p>
          <p
            key={round.required_syllable}
            className="syllable-pop text-4xl font-extrabold uppercase tracking-wider text-accent-deep"
          >
            -{round.required_syllable}
          </p>
          {round.relaxed && (
            <span className="mt-1 inline-block rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-ink">
              🎁 keringanan (-{round.full_syllable} dilonggarkan)
            </span>
          )}
        </div>

        <TimerRing remaining={remaining} total={total} />

        <div className="text-center" aria-live="polite">
          {activeTeam && (
            <span
              className="mb-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold text-white"
              style={{ background: activeTeam.color }}
            >
              {activeTeam.name}
            </span>
          )}
          <p className="text-sm text-ink-soft">
            Giliran:{" "}
            <span key={activePlayer?.id ?? "none"} className="inline-block animate-slide-in font-bold text-ink">
              {activePlayer ? `${activePlayer.avatar} ${activePlayer.name}` : "…"}
            </span>
          </p>
        </div>
      </section>

      {/* Input area. Mobile non-Safari: saat giliranku tampil sebagai floating
          bar di bawah (lihat blok fixed). Safari/desktop: inline di sini. */}
      <section className="rise mb-4" style={stagger(2)}>
        {amEliminated || amSpectator ? (
          <div key="out" className="animate-pop-in rounded-3xl bg-bg-end p-4 text-center text-sm text-ink-soft">
            👀 Kamu menonton. Nantikan siapa pemenangnya!
          </div>
        ) : isMyTurn ? (
          useFloatingInput ? (
            <div key="mine-float" className="rounded-3xl bg-accent-to/10 p-4 text-center text-sm font-semibold text-accent-deep">
              ✍️ Giliranmu! Ketik jawaban di kotak bawah.
            </div>
          ) : (
            <div key="mine" className="turn-glow animate-pop-in rounded-3xl">
              <WordInput
                required={round.required_syllable}
                onSubmit={handleSubmit}
                disabled={remaining <= 0 || showCountdown}
                preCheck={(w) =>
                  validateCandidate(
                    w,
                    round.required_syllable,
                    new Set(words.map((x) => x.toLowerCase()))
                  )
                }
              />
            </div>
          )
        ) : (
          <div key="wait" className="animate-pop-in rounded-3xl bg-bg-end p-4 text-center text-sm text-ink-soft">
            <span className="animate-pulse-soft">
              Menunggu {activePlayer ? activePlayer.name : "pemain"} menyambung…
            </span>
          </div>
        )}
      </section>

      {/* Daftar pemain */}
      <section className="rise mt-auto" style={stagger(4)}>
        <p className="mb-2 text-xs font-semibold text-ink-soft">
          Bertahan ({alivePlayers.length}/{participants.length})
        </p>
        <div className="grid grid-cols-2 gap-2">
          {participants.map((p) => (
            <PlayerChip
              key={p.id}
              player={p}
              isActive={p.id === round.active_subject_id}
              teamColor={teams.find((t) => t.id === p.team_id)?.color}
              showLives={room.max_lives > 1}
              online={online.has(p.id)}
              isMe={p.id === identity?.playerId}
            />
          ))}
        </div>

        {spectators.length > 0 && (
          <>
            <p className="mb-2 mt-3 text-xs font-semibold text-ink-soft">
              👀 Penonton ({spectators.length})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {spectators.map((p) => (
                <PlayerChip
                  key={p.id}
                  player={p}
                  online={online.has(p.id)}
                  isMe={p.id === identity?.playerId}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Floating input (mobile non-Safari): kotak jawaban ditempel di bawah,
          di atas keyboard. Panel emoji berada di ATAS kotak input ini. */}
      {useFloatingInput && isMyTurn && !amEliminated && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 px-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-md turn-glow rounded-3xl">
            <WordInput
              required={round.required_syllable}
              onSubmit={handleSubmit}
              disabled={remaining <= 0 || showCountdown}
              preCheck={(w) =>
                validateCandidate(
                  w,
                  round.required_syllable,
                  new Set(words.map((x) => x.toLowerCase()))
                )
              }
            />
          </div>
        </div>
      )}

      <ReactionLayer
        roomCode={code}
        bottomOffsetPx={useFloatingInput && isMyTurn && !amEliminated ? 84 : 0}
        canSend={!amSpectator}
        equippable
      />
      {isHost && identity && (
        <EndGameConfirm
          open={confirmEnd}
          roomId={room.id}
          playerId={identity.playerId}
          busy={endingBusy}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={handleEndGame}
        />
      )}
    </main>
  );
}
