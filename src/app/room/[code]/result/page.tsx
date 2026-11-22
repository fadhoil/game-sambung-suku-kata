"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useRoomRealtime } from "@/lib/useRoomRealtime";
import { getIdentity } from "@/lib/session";
import { playAgain, getRoundPoints, type RoundPlayerPoints } from "@/lib/gameActions";
import { supabase } from "@/lib/supabaseClient";
import Confetti from "@/components/Confetti";
import { sfxWin } from "@/lib/sound";
import { stagger } from "@/lib/motion";
import type { Move, Player, Team } from "@/types/game";
import ShareCard, { type ShareMember } from "@/components/ShareCard";
import SuggestWordModal from "@/components/SuggestWordModal";
import VoiceChat from "@/components/VoiceChat";
import AccountPrompt from "@/components/AccountPrompt";
import RoundPoints from "@/components/RoundPoints";
import PointsPill from "@/components/PointsPill";

export default function Result() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const { room, players, teams, round } = useRoomRealtime(code);
  const identity = getIdentity(code);
  const [moves, setMoves] = useState<Move[]>([]);
  const [busy, setBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  // Poin per pemain di game ini (dihitung server); pointsVersion naik saat akun baru didaftarkan.
  const [roundPoints, setRoundPoints] = useState<Record<string, RoundPlayerPoints>>({});
  const [pointsLoaded, setPointsLoaded] = useState(false);
  const [pointsVersion, setPointsVersion] = useState(0);
  const playedWinRef = useRef(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (room?.status === "lobby") router.push(`/room/${code}`);
    if (room?.status === "playing") router.push(`/room/${code}/play`);
  }, [room?.status, code, router]);

  // Bunyi kemenangan sekali saat halaman hasil muncul.
  useEffect(() => {
    if (!playedWinRef.current) {
      playedWinRef.current = true;
      sfxWin();
    }
  }, []);

  useEffect(() => {
    if (!round?.id) return;
    supabase
      .from("moves")
      .select("*")
      .eq("round_id", round.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMoves((data ?? []) as Move[]));
  }, [round?.id]);

  useEffect(() => {
    if (!round?.id) return;
    let alive = true;
    getRoundPoints(round.id)
      .then((m) => {
        if (!alive) return;
        setRoundPoints(m);
        setPointsLoaded(true);
      })
      .catch(() => alive && setPointsLoaded(true));
    return () => {
      alive = false;
    };
  }, [round?.id, pointsVersion]);

  /** Poin pemain di game ini (null = guest / tidak ada poin). */
  const ptsOf = (playerId: string): number | null => roundPoints[playerId]?.total ?? null;
  const pointsByPlayer: Record<string, number> = Object.fromEntries(
    Object.entries(roundPoints).map(([id, r]) => [id, r.total])
  );

  const isHost = !!identity && room?.host_player_id === identity.playerId;

  const winnerPlayer = players.find((p) => p.id === round?.winner_player_id);
  const winnerTeam = teams.find((t) => t.id === round?.winner_team_id);

  const validWords = moves.filter((m) => m.is_valid);
  const chainLength = validWords.length + (round ? 1 : 0);
  const longestWord = validWords.reduce(
    (acc, m) => (m.word.length > acc.length ? m.word : acc),
    round?.starting_word ?? ""
  );

  // Jumlah kata valid per pemain (dipakai untuk MVP & daftar anggota tim).
  const validCountByPlayer = validWords.reduce<Record<string, number>>((acc, m) => {
    acc[m.player_id] = (acc[m.player_id] ?? 0) + 1;
    return acc;
  }, {});

  // Anggota tim (diurutkan: penyumbang kata terbanyak dulu).
  function teamMembers(teamId: string) {
    return players
      .filter((p) => p.team_id === teamId)
      .sort((a, b) => (validCountByPlayer[b.id] ?? 0) - (validCountByPlayer[a.id] ?? 0));
  }

  // MVP: pemain tim pemenang dengan kata valid terbanyak (mode tim).
  const mvpPlayer =
    winnerTeam
      ? players
          .filter((p) => p.team_id === winnerTeam.id)
          .sort((a, b) => (validCountByPlayer[b.id] ?? 0) - (validCountByPlayer[a.id] ?? 0))[0] ?? null
      : null;
  const mvpCount = mvpPlayer ? validCountByPlayer[mvpPlayer.id] ?? 0 : 0;

  // Angka panjang rantai naik dari nilai sebelumnya ke target (≈0,8 dtk).
  const [shownChain, setShownChain] = useState(0);
  useEffect(() => {
    const from = shownChain;
    const to = chainLength;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 800);
      const eased = 1 - Math.pow(1 - k, 3);
      setShownChain(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainLength]);

  async function handleAgain() {
    if (!room || !identity) return;
    setBusy(true);
    try {
      await playAgain(room.id, identity.playerId);
    } finally {
      setBusy(false);
    }
  }

  // ---- Peringkat (berdasarkan "bertahan terlama") ----
  // Yang masih hidup (eliminated_order null) = peringkat teratas.
  // Di antara yang tereliminasi, urutan eliminasi lebih besar = bertahan lebih lama.
  const isTeam = room?.mode === "team";

  function survivalSort<T extends { eliminated_order: number | null }>(a: T, b: T) {
    const ao = a.eliminated_order;
    const bo = b.eliminated_order;
    if (ao === null && bo === null) return 0;
    if (ao === null) return -1; // a masih hidup -> lebih tinggi
    if (bo === null) return 1;
    return bo - ao; // eliminasi lebih akhir -> peringkat lebih tinggi
  }

  // Penonton tidak ikut bermain, jadi tidak masuk peringkat.
  const rankedPlayers: Player[] = players.filter((p) => !p.is_spectator).sort(survivalSort);
  const rankedTeams: Team[] = [...teams].sort(survivalSort);

  // Data anggota tim + MVP untuk kartu share (mode tim).
  const shareTeamMembers: Record<string, ShareMember[]> = {};
  if (isTeam) {
    for (const t of rankedTeams) {
      shareTeamMembers[t.id] = teamMembers(t.id).map((p) => ({
        key: p.id,
        avatar: p.avatar,
        name: p.name,
        words: validCountByPlayer[p.id] ?? 0,
        isMvp: mvpPlayer?.id === p.id && mvpCount > 0,
        points: ptsOf(p.id),
      }));
    }
  }
  const shareMvp =
    isTeam && mvpPlayer && mvpCount > 0
      ? { avatar: mvpPlayer.avatar, name: mvpPlayer.name, words: mvpCount }
      : null;

  // Teks untuk dibagikan.
  const ptsText = (playerId: string) => {
    const n = ptsOf(playerId);
    return n === null ? "" : ` · +${n} 🏆🪙`;
  };
  function buildShareText(): string {
    const link = typeof window !== "undefined" ? `${window.location.origin}/?join=${code}` : "";
    const juara = isTeam
      ? winnerTeam?.name ?? "Seri"
      : winnerPlayer
        ? `${winnerPlayer.avatar} ${winnerPlayer.name}`
        : "Seri";
    const lines: string[] = [];
    lines.push("🔗 Sambung Suku Kata — Hasil");
    lines.push(`🏆 Juara: ${juara}`);
    if (isTeam && mvpPlayer && mvpCount > 0) {
      lines.push(`⭐ MVP: ${mvpPlayer.avatar} ${mvpPlayer.name} (${mvpCount} kata)`);
    }
    lines.push("");
    lines.push("Peringkat:");
    if (isTeam) {
      rankedTeams.forEach((t, i) => {
        lines.push(`${medal(i)} ${t.name}`);
        teamMembers(t.id).forEach((p) =>
          lines.push(`   • ${p.avatar} ${p.name} — ${validCountByPlayer[p.id] ?? 0} kata${ptsText(p.id)}`)
        );
      });
    } else {
      rankedPlayers.forEach((p, i) => lines.push(`${medal(i)} ${p.avatar} ${p.name}${ptsText(p.id)}`));
    }
    lines.push("");
    lines.push(`Panjang rantai: ${chainLength} kata`);
    lines.push(`Main bareng: ${link}`);
    return lines.join("\n");
  }

  async function handleShare() {
    const link = typeof window !== "undefined" ? `${window.location.origin}/?join=${code}` : "";
    const text = buildShareText();
    setSharing(true);
    try {
      // Capture kartu hasil jadi gambar PNG.
      let file: File | null = null;
      if (shareCardRef.current) {
        try {
          const { toPng } = await import("html-to-image");
          // Pastikan semua gambar di kartu (logo) sudah ter-load penuh,
          // kalau tidak html-to-image bisa merekam area logo jadi kosong.
          const imgs = Array.from(shareCardRef.current.querySelectorAll("img"));
          await Promise.all(
            imgs.map((img) =>
              img.complete && img.naturalWidth > 0
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                  })
            )
          );
          // Render dua kali: percobaan pertama sering "memanaskan" cache gambar,
          // percobaan kedua menghasilkan PNG dengan logo yang pasti tergambar.
          await toPng(shareCardRef.current, { pixelRatio: 2 });
          const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 2 });
          const blob = await (await fetch(dataUrl)).blob();
          file = new File([blob], "hasil-sambung-suku-kata.png", { type: "image/png" });
        } catch {
          file = null; // gagal render gambar -> fallback teks
        }
      }

      // 1) Coba share gambar (Web Share Level 2).
      if (
        file &&
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        navigator.share
      ) {
        await navigator.share({
          files: [file],
          title: "Sambung Suku Kata",
          text: `Ayo main bareng! ${link}`,
        });
        return;
      }

      // 2) Coba share teks biasa.
      if (navigator.share) {
        await navigator.share({ title: "Sambung Suku Kata", text, url: link });
        return;
      }

      // 3) Fallback desktop: unduh gambar + salin teks.
      if (file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        setShareMsg("Gambar hasil diunduh. Bagikan ke WA/IG ya!");
      } else {
        await navigator.clipboard.writeText(text);
        setShareMsg("Hasil tersalin! Tinggal tempel di WA/IG.");
      }
      setTimeout(() => setShareMsg(null), 3000);
    } catch {
      // dibatalkan pengguna atau error -> abaikan senyap, kecuali tak ada apa pun
    } finally {
      setSharing(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-10">
      <Confetti />

      <div className="rise z-10 w-full rounded-3xl bg-white p-7 text-center shadow-soft" style={stagger(0)}>
        <Image
          src="/logo.png"
          alt="Sambung Suku Kata"
          width={1536}
          height={1024}
          className="mx-auto mb-2 h-auto w-44 max-w-full"
        />
        <div className="crown-drop text-5xl">👑</div>
        <p className="rise mt-1 text-sm font-semibold text-ink-soft" style={stagger(8)}>
          Pemenang
        </p>
        <div className="rise mt-1" style={stagger(10)}>
          <h1 className="text-shimmer bg-gradient-to-r from-accent-deep via-accent-to to-accent-deep bg-clip-text text-3xl font-extrabold text-transparent">
            {winnerTeam
              ? winnerTeam.name
              : winnerPlayer
                ? `${winnerPlayer.avatar} ${winnerPlayer.name}`
                : "Seri"}
          </h1>
        </div>

        {isTeam && mvpPlayer && mvpCount > 0 && (
          <div
            className="rise mt-5 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent-from/30 to-accent-to/30 px-4 py-3"
            style={stagger(12)}
          >
            <span className="text-2xl">⭐</span>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-ink-soft">MVP Tim Juara</p>
              <p className="text-sm font-extrabold text-ink">
                {mvpPlayer.avatar} {mvpPlayer.name}
                <span className="ml-1 font-semibold text-ink-soft">· {mvpCount} kata</span>
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Panjang rantai" value={`${shownChain} kata`} index={13} />
          <Stat label="Kata terpanjang" value={longestWord.toUpperCase() || "-"} index={14} />
        </div>
      </div>

      <RoundPoints
        myRow={identity ? roundPoints[identity.playerId] ?? null : null}
        loaded={pointsLoaded}
        endedByHost={!!round?.ended_by_host}
        chainLength={chainLength}
        index={15}
        refreshKey={pointsVersion}
      />

      {/* Peringkat */}
      <div className="rise z-10 mt-4 w-full rounded-3xl bg-white p-4 shadow-soft-sm" style={stagger(16)}>
        <p className="mb-3 text-xs font-semibold text-ink-soft">
          🏅 Peringkat {isTeam ? "Tim" : "Pemain"} <span className="opacity-70">(bertahan terlama)</span>
        </p>
        <ol className="space-y-2">
          {isTeam
            ? rankedTeams.map((t, i) => {
                const members = teamMembers(t.id);
                return (
                  <li key={t.id} className="rounded-2xl bg-bg-end px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 text-center text-lg">{medal(i)}</span>
                      <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                      <span className="flex-1 text-sm font-semibold text-ink">{t.name}</span>
                      <span className="text-[11px] text-ink-soft">
                        {t.eliminated_order === null ? "Juara 🎉" : "tereliminasi"}
                      </span>
                    </div>
                    {members.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5 pl-10">
                        {members.map((p) => {
                          const isMvp = mvpPlayer?.id === p.id && mvpCount > 0;
                          return (
                            <li
                              key={p.id}
                              className={[
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                isMvp
                                  ? "bg-gradient-to-r from-accent-from to-accent-to font-bold text-ink"
                                  : "bg-white text-ink",
                              ].join(" ")}
                            >
                              <span>{p.avatar}</span>
                              <span>{p.name}</span>
                              {isMvp && <span title="MVP">⭐</span>}
                              <span className="text-ink-soft">
                                {validCountByPlayer[p.id] ?? 0}
                              </span>
                              {ptsOf(p.id) !== null && <PointsPill value={ptsOf(p.id)!} className="ml-0.5" />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })
            : rankedPlayers.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-bg-end px-3 py-2"
                >
                  <span className="w-7 text-center text-lg">{medal(i)}</span>
                  <span className="text-xl">{p.avatar}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.name}</span>
                  {ptsOf(p.id) !== null && <PointsPill value={ptsOf(p.id)!} />}
                  <span className="text-[11px] text-ink-soft">
                    {p.eliminated_order === null ? "bertahan 🎉" : "tereliminasi"}
                  </span>
                </li>
              ))}
        </ol>
      </div>

      {/* Rekap kata */}
      <div className="rise z-10 mt-4 w-full rounded-3xl bg-white/80 p-4 shadow-soft-sm" style={stagger(18)}>
        <p className="mb-2 text-xs font-semibold text-ink-soft">Rantai kata</p>
        <p className="text-sm leading-relaxed text-ink">
          {[round?.starting_word, ...validWords.map((m) => m.word)]
            .filter(Boolean)
            .join(" → ")}
        </p>
      </div>

      <div className="rise z-10 mt-6 flex w-full flex-col gap-2" style={stagger(20)}>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full rounded-2xl bg-gradient-to-r from-sage-bg to-accent-to py-3.5 font-bold text-ink shadow-soft transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
        >
          {sharing ? "Menyiapkan gambar…" : "📤 Bagikan Hasil"}
        </button>
        {shareMsg && (
          <p className="text-center text-xs font-medium text-sage-text">{shareMsg}</p>
        )}

        {isHost ? (
          <button
            onClick={handleAgain}
            disabled={busy}
            className="sheen w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3.5 font-bold text-ink shadow-soft transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            {busy ? "…" : "🔄 Main Lagi"}
          </button>
        ) : (
          <p className="text-center text-sm text-ink-soft">Menunggu host memulai ronde baru…</p>
        )}
        <button
          onClick={() => setShowSuggest(true)}
          className="w-full rounded-2xl bg-white py-3 font-semibold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
        >
          💡 Usulkan Kata
        </button>
        <button
          onClick={() => router.push("/")}
          className="w-full rounded-2xl bg-white py-3 font-semibold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
        >
          Keluar
        </button>
      </div>

      <SuggestWordModal
        open={showSuggest}
        onClose={() => setShowSuggest(false)}
        roomCode={code}
        playerName={identity?.name}
      />

      {/* Kartu share di luar layar (dipakai untuk capture gambar) */}
      <div style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }} aria-hidden>
        <ShareCard
          ref={shareCardRef}
          isTeam={isTeam}
          winnerLabel={
            isTeam
              ? winnerTeam?.name ?? "Seri"
              : winnerPlayer
                ? `${winnerPlayer.avatar} ${winnerPlayer.name}`
                : "Seri"
          }
          rankedPlayers={rankedPlayers}
          rankedTeams={rankedTeams}
          chainLength={chainLength}
          joinUrl={typeof window !== "undefined" ? `${window.location.origin}/?join=${code}` : ""}
          teamMembers={shareTeamMembers}
          mvp={shareMvp}
          pointsByPlayer={pointsByPlayer}
        />
      </div>

      <VoiceChat code={code} identity={identity?.playerId ?? null} name={identity?.name} />

      <AccountPrompt
        roundId={round?.id ?? null}
        playerId={identity?.playerId}
        name={identity?.name}
        avatar={identity?.avatar}
        isAdmin={identity?.isAdmin}
        onRegistered={() => setPointsVersion((v) => v + 1)}
      />
    </main>
  );
}

/** Lencana peringkat: emas/perak/perunggu lalu angka. */
function medal(index: number): string {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

function Stat({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <div className="rise rounded-2xl bg-bg-end p-3" style={stagger(index)}>
      <p className="text-[11px] font-semibold text-ink-soft">{label}</p>
      <p className="mt-0.5 text-base font-extrabold text-ink">{value}</p>
    </div>
  );
}
