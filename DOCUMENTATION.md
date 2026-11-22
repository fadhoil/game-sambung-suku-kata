# Dokumentasi Aplikasi — Sambung Suku Kata 🔗

> Game kekompakan multiplayer realtime untuk 2–16 pemain. Setiap pemain menyambung kata Bahasa Indonesia yang harus diawali **suku kata terakhir** kata sebelumnya. Mode survival: pemain yang gagal menjawab kehilangan nyawa, dan tereliminasi saat nyawa habis.

---

## 1. Ringkasan

**Sambung Suku Kata** adalah web app untuk main bareng teman kuliah atau rekan kantor. Semua pemain bergabung ke satu room lewat kode, main dari HP masing-masing, dan state permainan tersinkron realtime.

- **Tagline:** "Nyambung nggak? Buktiin!"
- **Pemain:** 2–16 orang
- **Platform:** Web (mobile-first), deploy di Vercel
- **Bahasa UI:** Indonesia

---

## 2. Cara Bermain

1. **Host** membuat room → mendapat kode 6 karakter (bisa dibagikan via salin kode atau QR).
2. **Pemain lain** gabung dengan memasukkan kode di HP masing-masing.
3. Host mengatur **mode**, **timer**, dan **nyawa**, lalu menekan **Mulai**.
4. Muncul **hitung mundur 5 detik** di semua layar, lalu kata awal muncul.
5. Pemain pada giliran aktif mengetik kata yang harus:
   - **diawali suku kata terakhir** kata sebelumnya (contoh: LUKISAN → sambung `-SAN` → SANTAI),
   - **ada di kamus**,
   - **belum pernah dipakai** pada ronde ini,
   - **tidak membuat buntu** (suku kata terakhirnya masih punya kemungkinan lanjutan).
6. Gagal menjawab (waktu habis / tak menemukan kata) → **kehilangan 1 nyawa**. Nyawa habis → **tereliminasi**.
7. **Pemenang:**
   - **Free For All:** pemain terakhir yang bertahan.
   - **Tim:** tim terakhir yang masih punya anggota hidup.

### Aturan khusus
- **Keringanan suku kata.** Bila **2 pemain berturut-turut gagal** pada suku kata target yang sama (mis. `-UR`), sistem melonggarkan target jadi **1 huruf terakhir** (mis. `-R`) untuk pemain berikutnya. Muncul pop-up keringanan di semua layar dengan **hold 3 detik** (timer ditahan) sebelum giliran lanjut. Target kembali normal begitu ada kata valid.
- **Giliran pembuka dipilih acak** (bukan selalu pemain pertama).
- **Mode Tim:** giliran berputar antar-tim; saat giliran sebuah tim, sistem **mengacak** satu anggota tim yang masih hidup untuk menyambung.
- **Pemain tereliminasi tetap di room sebagai penonton** — bisa melihat jalannya permainan realtime, tetapi tidak bisa mengetik.
- **Host bisa mengakhiri permainan** kapan saja lewat tombol "Akhiri Permainan".

---

## 3. Mode & Pengaturan (diatur Host di lobby)

| Pengaturan | Pilihan | Keterangan |
|------------|---------|------------|
| **Mode** | Free For All / Tim | FFA = semua lawan semua. Tim = komposisi custom, giliran acak per anggota. |
| **Waktu per giliran** | 5 / 7 / 10 / 15 detik | Default 7 detik. |
| **Nyawa per pemain** | 1 – 5 | Default 1. Gagal menjawab = −1 nyawa; eliminasi saat 0. |

---

## 4. Fitur

- 🔗 Sambung kata berbasis **suku kata terakhir** (algoritma pemisah suku kata konsisten di klien & server)
- ⏱️ **Timer otoritatif di server** — eliminasi ditentukan server, adil & anti-cheat
- ❤️ **Mode nyawa 1–5** — gagal mengurangi nyawa, bukan langsung keluar
- 👤 **Free For All** & 👥 **Tim** (komposisi custom, giliran acak)
- 📖 **Kamus Bahasa Indonesia** 3.500+ kata, termasuk kata percakapan umum (ngopi, gabut, baper, dll)
- 🚫 **Anti-buntu (dead-end)** — kata yang membuat permainan mentok ditolak, dicek di klien (instan) & server (otoritatif)
- ⏳ **Hitung mundur 5 detik** saat permainan dimulai, dengan grace agar waktu pemain pertama tidak terpotong
- 👀 **Mode penonton** untuk pemain tereliminasi
- 🧍 **Sesi per-device** — satu device = satu pemain per room (cegah pemain fiktif/double-join)
- 🟢 **Status online akurat** via Supabase Presence (offline otomatis saat HP/tab ditutup)
- 🏅 **Peringkat akhir** berdasarkan bertahan terlama (per-pemain untuk FFA, per-tim untuk mode Tim)
- 📤 **Bagikan Hasil sebagai gambar** — kartu hasil di-capture jadi PNG + ajakan join (share ke WA/IG/dll; fallback unduh di desktop)
- ✉️ **Undang via link** (`?join=KODE`) + 📷 **QR pop-up** di lobby
- 📷 **Gabung lewat Scan QR** di halaman awal (kamera) — kode terisi & langsung masuk
- 👢 **Kick pemain** & 🧩 **kelola tim** (pindah antar tim / keluarkan dari tim) untuk host
- 🚪 **Keluar Room** untuk pemain non-host, ✕ **Batalkan/Bubarkan room** untuk host
- ⏹ **Tombol Akhiri Permainan** untuk host
- 📖 **Pop-up Cara Bermain** otomatis saat masuk room (auto-tutup 20 detik)
- 🔊 **Sound effect** menyeluruh (jingle halaman awal, klik tombol, countdown, dsb) + tombol **mute**
- ⛶ **Layar penuh** (tersedia di halaman awal, lobby, & halaman permainan)
- 🔊 **Sound effect** (Web Audio API): countdown, timer menipis, kata valid/salah, eliminasi, fanfare pemenang
- 📱 **Realtime antar HP** via Supabase; deploy mulus ke Vercel
- 🎨 **UI lembut/pastel** yang nyaman di mata

---

## 5. Arsitektur Teknis

```
┌──────────────────── Klien (HP Pemain) ────────────────────┐
│  Next.js 14 (App Router) + React + TypeScript + Tailwind   │
│  - Halaman: Home, Lobby, Play, Result                      │
│  - Supabase JS: Realtime (subscribe) + RPC (aksi game)     │
│  - Kamus klien (data/*.json) untuk pra-validasi instan     │
└──────────────┬─────────────────────────┬──────────────────┘
               │ Realtime (WebSocket)     │ HTTPS (RPC/REST)
               ▼                          ▼
┌──────────────────────── Supabase ─────────────────────────┐
│  Postgres: rooms, players, teams, rounds, moves,           │
│            used_words, dictionary                          │
│  Realtime: broadcast perubahan tabel ke semua klien        │
│  RPC (SECURITY DEFINER): seluruh logika game otoritatif    │
│  RLS: tabel read-only untuk anon; mutasi hanya via RPC     │
└────────────────────────────────────────────────────────────┘
               ▲ Deploy
┌──────────────────────── Vercel ───────────────────────────┐
│  Hosting Next.js (SSR + static). Env: URL + anon key.      │
└────────────────────────────────────────────────────────────┘
```

### Prinsip kunci
- **Server otoritatif.** Timer, validasi kata, kamus, anti-buntu, eliminasi, dan penentuan giliran dilakukan di fungsi Postgres (RPC). Klien hanya menampilkan state + pra-validasi untuk UX.
- **Kamus di dua tempat (sengaja).** File JSON di klien untuk feedback instan; tabel `dictionary` di DB untuk validasi final. Keduanya diisi dari sumber yang sama via skrip seed agar konsisten.
- **Idempoten & aman balapan.** `resolve_timeout` memakai cek deadline ulang + `FOR UPDATE`, sehingga aman walau beberapa klien memicunya bersamaan (mencegah room macet bila pemain aktif disconnect).

---

## 6. Model Data (Postgres)

| Tabel | Isi |
|-------|-----|
| `rooms` | status, mode, timer_seconds, max_lives, host, ronde aktif |
| `players` | nama, avatar, tim, is_alive, lives, turn_order, koneksi |
| `teams` | nama, warna, urutan giliran tim |
| `rounds` | kata awal, kata kini, suku target, subjek/tim aktif, deadline, pemenang |
| `moves` | setiap submit (valid/invalid + alasan: chain/dict/dupe/timeout/deadend) |
| `used_words` | anti-duplikat kata per ronde |
| `dictionary` | kamus kata (untuk validasi & anti-buntu di server) |

---

## 7. Fungsi RPC Utama

| Fungsi | Peran |
|--------|-------|
| `create_room` / `join_room` | Buat / gabung room (set nyawa awal) |
| `set_room_settings` | Host ubah mode, timer, nyawa |
| `upsert_team` / `assign_player_team` | Atur tim (mode Tim) |
| `start_game` | Mulai ronde; pilih pembuka acak; grace 5 detik di giliran pertama |
| `submit_word` | Validasi sambung + kamus + duplikat + anti-buntu; lanjut giliran |
| `resolve_timeout` / `fn_handle_timeout` | Waktu habis → kurangi nyawa / eliminasi → lanjut giliran |
| `end_game` | Host akhiri sesi kapan saja |
| `play_again` | Reset room ke lobby untuk ronde baru |
| `fn_last_syllable` | Algoritma suku kata (sumber kebenaran target sambung) |
| `fn_in_dict` / `fn_has_continuation` | Cek kamus & anti-buntu di server |
| `seed_dictionary` | Upload kamus ke tabel `dictionary` |

---

## 8. Struktur Project

```
game-apps/
├── data/
│   ├── kata-id.json            # kamus dasar
│   └── kata-id-extra.json      # kamus tambahan (kosakata + percakapan)
├── scripts/
│   └── seed-dictionary.mjs     # upload kamus ke Supabase
├── supabase/
│   ├── schema.sql              # tabel awal + RLS + realtime
│   ├── functions.sql           # semua fungsi RPC (logika game)
│   ├── migration-v2.sql        # + kolom nyawa (lives / max_lives)
│   └── migration-v3.sql        # + tabel dictionary & anti-buntu
└── src/
    ├── app/
    │   ├── page.tsx                  # Home (buat/gabung room)
    │   └── room/[code]/
    │       ├── page.tsx              # Lobby (setting, tim, cara bermain)
    │       ├── play/page.tsx         # Permainan
    │       └── result/page.tsx       # Hasil & pemenang
    ├── components/                   # TimerRing, WordChain, WordInput,
    │                                 # Countdown, RulesModal, Confetti,
    │                                 # PlayerChip, TeamBuilder, FullscreenButton
    ├── lib/                          # syllable, dictionary, sound,
    │                                 # supabaseClient, useRoomRealtime,
    │                                 # gameActions, session
    └── types/game.ts
```

---

## 9. Setup & Deploy

### Supabase (sekali di awal, lalu saat ada perubahan DB)
Jalankan di SQL Editor secara berurutan:
1. `supabase/schema.sql`
2. `supabase/functions.sql`
3. `supabase/migration-v2.sql`
4. `supabase/migration-v3.sql`
5. `supabase/migration-v4.sql`
6. `supabase/migration-v5.sql`

Lalu isi kamus ke DB (dari folder `game-apps`):
```bash
node scripts/seed-dictionary.mjs
```

### Environment (`.env`)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Lokal
```bash
npm install
npm run dev        # http://localhost:3000
```

### Deploy ke Vercel
```bash
vercel          # preview
vercel --prod   # produksi (URL publik)
```
Set `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` di Environment Variables Vercel.

---

## 10. Menambah / Mengubah Kamus

1. Tambahkan kata ke `data/kata-id-extra.json`.
2. Jalankan ulang seed agar DB ikut diperbarui:
   ```bash
   node scripts/seed-dictionary.mjs
   ```
3. Deploy ulang (`vercel --prod`) agar kamus klien ikut terbarui.

> Penting: kamus ada di klien (file) dan server (DB). Keduanya harus disinkronkan — langkah 2 & 3 di atas menjaga keduanya konsisten.

---

## 11. Catatan & Batasan

- **Validasi suku kata** mengikuti algoritma baku (menangani digraf `ng`, `ny`, `kh`, `sy`). Target sambung selalu ditampilkan ke pemain (mis. "Sambung dari: -SAN") agar tidak ada perdebatan.
- **iOS Safari** membatasi Fullscreen API; tombol layar penuh mungkin tidak berefek di perangkat tersebut.
- **Audio mobile** baru aktif setelah interaksi pertama pengguna (dibuka otomatis saat sentuhan pertama).
- **Keamanan versi:** Next.js 14.2.15 memiliki anjuran patch keamanan; disarankan upgrade ke `next@^14.2.33` saat jaringan stabil, lalu `npm run build` ulang.
- Game ini untuk hiburan santai; validasi kamus mencakup sebagian kata percakapan (non-baku) secara sengaja agar main lebih seru.

---

*Dokumen ini merangkum keadaan aplikasi saat ditulis. Perbarui bila ada perubahan fitur, skema, atau alur deploy.*
