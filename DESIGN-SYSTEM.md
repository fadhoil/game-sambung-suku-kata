# Design System — Sambung Suku Kata

> Aturan visual dan pola komponen yang dipakai di seluruh aplikasi. Sumber kebenaran: `tailwind.config.ts`, `src/app/globals.css`, `src/lib/motion.ts`, dan komponen di `src/components/`. Bila dokumen dan kode berbeda, **kode menang**, lalu perbarui dokumen ini.

---

## 1. Prinsip

| Prinsip | Artinya di UI |
|---|---|
| **Lembut dan ringan** | Palet pastel biru ("Airy Blue Delight"), sudut membulat besar, bayangan halus. Tidak ada warna jenuh kecuali untuk status. |
| **Mobile-first** | Dirancang untuk layar ±360–430 px, satu tangan, jempol. Konten satu kolom, `max-w-md` di tengah. |
| **Main dulu, baca belakangan** | Aksi utama jelas dan besar. Teks pendek, santai, Bahasa Indonesia. |
| **Hidup tapi tidak mengganggu** | Gerak kecil (muncul bertahap, denyut giliran, balon emoji) hanya memakai `transform`/`opacity` dan mati saat pengguna memilih "kurangi gerakan". |
| **Realtime harus terbaca** | Status penting (giliran siapa, nyawa, timer, keringanan) selalu punya bentuk visual yang berbeda, bukan hanya warna. |

---

## 2. Warna

Didefinisikan di `tailwind.config.ts` (`theme.extend.colors`) dan sebagian dicerminkan sebagai CSS variable di `:root`. **Selalu pakai token, jangan tulis hex di komponen.**

### 2.1 Palet dasar

| Token Tailwind | Hex | Dipakai untuk |
|---|---|---|
| `bg-start` / `airy-50` | `#F8F9FB` | Awal gradien latar halaman |
| `bg-end` / `airy-100` | `#E1ECF7` | Akhir gradien latar; **permukaan sekunder** (input, chip, kartu dalam, tombol sekunder) |
| `airy-200` / `accent-from` | `#AECBEB` | Awal gradien tombol utama |
| `airy-300` | `#83B0E1` | Aksen tengah (jarang dipakai langsung) |
| `airy-400` / `accent-to` | `#71A5DE` | Akhir gradien tombol utama, cincin fokus, cincin pilihan |
| `accent-deep` | `#3C74B6` | **Teks biru di atas putih** (harga, tautan, angka penting) |
| `surface` | `#FFFFFF` | Kartu, modal, tombol sekunder di atas kartu berwarna |
| `ink` | `#243350` | Teks utama |
| `ink-soft` | `#5C6C86` | Teks sekunder, label, keterangan |
| `peach` | `#FBCFE8` | Aksen tim/penanda hangat |
| `cream` | `#FDE2C8` | Latar pemberitahuan lembut (mis. banner info) |

### 2.2 Warna status (semantik)

| Arti | Latar | Teks | Contoh |
|---|---|---|---|
| **Sukses / hidup** | `sage-bg` `#A7D7C5` | `sage-text` `#3F8F77` | "Emoji dibuat", kata valid |
| **Galat / bahaya** | `coral-bg` `#F4A6A6` | `coral-text` `#C96A6A` | Pesan galat, tombol Hapus, "disembunyikan" |
| **Info / aksi** | gradien `accent-from → accent-to` | `ink` | Tombol utama, ticker berita |

### 2.3 Latar halaman
- `body`: gradien `160deg` dari `airy-50` ke `airy-100`, `background-attachment: fixed`.
- Lapisan `.ambient` (3 elemen `<i>` di `layout.tsx`) menambah gumpalan warna yang melayang pelan (`drift-a/b/c`). Dekoratif, `aria-hidden`.
- `viewport.themeColor` = `#f8f9fb`. Aplikasi **hanya mode terang** (`color-scheme: light`).

### 2.4 Kontras (diukur WCAG 2.x)

| Pasangan | Rasio | Status teks kecil (AA ≥ 4,5) |
|---|---|---|
| `ink` di putih | 12,62 | ✅ |
| `ink` di `bg-end` | 10,54 | ✅ |
| `ink` di `cream` | 10,15 | ✅ |
| `ink` di `accent-from` | 7,54 | ✅ |
| `ink` di `accent-to` | 4,89 | ✅ |
| `accent-deep` di putih | 4,81 | ✅ |
| `ink-soft` di putih | 5,32 | ✅ |
| `ink-soft` di `bg-end` | 4,45 | ⚠️ tipis; pakai ≥ 14 px atau `ink` |
| `sage-text` di putih | 3,88 | ⚠️ hanya untuk teks tebal ≥ 18,66 px atau disertai ikon/kata |
| `coral-text` di putih | 3,65 | ⚠️ sama seperti di atas |
| putih di `coral-text` | 3,65 | ⚠️ jangan untuk teks kecil (lihat bagian 12) |

**Aturan:** teks pada tombol bergradien biru memakai `ink`, bukan putih. Jangan menyampaikan status hanya lewat warna; tambahkan kata, ikon, atau bentuk.

---

## 3. Tipografi

- **Keluarga:** Plus Jakarta Sans (Google Fonts via `next/font`), bobot 400–800, variabel `--font-display`, fallback `system-ui, sans-serif`. Satu keluarga untuk semua teks.
- **Kelas:** `font-display` tersedia, tetapi `body` sudah memakainya; tidak perlu dipasang ulang.
- **Rendering:** `-webkit-font-smoothing: antialiased`.

| Peran | Kelas yang dipakai | Catatan |
|---|---|---|
| Judul halaman | `text-xl font-extrabold text-ink` (turun ke `text-base` di layar sangat sempit) | Satu per halaman, boleh dipotong `truncate` |
| Judul kartu/seksi | `text-base font-extrabold text-ink` | |
| Judul dialog | `text-lg font-extrabold text-ink` | |
| Isi / nama item | `text-[15px] font-semibold text-ink` atau `text-sm font-semibold` | |
| Isi sekunder | `text-sm text-ink-soft` | |
| Keterangan / meta | `text-xs text-ink-soft` | Minimum yang disarankan |
| Label field | `text-xs font-bold text-ink` | Di atas input |
| Angka/koin/skor | `font-bold` + `toLocaleString("id-ID")` | Pemisah ribuan titik |

**Aturan**
- Ukuran teks minimum **12 px** untuk konten yang harus dibaca. (`text-[11px]` masih dipakai di teks bantuan form; lihat bagian 12.)
- Nama panjang: `truncate` untuk satu baris, `line-clamp-2 break-words` bila nama harus terbaca (daftar emoji).
- Tanda kutip dalam teks tampilan: “ ” (kutip lengkung).
- Jangan menaikkan bobot di atas 800 atau memakai huruf miring untuk penekanan; pakai `font-bold`/`font-extrabold`.

---

## 4. Bentuk, jarak, dan elevasi

### 4.1 Radius
| Token | Nilai | Dipakai |
|---|---|---|
| `rounded-xl` | 0,75 rem | Tombol kecil, tombol avatar, chip |
| `rounded-2xl` (dikustom) | 1,25 rem | Input, tombol utama, baris daftar, banner |
| `rounded-3xl` (dikustom) | 1,75 rem | **Kartu**, modal, panel besar |
| `rounded-full` | — | Pil skor/koin, indikator |

### 4.2 Bayangan
| Token | Nilai | Dipakai |
|---|---|---|
| `shadow-soft` | `0 10px 30px -12px rgba(60,116,182,.28)` | Kartu dan modal |
| `shadow-soft-sm` | `0 4px 14px -6px rgba(60,116,182,.22)` | Tombol, chip, item kecil |

Bayangan selalu berwarna biru, tidak pernah hitam.

### 4.3 Tata letak
- Halaman: `main` dengan `mx-auto w-full max-w-md px-4 py-6`, `min-h-screen`, satu kolom.
- Kartu: `rounded-3xl bg-white p-4 shadow-soft` (atau `p-5`).
- Jarak vertikal antar kartu: `space-y-4`; antar elemen dalam kartu: `mt-3`/`space-y-3`; antar tombol sebaris: `gap-2` (8 px).
- Daftar item dalam kartu: `rounded-2xl bg-bg-end/60 p-3`.
- Grid dua kolom untuk katalog (`grid-cols-2 gap-3`); grid tombol aksi `grid-cols-3 gap-2`.
- Area aman: header halaman mengikuti pola baris atas (tombol kembali kiri, judul tengah, penyeimbang kanan).

### 4.4 Lapisan (z-index)
| Lapisan | z | Isi |
|---|---|---|
| Panel reaksi emoji | `z-30` | Tombol emoji di bawah (room, hasil, play) |
| Overlay balon emoji, tombol mic | `z-40` | `pointer-events-none` agar tidak menutup input |
| Modal | `z-50` | `bg-ink/40 backdrop-blur-sm` |

---

## 5. Interaksi dan sentuhan

| Aturan | Nilai |
|---|---|
| Target sentuh minimum | **44 × 44 px** (`min-h-[44px]`, `h-11 w-11`) |
| Jarak antar target | ≥ 8 px |
| Umpan balik tekan | `active:scale-95` (tombol), `active:scale-90` (target kecil/ikon) |
| Hover | Hanya pelengkap desktop (`hover:-translate-y-0.5`); tidak boleh jadi satu-satunya petunjuk |
| Fokus | Input: `focus:ring-2 focus:ring-accent-to`, tanpa `outline` bawaan |
| Nonaktif | `disabled:opacity-50`, kursor tidak berubah makna; tampilkan alasan lewat teks bila perlu |
| Scroll horizontal | Hanya di dalam wadah sendiri (`overflow-x-auto`, `snap-x`, `overscroll-x-contain`), tidak pernah di `body` |
| Tombol ikon | Wajib `aria-label`; status terpilih pakai `aria-pressed` |

---

## 6. Komponen

### 6.1 Tombol

| Varian | Kelas inti | Kapan |
|---|---|---|
| **Utama** | `sheen min-h-[44px] rounded-2xl bg-gradient-to-r from-accent-from to-accent-to font-bold text-ink shadow-soft-sm active:scale-95 disabled:opacity-50` | Satu aksi utama per kartu/layar (Buat & Masuk, Kirim Usulan, Terima) |
| **Sekunder** | `min-h-[44px] rounded-xl bg-white text-xs/sm font-bold text-ink shadow-soft-sm active:scale-95` | Aksi pendamping (Preview, Sembunyikan, Tolak) |
| **Netral di dalam kartu** | `bg-bg-end text-ink` | Batal, pilihan tak terpilih |
| **Bahaya** | teks `text-coral-text` di tombol sekunder; konfirmasi akhir `bg-coral-text text-white` | Hapus, bubarkan |
| **Tautan sebagai tombol** | `Link` dengan kelas tombol sekunder | Navigasi (Toko, kembali) |
| **Segmented / tab** | wadah `grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-soft-sm`; tab aktif gradien utama, non-aktif `text-ink-soft` | Toko ↔ Inventory, Buat ↔ Gabung Room |

Efek `.sheen` = kilau menyapu saat hover/idle. Pakai hanya pada tombol utama.

### 6.2 Input
Kelas bersama `emojiInputCls` (di `EmojiFileFields.tsx`):  
`w-full rounded-2xl bg-bg-end px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-accent-to`.  
Label di atas (`text-xs font-bold text-ink`), teks bantuan di bawah (`text-xs text-ink-soft`). Input angka: `inputMode="numeric"` dan saring non-digit. Input file memakai gaya `file:` dengan tombol bergaya chip `bg-bg-end`.

### 6.3 Kartu dan daftar
- **Kartu:** `rounded-3xl bg-white p-4 shadow-soft`, masuk dengan `.rise`.
- **Item daftar:** `rounded-2xl bg-bg-end/60 p-3`; baris atas gambar/avatar + teks (`min-w-0 flex-1`), baris bawah tombol aksi.
- **Kartu katalog (toko/inventory):** kotak gambar `bg-bg-end/60 rounded-2xl`, nama satu baris `truncate`, harga `text-accent-deep`, lalu tombol.

### 6.4 Dialog (modal)
Overlay `fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm`, panel `w-full max-w-sm animate-pop-in rounded-3xl bg-white p-6 shadow-soft`. Atribut `role="dialog" aria-modal="true" aria-label`. Dua tombol sejajar (`grid-cols-2`): **Batal** di kiri, aksi di kanan. Dialog destruktif wajib menyebut akibat dan bahwa aksi tidak bisa dibatalkan.

### 6.5 Pesan status
| Jenis | Pola |
|---|---|
| Galat | `text-sm font-medium text-coral-text` + `animate-shake` + `role="alert"`; beri `key={pesan}` agar animasi ulang |
| Sukses | `text-sm font-semibold text-sage-text` + `animate-pop-in`, diawali ✓ |
| Memuat | `animate-pulse-soft text-sm text-ink-soft` ("Memuat…") |
| Kosong | `text-sm text-ink-soft`, satu kalimat yang menunjukkan langkah berikutnya |

### 6.6 Komponen khusus produk

| Komponen | Pola desain |
|---|---|
| **Pilihan avatar** | Satu baris geser, tombol 44 px, `snap-x snap-proximity`, avatar terpilih `avatar-pop` + `ring-2 ring-accent-to`, otomatis digulir ke tengah |
| **Pil skor/koin** (`PointsPill`) | Kapsul putih kecil, ikon 🏆/🪙 + angka |
| **Ticker berita** (`NewsTicker`) | Tinggi 36 px, gradien biru, satu baris, teks bergerak 60 px/dtk, jeda 3 dtk antar berita, nama dicetak tebal, berhenti saat disentuh |
| **Balon emoji** (`EmojiBubbles`, `.emoji-rise`) | Naik 2 dtk dari tengah-bawah, ukuran 48 px, acak 30–70% horizontal |
| **Panel reaksi** (`ReactionLayer`) | 3 tombol emoji tetap di bawah, slot kustom menggantikan bawaan |
| **Timer** (`TimerRing`) | Cincin SVG; menipis → `heartbeat` |
| **Rantai kata** (`WordChain`) | Daftar yang bisa digulir (`.chain-scroll`), kata baru `chain-land`, suku kata target `syllable-pop` |
| **Giliran aktif** (`PlayerChip`) | `turn-pulse` / `turn-glow` pada pemain yang sedang giliran |
| **Hitung mundur** (`Countdown`) | Angka besar `count-num` + `ripple` |
| **Keringanan** (`RelaxNotice`) | Pop-up di semua layar, tahan 3 detik |
| **Kartu hasil** (`ShareCard`) | Dirender jadi PNG (`html-to-image`); harus mandiri secara visual (tanpa bergantung hover/scroll) |

---

## 7. Gerak

### 7.1 Token
| Nama | Nilai | Sifat |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22, 1, .36, 1)` | Masuk/keluar halus (default) |
| `--spring` | `cubic-bezier(.34, 1.56, .64, 1)` | Sedikit memantul (pop, avatar) |

### 7.2 Kelas gerak
| Kelas / animasi | Fungsi |
|---|---|
| `.rise` + `stagger(i)` | Masuk bertahap (naik 14 px + fade); jeda `i × 70 ms` lewat variabel `--i` |
| `animate-pop-in` | Muncul membesar (0,25 dtk) untuk modal dan pesan |
| `animate-slide-in` | Geser masuk dari kanan (0,3 dtk) |
| `animate-shake` | Goyang saat galat (0,4 dtk) |
| `animate-pulse-soft` | Denyut opasitas saat memuat |
| `.sheen`, `.text-shimmer` | Kilau pada tombol utama / teks khusus |
| `.avatar-pop`, `.tick-pop`, `.chain-land`, `.syllable-pop`, `.flip-in`, `.count-num`, `.ripple`, `.heartbeat`, `.turn-pulse`, `.turn-glow`, `.emoji-rise` | Gerak khusus fitur permainan |

### 7.3 Aturan
1. Animasikan **hanya** `transform` dan `opacity` (juga `filter` untuk efek blur singkat). Jangan animasikan `width/height/top/left`.
2. Durasi interaksi 150–400 ms; hiasan latar boleh lambat.
3. Blok `@media (prefers-reduced-motion: reduce)` di `globals.css` wajib tetap ada; gerak berulang di komponen (mis. ticker) harus punya cabang diam.
4. Elemen yang bergerak tidak boleh menutupi input atau tombol (`pointer-events-none`).
5. Untuk animasi berbasis JS (mis. ticker) pakai Web Animations API, bersihkan di `useEffect` cleanup.

---

## 8. Ikon dan gambar

- **Ikon = emoji Unicode** (🏆 🪙 🛒 👁 🗑 💡 🎒 🔊). Tidak ada pustaka ikon. Konsisten: satu ikon per makna.
  - 🏆 skor · 🪙 koin · 🛒 toko · 🎒 inventory · 💡 usulan · 👁 preview · 🗑 hapus · 🔊 suara · 📰 berita
- Emoji kustom (toko) berupa PNG/WebP transparan ≤ 256 px, ditampilkan `object-contain`, `<img>` biasa (bukan `next/image`) dengan komentar `eslint-disable` yang menjelaskannya.
- Logo `public/logo.png`, ikon aplikasi `src/app/icon.png`.

---

## 9. Salinan teks (copywriting)

- Bahasa Indonesia santai, kalimat pendek, tanpa jargon teknis ke pemain.
- Tombol: kata kerja langsung ("Buat & Masuk", "Kirim Usulan", "Terima").
- Galat: katakan **apa yang salah dan apa yang bisa dilakukan** ("Nama itu sudah dipakai. Pakai nama lain."), bukan kode galat.
- Konfirmasi destruktif: sebut objek dan akibatnya ("Hapus “Good Job”? … Tidak bisa dibatalkan.").
- Angka uang/poin: `toLocaleString("id-ID")`; mata uang game ditulis dengan 🪙.
- Berita/ticker: pola tetap "Penambahan usulan {kata|emoji} “{nama}” diterima".

---

## 10. Aksesibilitas

- Semua tombol ikon punya `aria-label`; toggle punya `aria-pressed`; dialog punya `role="dialog" aria-modal`.
- Pesan galat memakai `role="alert"`; ticker memakai `role="status"` dengan `aria-label` ringkas (tidak membacakan terus-menerus).
- Urutan fokus mengikuti urutan visual; modal menutup dengan tombol Batal yang terjangkau.
- Hormati `prefers-reduced-motion`.
- Jangan membuat zoom dimatikan secara tidak perlu. (Saat ini `maximumScale: 1` di viewport demi tampilan game; pertimbangkan dilonggarkan.)

---

## 11. Checklist komponen/halaman baru

- [ ] Memakai token warna/radius/bayangan, tanpa hex atau nilai px baru
- [ ] Tata letak satu kolom, `max-w-md`, tidak ada scroll horizontal halaman pada 360 px
- [ ] Semua target sentuh ≥ 44 px dengan jarak ≥ 8 px
- [ ] Hanya satu tombol utama per kartu; aksi destruktif punya konfirmasi
- [ ] Kondisi: memuat, kosong, galat, sukses, nonaktif semuanya ditangani
- [ ] Teks ≥ 12 px, kontras sesuai bagian 2.4, status tidak hanya lewat warna
- [ ] Gerak hanya `transform`/`opacity` dan mati saat "kurangi gerakan"
- [ ] `aria-label` untuk tombol ikon, `aria-pressed` untuk toggle
- [ ] Teks Indonesia, nada santai, angka `id-ID`
- [ ] Diperiksa di lebar 360 px dan 430 px, dengan keyboard layar terbuka bila ada input

---

## 12. Ketidakkonsistenan yang sudah diketahui

| # | Temuan | Saran |
|---|---|---|
| 1 | `text-[11px]` dipakai di teks bantuan form (upload emoji, slot) | Naikkan ke `text-xs` (12 px) |
| 2 | Tombol "Ya, hapus" memakai putih di `coral-text` (3,65:1) | Pakai latar `coral-text` lebih gelap (mis. `#B04E4E`) atau gaya outline dengan teks `ink` |
| 3 | `sage-text` dan `coral-text` di bawah 4,5:1 untuk teks kecil | Pakai versi lebih gelap untuk teks, simpan versi saat ini untuk latar/ikon |
| 4 | `ink-soft` di atas `bg-end` hanya 4,45:1 | Gunakan `ink` atau naikkan ukuran untuk teks penting |
| 5 | Gaya tab/segmented ditulis ulang di beberapa halaman | Ekstrak jadi satu komponen `Segmented` bila ada tab baru |
| 6 | `maximumScale: 1` menghalangi pembesaran oleh pengguna | Pertimbangkan dilonggarkan, uji dampaknya pada game |
| 7 | `TimerRing` menulis hex langsung di atribut SVG (`stroke`), dan `.chain-swing` ada di CSS tetapi tidak dipakai komponen mana pun | Pakai `currentColor`/CSS variable untuk SVG; hapus kelas yang yatim bila memang tidak terpakai |
| 8 | Tidak ada mode gelap | Di luar cakupan saat ini; token sudah terpusat sehingga bisa ditambah |
