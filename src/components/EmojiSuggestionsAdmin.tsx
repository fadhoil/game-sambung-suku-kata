"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminApproveEmojiSuggestion,
  adminListEmojiSuggestions,
  adminRejectEmojiSuggestion,
  emojiAssetUrl,
  type EmojiSuggestion,
} from "@/lib/gameActions";
import { EMOJI_NAME_MAX, EMOJI_PRICE_MAX } from "@/lib/emojiLimits";
import { emojiInputCls } from "@/components/EmojiFileFields";

const ERR: Record<string, string> = {
  BAD_PIN: "Sesi PIN kedaluwarsa, buka ulang halaman.",
  NAME_TAKEN: "Nama itu sudah dipakai emoji lain. Ubah namanya dulu.",
  INVALID_NAME: `Nama harus 1–${EMOJI_NAME_MAX} karakter.`,
  INVALID_PRICE: `Harga harus bilangan bulat 0–${EMOJI_PRICE_MAX.toLocaleString("id-ID")}.`,
};
const errText = (e: unknown, fallback: string) => {
  const msg = String((e as { message?: string; code?: string })?.message || (e as { code?: string })?.code || "");
  const hit = Object.keys(ERR).find((k) => msg.includes(k));
  return hit ? ERR[hit] : fallback;
};

/** Panel konfirmasi usulan emoji pemain: admin menentukan nama + harga lalu Terima, atau Tolak. */
export default function EmojiSuggestionsAdmin({
  pin,
  onApproved,
  onPreview,
}: {
  pin: string;
  onApproved: () => void;
  onPreview: (e: { image_path: string; sound_path: string }) => void;
}) {
  const [list, setList] = useState<EmojiSuggestion[] | null>(null);
  const [edits, setEdits] = useState<Record<string, { name: string; price: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await adminListEmojiSuggestions(pin));
      setError(null);
    } catch (e) {
      setError(errText(e, "Gagal memuat usulan emoji."));
    }
  }, [pin]);

  useEffect(() => {
    load();
  }, [load]);

  const get = (s: EmojiSuggestion) => edits[s.id] ?? { name: s.name, price: "" };
  const set = (s: EmojiSuggestion, patch: Partial<{ name: string; price: string }>) =>
    setEdits((prev) => ({ ...prev, [s.id]: { ...get(s), ...patch } }));

  async function approve(s: EmojiSuggestion) {
    const { name, price } = get(s);
    setBusyId(s.id);
    setError(null);
    setOk(null);
    try {
      await adminApproveEmojiSuggestion(pin, s.id, name.trim(), Number(price));
      setOk(`✓ “${name.trim()}” diterima dan tampil di toko.`);
      await load();
      onApproved();
    } catch (e) {
      setError(errText(e, "Gagal menerima usulan."));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(s: EmojiSuggestion) {
    setBusyId(s.id);
    setError(null);
    setOk(null);
    try {
      await adminRejectEmojiSuggestion(pin, s.id);
      setOk(`Usulan “${s.name}” ditolak.`);
      await load();
    } catch (e) {
      setError(errText(e, "Gagal menolak usulan."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rise w-full rounded-3xl bg-white p-4 shadow-soft">
      <h2 className="text-base font-extrabold text-ink">Usulan Emoji{list ? ` (${list.length})` : ""}</h2>
      <p className="mt-1 text-xs text-ink-soft">Dari pemain. Tentukan harga lalu Terima agar tampil di toko.</p>

      {error && (
        <p key={error} className="mt-3 animate-shake text-sm font-medium text-coral-text" role="alert">
          {error}
        </p>
      )}
      {ok && <p className="mt-3 animate-pop-in text-sm font-semibold text-sage-text">{ok}</p>}

      {list === null ? (
        !error && <p className="mt-3 animate-pulse-soft text-sm text-ink-soft">Memuat…</p>
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Belum ada usulan emoji.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {list.map((s) => {
            const { name, price } = get(s);
            const priceOk = /^\d+$/.test(price) && Number(price) <= EMOJI_PRICE_MAX;
            const nameOk = name.trim().length >= 1 && name.trim().length <= EMOJI_NAME_MAX;
            const busy = busyId === s.id;
            return (
              <li key={s.id} className="rounded-2xl bg-bg-end/60 p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={emojiAssetUrl(s.image_path)} alt="" className="h-14 w-14 shrink-0 object-contain" />
                  <p className="min-w-0 flex-1 text-xs text-ink-soft">
                    Diusulkan oleh <b className="text-ink">{s.suggested_by ?? "—"}</b>
                  </p>
                  <button
                    onClick={() => onPreview(s)}
                    aria-label={`Preview ${s.name}`}
                    className="min-h-[44px] shrink-0 rounded-xl bg-white px-3 text-xs font-bold text-ink shadow-soft-sm transition active:scale-95"
                  >
                    👁 Preview
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_6.5rem] gap-2">
                  <input
                    value={name}
                    onChange={(e) => set(s, { name: e.target.value })}
                    maxLength={EMOJI_NAME_MAX}
                    className={emojiInputCls}
                    aria-label="Nama emoji"
                  />
                  <input
                    value={price}
                    onChange={(e) => set(s, { price: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    inputMode="numeric"
                    placeholder="Harga 🪙"
                    className={emojiInputCls}
                    aria-label="Harga koin"
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => reject(s)}
                    disabled={busy}
                    className="min-h-[44px] rounded-xl bg-white px-2 text-sm font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => approve(s)}
                    disabled={busy || !nameOk || !priceOk}
                    className="sheen min-h-[44px] rounded-xl bg-gradient-to-r from-accent-from to-accent-to px-2 text-sm font-bold text-ink shadow-soft-sm transition active:scale-95 disabled:opacity-50"
                  >
                    {busy ? "Memproses…" : "Terima"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
