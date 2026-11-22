// Membangun data/kata-id-kbbi.json dari daftar KBBI mentah.
//
// Sumber: https://github.com/damzaky/kumpulan-kata-bahasa-indonesia-KBBI
// (list_1.0.0.txt, ~112k entri). Lisensi repo sumber: publik.
//
// Tujuan: untuk game "Sambung Suku Kata" kita hanya butuh KATA TUNGGAL
// berhuruf a-z (tanpa spasi, tanda hubung, angka, atau karakter asing),
// panjang >= 2. Entri frasa ("a charge"), berimbuhan-tanda, atau serapan
// beraksen dibuang agar tidak jadi kata gabungan aneh setelah normalisasi.
//
// Jalankan: node scripts/build-kbbi.mjs
// Prasyarat: data/_kbbi_raw.txt sudah terunduh.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");
const rawPath = join(dataDir, "_kbbi_raw.txt");
const outPath = join(dataDir, "kata-id-kbbi.json");

if (!existsSync(rawPath)) {
  console.error("File mentah tidak ditemukan:", rawPath);
  console.error("Unduh dulu list_1.0.0.txt dari repo KBBI ke data/_kbbi_raw.txt");
  process.exit(1);
}

const raw = readFileSync(rawPath, "utf8");
const lines = raw.split(/\r?\n/);

// Hanya huruf a-z murni (satu kata), minimal 2 huruf.
const onlyAZ = /^[a-z]+$/;

const seen = new Set();
for (const line of lines) {
  const w = line.trim().toLowerCase();
  if (w.length < 2) continue;
  if (!onlyAZ.test(w)) continue; // buang frasa/aksen/tanda/angka
  seen.add(w);
}

const words = Array.from(seen).sort();
writeFileSync(outPath, JSON.stringify(words), "utf8");

console.log("Total entri mentah :", lines.length);
console.log("Kata bersih (a-z)  :", words.length);
console.log("Contoh gajah ada?  :", seen.has("gajah"));
console.log("Ditulis ke         :", outPath);
