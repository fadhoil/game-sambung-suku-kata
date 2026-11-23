# AI-AGENTS.md — Panduan untuk AI Coding Agent

> Instruksi untuk agent (Claude Code, Cursor, Copilot, Kiro, dsb.) yang bekerja di repo **Sambung Suku Kata**. Baca seluruhnya sebelum mengubah apa pun. Dokumen pendamping: `PRODUCT-REQUIREMENTS.md` (apa dan kenapa), `ARCHITECTURE.md` (bagaimana), `DESIGN-SYSTEM.md` (tampilan).

---

## 1. Proyek dalam 30 detik

- Game kata multiplayer realtime (2–16 pemain), Bahasa Indonesia: sambung kata dengan **suku kata terakhir**.
- **Next.js 14 (App Router) + React 18 + TypeScript strict + Tailwind 3**, backend **Supabase** (Postgres, Realtime, Storage), suara **LiveKit**, hosting **Vercel**.
- **Seluruh aturan game ada di fungsi Postgres (RPC).** Klien hanya menampilkan state dan pra-validasi.
- Pemilik produk: Ado. Pengguna akhir: pemain di HP. UI dan teks pengguna dalam Bahasa Indonesia.

### Urutan baca yang disarankan
1. Dokumen ini → 2. `ARCHITECTURE.md` bagian 5–6 (RPC dan alur) → 3. berkas yang akan diubah → 4. `DESIGN-SYSTEM.md` bila menyentuh UI.

---

## 2. Perintah dan verifikasi

```bash
npm install
npm run dev            # http://localhost:3000
npx tsc --noEmit       # WAJIB lulus sebelum selesai
npm run build          # butuh internet ke Google Fonts; gagal di sandbox tanpa akses, itu bukan galat kode
```

**Setelah menjalankan `tsc` atau build:** `tsconfig.tsbuildinfo` ter-track di git dan akan berubah. Kembalikan: `git checkout tsconfig.tsbuildinfo`. Jangan ikut di-commit.

Tidak ada ESLint, Prettier, atau framework tes di repo. Jangan menambahkannya tanpa persetujuan pemilik. Untuk logika SQL, uji dengan harness Postgres lokal (bagian 7.4).

### Definisi selesai
- [ ] `npx tsc --noEmit` lulus
- [ ] Logika SQL baru/diubah diuji di Postgres lokal (bukan hanya dibaca)
- [ ] Perubahan menyentuh hanya berkas yang perlu (cek `git diff --stat`)
- [ ] Urutan deploy dan migrasi yang perlu dijalankan dinyatakan jelas
- [ ] Hal yang **tidak** sempat diuji disebut terus terang

---

## 3. Aturan emas (jangan dilanggar)

1. **Server otoritatif.** Timer, validasi kata, giliran, eliminasi, poin, kepemilikan emoji ditentukan di SQL. Jangan memindahkan keputusan ke klien, dan jangan memercayai nilai dari klien tanpa cek di server.
2. **Klien tidak menulis tabel langsung.** Semua aksi lewat `supabase.rpc(...)` yang dibungkus di `src/lib/gameActions.ts`. Tabel sensitif tidak punya policy RLS; biarkan begitu.
3. **Jangan membocorkan rahasia.** `SUPABASE_SERVICE_ROLE_KEY` dan `LIVEKIT_API_SECRET` hanya dipakai di route handler server, tanpa awalan `NEXT_PUBLIC_`. Jangan menulis kunci, token, atau PIN ke kode, komit, log, atau jawaban.
4. **Dua implementasi suku kata harus identik.** `fn_last_syllable` (SQL) adalah sumber kebenaran; `src/lib/syllable.ts` meniru. Ubah keduanya bersamaan atau tidak sama sekali.
5. **Kamus ada di dua tempat** (JSON klien dan tabel `dictionary`). Ubah lewat jalur resmi (bagian 8.6), jangan hanya salah satunya.
6. **Jangan menjalankan ulang migrasi lama** yang mendefinisikan versi fungsi lama sesudah migrasi yang menggantinya (mis. `migration-v11.sql` setelah `v12`).
7. **Perubahan minimal.** Sentuh hanya yang diminta; jangan merapikan, memformat ulang, atau me-refaktor kode di sekitarnya.
8. **Ikuti design system.** Token warna/radius/bayangan, target sentuh 44 px, gerak hanya `transform`/`opacity`.
9. **Tanya sebelum tindakan berisiko** (bagian 11).

---

## 4. Cara bekerja (preferensi pemilik)

Pemilik meminta gaya kerja ringkas dan hati-hati. Terapkan pada **setiap** tugas, bukan hanya kode:

1. **Pikir dulu.** Nyatakan asumsi secara eksplisit. Bila ada beberapa tafsir, sebutkan; jangan memilih diam-diam. Bila ada cara yang lebih sederhana, katakan dan dorong balik bila perlu.
2. **Sederhana dulu.** Kode paling sedikit yang menyelesaikan masalah. Tanpa fitur, abstraksi, atau konfigurasi yang tidak diminta. Tanpa penanganan galat untuk skenario yang mustahil. Bila 200 baris bisa jadi 50, tulis ulang.
3. **Perubahan bedah.** Setiap baris yang berubah harus bisa ditelusuri ke permintaan. Cocokkan gaya yang ada. Temuan di luar tugas (kode mati, bug lain) **disebutkan, tidak diperbaiki**. Hapus hanya yatim yang diciptakan perubahanmu sendiri.
4. **Berbasis tujuan.** Ubah tugas jadi kriteria yang bisa diverifikasi, dan untuk tugas bertahap beri rencana singkat:
   ```
   1. [langkah] → verifikasi: [cek]
   2. [langkah] → verifikasi: [cek]
   ```
5. **Tanya hanya bila buntu.** Utamakan menyatakan asumsi daripada bertanya hal sepele.
6. **Lapor ringkas, terstruktur, berbahasa Indonesia.** Sebutkan: apa yang berubah, asumsi, cara uji, risiko, dan apa yang **belum** diuji.
7. **Tanpa akses push?** Serahkan hasil sebagai berkas hasil edit (zip dengan path repo) atau `git diff`, dan beri urutan deploy.

---

## 5. Peta repo (yang paling sering disentuh)

| Butuh mengubah… | Buka |
|---|---|
| Aturan game, giliran, timer, poin | `supabase/functions.sql` + migrasi baru |
| Aksi/RPC dari klien | `src/lib/gameActions.ts` |
| State realtime room | `src/lib/useRoomRealtime.ts`, `usePresence.ts`, `useRoomReactions.ts` |
| Identitas dan akun lokal | `src/lib/session.ts` |
| Suku kata/kamus klien | `src/lib/syllable.ts`, `dictionary.ts`, `data/*.json` |
| Beranda, lobi, play, hasil | `src/app/page.tsx`, `src/app/room/[code]/…` |
| Toko, inventory, usulan emoji, peringkat | `src/app/toko`, `usulkan-emoji`, `leaderboard`, komponen `Emoji*` |
| Admin | `src/app/kamus-admin/page.tsx`, `EmojiAdmin.tsx`, `EmojiSuggestionsAdmin.tsx` |
| Unggah/hapus file, token suara | `src/app/api/**`, `src/lib/emojiServer.ts` |
| Warna, font, animasi | `tailwind.config.ts`, `src/app/globals.css`, `src/lib/motion.ts` |
| Batas emoji (klien + server) | `src/lib/emojiLimits.ts` |

---

## 6. Standar kode TypeScript / React

- **TypeScript `strict`.** Tipe untuk kode baru, hindari `any` (beberapa `catch (e: any)` lama dibiarkan; jangan diperluas).
- **Client Component** (`"use client"`) untuk halaman yang memakai realtime, `localStorage`, audio, atau efek. Berkas server-only (`emojiServer.ts`, route handler) tidak boleh diimpor dari komponen klien.
- **Akses Supabase** hanya lewat `gameActions.ts` (RPC) atau hook realtime. Jangan memanggil `supabase.from(...).insert/update` dari komponen.
- **Penyimpanan lokal** hanya lewat `session.ts` (kunci berawalan `ssk:`).
- **Galat:** RPC melempar kode huruf besar (`NAME_TAKEN`, `BAD_PIN`). Petakan ke pesan Indonesia di UI; jangan menampilkan pesan mentah ke pemain.
- **Efek:** setiap `useEffect` yang membuat langganan, timer, atau animasi **wajib membersihkan** di cleanup. Hati-hati dengan penghitung yang bergantung pada `% length` (satu item = state tidak berubah).
- **Impor:** pakai alias `@/…`. Jangan menambah dependensi baru tanpa persetujuan pemilik.
- **Gaya:** indentasi 2 spasi, tanda kutip ganda, titik koma, nama berkas komponen `PascalCase.tsx`, hook `useXxx`, fungsi `camelCase`.
- **Komentar:** Bahasa Indonesia, menjelaskan **kenapa**, bukan apa. Pertahankan gaya ini.
- **Gambar:** `<img>` biasa untuk emoji dari Storage, dengan komentar `eslint-disable-next-line @next/next/no-img-element`.
- **Aksesibilitas:** `aria-label` untuk tombol ikon, `aria-pressed` untuk toggle, `role="alert"` untuk galat.

---

## 7. Standar SQL dan basis data

### 7.1 Di mana menaruh perubahan
| Situasi | Tindakan |
|---|---|
| Tabel/kolom/indeks baru | Migrasi baru `supabase/migration-vN.sql` (N = nomor berikutnya) |
| Fungsi **didefinisikan di `functions.sql`** | Ubah **di `functions.sql`**; jalankan ulang file itu |
| Fungsi **didefinisikan di migrasi** (mis. `fn_relax_threshold` di v8, `fn_has_continuation` di v3, fungsi toko/akun) | Tulis `create or replace` baru di **migrasi baru**; jangan duplikat di `functions.sql` |
| Konstanta aturan poin | `fn_pts_cfg` (satu tempat) |

Cek dulu di mana fungsi didefinisikan: `grep -n "function public.NAMA" supabase/*.sql`.

### 7.2 Templat migrasi
```sql
-- =====================================================================
-- Sambung Suku Kata — Migration vN
--  (1) <ringkasan perubahan>
-- Prasyarat: migration-vM.sql. Aman diulang.
-- URUTAN DEPLOY: file ini -> functions.sql (bila disentuh) -> deploy Vercel.
-- =====================================================================

create table if not exists public.xxx ( ... );
alter table public.xxx enable row level security;  -- tanpa policy: hanya lewat RPC

create or replace function public.nama_rpc(p_token text, ...)
returns ... language plpgsql security definer as $$
begin
  -- validasi dulu, lempar kode huruf besar
  if ... then raise exception 'KODE_GALAT'; end if;
  ...
end;
$$;

grant execute on function public.nama_rpc(text, ...) to anon, authenticated;
```

### 7.3 Aturan
- **Idempoten** (`if not exists`, `create or replace`, `add column if not exists`).
- Header komentar dengan **Prasyarat** dan **URUTAN DEPLOY**.
- RPC yang mengubah data atau membaca data sensitif: `security definer`, validasi token/PIN **di dalam fungsi**, `grant execute` eksplisit.
- Tabel sensitif: `enable row level security` **tanpa policy**.
- Otorisasi admin: `p_pin is distinct from public.fn_admin_pin()`. **Jangan menulis PIN literal** di berkas baru.
- Galat bisnis: `raise exception 'KODE'`; hasil wajar yang bukan galat: JSON `{ok, reason}`.
- Kunci baris untuk operasi bersamaan: `select … for update`. Operasi harus aman dipanggil banyak klien (idempoten).
- Hati-hati `delete` pada tabel yang dipakai FK `restrict` (contoh: `account_emojis` harus dihapus sebelum `emojis`).
- Jangan menghitung poin atau mengubah saldo di klien.

### 7.4 Harness uji SQL (Postgres lokal)
```bash
apt-get install -y postgresql && pg_ctlcluster 16 main start
```
1. Buat skema minimal (tabel yang disentuh fungsi) dan stub (`fn_account_id`, `fn_admin_pin`, role `anon`/`authenticated`).
2. Muat fungsi yang diuji (ekstrak blok `create or replace function … $$;` dari berkasnya).
3. Tulis blok `do $$ … assert … $$;` untuk: kasus normal, batas, penolakan (galat yang diharapkan), dan efek samping (baris terhapus/terbuat).
4. Jalankan: `su postgres -c "psql -v ON_ERROR_STOP=1 -f test.sql postgres"`; sukses bila muncul `NOTICE: OK …` tanpa galat.

Minimal uji: giliran tim (semua anggota main sekali per siklus, termasuk tim berukuran berbeda dan eliminasi di tengah), keringanan, penolakan akses (PIN salah, token kosong), dan integritas (hapus emoji membersihkan inventory dan slot).

---

## 8. Playbook tugas umum

### 8.1 Menambah RPC dan memakainya di UI
1. Tulis fungsi di migrasi baru (bagian 7.2) atau di `functions.sql`.
2. Uji di Postgres lokal.
3. Bungkus di `gameActions.ts` (tipe hasil + penanganan galat).
4. Pakai di komponen; tampilkan memuat/kosong/galat/sukses.
5. `tsc`, lalu laporkan urutan deploy (migrasi → functions.sql → Vercel).

### 8.2 Menambah pengaturan room
Kolom di `rooms` (migrasi) → `set_room_settings` (parameter + validasi) → tipe `Room` di `types/game.ts` → UI lobi → baca di fungsi game yang memakainya.

### 8.3 Mengubah aturan poin atau penalti
Ubah nilai di `fn_pts_cfg`; bila rumus berubah, ubah fungsi penghitungnya. Aturan poin dan penalti **mempengaruhi ekonomi pemain**: minta persetujuan pemilik dulu dan jangan menghitung ulang data historis tanpa diminta.

### 8.4 Mengubah aturan giliran atau keringanan
Edit `fn_advance_turn`, `fn_relax_threshold`, `fn_fit_syllable`, `fn_handle_timeout`, atau `submit_word`. Pertahankan: `relaxed` + `full_syllable` + hold 3 detik, dan kunci pop-up di `play/page.tsx`. Wajib ada uji SQL (bagian 7.4).

### 8.5 Menambah halaman
Folder di `src/app/<nama>/page.tsx` (`"use client"` bila perlu), pola `main` satu kolom `max-w-md`, header dengan tombol kembali, kartu `rounded-3xl bg-white p-4 shadow-soft`, animasi masuk `.rise` + `stagger(i)`. Tambah tautan masuk dan pastikan bisa dijangkau dari navigasi yang ada.

### 8.6 Mengubah kamus
Edit `data/kata-id-extra.json` → `node scripts/seed-dictionary.mjs` (isi tabel `dictionary`) → deploy ulang agar kamus klien ikut. Kata dari usulan pemain masuk lewat panel admin dan langsung ke tabel server.

### 8.7 Fitur yang mengunggah file
Ikuti pola `emoji-suggest`: validasi ringan → cek syarat di SQL **sebelum** unggah → baca/validasi file (`readEmojiFiles`) → `uploadEmojiFiles` → RPC pencatat → bersihkan file bila RPC gagal. Tipe file dari magic bytes, path acak.

### 8.8 Efek suara
Tambah fungsi `sfxXxx` di `src/lib/sound.ts` (Web Audio, hormati mute lewat `isSoundEnabled`), panggil dari komponen. Audio HTML (`new Audio`) untuk file emoji harus memeriksa `isSoundEnabled()` pada pemutaran otomatis dari broadcast.

---

## 9. Jebakan yang sudah ditemukan

| Jebakan | Penjelasan |
|---|---|
| Fungsi punya dua "rumah" | Sebagian fungsi hidup di `functions.sql`, sebagian di migrasi. Salah tempat = perubahan tertimpa saat `functions.sql` dijalankan ulang. |
| `fn_has_continuation` dan kata sendiri | Cek lanjutan dihitung terhadap kamus **tanpa** kata yang sudah terpakai; panggil setelah kata baru masuk `used_words`. |
| Keringanan ganda | `relaxed = true` dari keringanan kamus mencegah keringanan timeout berikutnya di target yang sama. |
| `% length` pada satu item | Penghitung berputar `(i+1) % 1` tidak mengubah state; pakai penghitung yang terus naik. |
| `Animation.play()` pada animasi selesai | Mengulang dari awal. Jeda/lanjut hanya saat `playState` sesuai. |
| `overflow-x: auto` memotong ring/bayangan | Beri padding pada wadah geser. |
| `emojis` ↔ `account_emojis` | FK `restrict`: hapus kepemilikan dulu, baru emoji (lihat `admin_delete_emoji`). |
| Realtime DELETE tanpa `room_id` | Butuh `REPLICA IDENTITY FULL`; sudah diatur, jangan dicabut. |
| `tsconfig.tsbuildinfo` ter-track | Berubah setiap `tsc`; kembalikan sebelum menyerahkan hasil. |
| Google Fonts saat build | `next build` di lingkungan tanpa internet gagal di tahap font, bukan di kode. |
| Autoplay audio | Suara emoji dari pemain lain bisa diblokir browser sampai ada sentuhan pertama. |
| Skrip AdSense di `layout.tsx` | Milik pemilik (iklan); jangan dihapus atau diubah. |

---

## 10. Keamanan: daftar periksa tiap perubahan

- [ ] Tidak ada kunci/rahasia/PIN baru di kode atau komit
- [ ] Rute server baru: validasi input, batas ukuran, cek hak akses **sebelum** pekerjaan mahal
- [ ] RPC baru: validasi token/PIN di dalam fungsi, `grant` hanya yang perlu
- [ ] Data pemain lain tidak bocor lewat RPC (kembalikan hanya kolom yang perlu)
- [ ] Input dari klien lain (broadcast) diperlakukan tidak tepercaya (validasi path/format)
- [ ] File unggahan: tipe dari isi, ukuran dibatasi, path acak
- [ ] Tidak ada `dangerouslySetInnerHTML` dengan data pengguna

**Temuan terbuka (jangan diperburuk, laporkan bila relevan):** PIN admin tertulis di `migration-v7.sql` pada repo publik; belum ada pembatasan laju per IP di route unggah.

---

## 11. Berhenti dan tanya pemilik sebelum…

- mengganti/menghapus PIN admin, atau mengubah mekanisme otorisasi admin
- menghapus atau memodifikasi data pemain, poin, koin, atau akun (termasuk mengembalikan koin)
- mengubah aturan poin, penalti host, atau batas akun per perangkat
- migrasi destruktif (`drop`, `delete` massal, `truncate`) atau menjalankan ulang migrasi lama
- menambah dependensi, framework tes, atau konfigurasi lint/format
- menyentuh skrip iklan, kunci environment, atau konfigurasi deploy
- tindakan git yang tidak bisa dibatalkan (force push, rewrite history)
- mengubah perilaku yang sudah dijanjikan ke pemain (aturan permainan, harga emoji yang ada)

---

## 12. Format laporan akhir

```
Ringkasan: <1–2 kalimat apa yang selesai>
Perubahan: <berkas → apa>
Urutan deploy: <migrasi → functions.sql → Vercel>
Asumsi: <daftar>
Verifikasi: <tsc lulus; uji SQL apa; yang belum diuji>
Risiko / catatan: <termasuk temuan di luar tugas yang tidak diperbaiki>
```

Singkat, Bahasa Indonesia, tanpa mengulang isi diff.
