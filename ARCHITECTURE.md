# Architecture — Sambung Suku Kata

> Struktur aplikasi, teknologi, dan cara semua komponen terhubung. Dibuat dari kode repo `fadhoil/game-sambung-suku-kata`. Prinsip utamanya: **server (Postgres) memegang seluruh logika game; klien hanya menampilkan state dan membantu validasi cepat.**

---

## 1. Gambaran besar

```
┌─────────────────────── Browser HP pemain (Next.js 14, React 18, TS) ───────────────────────┐
│  Halaman: Beranda · Lobi · Play · Hasil · Toko · Usulkan Emoji · Peringkat · Admin          │
│  supabase-js (anon key)   html5-qrcode   html-to-image   livekit-client   Web Audio         │
│  localStorage: identitas room, deviceId, token akun, kunci perangkat                        │
└───────┬───────────────────┬───────────────────┬───────────────────┬─────────────────────────┘
        │ RPC (HTTPS)       │ Realtime (WS)     │ fetch             │ WebRTC (suara)
        ▼                   ▼                   ▼                   ▼
┌────────────────── Supabase ───────────────┐ ┌──── Vercel (Next route handlers) ───┐  ┌─ LiveKit Cloud ─┐
│ Postgres: tabel + fungsi RPC (otoritatif) │ │ /api/livekit-token                  │  │ Ruang suara     │
│ Realtime: postgres_changes, presence,     │ │ /api/emoji-suggest                  │  │ per room        │
│           broadcast                       │ │ /api/admin/emoji                    │  └─────────────────┘
│ Storage: bucket publik "emoji-assets"     │◄┤ /api/admin/emoji-remove             │
│ RLS: tabel hanya-baca untuk anon          │ │  (service-role key, hanya di server)│
└───────────────────────────────────────────┘ └─────────────────────────────────────┘
```

| Lapisan | Peran |
|---|---|
| **Klien** | UI, pra-validasi kata (kamus lokal), langganan realtime, memanggil RPC |
| **Supabase Postgres** | Sumber kebenaran: aturan game, giliran, timer, poin, akun, toko |
| **Supabase Realtime** | Menyebarkan perubahan tabel, presence online, dan broadcast reaksi |
| **Supabase Storage** | Menyimpan gambar dan suara emoji (baca publik, tulis hanya via server) |
| **Route handler Next.js** | Hal yang butuh rahasia: token LiveKit, unggah/hapus file emoji |
| **LiveKit** | Voice chat audio-only di lobi dan hasil |
| **Vercel** | Hosting Next.js |

---

## 2. Teknologi

| Area | Pilihan | Versi (package.json) |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.15 |
| UI | React, TypeScript (`strict: true`) | 18.3.1, 5.5 |
| Styling | Tailwind CSS + `globals.css` | 3.4 |
| Font | Plus Jakarta Sans (`next/font/google`) | — |
| Backend-as-a-service | Supabase (`@supabase/supabase-js`) | 2.45 |
| Suara realtime | `livekit-client`, `livekit-server-sdk` | 2.23, 2.19 |
| Pemindai QR | `html5-qrcode` | 2.3 |
| Gambar hasil | `html-to-image` | 1.11 |
| Audio efek | Web Audio API (`lib/sound.ts`) | — |
| Iklan | Skrip Google AdSense di `layout.tsx` | — |
| Hosting | Vercel | — |

Tidak ada pustaka state global, pustaka ikon, atau framework tes. Tidak ada konfigurasi ESLint/Prettier di repo.

---

## 3. Struktur repo

```
game-sambung-suku-kata/
├── data/
│   ├── kata-id.json            # kamus dasar
│   ├── kata-id-extra.json      # kosakata tambahan + percakapan
│   └── kata-id-kbbi.json       # kata tunggal dari KBBI (dibangun skrip)
├── scripts/
│   ├── seed-dictionary.mjs     # unggah kamus ke tabel dictionary
│   └── build-kbbi.mjs          # bangun kata-id-kbbi.json dari daftar KBBI mentah
├── supabase/
│   ├── schema.sql              # tabel awal, RLS, publikasi realtime
│   ├── functions.sql           # SEMUA fungsi RPC logika game (versi terbaru)
│   └── migration-v2 … v17.sql  # perubahan skema bertahap
├── public/                     # logo, ikon QR
└── src/
    ├── app/
    │   ├── layout.tsx, globals.css, icon.png
    │   ├── page.tsx                      # Beranda (avatar, buat/gabung room, ticker, Toko)
    │   ├── room/[code]/page.tsx          # Lobi (pengaturan, tim, suara, reaksi)
    │   ├── room/[code]/play/page.tsx     # Permainan
    │   ├── room/[code]/result/page.tsx   # Hasil, poin, bagikan
    │   ├── leaderboard/                  # Peringkat minggu ini / sepanjang masa
    │   ├── toko/                         # Toko + Inventory emoji
    │   ├── usulkan-emoji/                # Pemain mengusulkan emoji
    │   ├── kamus-admin/                  # Admin: usulan kata, lobi aktif, emoji
    │   └── api/
    │       ├── livekit-token/route.ts
    │       ├── emoji-suggest/route.ts
    │       └── admin/{emoji,emoji-remove}/route.ts
    ├── components/                       # lihat bagian 8
    ├── lib/                              # lihat bagian 7
    └── types/game.ts                     # tipe Room, Player, Team, Round, Move, …
```

Alias impor: `@/*` → `./src/*`.

---

## 4. Model data

Tabel dibagi menurut domain (nama dari migrasi dan pemanggilan RPC).

| Domain | Tabel | Isi singkat |
|---|---|---|
| **Game inti** | `rooms`, `players`, `teams`, `rounds`, `moves`, `used_words` | Status room, mode, timer, nyawa; pemain (nyawa, hidup, `turn_order`, `turn_done`, penonton, admin); tim; ronde aktif (suku kata target, subjek aktif, deadline, `relaxed`); riwayat kata; anti-duplikat |
| **Kamus** | `dictionary`, `word_suggestions` | Kata valid untuk validasi server; usulan kata pemain (pending/approved/rejected) |
| **Akun dan poin** | `accounts`, `player_keys`, `point_ledger`, `round_results`, `host_penalties` | Akun per perangkat (hash token, soft-delete); kunci perangkat; buku besar skor 🏆 dan koin 🪙; hasil poin per pemain per ronde (termasuk guest); penalti host |
| **Toko** | `emojis`, `account_emojis`, `account_emoji_slots` | Katalog emoji; kepemilikan; 3 slot terpasang per akun |
| **Usulan emoji** | `emoji_suggestions` | Antrean sementara (pending/approved/rejected) |

Catatan model:
- Semua tabel punya **RLS aktif**. Tabel game boleh dibaca anon (perlu untuk realtime); tabel sensitif (`accounts`, `point_ledger`, `emoji_suggestions`, `account_emoji_slots`, …) **tanpa policy** sehingga hanya bisa diakses lewat RPC `SECURITY DEFINER`.
- `players` memakai `REPLICA IDENTITY FULL` agar event DELETE membawa `room_id` (kick terdeteksi realtime).
- `account_emoji_slots` memakai FK komposit ke `account_emojis` sehingga hanya emoji yang **dimiliki** yang bisa dipasang; `unique (account_id, emoji_id)` mencegah satu emoji di dua slot.

---

## 5. Lapisan RPC (logika otoritatif)

Klien tidak pernah menulis tabel langsung. Semua aksi lewat `supabase.rpc(...)` yang dibungkus di `src/lib/gameActions.ts`.

| Domain | RPC |
|---|---|
| Room dan sesi | `create_room`, `join_room`, `leave_room`, `cancel_room`, `kick_player`, `set_room_settings`, `set_connected`, `set_spectator`, `find_active_session`, `play_again` |
| Tim | `upsert_team`, `assign_player_team`, `remove_player_team` |
| Permainan | `start_game`, `submit_word`, `resolve_timeout`, `end_game`, `end_game_preview`, `get_host_lock`, `get_round_points` |
| Akun dan poin | `register_account`, `get_accounts`, `delete_account`, `get_leaderboard` |
| Usulan kata | `suggest_words`, `list_suggestions`, `review_suggestion` |
| Toko | `list_shop_emojis`, `buy_emoji`, `list_my_emojis`, `set_emoji_slot` |
| Usulan emoji | `check_emoji_suggest`, `suggest_emoji`, `admin_list_emoji_suggestions`, `admin_review_emoji_suggestion` |
| Admin | `admin_check_pin`, `list_active_rooms`, `admin_list_emojis`, `admin_create_emoji`, `admin_set_emoji_active`, `admin_delete_emoji` |
| Berita | `list_today_news` |

Fungsi internal (tidak dipanggil klien): `fn_last_syllable`, `fn_in_dict`, `fn_has_continuation`, `fn_fit_syllable`, `fn_advance_turn`, `fn_pick_first_subject`, `fn_handle_timeout`, `fn_relax_threshold`, `fn_putaran`, `fn_pts_cfg`, `fn_account_id`, `fn_admin_pin`.

Konvensi RPC: galat dilempar sebagai `raise exception 'KODE_HURUF_BESAR'` (mis. `NAME_TAKEN`, `BAD_PIN`); hasil bisnis yang wajar dikembalikan sebagai JSON `{ok, reason}`. Klien memetakan kode ke pesan Indonesia.

---

## 6. Alur kunci

### 6.1 Siklus permainan

```
Host: start_game ──► rooms.status = playing, round dibuat, pembuka dipilih acak, grace 5 dtk
        │
        ▼
 Pemain aktif ── submit_word ──► validasi (suku kata, kamus, duplikat, anti-buntu)
        │                          ├─ valid  → used_words + moves, target baru, fn_advance_turn
        │                          └─ invalid → moves(reason), tidak ganti giliran
        │
 Deadline lewat ── resolve_timeout(round) ──► (dipicu klien di play page, idempoten)
        │                          └─ kurangi nyawa / eliminasi → fn_advance_turn
        ▼
 Pemenang terdeteksi ──► rounds.finished, round_results dihitung, ledger poin diisi
        │
 Host: play_again ──► kembali ke lobi (penonton naik jadi pemain)
```

- **Timer otoritatif:** deadline disimpan di `rounds.turn_deadline`. Klien menghitung mundur hanya untuk tampilan dan memanggil `resolve_timeout` saat lewat. Fungsi mengecek ulang deadline dengan `FOR UPDATE`, sehingga banyak klien boleh memanggilnya bersamaan.
- **Pra-validasi di klien:** `lib/syllable.ts` dan `lib/dictionary.ts` memberi feedback instan. Server tetap memutuskan; `fn_last_syllable` adalah sumber kebenaran suku kata, jadi **dua implementasi harus selalu sama**.

### 6.2 Penentuan giliran (`fn_advance_turn`)
- **FFA:** pemain hidup berikutnya menurut `turn_order`.
- **Tim:** tim bergantian menurut urutan tim. Di dalam tim, dipilih acak satu anggota hidup dengan `turn_done = false`; bila semua sudah, penanda tim direset (siklus baru). Pemain terpilih langsung ditandai `turn_done = true`. `start_game` mereset semua penanda dan menandai pembuka.

### 6.3 Keringanan suku kata
| Jenis | Pemicu | Efek |
|---|---|---|
| **Karena gagal** | Gagal beruntun mencapai ambang acak `fn_relax_threshold` = 1..(n−1), n = tim hidup (mode Tim) atau pemain hidup (FFA) | Target jadi 1 huruf terakhir; `relaxed = true` |
| **Karena kamus** | Setelah kata valid, `fn_fit_syllable` mendapati suku kata penuh tak punya kata yang belum terpakai | Huruf depan dibuang satu per satu sampai ada kata (min. 1 huruf); `relaxed = true` |

Keduanya menyimpan `full_syllable` (asli) dan `required_syllable` (target baru), menambah deadline 3 detik, lalu klien menampilkan pop-up `RelaxNotice` (kunci tampilan: ronde + kata kini + suku kata penuh + status).

### 6.4 Poin dan koin
Saat ronde selesai, `round_results` menyimpan poin **semua** pemain (termasuk guest) memakai aturan `fn_pts_cfg` (rantai minimal, bonus rantai, kata terpanjang, bonus tim). Ledger akun (`point_ledger`) hanya diisi untuk pemain ber-akun dan diturunkan dari hasil itu. Game yang diakhiri host tidak menghasilkan poin; host yang mengakhiri terlalu cepat terkena penalti bertahap (`host_penalties`). Skor 🏆 bersifat akumulatif; koin 🪙 adalah saldo yang bisa dibelanjakan.

### 6.5 Akun berbasis perangkat
Perangkat mendaftar dan mendapat **token acak** yang disimpan di `localStorage` (`ssk:accounts`); server hanya menyimpan **hash SHA-256**. Token dikirim sebagai `p_token` ke RPC bertanda akun; `fn_account_id(token)` menerjemahkannya dan memperlakukan akun terhapus sebagai guest. Maksimal 3 akun per perangkat, nama unik di antara akun aktif.

### 6.6 Emoji: dari unggah sampai dipakai

```
Admin buat emoji ─► POST /api/admin/emoji ─► cek PIN (RPC) ─► unggah gambar+suara ke Storage ─► admin_create_emoji
Pemain usul ─────► POST /api/emoji-suggest ─► check_emoji_suggest ─► unggah ─► suggest_emoji (pending)
Admin terima ────► admin_review_emoji_suggestion(approve, nama, harga) ─► masuk tabel emojis (file tidak dipindah)
Admin tolak/hapus ► POST /api/admin/emoji-remove ─► RPC ─► hapus file di Storage
Pemain beli ─────► buy_emoji ─► account_emojis ─► pasang ke slot (set_emoji_slot)
Pakai di room ───► ReactionLayer ─► broadcast "emoji:custom" {image_path, sound_path} ─► semua klien menampilkan balon + suara
```

- File memakai path acak `img/<uuid>.<ext>` dan `snd/<uuid>.<ext>`; cache CDN satu tahun, aman karena path tidak pernah dipakai ulang.
- Tipe file ditentukan dari **magic bytes** di server, bukan dari nama atau `Content-Type` klien.
- Penerima broadcast hanya menerima path polos (`[\w./-]+`, tanpa `..`) lalu menyusun URL Storage sendiri.
- Hapus emoji: `admin_delete_emoji` menghapus `account_emojis` lebih dulu (slot ikut terhapus lewat FK cascade), lalu `emojis`; route menghapus file. Koin tidak dikembalikan.

### 6.7 Berita beranda
`list_today_news` menggabungkan usulan kata dan usulan emoji yang **diterima hari ini** (zona Asia/Jakarta), terbaru dulu, maksimal 10. `NewsTicker` memuatnya sekali saat beranda dibuka dan memutarnya berurutan dengan jeda 3 detik.

### 6.8 Suara (LiveKit)
Klien memanggil `/api/livekit-token` dengan kode room dan identitas pemain; server membuat JWT dengan `LIVEKIT_API_SECRET` (tidak pernah ke browser). Klien tersambung ke `NEXT_PUBLIC_LIVEKIT_URL` hanya untuk audio.

---

## 7. Klien: modul `src/lib`

| Modul | Peran |
|---|---|
| `supabaseClient.ts` | Satu instance supabase-js (anon key) |
| `gameActions.ts` | Pembungkus RPC dan route server, tipe hasil, kelas galat |
| `useRoomRealtime.ts` | Langganan kanal `room:{id}` ke `rooms`, `players`, `teams`, `rounds`; menyusun state room |
| `usePresence.ts` | Kanal presence `presence:{KODE}`; status online pemain |
| `useRoomReactions.ts` | Kanal broadcast `reactions:{KODE}`: reaksi bawaan, emoji kustom, ready-check |
| `session.ts` | Identitas room, `deviceId`, akun dan token (`ssk:identity`, `ssk:deviceId`, `ssk:accounts`, `ssk:deviceKey`) |
| `syllable.ts`, `dictionary.ts` | Pemisah suku kata dan kamus klien (JSON dari `data/`) |
| `sound.ts` | Efek suara Web Audio, tombol mute |
| `emojiLimits.ts` | Konstanta batas emoji (dipakai klien **dan** server) |
| `emojiServer.ts` | Helper khusus server: deteksi tipe file, unggah/hapus Storage, klien service-role |
| `imageProcess.ts` | Perkecil gambar emoji di browser, baca durasi suara |
| `motion.ts` | `stagger(i)` untuk animasi masuk bertahap |

---

## 8. Klien: komponen

| Kelompok | Komponen |
|---|---|
| Permainan | `WordChain`, `WordInput`, `TimerRing`, `Countdown`, `PlayerChip`, `RelaxNotice`, `RoundPoints`, `Confetti`, `EndGameConfirm` |
| Lobi dan room | `TeamBuilder`, `QrModal`, `QrScanner`, `RulesModal`, `VoiceChat`, `ReactionLayer` |
| Akun dan poin | `AccountBar`, `AccountPrompt`, `AccountSwitcher`, `PointsPill` |
| Hasil | `ShareCard` (dirender jadi PNG) |
| Emoji | `EmojiBubbles`, `EmojiFileFields`, `EmojiInventory`, `EmojiAdmin`, `EmojiSuggestionsAdmin` |
| Usulan | `SuggestWordModal` |
| Umum | `NewsTicker`, `FullscreenButton`, `MuteButton`, `SoundProvider` |

Hampir semua halaman adalah Client Component (`"use client"`) karena bergantung pada realtime, `localStorage`, dan audio.

---

## 9. Keamanan

| Ancaman | Kontrol |
|---|---|
| Klien curang mengubah state | RLS tanpa policy tulis; semua mutasi lewat RPC; timer dan validasi di server |
| Pembacaan data sensitif | Tabel akun/poin/usulan tanpa policy baca; hanya RPC `SECURITY DEFINER` |
| Pencurian token akun | Server hanya menyimpan hash; token terpisah dari `device_id` yang publik |
| Akses admin | PIN diverifikasi **di dalam SQL** (`fn_admin_pin`); route server meneruskan PIN ke RPC |
| Unggahan berbahaya | Batas ukuran, deteksi magic bytes, path acak, bucket hanya bisa ditulis service-role |
| Kebocoran rahasia | `SUPABASE_SERVICE_ROLE_KEY` dan `LIVEKIT_API_SECRET` hanya di env server, tanpa awalan `NEXT_PUBLIC_` |
| Spam usulan emoji | Login wajib, maks. 3 usulan menunggu per akun, syarat dicek **sebelum** file diunggah |

**Celah yang diketahui:** PIN admin tertulis di `migration-v7.sql` pada repo yang bisa di-clone publik; belum ada pembatasan laju per IP untuk route upload.

---

## 10. Deploy dan konfigurasi

### 10.1 Variabel lingkungan

| Variabel | Dipakai di | Rahasia? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Klien + server | Tidak |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Klien + server | Tidak (dibatasi RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Route unggah/hapus emoji | **Ya, server-only** |
| `NEXT_PUBLIC_LIVEKIT_URL` | Klien | Tidak |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | `/api/livekit-token` | **Ya, server-only** |

### 10.2 Urutan deploy perubahan database
1. Jalankan migrasi baru di Supabase SQL Editor (idempoten).
2. Jalankan ulang `supabase/functions.sql` (sumber kebenaran fungsi game).
3. Deploy ke Vercel.

Klien baru yang memanggil RPC yang belum ada akan gagal, jadi **database dulu, Vercel kemudian**. Jangan menjalankan ulang migrasi lama yang mendefinisikan versi fungsi lama sesudah migrasi yang menggantinya (contoh: `migration-v11.sql` setelah `v12`). Fungsi yang diganti migrasi (mis. `fn_relax_threshold` di `v16`) tetap benar selama `functions.sql` tidak mendefinisikannya ulang.

### 10.3 Kamus
Kamus ada di dua tempat: JSON di klien (feedback instan) dan tabel `dictionary` (validasi final). Mengubah kata lewat file berarti: edit `data/*.json` → `node scripts/seed-dictionary.mjs` → deploy ulang. Kata dari usulan yang disetujui admin langsung masuk tabel server.

### 10.4 Perintah
```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # butuh akses ke Google Fonts
npx tsc --noEmit     # pemeriksaan tipe
```

---

## 11. Keputusan arsitektur dan alasannya

| Keputusan | Alasan | Konsekuensi |
|---|---|---|
| Logika game di Postgres, bukan di server Next | Satu tempat otoritatif, anti-cheat, tanpa server game tersendiri; murah | Perubahan aturan = ubah SQL + migrasi, tes perlu Postgres |
| Kamus di klien **dan** server | UX instan tanpa kehilangan otoritas | Harus selalu disinkronkan |
| Akun berbasis perangkat tanpa email/sandi | Gabung secepat mungkin | Akun hilang bila data browser terhapus |
| Penyimpanan emoji di Storage publik dengan path acak | CDN, cache panjang, URL tidak bisa ditebak | Hapus butuh route server |
| Route server hanya untuk hal bersifat rahasia | Menjaga kunci service-role dan LiveKit di luar browser | Dua jalur akses (RPC dan route) yang harus konsisten |
| Satu file `functions.sql` + migrasi bertahap | Fungsi mudah dibaca utuh; skema berubah terkontrol | Aturan "jangan ulang migrasi lama" harus dipatuhi |

---

## 12. Ketidaksesuaian dan utang teknis yang diketahui

| # | Temuan | Saran |
|---|---|---|
| 1 | `DOCUMENTATION.md` belum memuat akun, poin, toko, suara, dan daftar migrasinya berhenti di v5 | Perbarui, atau ganti dengan dokumen ini |
| 2 | `tsconfig.tsbuildinfo` dan `_gitstatus.txt` ter-commit | `git rm --cached` dan tambahkan ke `.gitignore` |
| 3 | Tidak ada ESLint/Prettier dan tidak ada tes otomatis | Tambahkan `.eslintrc` dasar dan tes SQL (harness Postgres lokal) |
| 4 | Next.js 14.2.15 punya anjuran patch keamanan | Naikkan ke 14.2.33+ dan uji build |
| 5 | Kata awal ronde tidak mendapat keringanan kamus | Evaluasi bila kata awal bisa buntu |
| 6 | Repo publik memuat PIN admin | Ganti PIN, pindahkan dari file, atau jadikan repo private |
