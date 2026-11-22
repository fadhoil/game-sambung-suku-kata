"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom, findActiveSession, type ActiveSession } from "@/lib/gameActions";
import AccountBar from "@/components/AccountBar";
import { saveIdentity, randomAvatar, AVATARS, getAccount, type Account } from "@/lib/session";
import FullscreenButton from "@/components/FullscreenButton";
import MuteButton from "@/components/MuteButton";
import QrScanner from "@/components/QrScanner";
import { stagger } from "@/lib/motion";
import { sfxJingle } from "@/lib/sound";

type Tab = "create" | "join";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("");
  // Nilai awal tetap (bukan acak) agar HTML server = render pertama klien; acak/prefill di efek.
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [resume, setResume] = useState<ActiveSession | null>(null);
  const [dismissedResume, setDismissedResume] = useState(false);
  const jingleRef = useRef(false);

  // Akun aktif (null = guest / pemain baru). Pemain ber-akun memakai nama akunnya
  // dan tidak bisa mengubahnya; avatar tetap bebas dipilih.
  const [activeAccount, setActiveAccountState] = useState<Account | null>(null);

  // Akun aktif: isi nama & avatar dari akun.
  useEffect(() => {
    const a = getAccount();
    setActiveAccountState(a);
    if (!a) {
      setAvatar(randomAvatar());
      return;
    }
    setName(a.name);
    setAvatar(a.avatar);
  }, []);

  // Baca parameter URL: ?join=KODE (dari link undangan) & ?dismissed=1 (room dibubarkan).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      setTab("join");
      setCode(joinCode.toUpperCase().slice(0, 6));
    }
    if (params.get("dismissed")) {
      setNotice("Room sebelumnya telah dibubarkan oleh host.");
    }
    if (params.get("kicked")) {
      setNotice("Kamu telah dikeluarkan dari room oleh host.");
    }
    // Bersihkan query dari URL agar rapi (tanpa reload).
    if (joinCode || params.get("dismissed") || params.get("kicked")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Tawarkan lanjutkan permainan: jika device ini masih punya pemain di room
  // yang belum selesai (lobby/playing), tampilkan banner "lanjut / keluar".
  useEffect(() => {
    let active = true;
    findActiveSession()
      .then((s) => {
        if (active) setResume(s);
      })
      .catch(() => {
        /* abaikan: tidak menghalangi alur buat/gabung */
      });
    return () => {
      active = false;
    };
  }, []);

  function handleResume() {
    if (!resume) return;
    // Pastikan identitas tersimpan agar halaman room mengenali "saya".
    saveIdentity(resume.room_code, {
      playerId: resume.player_id,
      name: resume.player_name,
      avatar: resume.player_avatar,
    });
    const path =
      resume.room_status === "playing"
        ? `/room/${resume.room_code}/play`
        : `/room/${resume.room_code}`;
    router.push(path);
  }

  // Jingle lembut sekali saat halaman awal dibuka (setelah interaksi pertama,
  // karena browser mobile memblokir audio sebelum ada sentuhan).
  useEffect(() => {
    const play = () => {
      if (jingleRef.current) return;
      jingleRef.current = true;
      sfxJingle();
      window.removeEventListener("pointerdown", play);
    };
    window.addEventListener("pointerdown", play);
    return () => window.removeEventListener("pointerdown", play);
  }, []);

  async function handleCreate() {
    if (!name.trim()) return setError("Isi nama dulu ya");
    setBusy(true);
    setError(null);
    try {
      const res = await createRoom(name.trim(), avatar, "ffa", 7);
      saveIdentity(res.room_code, { playerId: res.player_id, name: name.trim(), avatar });
      router.push(`/room/${res.room_code}`);
    } catch (e: any) {
      // Tampilkan pesan asli dari Supabase agar mudah di-debug.
      const detail = e?.message || e?.error_description || e?.hint || "error tidak diketahui";
      setError(`Gagal membuat room: ${detail}`);
      // eslint-disable-next-line no-console
      console.error("create_room error:", e);
      setBusy(false);
    }
  }

  async function handleJoin(overrideCode?: string) {
    const theCode = (overrideCode ?? code).trim().toUpperCase();
    if (!name.trim()) return setError("Isi nama dulu ya");
    if (theCode.length < 4) return setError("Kode room tidak valid");
    setBusy(true);
    setError(null);
    try {
      const res = await joinRoom(theCode, name.trim(), avatar);
      saveIdentity(theCode, { playerId: res.player_id, name: name.trim(), avatar });
      router.push(`/room/${theCode}`);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("ROOM_NOT_FOUND")) setError("Room tidak ditemukan");
      else if (msg.includes("ROOM_NOT_JOINABLE")) setError("Room sudah selesai atau dibubarkan");
      else if (msg.includes("ROOM_FULL")) setError("Room penuh (maks 16)");
      else {
        const detail = e?.message || e?.error_description || e?.hint || "error tidak diketahui";
        setError(`Gagal gabung room: ${detail}`);
      }
      // eslint-disable-next-line no-console
      console.error("join_room error:", e);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 py-10">
      {/* Baris atas: Ganti akun + 🏆 + 🪙 di kiri; suara & layar penuh di kanan */}
      <div className="absolute inset-x-0 top-4 mx-auto flex w-full max-w-md items-center justify-between gap-1.5 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <AccountBar
            defaultAvatar={avatar}
            onActiveChange={(a) => {
              setActiveAccountState(a);
              if (a) {
                setName(a.name);
                setAvatar(a.avatar);
              }
            }}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <MuteButton />
          <FullscreenButton compact />
        </div>
      </div>

      <div className="rise flex flex-col items-center text-center" style={stagger(0)}>
        <br/>
        <Image
          src="/logo.png"
          alt="Sambung Suku Kata"
          width={1536}
          height={1024}
          priority
          className="h-auto w-64 max-w-full drop-shadow-sm sm:w-72"
        />
        <span className="mt-2 inline-block rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 py-1.5 text-sm font-bold text-ink shadow-soft-sm">
          2–16 pemain
        </span>
      </div>

      {notice && (
        <div className="w-full rounded-2xl bg-cream/60 px-4 py-3 text-center text-sm font-medium text-ink">
          {notice}
        </div>
      )}

      {resume && !dismissedResume && (
        <div className="rise w-full rounded-3xl bg-white p-4 shadow-soft" style={stagger(1)}>
          <p className="text-sm font-bold text-ink">
            {resume.room_status === "playing"
              ? "🎮 Permainan sedang berlangsung"
              : "🔗 Kamu masih di sebuah room"}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Room <b className="tracking-widest text-ink">{resume.room_code}</b> sebagai{" "}
            <b className="text-ink">
              {resume.player_avatar} {resume.player_name}
            </b>
            . Ingin lanjut?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleResume}
              className="flex-1 rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-2.5 text-sm font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
            >
              {resume.room_status === "playing" ? "Lanjut Main" : "Kembali ke Room"}
            </button>
            <button
              onClick={() => setDismissedResume(true)}
              className="rounded-2xl bg-bg-end px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:-translate-y-0.5 active:scale-95"
            >
              Nanti
            </button>
          </div>
        </div>
      )}

      <div className="rise w-full rounded-3xl bg-white p-5 shadow-soft" style={stagger(2)}>
        {/* Avatar + nama */}
        <label className="mb-1 block text-xs font-semibold text-ink-soft">Avatar</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={[
                "h-9 w-9 rounded-xl text-lg transition hover:-translate-y-0.5 active:scale-90",
                avatar === a ? "avatar-pop bg-accent-to/20 ring-2 ring-accent-to" : "bg-bg-end",
              ].join(" ")}
              aria-label={`Pilih avatar ${a}`}
            >
              {a}
            </button>
          ))}
        </div>

        <label htmlFor="player-name" className="mb-1 block text-xs font-semibold text-ink-soft">
          Nama kamu
        </label>
        <input
          id="player-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Budi"
          maxLength={16}
          readOnly={!!activeAccount}
          aria-describedby={activeAccount ? "player-name-hint" : undefined}
          className={[
            "w-full rounded-2xl bg-bg-end px-4 py-3 font-semibold text-ink outline-none",
            activeAccount ? "cursor-not-allowed opacity-70" : "focus:ring-2 focus:ring-accent-to",
            activeAccount ? "mb-1" : "mb-4",
          ].join(" ")}
        />
        {activeAccount && (
          <p id="player-name-hint" className="mb-4 text-[11px] text-ink-soft">
            🔒 Nama mengikuti akunmu dan tidak bisa diubah. Avatar tetap bisa diganti.
          </p>
        )}

        {/* Tabs */}
        <div className="relative mb-4 grid grid-cols-2 rounded-2xl bg-bg-end p-1">
          {/* Indikator tab yang bergeser */}
          <span
            aria-hidden
            className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-xl bg-white shadow-soft-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{ transform: tab === "join" ? "translateX(100%)" : "translateX(0)" }}
          />
          <button
            onClick={() => setTab("create")}
            className={[
              "relative z-10 rounded-xl py-2 text-sm font-bold transition-colors",
              tab === "create" ? "text-ink" : "text-ink-soft",
            ].join(" ")}
          >
            Buat Room
          </button>
          <button
            onClick={() => setTab("join")}
            className={[
              "relative z-10 rounded-xl py-2 text-sm font-bold transition-colors",
              tab === "join" ? "text-ink" : "text-ink-soft",
            ].join(" ")}
          >
            Gabung Room
          </button>
        </div>

        {tab === "join" && (
          <div className="mb-4 flex animate-pop-in items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="KODE ROOM"
              maxLength={6}
              className="w-full rounded-2xl bg-bg-end px-4 py-3 text-center text-xl font-extrabold tracking-[0.3em] text-ink outline-none focus:ring-2 focus:ring-accent-to"
            />
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-accent-from to-accent-to px-4 py-3 shadow-soft-sm active:scale-95"
              aria-label="Scan QR untuk gabung"
              title="Scan QR"
            >
              <Image src="/qr-icon.png" alt="" width={24} height={24} className="h-6 w-6" />
            </button>
          </div>
        )}

        {error && (
          <p key={error} className="mb-3 animate-shake text-sm font-medium text-coral-text">
            {error}
          </p>
        )}

        <button
          onClick={() => (tab === "create" ? handleCreate() : handleJoin())}
          disabled={busy}
          className="sheen w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3.5 text-base font-bold text-ink shadow-soft transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
        >
          {busy ? "Sebentar…" : tab === "create" ? "Buat & Masuk" : "Gabung"}
        </button>
      </div>

      <div className="rise flex flex-wrap justify-center gap-2" style={stagger(4)}>
        <Link
          href="/leaderboard"
          className="rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
        >
          🏆 Papan Peringkat
        </Link>
        {/* <Link
          href="/toko"
          className="rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
        >
          🛒 Toko
        </Link> */}
      </div>

      <p className="rise text-center text-xs text-ink-soft" style={stagger(5)}>
        Main bareng lewat HP masing-masing. Sambung kata dari suku kata terakhir.
      </p>

      {showScanner && (
        <QrScanner
          onClose={() => setShowScanner(false)}
          onResult={(scanned) => {
            setShowScanner(false);
            setTab("join");
            setCode(scanned);
            // Jika nama sudah diisi, langsung gabung. Jika belum, minta isi nama.
            if (name.trim()) {
              handleJoin(scanned);
            } else {
              setError("Kode terisi dari QR. Isi nama dulu, lalu klik Gabung.");
            }
          }}
        />
      )}
    </main>
  );
}
