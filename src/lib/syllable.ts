/**
 * Pemecah suku kata Bahasa Indonesia.
 *
 * Aturan praktis berbasis pola V / VK / KV / KVK dengan penanganan digraf
 * konsonan yang tidak boleh dipisah (ng, ny, kh, sy) dan gugus konsonan.
 *
 * Algoritma ini adalah SUMBER KEBENARAN TUNGGAL untuk menentukan suku kata
 * terakhir sebuah kata (dipakai untuk aturan sambung) dan harus konsisten
 * di klien maupun server.
 */

const VOWELS = new Set(["a", "i", "u", "e", "o"]);
// Digraf konsonan yang diperlakukan sebagai satu unit konsonan.
const DIGRAPHS = new Set(["ng", "ny", "kh", "sy"]);

function isVowel(ch: string): boolean {
  return VOWELS.has(ch);
}

/**
 * Normalisasi kata: huruf kecil, hanya a-z (buang spasi, tanda hubung, dll).
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

/**
 * Pecah kata menjadi array suku kata.
 *
 * Pendekatan: temukan posisi inti vokal, lalu tentukan batas berdasarkan
 * jumlah konsonan di antara dua vokal:
 *  - 0 konsonan (VV)      -> pisah di antara vokal (di-a => di, a) kecuali diftong
 *  - 1 konsonan (VCV)     -> V-CV   (ba-tu)
 *  - 2 konsonan (VCCV)    -> VC-CV, kecuali CC digraf -> V-CCV (ba-nyak => ba, nyak)
 *  - >=3 konsonan (VCCCV) -> VCC-CV (umumnya)
 */
export function syllabify(rawWord: string): string[] {
  const word = normalizeWord(rawWord);
  if (word.length <= 1) return word ? [word] : [];

  // Tandai indeks vokal.
  const vowelIdx: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (isVowel(word[i])) vowelIdx.push(i);
  }
  // Tidak ada vokal: kembalikan utuh.
  if (vowelIdx.length === 0) return [word];

  const boundaries: number[] = []; // batas potong (indeks awal suku berikutnya)

  for (let v = 0; v < vowelIdx.length - 1; v++) {
    const curV = vowelIdx[v];
    const nextV = vowelIdx[v + 1];
    const gap = nextV - curV - 1; // jumlah konsonan antar dua vokal

    if (gap <= 0) {
      // VV: pisah tepat setelah vokal pertama (tangani sebagai dua suku).
      boundaries.push(curV + 1);
    } else if (gap === 1) {
      // VCV -> potong sebelum konsonan (V-CV). Contoh: ba-tu, si-nga (ng=1 unit).
      boundaries.push(curV + 1);
    } else {
      // >= 2 konsonan antar vokal.
      // Perlakukan digraf (ng, ny, kh, sy) sebagai SATU unit konsonan.
      // Panjang unit konsonan pertama: 2 bila digraf, selain itu 1.
      const firstPair = word.slice(curV + 1, curV + 3);
      const firstUnitLen = DIGRAPHS.has(firstPair) ? 2 : 1;

      // Sisa konsonan setelah unit pertama (dalam jumlah huruf).
      const remainingConsonants = gap - firstUnitLen;

      if (remainingConsonants <= 0) {
        // Hanya ada satu unit konsonan (mis. digraf "ng" di "si-nga").
        // Pola V-CV: potong sebelum unit konsonan.
        boundaries.push(curV + 1);
      } else {
        // Ada konsonan lain setelah unit pertama -> pola VC-CV.
        // Unit konsonan pertama menempel ke suku depan, sisanya ke belakang.
        // Contoh: tang-ga ("ng" unit pertama 2 huruf, lalu "g").
        boundaries.push(curV + 1 + firstUnitLen);
      }
    }
  }

  // Bangun suku kata dari batas-batas.
  const syllables: string[] = [];
  let start = 0;
  for (const b of boundaries) {
    syllables.push(word.slice(start, b));
    start = b;
  }
  syllables.push(word.slice(start));

  return syllables.filter((s) => s.length > 0);
}

/**
 * Suku kata terakhir sebuah kata (target sambung berikutnya).
 */
export function lastSyllable(word: string): string {
  const syl = syllabify(word);
  return syl.length ? syl[syl.length - 1] : normalizeWord(word);
}

/**
 * Cek apakah `nextWord` menyambung `required` (diawali suku kata target).
 */
export function chainsFrom(nextWord: string, required: string): boolean {
  const n = normalizeWord(nextWord);
  const r = normalizeWord(required);
  return r.length > 0 && n.startsWith(r);
}
