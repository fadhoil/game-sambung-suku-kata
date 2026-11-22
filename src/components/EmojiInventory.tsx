"use client";

import { useCallback, useEffect, useState } from "react";
import { emojiAssetUrl, listMyEmojis, setEmojiSlot, type MyEmoji } from "@/lib/gameActions";

const SLOTS = [1, 2, 3];

/**
 * Inventory pemain: emoji yang sudah dibeli + 3 slot. Emoji di slot n menggantikan
 * tombol emoji ke-n di panel reaksi pada halaman room & hasil.
 */
export default function EmojiInventory({
  onPreview,
}: {
  onPreview: (e: { image_path: string; sound_path: string }) => void;
}) {
  const [items, setItems] = useState<MyEmoji[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listMyEmojis());
      setError(null);
    } catch {
      setError("Gagal memuat inventory. Coba lagi nanti.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Pasang ke slot; menekan slot yang sama lagi = melepas. */
  async function toggle(e: MyEmoji, slot: number) {
    if (busy) return;
    setBusy(true);
    try {
      await setEmojiSlot(slot, e.slot === slot ? null : e.id);
      await load();
    } catch {
      setError("Gagal menyimpan slot. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  if (items === null) {
    return error ? (
      <p className="rounded-3xl bg-white p-6 text-center text-sm font-medium text-coral-text shadow-soft">{error}</p>
    ) : (
      <p className="animate-pulse-soft p-6 text-center text-sm text-ink-soft">Memuat…</p>
    );
  }

  return (
    <>
      <section className="rise mb-4 rounded-3xl bg-white p-4 shadow-soft-sm">
        <h2 className="text-sm font-extrabold text-ink">Slot emoji</h2>
        <p className="text-[11px] text-ink-soft">Dipakai di halaman room &amp; hasil. Slot kosong memakai emoji bawaan.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {SLOTS.map((n) => {
            const mine = items.find((e) => e.slot === n);
            return (
              <div key={n} className="flex flex-col items-center rounded-2xl bg-bg-end/60 p-2">
                <div className="flex h-14 w-14 items-center justify-center">
                  {mine ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={emojiAssetUrl(mine.image_path)} alt={mine.name} className="h-12 w-12 object-contain" />
                  ) : (
                    <span className="text-xs font-semibold text-ink-soft">Kosong</span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-ink">Slot {n}</span>
              </div>
            );
          })}
        </div>
      </section>

      {error && <p className="mb-3 text-center text-sm font-medium text-coral-text">{error}</p>}

      {items.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-center text-sm text-ink-soft shadow-soft">
          Belum punya emoji. Beli dulu di tab Toko.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {items.map((e) => (
            <li key={e.id} className="flex flex-col items-center rounded-3xl bg-white p-3 text-center shadow-soft-sm">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-bg-end/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={emojiAssetUrl(e.image_path)} alt={e.name} loading="lazy" className="h-20 w-20 object-contain" />
              </div>
              <p className="mt-2 w-full truncate text-sm font-extrabold text-ink">{e.name}</p>
              <button
                onClick={() => onPreview(e)}
                className="mt-1 w-full rounded-xl bg-bg-end px-2 py-1.5 text-xs font-bold text-ink transition active:scale-95"
              >
                👁 Preview
              </button>
              <div className="mt-2 flex w-full gap-1">
                {SLOTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => toggle(e, n)}
                    disabled={busy}
                    aria-pressed={e.slot === n}
                    aria-label={e.slot === n ? `Lepas dari slot ${n}` : `Pasang di slot ${n}`}
                    className={[
                      "flex-1 rounded-xl py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50",
                      e.slot === n
                        ? "sheen bg-gradient-to-r from-accent-from to-accent-to text-ink shadow-soft-sm"
                        : "bg-bg-end text-ink-soft",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
