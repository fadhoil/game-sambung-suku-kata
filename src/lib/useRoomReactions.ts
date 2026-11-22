"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

export type EmojiKind = "tease" | "laugh" | "angry";

export interface ReactionEvent {
  emoji: EmojiKind;
}

/** Emoji kustom dari toko: yang dikirim hanya path file Storage (bukan file-nya). */
export interface CustomReactionEvent {
  image_path: string;
  sound_path: string;
}

/** Jenis event ready-check (informasional, broadcast-only — tidak ke DB). */
export interface ReadyOpenEvent {
  /* tidak ada payload tambahan; sekadar penanda host membuka ready-check */
}
export interface ReadyAnswerEvent {
  playerId: string;
  ready: boolean;
}

interface Handlers {
  onReaction?: (ev: ReactionEvent) => void;
  onCustomReaction?: (ev: CustomReactionEvent) => void;
  onReadyOpen?: (ev: ReadyOpenEvent) => void;
  onReadyAnswer?: (ev: ReadyAnswerEvent) => void;
}

interface ReactionApi {
  sendReaction: (emoji: EmojiKind) => void;
  sendCustomReaction: (ev: CustomReactionEvent) => void;
  openReadyCheck: () => void;
  answerReadyCheck: (playerId: string, ready: boolean) => void;
}

/**
 * Hook realtime untuk reaksi emoji + ready-check lewat Supabase broadcast.
 * Tidak menulis apa pun ke database — murni channel broadcast ephemeral.
 *
 * Satu channel per room: `reactions:CODE` dengan broadcast self:true agar
 * pengirim juga melihat reaksinya sendiri.
 */
export function useRoomReactions(
  roomCode: string | null,
  handlers: Handlers
): ReactionApi {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Simpan handler terbaru via ref agar tidak perlu re-subscribe tiap render.
  const handlersRef = useRef<Handlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase.channel(`reactions:${roomCode.toUpperCase()}`, {
      config: { broadcast: { self: true } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "emoji" }, ({ payload }) => {
        handlersRef.current.onReaction?.(payload as ReactionEvent);
      })
      .on("broadcast", { event: "emoji:custom" }, ({ payload }) => {
        handlersRef.current.onCustomReaction?.(payload as CustomReactionEvent);
      })
      .on("broadcast", { event: "readycheck:open" }, ({ payload }) => {
        handlersRef.current.onReadyOpen?.((payload ?? {}) as ReadyOpenEvent);
      })
      .on("broadcast", { event: "readycheck:answer" }, ({ payload }) => {
        handlersRef.current.onReadyAnswer?.(payload as ReadyAnswerEvent);
      })
      .subscribe();

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  function sendReaction(emoji: EmojiKind) {
    channelRef.current?.send({ type: "broadcast", event: "emoji", payload: { emoji } });
  }

  function sendCustomReaction(ev: CustomReactionEvent) {
    channelRef.current?.send({ type: "broadcast", event: "emoji:custom", payload: ev });
  }

  function openReadyCheck() {
    channelRef.current?.send({ type: "broadcast", event: "readycheck:open", payload: {} });
  }

  function answerReadyCheck(playerId: string, ready: boolean) {
    channelRef.current?.send({
      type: "broadcast",
      event: "readycheck:answer",
      payload: { playerId, ready },
    });
  }

  return { sendReaction, sendCustomReaction, openReadyCheck, answerReadyCheck };
}
