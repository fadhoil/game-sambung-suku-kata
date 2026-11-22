"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAccount, type Account } from "@/lib/session";
import {
  buyEmoji,
  emojiAssetUrl,
  fetchAccountStats,
  listShopEmojis,
  ShopError,
  type ShopEmoji,
} from "@/lib/gameActions";
import { stagger } from "@/lib/motion";
import EmojiInventory from "@/components/EmojiInventory";
import { playEmojiSound, useEmojiBubbles } from "@/components/EmojiBubbles";

const BUY_ERR: Record<string, string> = {
  NOT_LOGGED_IN: "Masuk dengan akun dulu untuk membeli. Pilih akun di halaman utama.",
  EMOJI_NOT_FOUND: "Emoji ini sudah tidak dijual.",
  ALREADY_OWNED: "Kamu sudah memiliki emoji ini.",
  NOT_ENOUGH_COINS: "Koinmu tidak cukup.",
  OTHER: "Gagal membeli. Coba lagi.",
};

const priceLabel = (n: number) => (n === 0 ? "Gratis" : `🪙 ${n.toLocaleString("id-ID")}`);

export default function ShopPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [items, setItems] = useState<ShopEmoji[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState<ShopEmoji | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"shop" | "inv">("shop");
  const { spawn, layer } = useEmojiBubbles();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setItems(await listShopEmojis());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  const loadCoins = useCallback((a: Account | null) => {
    if (!a) return;
    fetchAccountStats()
      .then((m) => setCoins(m[a.id]?.coins ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const a = getAccount();
    setAccount(a);
    loadItems();
    loadCoins(a);
    return () => {
      audioRef.current?.pause();
    };
  }, [loadItems, loadCoins]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  function play(e: ShopEmoji) {
    audioRef.current?.pause();
    if (playingId === e.id) {
      setPlayingId(null);
      return;
    }
    const a = new Audio(emojiAssetUrl(e.sound_path));
    audioRef.current = a;
    a.onended = () => setPlayingId((id) => (id === e.id ? null : id));
    a.play().catch(() => setPlayingId(null));
    setPlayingId(e.id);
  }

  /** Pratinjau seperti di room: balon melayang + suara (semua emoji, dimiliki atau belum). */
  function preview(e: { image_path: string; sound_path: string }) {
    spawn({ src: emojiAssetUrl(e.image_path) });
    playEmojiSound(emojiAssetUrl(e.sound_path));
  }

  async function handleBuy() {
    if (!confirm || busy) return;
    const target = confirm;
    setBusy(true);
    setBuyError(null);
    try {
      const left = await buyEmoji(target.id);
      setCoins(left);
      setItems((list) => list?.map((x) => (x.id === target.id ? { ...x, owned: true } : x)) ?? list);
      setToast(`✓ “${target.name}” ditambahkan ke koleksimu`);
      setConfirm(null);
    } catch (e: any) {
      const code = e instanceof ShopError ? e.code : "OTHER";
      setBuyError(BUY_ERR[code] ?? BUY_ERR.OTHER);
      // Selaraskan tampilan dengan keadaan server.
      if (code === "ALREADY_OWNED" || code === "EMOJI_NOT_FOUND") loadItems();
      if (code === "NOT_ENOUGH_COINS") loadCoins(account);
    } finally {
      setBusy(false);
    }
  }

  function action(e: ShopEmoji): { label: string; disabled: boolean; primary: boolean } {
    if (e.owned) return { label: "✓ Dimiliki", disabled: true, primary: false };
    if (!account) return { label: "Perlu akun", disabled: true, primary: false };
    if (coins !== null && coins < e.price) return { label: "Koin kurang", disabled: true, primary: false };
    return { label: "Beli", disabled: false, primary: true };
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
      <div className="rise mb-4 flex items-center justify-between gap-2" style={stagger(0)}>
        <Link href="/" className="shrink-0 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-soft-sm">
          ← Kembali
        </Link>
        <h1 className="min-w-0 truncate text-base font-extrabold text-ink min-[360px]:text-xl">🛒 Toko Emoji</h1>
        <span
          className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-center text-xs font-bold text-ink shadow-soft-sm"
          title="Koinmu"
        >
          {account ? `🪙 ${coins === null ? "…" : coins.toLocaleString("id-ID")}` : "Guest"}
        </span>
      </div>

      {!account && (
        <p className="rise mb-4 rounded-2xl bg-white/80 p-3 text-center text-xs text-ink-soft shadow-soft-sm" style={stagger(1)}>
          Kamu belum memakai akun. Pilih atau daftarkan akun di halaman utama untuk mengumpulkan koin 🪙 dan membeli emoji.
        </p>
      )}

      <div className="rise mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-soft-sm" style={stagger(1)}>
        {(["shop", "inv"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "rounded-xl py-2 text-sm font-bold transition active:scale-95",
              tab === t ? "bg-gradient-to-r from-accent-from to-accent-to text-ink" : "text-ink-soft",
            ].join(" ")}
          >
            {t === "shop" ? "🛒 Toko" : "🎒 Inventory"}
          </button>
        ))}
      </div>

      {tab === "inv" ? (
        account ? <EmojiInventory onPreview={preview} /> : null
      ) : failed ? (
        <p className="animate-shake rounded-3xl bg-white p-6 text-center text-sm font-medium text-coral-text shadow-soft">
          Gagal memuat toko. Coba lagi nanti.
        </p>
      ) : items === null ? (
        <p className="animate-pulse-soft p-6 text-center text-sm text-ink-soft">Memuat…</p>
      ) : items.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-center text-sm text-ink-soft shadow-soft">
          Belum ada emoji di etalase. Cek lagi nanti!
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {items.map((e, i) => {
            const act = action(e);
            return (
              <li
                key={e.id}
                className="rise flex flex-col items-center rounded-3xl bg-white p-3 text-center shadow-soft-sm"
                style={stagger(Math.min(i + 1, 10))}
              >
                <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-bg-end/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={emojiAssetUrl(e.image_path)} alt={e.name} loading="lazy" className="h-20 w-20 object-contain" />
                  <button
                    onClick={() => play(e)}
                    aria-label={`Dengar suara ${e.name}`}
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm shadow-soft-sm transition active:scale-90"
                  >
                    {playingId === e.id ? "⏹" : "🔊"}
                  </button>
                </div>
                <p className="mt-2 w-full truncate text-sm font-extrabold text-ink">{e.name}</p>
                <p className="text-xs font-bold text-accent-deep">{priceLabel(e.price)}</p>
                <button
                  onClick={() => preview(e)}
                  className="mt-1 w-full rounded-xl bg-bg-end px-2 py-1.5 text-xs font-bold text-ink transition active:scale-95"
                >
                  👁 Preview
                </button>
                <button
                  onClick={() => {
                    setBuyError(null);
                    setConfirm(e);
                  }}
                  disabled={act.disabled}
                  className={[
                    "mt-2 w-full whitespace-nowrap rounded-xl px-2 py-2 text-xs font-bold transition active:scale-95",
                    act.primary
                      ? "sheen bg-gradient-to-r from-accent-from to-accent-to text-ink shadow-soft-sm"
                      : "bg-bg-end text-ink-soft",
                    "disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  {act.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {layer}

      {toast && (
        <div
          role="status"
          className="animate-pop-in fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-white shadow-soft"
        >
          {toast}
        </div>
      )}

      {confirm && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="buy-title"
        >
          <div className="spring-in w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emojiAssetUrl(confirm.image_path)} alt="" className="mx-auto h-20 w-20 object-contain" />
            <h2 id="buy-title" className="mt-2 text-lg font-extrabold text-ink">
              Beli “{confirm.name}”?
            </h2>
            <p className="mt-1 text-sm text-ink">
              Harga <b>{priceLabel(confirm.price)}</b>
            </p>
            {coins !== null && (
              <p className="mt-1 text-xs text-ink-soft">
                Koinmu {coins.toLocaleString("id-ID")} → sisa {(coins - confirm.price).toLocaleString("id-ID")} 🪙
              </p>
            )}
            {buyError && (
              <p key={buyError} className="mt-3 animate-shake text-sm font-medium text-coral-text" role="alert">
                {buyError}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={handleBuy}
                disabled={busy}
                className="sheen w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
              >
                {busy ? "Membeli…" : "Ya, beli"}
              </button>
              <button
                onClick={() => setConfirm(null)}
                disabled={busy}
                className="w-full rounded-2xl bg-bg-end py-3 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
