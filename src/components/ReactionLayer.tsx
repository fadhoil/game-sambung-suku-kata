"use client";

import { useEffect, useRef, useState } from "react";
import {
  useRoomReactions,
  type EmojiKind,
  type ReactionEvent,
} from "@/lib/useRoomReactions";
import {
  sfxEmojiTease,
  sfxEmojiLaugh,
  sfxEmojiAngry,
} from "@/lib/sound";

const EMOJI_CHAR: Record<EmojiKind, string> = {
  tease: "\uD83D\uDE1C", // 😜
  laugh: "\uD83D\uDE02", // 😂
  angry: "\uD83D\uDE21", // 😡
};

const EMOJI_LABEL: Record<EmojiKind, string> = {
  tease: "Ngeledek",
  laugh: "Ketawa",
  angry: "Marah",
};

function playEmojiSfx(kind: EmojiKind) {
  if (kind === "tease") sfxEmojiTease();
  else if (kind === "laugh") sfxEmojiLaugh();
  else sfxEmojiAngry();
}

interface FloatingEmoji {
  id: number;
  emoji: EmojiKind;
  left: number; // persen posisi horizontal
}

interface Props {
  roomCode: string;
  /** Teruskan API hook ke pemanggil (untuk ready-check), opsional. */
  onReady?: (api: ReturnType<typeof useRoomReactions>) => void;
  /** Handler event ready-check (opsional; hanya dipakai di lobby). */
  onReadyOpen?: () => void;
  onReadyAnswer?: (ev: { playerId: string; ready: boolean }) => void;
  /** Geser panel emoji ke atas (px) agar tidak menutupi floating input. */
  bottomOffsetPx?: number;
  /**
   * false = hanya menerima (emoji orang lain tetap terlihat & terdengar) tanpa panel kirim.
   * Dipakai untuk penonton agar tidak mengganggu permainan.
   */
  canSend?: boolean;
}

/**
 * Panel emoji terkunci di bawah-tengah + overlay balon naik.
 * Overlay ber-pointer-events:none agar tidak pernah merebut fokus/menutupi input.
 */
export default function ReactionLayer({
  roomCode,
  onReady,
  onReadyOpen,
  onReadyAnswer,
  bottomOffsetPx = 0,
  canSend = true,
}: Props) {
  const [floats, setFloats] = useState<FloatingEmoji[]>([]);
  const idRef = useRef(0);

  function spawn(kind: EmojiKind) {
    const id = ++idRef.current;
    // Sebar posisi horizontal acak di sekitar tengah (30%-70%).
    const left = 30 + Math.random() * 40;
    setFloats((prev) => [...prev, { id, emoji: kind, left }]);
    // Hapus setelah animasi selesai (~2s).
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id));
    }, 2100);
  }

  function handleIncoming(ev: ReactionEvent) {
    spawn(ev.emoji);
    playEmojiSfx(ev.emoji);
  }

  const api = useRoomReactions(roomCode, {
    onReaction: handleIncoming,
    onReadyOpen: onReadyOpen,
    onReadyAnswer: onReadyAnswer,
  });

  // Beri tahu pemanggil tentang API (sekali, saat siap).
  const apiRef = useRef(api);
  apiRef.current = api;
  useEffect(() => {
    onReady?.(apiRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick(kind: EmojiKind) {
    if (!canSend) return;
    api.sendReaction(kind);
    // SFX lokal langsung; incoming self (self:true) juga memicu, tapi itu
    // akan terdengar nyaris bersamaan — cukup tetap responsif dipicu di sini.
  }

  return (
    <>
      {/* Overlay animasi — TIDAK menerima pointer agar input tetap fokus. */}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {floats.map((f) => (
          <span
            key={f.id}
            className="emoji-rise absolute bottom-24 text-5xl"
            style={{ left: `${f.left}%` }}
          >
            {EMOJI_CHAR[f.emoji]}
          </span>
        ))}
      </div>

      {/* Panel emoji terkunci bawah-tengah (bisa digeser ke atas via offset).
          Penonton tidak mendapat panel kirim. */}
      {canSend && (
      <div
        className="fixed left-1/2 z-30 mb-3 -translate-x-1/2"
        style={{ bottom: bottomOffsetPx }}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-soft">
          {(Object.keys(EMOJI_CHAR) as EmojiKind[]).map((kind) => (
            <button
              key={kind}
              onClick={() => handleClick(kind)}
              className="rounded-xl px-2 py-1 text-2xl transition hover:-translate-y-0.5 active:scale-90"
              aria-label={EMOJI_LABEL[kind]}
              title={EMOJI_LABEL[kind]}
            >
              {EMOJI_CHAR[kind]}
            </button>
          ))}
        </div>
      </div>
      )}
    </>
  );
}
