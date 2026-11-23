# Sambung Suku Kata 🔗

> **Nyambung nggak? Buktiin!** Game kekompakan multiplayer realtime untuk **2–16 pemain**. Sambung kata Bahasa Indonesia yang harus diawali **suku kata terakhir** kata sebelumnya. Salah atau kehabisan waktu, nyawa berkurang. Yang bertahan terakhir menang.

### 🎮 Main sekarang: **[ado-sambung-kata.vercel.app](https://ado-sambung-kata.vercel.app/)**

Tanpa instal. Buka di HP, buat room, bagikan kode atau QR ke teman, lalu mulai.

---

## Fitur

**Permainan**
- 🔗 Sambung kata dari suku kata terakhir (mis. LUKISAN → **SAN**TAI)
- ⏱️ Timer per giliran 5 / 7 / 10 / 15 detik, **otoritatif di server** (adil dan anti-cheat)
- ❤️ Nyawa 1–5 per pemain
- 👤 **Free For All** dan 👥 **Mode Tim** (komposisi custom; semua anggota tim kebagian giliran secara merata)
- 🛟 **Keringanan suku kata**: bila beberapa pemain berturut-turut gagal, atau suku kata target tidak punya kata di kamus, target dilonggarkan otomatis
- 🚫 **Anti-buntu**: kata yang membuat permainan mentok ditolak
- 👀 Pemain tereliminasi menjadi **penonton**
- 📖 Kamus Bahasa Indonesia (termasuk kata percakapan umum) dengan validasi di klien dan server

**Sosial**
- 📷 Gabung lewat **kode room**, **link undangan**, atau **scan QR**
- 🎙️ **Voice chat** di lobi dan halaman hasil (LiveKit)
- 😀 **Reaksi emoji** melayang di room, bisa memakai emoji dari toko
- 📤 **Bagikan hasil** sebagai gambar (WhatsApp, Instagram, dll.)

**Akun dan progres**
- 🏆 **Skor** dan 🪙 **koin** per akun, dengan **Papan Peringkat** minggu ini dan sepanjang masa
- 🛒 **Toko emoji**: beli dengan koin, **Preview** sebelum membeli
- 🎒 **Inventory**: pasang emoji ke 3 slot untuk dipakai di room dan hasil
- 💡 **Usulkan kata** dan **usulkan emoji**; admin yang menyetujui
- 📰 **Berita hari ini** di beranda: usulan kata/emoji yang baru diterima

**Pengalaman**
- 📱 Mobile-first, UI pastel yang lembut, efek suara dan layar penuh
- 🧑‍💼 Panel admin untuk kamus, lobi aktif, dan emoji

---

## Cara main

1. **Host** membuat room dan mendapat kode 6 karakter (atau bagikan QR/link).
2. **Pemain lain** bergabung lewat kode di HP masing-masing.
3. Host memilih mode, timer, dan nyawa, lalu menekan **Mulai**.
4. Setelah hitung mundur 5 detik, pemain yang mendapat giliran mengetik kata yang:
   - diawali **suku kata target** (ditampilkan sebagai "Sambung dari: -XXX"),
   - **ada di kamus**,
   - **belum dipakai** di ronde itu,
   - **tidak membuat buntu**.
5. Gagal atau kehabisan waktu: **−1 nyawa**. Nyawa habis: tereliminasi (lanjut menonton).
6. **FFA**: pemain terakhir menang. **Tim**: tim terakhir yang masih punya anggota hidup menang.

---

## Teknologi

| Area | Pilihan |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS 3, font Plus Jakarta Sans |
| Backend | Supabase: Postgres + RPC (logika game), Realtime, Storage |
| Suara | LiveKit (audio-only) |
| Lainnya | `html5-qrcode`, `html-to-image`, Web Audio API |
| Hosting | Vercel |

Prinsip utama: **seluruh aturan game dijalankan di fungsi Postgres (RPC `SECURITY DEFINER`)**. Klien hanya menampilkan state dan membantu validasi cepat; RLS membuat tabel hanya-baca untuk pengguna anonim.

---

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [PRODUCT-REQUIREMENTS.md](PRODUCT-REQUIREMENTS.md) | Tujuan produk, pengguna, kebutuhan fungsional, aturan bisnis |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Struktur, teknologi, model data, RPC, alur kunci, keamanan, deploy |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | Warna, tipografi, komponen UI, gerak, aksesibilitas |
| [AI-AGENTS.md](AI-AGENTS.md) | Panduan untuk AI coding agent: aturan, standar kode, playbook |

---

## Menjalankan sendiri

### 1. Siapkan Supabase (gratis)

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, lalu jalankan berurutan:
   1. `supabase/schema.sql`
   2. `supabase/functions.sql`
   3. `supabase/migration-v2.sql` sampai `supabase/migration-v17.sql`, **sesuai nomor** (masing-masing aman diulang, tetapi jangan menjalankan ulang migrasi lama sesudah migrasi yang menggantinya)
   4. `supabase/functions.sql` **sekali lagi** (aman diulang; memastikan fungsi terbaru yang dipakai)
3. Buka **Project Settings → API** dan salin `Project URL`, `anon public` key, dan `service_role` key.

> Bucket Storage `emoji-assets` dibuat otomatis oleh route server saat emoji pertama diunggah.

### 2. Atur environment

```bash
cp .env.example .env
```

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Ya | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ya | Anon key (dibatasi RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Untuk toko emoji | **Rahasia, hanya server.** Jangan beri awalan `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_LIVEKIT_URL` | Untuk voice chat | `wss://…livekit.cloud` |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Untuk voice chat | **Rahasia, hanya server** |

### 3. Isi kamus

```bash
node scripts/seed-dictionary.mjs
```

Mengunggah kamus di `data/*.json` ke tabel `dictionary` agar validasi server dan klien konsisten.

### 4. Jalankan

```bash
npm install
npm run dev        # http://localhost:3000
```

Untuk mengetes multiplayer, buka beberapa tab atau HP dan gabung dengan kode room yang sama.

### Perintah lain

```bash
npm run build      # build produksi
npm run start      # jalankan hasil build
npx tsc --noEmit   # periksa tipe
```

---

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Di [vercel.com](https://vercel.com) → **Import Project** → pilih repo.
3. Isi **Environment Variables** sesuai tabel di atas.
4. Deploy. Setiap push ke `main` akan men-deploy ulang.

**Urutan saat ada perubahan database:** jalankan migrasi baru di Supabase → jalankan ulang `functions.sql` → baru deploy Vercel. Klien baru yang memanggil RPC yang belum ada akan gagal.

---

## Panel admin

Buka `/kamus-admin` (dilindungi PIN). Fungsinya:
- menyetujui atau menolak **usulan kata** dan **usulan emoji** (admin menentukan nama dan harga emoji),
- membuat, menyembunyikan, dan **menghapus emoji** toko,
- melihat **lobi aktif** dan ikut bermain sebagai admin.

> ⚠️ PIN admin diatur di database (`fn_admin_pin()` di `supabase/migration-v7.sql`). **Ganti sebelum dipakai di produksi**, dan jangan menyimpan PIN asli di repo publik.

---

## Struktur proyek

```
├── data/                    # kamus kata (JSON)
├── scripts/                 # seed kamus, bangun kamus KBBI
├── supabase/                # schema.sql, functions.sql, migration-v2 … v17
└── src/
    ├── app/                 # Beranda, room (lobi/play/hasil), toko, usulkan-emoji,
    │                        # leaderboard, kamus-admin, api/ (route server)
    ├── components/          # UI: kata, timer, tim, emoji, ticker, suara, dll.
    ├── lib/                 # supabase, realtime, aksi RPC, suku kata, kamus, suara
    └── types/game.ts
```

Detail lengkap ada di [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Catatan

- **Keamanan versi:** proyek memakai Next.js 14.2.15. Ada patch keamanan di jalur 14.2.x; disarankan upgrade (`npm install next@^14.2.33`) lalu `npm run build` ulang sebelum produksi.
- **Audio di HP:** suara aktif setelah sentuhan pertama (aturan browser). Fullscreen API terbatas di iOS Safari.
- **Akun berbasis perangkat:** akun tersimpan di browser; menghapus data browser berarti kehilangan akses ke akun tersebut.
- Game ini untuk hiburan santai. Kamus sengaja memuat sebagian kata percakapan (non-baku) agar permainan lebih seru.

## Kontribusi

Saran dan usulan kata/emoji bisa dikirim lewat fitur **Usulkan** di dalam game. Untuk perubahan kode, baca [AI-AGENTS.md](AI-AGENTS.md) (aturan, standar kode, dan alur kerja) dan [ARCHITECTURE.md](ARCHITECTURE.md) lebih dulu.
