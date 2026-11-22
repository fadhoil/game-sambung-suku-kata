"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type RemoteTrack,
  type LocalAudioTrack,
} from "livekit-client";

interface Props {
  /** Kode room game -> dipakai sebagai nama room LiveKit. */
  code: string;
  /** Identitas unik pemain (playerId). */
  identity: string | null;
  /** Nama tampilan pemain. */
  name?: string;
  /** Dipanggil saat daftar pemain yang sedang bicara berubah (set playerId). */
  onSpeakingChange?: (speakingIds: Set<string>) => void;
}

/**
 * Voice chat audio-only via LiveKit.
 *
 * - Tombol toggle mic di pojok KIRI BAWAH (fixed).
 * - Mic DEFAULT MATI: koneksi ke room baru dibuat saat pertama kali
 *   pemain menyalakan mic (hemat kuota & izin mic baru diminta saat perlu).
 * - Saat mic dimatikan, track mikrofon di-unpublish (berhenti mengirim suara),
 *   koneksi tetap terbuka agar tetap bisa MENDENGAR pemain lain.
 * - Audio pemain lain diputar otomatis lewat elemen <audio> tersembunyi.
 *
 * Catatan: butuh HTTPS (getUserMedia) & env LiveKit terisi. Bila env kosong,
 * tombol tetap tampil namun menampilkan pesan bahwa voice belum dikonfigurasi.
 */
export default function VoiceChat({ code, identity, name, onSpeakingChange }: Props) {
  const [micOn, setMicOn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const onSpeakingChangeRef = useRef(onSpeakingChange);
  onSpeakingChangeRef.current = onSpeakingChange;

  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  // Pasang / lepas elemen audio untuk track remote.
  const attachRemote = useCallback((track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return;
    const el = track.attach();
    el.setAttribute("data-lk-remote", "1");
    el.autoplay = true;
    audioContainerRef.current?.appendChild(el);
  }, []);

  const connectRoom = useCallback(async (): Promise<Room | null> => {
    if (roomRef.current) return roomRef.current;
    if (!identity) {
      setError("Identitas pemain tidak ditemukan.");
      return null;
    }
    if (!lkUrl) {
      setError("Voice chat belum dikonfigurasi.");
      return null;
    }

    const res = await fetch(
      `/api/livekit-token?room=${encodeURIComponent(code)}&identity=${encodeURIComponent(
        identity
      )}&name=${encodeURIComponent(name ?? identity)}`
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Gagal mengambil token voice.");
    }
    const { token } = (await res.json()) as { token: string };

    const room = new Room({ adaptiveStream: false, dynacast: false });

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        attachRemote(track);
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        // identity LiveKit = playerId. Kirim semua yang sedang bicara ke parent
        // agar badge nama pemain diberi penanda "sedang bicara".
        const ids = new Set(speakers.map((s) => s.identity));
        onSpeakingChangeRef.current?.(ids);
        const me = room.localParticipant;
        setSpeaking(ids.has(me.identity));
      })
      .on(RoomEvent.Disconnected, () => {
        setMicOn(false);
        onSpeakingChangeRef.current?.(new Set());
      });

    await room.connect(lkUrl, token);
    roomRef.current = room;
    return room;
  }, [code, identity, name, lkUrl, attachRemote]);

  const enableMic = useCallback(async () => {
    const room = await connectRoom();
    if (!room) return;
    if (!micTrackRef.current) {
      micTrackRef.current = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
      });
    }
    await room.localParticipant.publishTrack(micTrackRef.current);
    setMicOn(true);
  }, [connectRoom]);

  const disableMic = useCallback(async () => {
    const room = roomRef.current;
    const track = micTrackRef.current;
    if (room && track) {
      await room.localParticipant.unpublishTrack(track);
    }
    track?.stop();
    micTrackRef.current = null;
    setMicOn(false);
    setSpeaking(false);
  }, []);

  const toggleMic = useCallback(async () => {
    setError(null);
    if (connecting) return;
    setConnecting(true);
    try {
      if (micOn) {
        await disableMic();
      } else {
        await enableMic();
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("permission") || e?.name === "NotAllowedError") {
        setError("Izin mikrofon ditolak.");
      } else {
        setError("Gagal menyalakan mic.");
      }
    } finally {
      setConnecting(false);
    }
  }, [connecting, micOn, enableMic, disableMic]);

  // Auto-connect saat masuk lobi/hasil: pemain langsung BISA MENDENGAR pemain
  // lain tanpa menekan tombol apa pun. Mic tetap mati sampai pemain menyalakannya.
  // (Autoplay audio di sebagian browser butuh 1x interaksi; browser akan
  //  memutar begitu ada track masuk / setelah pemain menyentuh layar.)
  useEffect(() => {
    if (!identity || !lkUrl) return;
    let cancelled = false;
    connectRoom().catch(() => {
      /* diamkan: koneksi voice opsional, tidak menghalangi lobi */
    });
    return () => {
      cancelled = true;
      void cancelled;
    };
    // hanya saat identity/url siap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, lkUrl]);

  // Bersihkan koneksi saat komponen dilepas (pindah halaman).
  useEffect(() => {
    return () => {
      micTrackRef.current?.stop();
      micTrackRef.current = null;
      const room = roomRef.current;
      roomRef.current = null;
      room?.disconnect();
    };
  }, []);

  const disabled = !identity || !lkUrl;

  return (
    <>
      {/* Wadah elemen audio remote (tak terlihat). */}
      <div ref={audioContainerRef} style={{ display: "none" }} aria-hidden />

      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
        <button
          onClick={toggleMic}
          disabled={disabled || connecting}
          title={
            disabled
              ? "Voice chat belum tersedia"
              : micOn
                ? "Matikan mic"
                : "Nyalakan mic & bicara"
          }
          aria-pressed={micOn}
          aria-label={micOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
          className={[
            "flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-soft transition active:scale-90 disabled:opacity-40",
            micOn
              ? "bg-gradient-to-r from-accent-from to-accent-to text-ink"
              : "bg-white text-ink",
            speaking ? "ring-4 ring-accent-to/60 animate-pulse-soft" : "",
          ].join(" ")}
        >
          {connecting ? "…" : micOn ? "🎙️" : "🔇"}
        </button>

        {error && (
          <span className="max-w-[160px] rounded-full bg-coral-bg/30 px-2.5 py-1 text-[11px] font-medium text-coral-text shadow-soft-sm">
            {error}
          </span>
        )}
      </div>
    </>
  );
}
