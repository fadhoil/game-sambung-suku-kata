/**
 * Batas & konstanta toko emoji. Dipakai bersama oleh halaman admin (validasi awal di
 * browser) dan route server /api/admin/emoji (validasi yang mengikat).
 */
export const EMOJI_BUCKET = "emoji-assets";

/** Gambar diperkecil di browser (sisi terpanjang) sebelum diunggah, jadi file kecil & seragam. */
export const EMOJI_IMAGE_MAX_SIDE = 256;
export const EMOJI_IMAGE_MAX_BYTES = 200 * 1024; // 200 KB
export const EMOJI_SOUND_MAX_BYTES = 300 * 1024; // 300 KB
/** Durasi suara yang disarankan (peringatan saja, tidak memblokir). */
export const EMOJI_SOUND_RECOMMENDED_SECONDS = 5;

export const EMOJI_NAME_MAX = 24;
export const EMOJI_PRICE_MAX = 100000;

/** Format yang diterima. WAV boleh tetapi besar: ±88 KB per detik (mono 44,1 kHz). */
export const EMOJI_IMAGE_ACCEPT = "image/png,image/webp,image/jpeg,image/gif";
export const EMOJI_SOUND_ACCEPT = "audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/webm,.mp3,.wav,.ogg,.m4a,.webm";

/** Panduan yang ditampilkan di halaman admin. */
export const EMOJI_SOUND_TIP =
  "Disarankan MP3 mono ±64 kbps, maks 5 detik (±25–40 KB). OGG/M4A/WebM juga bisa. " +
  "WAV boleh tetapi besar (±88 KB per detik), jadi batasnya tetap 300 KB.";
