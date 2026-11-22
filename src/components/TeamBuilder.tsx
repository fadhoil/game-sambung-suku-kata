"use client";

import { useState } from "react";
import type { Player, Team } from "@/types/game";
import { createTeam, assignPlayerTeam, removePlayerTeam } from "@/lib/gameActions";

const TEAM_PRESETS = [
  { name: "Tim Langit", color: "#71A5DE" },
  { name: "Tim Peach", color: "#FBCFE8" },
  { name: "Tim Sage", color: "#A7D7C5" },
  { name: "Tim Cream", color: "#FDE2C8" },
];

interface Props {
  roomId: string;
  hostId: string;
  players: Player[];
  teams: Team[];
}

export default function TeamBuilder({ roomId, hostId, players, teams }: Props) {
  const [busy, setBusy] = useState(false);

  async function addTeam() {
    if (teams.length >= 4 || busy) return;
    setBusy(true);
    const preset = TEAM_PRESETS[teams.length];
    try {
      await createTeam(roomId, hostId, preset.name, preset.color);
    } finally {
      setBusy(false);
    }
  }

  async function assign(playerId: string, teamId: string) {
    setBusy(true);
    try {
      await assignPlayerTeam(roomId, hostId, playerId, teamId);
    } finally {
      setBusy(false);
    }
  }

  async function removeFromTeam(playerId: string) {
    setBusy(true);
    try {
      await removePlayerTeam(roomId, hostId, playerId);
    } finally {
      setBusy(false);
    }
  }

  async function autoAssign() {
    if (teams.length < 2 || busy) return;
    setBusy(true);
    try {
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length; i++) {
        const team = teams[i % teams.length];
        await assignPlayerTeam(roomId, hostId, shuffled[i].id, team.id);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-bg-end p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">Atur Tim</h3>
        <div className="flex gap-2">
          <button
            onClick={addTeam}
            disabled={teams.length >= 4 || busy}
            className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-soft-sm disabled:opacity-40"
          >
            + Tim
          </button>
          <button
            onClick={autoAssign}
            disabled={teams.length < 2 || busy}
            className="rounded-xl bg-accent-to/20 px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
          >
            🎲 Acak
          </button>
        </div>
      </div>

      {teams.length < 2 && (
        <p className="mb-3 text-xs text-ink-soft">Butuh minimal 2 tim untuk mulai.</p>
      )}

      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.id} className="animate-pop-in rounded-xl bg-white p-3 shadow-soft-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: team.color }} />
              <span className="text-sm font-bold text-ink">{team.name}</span>
              <span className="text-xs text-ink-soft">
                ({players.filter((p) => p.team_id === team.id).length})
              </span>
            </div>
            <div className="space-y-1.5">
              {players
                .filter((p) => p.team_id === team.id)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg bg-bg-end px-2 py-1.5"
                  >
                    <span className="flex-1 truncate text-xs font-medium text-ink">
                      {p.avatar} {p.name}
                    </span>
                    {/* Pindahkan ke tim lain */}
                    {teams
                      .filter((t) => t.id !== team.id)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => assign(p.id, t.id)}
                          disabled={busy}
                          className="h-5 w-5 rounded text-[9px] font-bold text-white disabled:opacity-40"
                          style={{ background: t.color }}
                          title={`Pindahkan ke ${t.name}`}
                        >
                          →
                        </button>
                      ))}
                    {/* Keluarkan dari tim */}
                    <button
                      onClick={() => removeFromTeam(p.id)}
                      disabled={busy}
                      className="rounded bg-coral-bg/20 px-1.5 py-0.5 text-[9px] font-bold text-coral-text disabled:opacity-40"
                      title="Keluarkan dari tim"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              {players.filter((p) => p.team_id === team.id).length === 0 && (
                <p className="text-[11px] text-ink-soft">Belum ada anggota.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pemain belum punya tim */}
      {players.some((p) => !p.team_id) && teams.length >= 1 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-ink-soft">Belum punya tim:</p>
          <div className="space-y-2">
            {players
              .filter((p) => !p.team_id)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-ink">
                    {p.avatar} {p.name}
                  </span>
                  <div className="flex gap-1">
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => assign(p.id, t.id)}
                        disabled={busy}
                        className="h-6 w-6 rounded-md text-[10px] font-bold text-white disabled:opacity-40"
                        style={{ background: t.color }}
                        title={`Masukkan ke ${t.name}`}
                      >
                        →
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
