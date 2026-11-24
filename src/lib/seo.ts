/**
 * Sumber tunggal untuk data SEO.
 *
 * Ganti NEXT_PUBLIC_SITE_URL di environment (mis. domain sendiri) tanpa harus
 * menyunting kode. Nilai cadangan menunjuk ke domain produksi saat ini.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://ado-sambung-kata.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "Sambung Suku Kata";

export const SITE_TITLE =
  "Sambung Suku Kata — Game Sambung Kata Online Multiplayer (2–16 Pemain)";

export const SITE_DESCRIPTION =
  "Game sambung kata bahasa Indonesia untuk 2–16 pemain. Buat room, bagikan kode atau QR, lalu sambung kata dari suku kata terakhir. Gratis, tanpa instal, main langsung di HP.";

export const SITE_KEYWORDS = [
  "sambung suku kata",
  "sambung kata",
  "game sambung kata",
  "game kata online",
  "game multiplayer online",
  "game bareng teman",
  "game bahasa indonesia",
  "game edukasi bahasa indonesia",
  "game online gratis tanpa install",
  "game kumpul keluarga",
  "game virtual meeting",
  "word game multiplayer",
];

/** Gambar pratinjau 1200x630 di `public/og.png`. Ganti filenya bila teks berubah. */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Sambung Suku Kata — game sambung kata online multiplayer untuk 2–16 pemain",
};

export const absoluteUrl = (path = "/") =>
  `${SITE_URL}${path === "/" ? "" : path}`;
