# Sambung Suku Kata 🔗

Game kekompakan multiplayer realtime untuk **2–16 pemain**. Tiap pemain menyambung kata Bahasa Indonesia yang harus diawali **suku kata terakhir** kata sebelumnya. Mode survival: yang kehabisan waktu (default 7 detik) atau tak menemukan kata valid akan **tereliminasi**. Terakhir bertahan menang.

Cocok buat ngumpul teman kuliah atau rekan kantor. Semua main lewat **HP masing-masing** dalam satu room.

## Fitur
- 🔗 Sambung kata dari suku kata terakhir (mis. LUKISAN → **SAN**TAI)
- ⏱️ Timer per giliran (5 / 7 / 10 / 15 detik), otoritatif di server
- 👤 Mode **Free For All** & 👥 Mode **Tim** (komposisi custom, giliran acak per anggota tim)
- 📖 Validasi pakai kamus Bahasa Indonesia (anti ngarang)
- 📱 Realtime antar HP via Supabase, deploy ke Vercel
- 🎨 UI lembut & memanjakan mata (soft pastel)

## Stack
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres + Realtime + RPC) untuk state game & sinkronisasi
- Deploy: **Vercel**

---

## Setup

### 1. Buat project Supabase (gratis)
1. Daftar di https://supabase.com dan buat project baru.
2. Buka **SQL Editor**, jalankan isi file berikut secara berurutan:
   - `supabase/schema.sql`
   - `supabase/functions.sql`
3. Buka **Project Settings → API**, salin:
   - `Project URL`
   - `anon public` key

### 2. Konfigurasi environment
```bash
cp .env.example .env
```
Isi `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Jalankan lokal
```bash
npm install
npm run dev
```
Buka http://localhost:3000. Untuk tes multiplayer, buka beberapa tab/HP dan gabung dengan kode room yang sama.

---

## Deploy ke Vercel
1. Push project ke GitHub.
2. Di https://vercel.com → **Import Project** → pilih repo.
3. Tambahkan Environment Variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. Supabase menangani realtime, Vercel menghosting app.

---

## Cara Main
1. **Host** buat room → dapat kode 6 karakter (atau bagikan QR).
2. Pemain lain **gabung** dengan kode di HP masing-masing.
3. Host pilih mode (FFA/Tim) & timer, lalu **Mulai**.
4. Sistem kasih kata awal. Pemain pada giliran aktif mengetik kata yang:
   - diawali suku kata target (ditampilkan "Sambung dari: -XXX"),
   - ada di kamus,
   - belum pernah dipakai.
5. Gagal / kehabisan waktu → **tereliminasi**.
6. **FFA**: satu pemain terakhir menang. **Tim**: tim terakhir dengan anggota hidup menang.

---

## Catatan Teknis
- **Timer otoritatif di server**: eliminasi ditentukan `turn_deadline` di DB, bukan klien, agar adil.
- **Algoritma suku kata** ada di klien (`src/lib/syllable.ts`) dan server (`fn_last_syllable` di `functions.sql`) dengan aturan yang sama — menjadi sumber kebenaran tunggal target sambung.
- **Kamus** (`data/kata-id.json`) ukuran sedang; mudah diperluas dengan menambah kata.
- Semua mutasi state lewat RPC `SECURITY DEFINER`; RLS membuat tabel read-only untuk anon.

## Catatan Versi & Keamanan
- Project memakai **Next.js 14.2.15** (versi yang terverifikasi bisa build di mesin pengembangan ini).
- Next merilis patch keamanan di jalur 14.2.x. **Sebelum deploy produksi, disarankan upgrade** ke versi patched terbaru saat koneksi internet stabil:
  ```bash
  npm install next@^14.2.33
  npm run build   # verifikasi ulang
  ```
- Saat deploy ke Vercel (Linux), Next.js otomatis mengunduh binary SWC yang sesuai. Tidak perlu menambahkan paket `@next/swc-*` platform-spesifik ke package.json (itu hanya relevan untuk OS tertentu dan bisa menggagalkan build lintas platform).

## Struktur
```
game-apps/
├── data/kata-id.json          # kamus kata
├── supabase/
│   ├── schema.sql             # tabel + RLS + realtime
│   └── functions.sql          # RPC logika game
└── src/
    ├── app/                   # Home, Lobby, Play, Result
    ├── components/            # TimerRing, WordChain, WordInput, dll
    ├── lib/                   # syllable, dictionary, supabase, realtime, actions
    └── types/game.ts
```
