"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * Melacak kehadiran (presence) pemain di sebuah room secara realtime.
 * Mengembalikan Set berisi playerId yang sedang BENAR-BENAR online.
 *
 * Saat tab/HP ditutup atau koneksi putus, Supabase otomatis menghapus
 * presence pemain tsb dalam beberapa detik — jadi status online jujur.
 */
export function usePresence(roomCode: string | null, playerId: string | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roomCode || !playerId) return;

    const channel = supabase.channel(`presence:${roomCode.toUpperCase()}`, {
      config: { presence: { key: playerId } },
    });

    const sync = () => {
      const state = channel.presenceState();
      setOnline(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, playerId]);

  return online;
}
