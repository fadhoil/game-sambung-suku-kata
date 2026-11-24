"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC, {
  type ConnectionState,
  type IAgoraRTCClient,
  type IMicrophoneAudioTrack,
  type UID,
} from "agora-rtc-sdk-ng";

interface Props {
  /** Kode room game -> dipakai sebagai nama channel Agora. */
  code: string;
  /** Identitas unik pemain (playerId) -> dipakai sebagai uid string Agora. */
  identity: string | null;
  /** Nama tampilan pemain. */
  name?: string;
  /** Dipanggil saat daftar pemain yang sedang bicara berubah (set playerId). */
  onSpeakingChange?: (speakingIds: Set<string>) => void;
}

/** Ambang level volume (0–100) agar dianggap "sedang bicara". */
const SPEAKING_LEVEL = 12;

/**
 * Voice chat audio-only via Agora RTC.
 *
 * - Tombol toggle mic di pojok KIRI BAWAH (fixed).
 * - Mic DEFAULT MATI: hanya audio pemain lain yang otomatis diputar.
 * - Saat mic dimatikan, track mikrofon di-unpublish dan dilepas, sehingga
 *   tidak ada audio yang dikirim (hemat kuota menit per peserta).
 * - Koneksi tetap terbuka agar pemain tetap bisa MENDENGAR pemain lain.
 * - uid Agora = playerId (string user account), jadi badge "sedang bicara"
 *   bisa dipetakan langsung ke pemain di panel lobi.
 *
 * Catatan: butuh HTTPS (getUserMedia) & env Agora terisi. Bila env kosong,
 * tombol tetap tampil namun menampilkan pesan bahwa voice belum dikonfigurasi.
 */
export default function VoiceChat({ code, identity, onSpeakingChange }: Props) {
  const [micOn, setMicOn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const onSpeakingChangeRef = useRef(onSpeakingChange);
  onSpeakingChangeRef.current = onSpeakingChange;

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  /** Mencegah dua join bersamaan (auto-connect + klik mic). */
  const joinPromiseRef = useRef<Promise<IAgoraRTCClient | null> | null>(null);
  const speakersRef = useRef<Set<string>>(new Set());

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const channel = `ssk_${code}`;

  // Kirim perubahan daftar pembicara hanya bila isinya berubah, agar
  // callback volume (tiap ~2 detik) tidak memicu render terus-menerus.
  const publishSpeakers = useCallback((next: Set<string>) => {
    const prev = speakersRef.current;
    if (prev.size === next.size && [...next].every((id) => prev.has(id))) return;
    speakersRef.current = next;
    onSpeakingChangeRef.current?.(next);
  }, []);

  const joinChannel = useCallback(async (): Promise<IAgoraRTCClient | null> => {
    if (clientRef.current) return clientRef.current;
    if (!identity) {
      setError("Identitas pemain tidak ditemukan.");
      return null;
    }
    if (!appId) {
      setError("Voice chat belum dikonfigurasi.");
      return null;
    }
    if (joinPromiseRef.current) return joinPromiseRef.current;

    const run = (async () => {
      const res = await fetch(
        `/api/agora-token?room=${encodeURIComponent(code)}&identity=${encodeURIComponent(
          identity
        )}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Gagal mengambil token voice.");
      }
      const { token } = (await res.json()) as { token: string };

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

      client.on("user-published", async (user, mediaType) => {
        if (mediaType !== "audio") return;
        await client.subscribe(user, "audio");
        user.audioTrack?.play();
      });

      client.on("user-unpublished", (user) => {
        user.audioTrack?.stop();
      });

      client.on("user-left", (user: { uid: UID }) => {
        const next = new Set(speakersRef.current);
        next.delete(String(user.uid));
        publishSpeakers(next);
      });

      // Volume indicator dipakai sebagai pengganti "active speakers".
      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (volumes) => {
        const next = new Set<string>();
        for (const v of volumes) {
          if (v.level > SPEAKING_LEVEL) next.add(String(v.uid));
        }
        setSpeaking(next.has(identity));
        publishSpeakers(next);
      });

      client.on("connection-state-changed", (state: ConnectionState) => {
        if (state === "DISCONNECTED") {
          setMicOn(false);
          setSpeaking(false);
          publishSpeakers(new Set());
        }
      });

      // Token dibuat dengan string user account -> uid join = identity.
      await client.join(appId, channel, token, identity);
      clientRef.current = client;
      return client;
    })();

    joinPromiseRef.current = run;
    try {
      return await run;
    } finally {
      joinPromiseRef.current = null;
    }
  }, [appId, channel, code, identity, publishSpeakers]);

  const enableMic = useCallback(async () => {
    const client = await joinChannel();
    if (!client) return;
    if (!micTrackRef.current) {
      micTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
      });
    }
    await client.publish(micTrackRef.current);
    setMicOn(true);
  }, [joinChannel]);

  const disableMic = useCallback(async () => {
    const client = clientRef.current;
    const track = micTrackRef.current;
    if (client && track) {
      await client.unpublish(track);
    }
    track?.stop();
    track?.close();
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
      const msg = String(e?.code || e?.message || "");
      if (msg.includes("PERMISSION_DENIED") || msg.includes("NotAllowedError")) {
        setError("Izin mikrofon ditolak.");
      } else if (msg.includes("DEVICE_NOT_FOUND")) {
        setError("Mikrofon tidak ditemukan.");
      } else {
        setError("Gagal menyalakan mic.");
      }
    } finally {
      setConnecting(false);
    }
  }, [connecting, micOn, enableMic, disableMic]);

  // Auto-connect saat masuk lobi/hasil: pemain langsung BISA MENDENGAR pemain
  // lain tanpa menekan tombol apa pun. Mic tetap mati sampai pemain menyalakannya.
  // (Autoplay audio di sebagian browser butuh 1x interaksi; lihat handler
  //  onAutoplayFailed di bawah.)
  useEffect(() => {
    if (!identity || !appId) return;
    joinChannel().catch(() => {
      /* diamkan: koneksi voice opsional, tidak menghalangi lobi */
    });
    // hanya saat identity/appId siap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, appId]);

  // Browser bisa memblokir pemutaran audio sebelum ada interaksi pengguna.
  useEffect(() => {
    AgoraRTC.onAutoplayFailed = () => {
      setError("Ketuk layar untuk mengaktifkan suara.");
    };
    return () => {
      AgoraRTC.onAutoplayFailed = undefined;
    };
  }, []);

  // Bersihkan koneksi saat komponen dilepas (pindah halaman).
  useEffect(() => {
    return () => {
      micTrackRef.current?.stop();
      micTrackRef.current?.close();
      micTrackRef.current = null;
      const client = clientRef.current;
      clientRef.current = null;
      client?.removeAllListeners();
      client?.leave().catch(() => {});
      onSpeakingChangeRef.current?.(new Set());
    };
  }, []);

  const disabled = !identity || !appId;

  return (
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
  );
}