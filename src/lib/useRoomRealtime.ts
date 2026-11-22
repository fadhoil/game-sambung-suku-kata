"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import type { Room, Player, Team, Round } from "@/types/game";

interface RoomState {
  room: Room | null;
  players: Player[];
  teams: Team[];
  round: Round | null;
  loading: boolean;
}

/**
 * Subscribe ke seluruh state sebuah room secara realtime.
 * Memuat snapshot awal lalu mendengarkan perubahan Postgres.
 */
export function useRoomRealtime(roomCode: string | null): RoomState & { refresh: () => void } {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!roomCode) return;
    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode.toUpperCase())
      .maybeSingle();

    if (!roomData) {
      setLoading(false);
      return;
    }
    setRoom(roomData as Room);

    const [{ data: playerData }, { data: teamData }] = await Promise.all([
      supabase.from("players").select("*").eq("room_id", roomData.id).order("turn_order"),
      supabase.from("teams").select("*").eq("room_id", roomData.id).order("turn_order"),
    ]);
    setPlayers((playerData ?? []) as Player[]);
    setTeams((teamData ?? []) as Team[]);

    if (roomData.current_round_id) {
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roomData.current_round_id)
        .maybeSingle();
      setRound((roundData as Round) ?? null);
    } else {
      setRound(null);
    }
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!room?.id) return;
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `room_id=eq.${room.id}` },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` },
        () => loadAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, loadAll]);

  return { room, players, teams, round, loading, refresh: loadAll };
}
