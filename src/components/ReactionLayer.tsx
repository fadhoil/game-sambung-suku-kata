"use client";

import { useEffect, useRef, useState } from "react";
import {
  useRoomReactions,
  type CustomReactionEvent,
  type EmojiKind,
  type ReactionEvent,
} from "@/lib/useRoomReactions";
import {
  isSoundEnabled,
  sfxEmojiTease,
  sfxEmojiLaugh,
  sfxEmojiAngry,
} from "@/lib/sound";
import { emojiAssetUrl, listMyEmojis, type MyEmoji } from "@/lib/gameActions";
import { playEmojiSound, useEmojiBubbles } from "@/components/EmojiBubbles";

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

/** Path datang dari klien lain: terima hanya path Storage polos (tanpa "..", skema, dsb). */
const safePath = (p: unknown): p is string => typeof p === "string" && /^[\w./-]+$/.test(p) && !p.includes("..");

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
  /**
   * true = 3 tombol panel memakai emoji toko yang dipasang di inventory akun
   * (slot kosong tetap emoji bawaan). Dipakai di room & result.
   */
  equippable?: boolean;
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
  equippable = false,
}: Props) {
  const { spawn, layer } = useEmojiBubbles();
  const [equipped, setEquipped] = useState<MyEmoji[]>([]);

  useEffect(() => {
    if (!equippable) return;
    listMyEmojis()
      .then((list) => setEquipped(list.filter((e) => e.slot !== null)))
      .catch(() => {});
  }, [equippable]);

  function handleIncoming(ev: ReactionEvent) {
    spawn({ char: EMOJI_CHAR[ev.emoji] });
    playEmojiSfx(ev.emoji);
  }

  function handleCustomIncoming(ev: CustomReactionEvent) {
    if (!safePath(ev?.image_path) || !safePath(ev?.sound_path)) return;
    spawn({ src: emojiAssetUrl(ev.image_path) });
    if (isSoundEnabled()) playEmojiSound(emojiAssetUrl(ev.sound_path));
  }

  const api = useRoomReactions(roomCode, {
    onReaction: handleIncoming,
    onCustomReaction: handleCustomIncoming,
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
      {layer}

      {/* Panel emoji terkunci bawah-tengah (bisa digeser ke atas via offset).
          Penonton tidak mendapat panel kirim. */}
      {canSend && (
      <div
        className="fixed left-1/2 z-30 mb-3 -translate-x-1/2"
        style={{ bottom: bottomOffsetPx }}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-soft">
          {(Object.keys(EMOJI_CHAR) as EmojiKind[]).map((kind, i) => {
            // Slot i+1: emoji toko bila terpasang, selain itu emoji bawaan.
            const mine = equipped.find((e) => e.slot === i + 1);
            return (
              <button
                key={kind}
                onClick={() =>
                  mine
                    ? api.sendCustomReaction({ image_path: mine.image_path, sound_path: mine.sound_path })
                    : handleClick(kind)
                }
                className="rounded-xl px-2 py-1 text-2xl transition hover:-translate-y-0.5 active:scale-90"
                aria-label={mine ? mine.name : EMOJI_LABEL[kind]}
                title={mine ? mine.name : EMOJI_LABEL[kind]}
              >
                {mine ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={emojiAssetUrl(mine.image_path)} alt="" className="h-8 w-8 object-contain" />
                ) : (
                  EMOJI_CHAR[kind]
                )}
              </button>
            );
          })}
        </div>
      </div>
      )}
    </>
  );
}
