"use client";

import { forwardRef } from "react";
import type { Player, Team } from "@/types/game";

export interface ShareMember {
  key: string;
  avatar: string;
  name: string;
  words: number;
  isMvp: boolean;
  /** Poin game ini (skor 🏆 dan koin 🪙 masing-masing); null/undefined = guest. */
  points?: number | null;
}

interface Props {
  isTeam: boolean;
  winnerLabel: string;
  rankedPlayers: Player[];
  rankedTeams: Team[];
  chainLength: number;
  joinUrl: string;
  /** Mode tim: anggota per tim (key tim -> daftar anggota). */
  teamMembers?: Record<string, ShareMember[]>;
  /** Mode tim: MVP tim pemenang. */
  mvp?: { avatar: string; name: string; words: number } | null;
  /** Mode FFA: poin game ini per pemain (id pemain -> poin). */
  pointsByPlayer?: Record<string, number>;
}

/** Lencana poin (inline style: kartu ini di-capture jadi gambar, tanpa class Tailwind). */
function pillStyle(fontSize: number): React.CSSProperties {
  return {
    fontSize,
    fontWeight: 800,
    color: "#3C74B6",
    background: "rgba(113,165,222,0.2)",
    borderRadius: 999,
    padding: "1px 7px",
    whiteSpace: "nowrap",
  };
}

function medal(i: number): string {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `#${i + 1}`;
}

/**
 * Kartu hasil yang di-capture jadi gambar untuk dibagikan.
 * Lebar tetap (fit untuk story/feed), desain eye-catching + ajakan join.
 */
const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard(
  { isTeam, winnerLabel, rankedPlayers, rankedTeams, chainLength, joinUrl, teamMembers, mvp, pointsByPlayer },
  ref
) {
  const topList = isTeam
    ? rankedTeams.slice(0, 6).map((t) => ({ key: t.id, label: t.name, color: t.color }))
    : rankedPlayers
        .slice(0, 6)
        .map((p) => ({ key: p.id, label: `${p.avatar} ${p.name}`, color: undefined, points: pointsByPlayer?.[p.id] ?? null }));

  return (
    <div
      ref={ref}
      style={{
        width: 420,
        padding: 28,
        background: "linear-gradient(160deg, #EAF1FB 0%, #F6ECF6 60%, #FDF0E6 100%)",
        fontFamily: "var(--font-display), system-ui, sans-serif",
        color: "#2B2B33",
        borderRadius: 28,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Sambung Suku Kata"
          loading="eager"
          decoding="sync"
          style={{ width: 240, maxWidth: "100%", height: "auto", margin: "0 auto", display: "block" }}
        />
        <div style={{ fontSize: 12, color: "#7A7A88", marginTop: 4 }}>
          Hasil Permainan
        </div>
      </div>

      {/* Juara */}
      <div
        style={{
          borderRadius: 20,
          background: "#FFFFFF",
          padding: "18px 16px",
          textAlign: "center",
          boxShadow: "0 8px 24px -12px rgba(100,110,140,0.35)",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 34 }}>👑</div>
        <div style={{ fontSize: 12, color: "#7A7A88", fontWeight: 600 }}>
          {isTeam ? "Tim Juara" : "Juara"}
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            background: "linear-gradient(90deg,#3C74B6,#C4B5FD)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {winnerLabel}
        </div>

        {isTeam && mvp && mvp.words > 0 && (
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 14,
              background: "linear-gradient(90deg,#FDE68A,#FCA5A5)",
              padding: "8px 14px",
            }}
          >
            <span style={{ fontSize: 18 }}>⭐</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#2B2B33" }}>
              MVP: {mvp.avatar} {mvp.name}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5A5A66" }}>
              {mvp.words} kata
            </span>
          </div>
        )}
      </div>

      {/* Peringkat */}
      <div
        style={{
          borderRadius: 20,
          background: "#FFFFFF",
          padding: 16,
          boxShadow: "0 8px 24px -14px rgba(100,110,140,0.3)",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7A7A88", marginBottom: 10 }}>
          🏅 Peringkat {isTeam ? "Tim" : "Pemain"} (bertahan terlama)
        </div>
        {topList.map((item, i) => {
          const members = isTeam ? teamMembers?.[item.key] ?? [] : [];
          return (
            <div
              key={item.key}
              style={{
                background: "#F1F4FA",
                borderRadius: 14,
                padding: "8px 10px",
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 26, textAlign: "center", fontSize: 15 }}>{medal(i)}</span>
                {item.color && (
                  <span
                    style={{ width: 12, height: 12, borderRadius: 999, background: item.color }}
                  />
                )}
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                {!isTeam && "points" in item && item.points != null && (
                  <span style={pillStyle(12)}>+{item.points} 🏆🪙</span>
                )}
              </div>
              {members.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 8,
                    paddingLeft: 36,
                  }}
                >
                  {members.map((m) => (
                    <span
                      key={m.key}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 999,
                        padding: "3px 9px",
                        fontSize: 11,
                        fontWeight: m.isMvp ? 800 : 600,
                        background: m.isMvp
                          ? "linear-gradient(90deg,#A5B4FC,#C4B5FD)"
                          : "#FFFFFF",
                        color: "#2B2B33",
                      }}
                    >
                      <span>{m.avatar}</span>
                      <span>{m.name}</span>
                      {m.isMvp && <span>⭐</span>}
                      <span style={{ color: "#7A7A88" }}>{m.words}</span>
                      {m.points != null && <span style={pillStyle(10)}>+{m.points} 🏆🪙</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Statistik + ajakan */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#2B2B33", fontWeight: 600 }}>
          Panjang rantai: {chainLength} kata 🔗
        </div>
        <div
          style={{
            marginTop: 12,
            borderRadius: 16,
            background: "linear-gradient(90deg,#A5B4FC,#C4B5FD)",
            padding: "12px 14px",
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          Ayo main bareng! 🎉
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#7A7A88", wordBreak: "break-all" }}>
          {joinUrl}
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
