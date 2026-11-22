import kataList from "@/../data/kata-id.json";
import kataExtra from "@/../data/kata-id-extra.json";
import kataKbbi from "@/../data/kata-id-kbbi.json";
import { normalizeWord, lastSyllable } from "./syllable";

/**
 * Set kamus ternormalisasi untuk lookup O(1).
 * Gabungan dari daftar dasar + daftar tambahan + daftar KBBI (71k+ kata,
 * termasuk kata umum seperti "gajah", hewan, benda, kata kerja).
 */
const dictSet: Set<string> = new Set(
  [...(kataList as string[]), ...(kataExtra as string[]), ...(kataKbbi as string[])]
    .map((w) => normalizeWord(w))
    .filter((w) => w.length >= 2)
);

export function isInDictionary(word: string): boolean {
  return dictSet.has(normalizeWord(word));
}

export function dictionarySize(): number {
  return dictSet.size;
}

/**
 * Ambil kata awal acak (panjang 4-7) yang suku kata terakhirnya PUNYA lanjutan,
 * agar permainan tidak langsung buntu di giliran pertama.
 */
export function randomStartingWord(): string {
  // Kumpulan kata awal berukuran pas (4-7 huruf). Dibangun sekali lalu
  // di-cache agar tidak menyaring 70k+ kata tiap ronde.
  const pool = startingPool();
  const empty = new Set<string>();
  // Coba beberapa kandidat acak; ambil yang suku kata terakhirnya punya
  // lanjutan. Ini O(percobaan), bukan O(n^2), jadi cepat walau kamus besar.
  for (let i = 0; i < 40; i++) {
    const w = pool[Math.floor(Math.random() * pool.length)];
    if (hasContinuation(lastSyllable(w), empty)) return w;
  }
  // Fallback: ambil acak saja bila semua percobaan gagal (sangat jarang).
  return pool[Math.floor(Math.random() * pool.length)];
}

let _startingPool: string[] | null = null;
function startingPool(): string[] {
  if (_startingPool) return _startingPool;
  const arr = Array.from(dictSet).filter((w) => w.length >= 4 && w.length <= 7);
  _startingPool = arr.length ? arr : Array.from(dictSet);
  return _startingPool;
}

/**
 * Validasi lengkap kandidat kata di SISI KLIEN (untuk feedback instan).
 * Mengembalikan alasan gagal, atau null bila valid.
 * Server tetap jadi otoritas final.
 */
export function validateCandidate(
  word: string,
  requiredSyllable: string,
  usedWords: Set<string>
): "chain" | "dict" | "dupe" | "deadend" | null {
  const w = normalizeWord(word);
  const r = normalizeWord(requiredSyllable);
  if (!w.startsWith(r)) return "chain";
  if (!dictSet.has(w)) return "dict";
  if (usedWords.has(w)) return "dupe";
  // Anti-buntu (dilonggarkan): cukup HURUF TERAKHIR kata ini punya lanjutan,
  // karena bila suku penuh buntu, permainan otomatis memberi keringanan 1 huruf.
  const nextUsed = new Set(usedWords);
  nextUsed.add(w);
  const lastSyl = lastSyllable(w);
  const lastLetter = lastSyl.slice(-1);
  if (!hasContinuation(lastLetter, nextUsed)) return "deadend";
  return null;
}

/**
 * Cek apakah masih ADA kemungkinan kata lanjutan dari sebuah suku kata target
 * yang belum terpakai. Berguna untuk menghindari jalan buntu (opsional dipakai
 * server saat memilih kata awal).
 */
export function hasContinuation(requiredSyllable: string, usedWords: Set<string>): boolean {
  const r = normalizeWord(requiredSyllable);
  for (const w of dictSet) {
    if (w.startsWith(r) && !usedWords.has(w)) return true;
  }
  return false;
}
