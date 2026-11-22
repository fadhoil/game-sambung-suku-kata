"use client";

/**
 * Sound effect ringan berbasis Web Audio API (nada sintetis).
 * Tidak butuh file audio eksternal, jadi tidak perlu hosting aset.
 *
 * Catatan: browser mobile memblokir audio sampai ada interaksi pengguna.
 * Panggil `unlockAudio()` sekali pada klik pertama (mis. tombol Mulai / Gabung).
 */

let ctx: AudioContext | null = null;
let enabled = true;

// Muat preferensi mute dari localStorage (sekali, di klien).
if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem("ssk:sound");
    if (saved === "off") enabled = false;
  } catch {
    /* abaikan */
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Panggil sekali setelah interaksi pengguna untuk membuka audio di mobile. */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("ssk:sound", on ? "on" : "off");
    } catch {
      /* abaikan */
    }
  }
}

export function toggleSound(): boolean {
  setSoundEnabled(!enabled);
  if (enabled) sfxClick();
  return enabled;
}

export function isSoundEnabled() {
  return enabled;
}

/**
 * Bunyikan satu nada.
 */
function tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.08, delayMs = 0) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const start = c.currentTime + delayMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.02);
}

// ---- Efek siap pakai ----

/** Tik hitung mundur (tiap angka). */
export function sfxCountdownTick() {
  tone(660, 120, "triangle", 0.07);
}

/** "GO!" saat countdown selesai. */
export function sfxCountdownGo() {
  tone(880, 180, "triangle", 0.1);
  tone(1174, 220, "triangle", 0.1, 120);
}

/** Submit kata valid. */
export function sfxValid() {
  tone(587, 90, "sine", 0.08);
  tone(880, 120, "sine", 0.08, 80);
}

/** Submit kata salah. */
export function sfxInvalid() {
  tone(220, 180, "sawtooth", 0.06);
}

/** Peringatan timer menipis (detik-detik akhir). */
export function sfxTick() {
  tone(500, 70, "square", 0.05);
}

/** Pemain tereliminasi / waktu habis. */
export function sfxEliminated() {
  tone(300, 150, "sawtooth", 0.07);
  tone(180, 260, "sawtooth", 0.07, 130);
}

/** Fanfare saat hasil/pemenang muncul. */
export function sfxWin() {
  tone(523, 140, "triangle", 0.1); // C
  tone(659, 140, "triangle", 0.1, 140); // E
  tone(784, 140, "triangle", 0.1, 280); // G
  tone(1047, 280, "triangle", 0.11, 420); // C oktaf
}

/** Klik tombol — halus, pendek. */
export function sfxClick() {
  tone(420, 45, "triangle", 0.05);
}

/** Klik aksi penting (mulai, kirim) — sedikit lebih tegas. */
export function sfxTap() {
  tone(520, 55, "triangle", 0.06);
  tone(700, 60, "triangle", 0.05, 45);
}

/** Jingle lembut sekali saat halaman awal dibuka. */
export function sfxJingle() {
  tone(523, 160, "sine", 0.06); // C
  tone(659, 160, "sine", 0.06, 150); // E
  tone(784, 160, "sine", 0.06, 300); // G
  tone(988, 240, "sine", 0.05, 450); // B
}

// ---- Reaksi emoji (ephemeral, broadcast) ----

/** Emoji ngeledek (lidah menjulur) — nada turun jahil. */
export function sfxEmojiTease() {
  tone(700, 90, "triangle", 0.07);
  tone(520, 110, "triangle", 0.07, 80);
  tone(360, 150, "triangle", 0.06, 180);
}

/** Emoji ketawa — triad ceria memantul. */
export function sfxEmojiLaugh() {
  tone(880, 70, "sine", 0.07);
  tone(1047, 70, "sine", 0.07, 70);
  tone(1319, 110, "sine", 0.07, 140);
}

/** Emoji marah — gerombolan sawtooth kasar. */
export function sfxEmojiAngry() {
  tone(180, 150, "sawtooth", 0.07);
  tone(140, 180, "sawtooth", 0.07, 60);
  tone(110, 220, "sawtooth", 0.06, 130);
}

/** Fanfare besar saat permainan dimulai — lebih keras & panjang dari sfxWin. */
export function sfxGameStart() {
  tone(392, 120, "triangle", 0.12); // G
  tone(523, 120, "triangle", 0.12, 120); // C
  tone(659, 140, "triangle", 0.12, 240); // E
  tone(784, 180, "triangle", 0.13, 380); // G
  tone(1047, 420, "triangle", 0.14, 560); // C oktaf (tahan panjang)
  tone(784, 420, "sawtooth", 0.05, 560); // lapisan whoosh tipis
}
