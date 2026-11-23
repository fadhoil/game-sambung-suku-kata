# Product Requirements — Sambung Suku Kata

> Dokumen ini merangkum tujuan, pengguna, dan kebutuhan fungsional **Sambung Suku Kata**, berdasarkan kode repo `fadhoil/game-sambung-suku-kata` dan permintaan fitur yang sudah disampaikan pemilik produk. Status tiap kebutuhan: ✅ sudah ada, 🆕 dikerjakan pada revisi terbaru (butuh `migration-v16.sql` dan `migration-v17.sql`), 💡 usulan/belum dikerjakan.

---

## 1. Ringkasan produk

**Sambung Suku Kata** adalah game kata multiplayer realtime untuk 2–16 pemain, dimainkan lewat browser HP. Pemain bergiliran menyambung kata Bahasa Indonesia yang harus diawali **suku kata terakhir** kata sebelumnya. Yang gagal kehilangan nyawa dan tereliminasi saat nyawa habis; pemain atau tim terakhir yang bertahan menang.

| | |
|---|---|
| **Tagline** | "Nyambung nggak? Buktiin!" |
| **Platform** | Web, mobile-first (Next.js 14, Supabase, deploy di Vercel) |
| **Bahasa antarmuka** | Indonesia |
| **Pemain per room** | 2–16 |
| **Pemilik produk** | Ado (`fadhoil`) |

### Tujuan produk
1. Memberi permainan kekompakan yang bisa dimainkan **tanpa instal**, cukup dengan kode room atau QR.
2. Menjaga permainan **adil**: waktu, validasi kata, dan eliminasi ditentukan server.
3. Mendorong pemain **kembali bermain** lewat akun, poin, koin, peringkat, dan toko emoji.
4. Membiarkan **komunitas ikut membangun konten** (usulan kata dan usulan emoji) dengan kendali admin.

### Di luar tujuan
- Bukan kamus resmi bahasa Indonesia; kamus sengaja memuat sebagian kata percakapan.
- Bukan aplikasi kompetitif berhadiah uang. Koin hanya dipakai di dalam game.

---

## 2. Pengguna dan kebutuhan

| Pengguna | Siapa | Kebutuhan utama |
|---|---|---|
| **Host** | Pemain yang membuat room (teman kuliah, rekan kantor) | Membuat room cepat, mengatur mode/timer/nyawa, mengelola tim, mengeluarkan pemain yang mengganggu, memulai dan mengakhiri game |
| **Pemain** | Peserta di HP masing-masing | Gabung tanpa daftar, aturan jelas, giliran adil, feedback instan, bisa menonton setelah tereliminasi |
| **Pemain ber-akun** | Pemain yang mendaftarkan perangkat | Poin dan koin tersimpan, masuk peringkat, membeli dan memasang emoji, mengusulkan kata/emoji |
| **Admin** | Pemilik produk | Menyetujui usulan kata/emoji, membuat dan mengelola emoji toko, memantau lobi aktif, ikut bermain tanpa bisa di-kick |

### Kebutuhan inti (jobs to be done)
- "Aku mau main bareng teman **sekarang juga** tanpa ribet login."
- "Aku mau yakin **tidak ada yang curang** atau diuntungkan oleh lag."
- "Aku mau ada alasan **main lagi** (peringkat, koin, emoji)."
- "Aku mau **kata dan emoji buatan kami** bisa masuk ke game."

---

## 3. Alur pengguna utama

1. **Beranda** → pilih avatar, isi nama → **Buat Room** atau **Gabung Room** (kode 6 karakter, link `?join=KODE`, atau scan QR).
2. **Lobi** → host mengatur mode, timer, nyawa, dan tim → semua pemain siap → **Mulai**.
3. **Hitung mundur 5 detik** → giliran acak pertama → pemain bergiliran mengetik kata.
4. **Eliminasi** → pemain tereliminasi menonton → pemenang diumumkan.
5. **Hasil** → peringkat, poin per pemain, bagikan sebagai gambar, main lagi atau keluar.
6. **Di luar game** → Toko (beli emoji, atur slot, usulkan emoji), Papan Peringkat, usulan kata.

---

## 4. Persyaratan fungsional

### 4.1 Room dan sesi

| ID | Kebutuhan | Status |
|---|---|---|
| FR-01 | Pemain dapat membuat room dan mendapat kode 6 karakter yang bisa dibagikan lewat salin kode, link undangan, atau QR. | ✅ |
| FR-02 | Pemain dapat bergabung lewat kode, link, atau pemindai QR kamera. | ✅ |
| FR-03 | Satu perangkat hanya satu pemain per room (mencegah pemain ganda). | ✅ |
| FR-04 | Status online pemain akurat (hilang otomatis saat tab/HP ditutup). | ✅ |
| FR-05 | Perangkat yang masih punya room aktif ditawari "lanjutkan permainan" di beranda. | ✅ |
| FR-06 | Host dapat mengeluarkan (kick) pemain, membubarkan room, dan mengakhiri permainan kapan saja. | ✅ |
| FR-07 | Pemain non-host dapat keluar dari room. | ✅ |
| FR-08 | Pemain yang masuk saat game berjalan menjadi penonton dan naik jadi pemain pada ronde berikutnya. | ✅ |
| FR-09 | Voice chat tersedia di lobi dan halaman hasil (LiveKit), dengan tombol mic. | ✅ |
| FR-10 | Pop-up "Cara Bermain" muncul otomatis saat masuk room dan menutup sendiri. | ✅ |

### 4.2 Pengaturan permainan (host, di lobi)

| ID | Kebutuhan | Status |
|---|---|---|
| FR-11 | Mode: **Free For All** atau **Tim** (komposisi custom, pindah antar tim, keluarkan dari tim). | ✅ |
| FR-12 | Waktu per giliran: 5 / 7 / 10 / 15 detik (default 7). | ✅ |
| FR-13 | Nyawa per pemain: 1–5 (default 1). | ✅ |

### 4.3 Aturan gameplay

| ID | Kebutuhan | Status |
|---|---|---|
| FR-20 | Kata valid jika: diawali suku kata terakhir kata sebelumnya, ada di kamus, belum dipakai di ronde itu, dan tidak membuat buntu. | ✅ |
| FR-21 | Target sambung selalu ditampilkan ke semua pemain (mis. "Sambung dari: -SAN"). | ✅ |
| FR-22 | Timer, validasi, dan eliminasi ditentukan **server**. Klien hanya pra-validasi untuk feedback instan. | ✅ |
| FR-23 | Gagal (waktu habis atau tidak ada kata) mengurangi 1 nyawa; nyawa 0 = tereliminasi. | ✅ |
| FR-24 | Pemain pembuka dipilih acak. | ✅ |
| FR-25 | **Mode tim:** tim bergantian; di dalam tim, pemain diacak **tanpa pengulangan** sampai semua anggota hidup sudah main, lalu siklus baru. Berlaku walau ukuran tim berbeda (mis. 3 vs 4). | 🆕 |
| FR-26 | **Keringanan karena gagal:** bila sejumlah pemain berturut-turut gagal di suku kata yang sama, target dilonggarkan jadi 1 huruf terakhir, dengan pop-up dan jeda 3 detik. Ambang diacak 1..(n−1): n = **jumlah tim hidup** di mode Tim, **jumlah pemain hidup** di FFA. | 🆕 (ambang mode tim) |
| FR-27 | **Keringanan kamus:** bila suku kata target tidak punya kata yang belum terpakai di kamus, huruf depan dibuang satu per satu sampai ada kata, minimal 1 huruf. Pop-up dan jeda sama seperti FR-26. | 🆕 |
| FR-28 | Pemenang: pemain terakhir (FFA) atau tim terakhir yang masih punya anggota hidup. | ✅ |
| FR-29 | Pemain tereliminasi tetap di room sebagai penonton: bisa melihat realtime, tidak bisa mengetik. | ✅ |

### 4.4 Hasil dan berbagi

| ID | Kebutuhan | Status |
|---|---|---|
| FR-30 | Halaman hasil menampilkan peringkat (per pemain untuk FFA, per tim untuk Tim) dan poin tiap pemain, termasuk guest. | ✅ |
| FR-31 | Kartu hasil dapat dibagikan sebagai gambar PNG (WhatsApp/Instagram), dengan fallback unduh di desktop. | ✅ |
| FR-32 | Host dapat memulai ronde baru di room yang sama. | ✅ |

### 4.5 Akun, poin, koin, peringkat

| ID | Kebutuhan | Status |
|---|---|---|
| FR-40 | Akun berbasis perangkat: pemain mendaftarkan perangkat dengan nama; hanya hash token yang disimpan di server. Pemain tanpa akun tetap bisa main sebagai guest. | ✅ |
| FR-41 | Nama akun unik (tanpa membedakan huruf besar/kecil) di antara akun aktif; maksimal 3 akun per perangkat. | ✅ |
| FR-42 | Setelah game pertama selesai, guest ditawari mendaftar; poin game itu ikut diklaim ke akun. | ✅ |
| FR-43 | Hapus akun bersifat *soft*: skor dan koin ditahan, tidak tampil di peringkat, nama bisa dipakai lagi. | ✅ |
| FR-44 | Dua jenis poin per game: **skor 🏆** (akumulasi untuk peringkat) dan **koin 🪙** (saldo untuk toko). Jumlah per game sama; penalti hanya memotong koin. | ✅ |
| FR-45 | Beranda menampilkan skor 🏆 dan koin 🪙 akun aktif, serta tombol ganti akun. | ✅ |
| FR-46 | Papan peringkat: **minggu ini** dan **sepanjang masa**. | ✅ |
| FR-47 | Penalti host yang mengakhiri game terlalu cepat (lihat bagian 6). | ✅ |

### 4.6 Toko, inventory, dan emoji

| ID | Kebutuhan | Status |
|---|---|---|
| FR-50 | Toko menampilkan emoji (gambar + suara) buatan admin yang bisa dibeli dengan koin; emoji tersembunyi tidak tampil. | ✅ |
| FR-51 | Setiap emoji di toko, admin, dan inventory punya tombol **Preview**: balon emoji melayang plus suara, seperti saat dipakai di room. Berlaku untuk emoji yang sudah maupun belum dibeli. | 🆕 |
| FR-52 | **Inventory:** pemain melihat emoji miliknya dan memasangnya ke **3 slot**. Emoji di slot n menggantikan tombol reaksi ke-n di halaman **room dan hasil**; slot kosong memakai emoji bawaan. Satu emoji hanya di satu slot. | 🆕 |
| FR-53 | Reaksi emoji dikirim ke semua pemain di room secara realtime (balon + suara, mengikuti status mute). | ✅ (emoji kustom 🆕) |
| FR-54 | Beranda memiliki tombol langsung ke Toko. | 🆕 |

### 4.7 Usulan dari pemain

| ID | Kebutuhan | Status |
|---|---|---|
| FR-60 | Pemain dapat mengusulkan satu atau beberapa kata (dipisah koma); usulan yang sudah ada di kamus atau sedang menunggu dilewati. | ✅ |
| FR-61 | Admin menyetujui/menolak usulan kata satu per satu; yang disetujui langsung valid di game. | ✅ |
| FR-62 | **Usulkan Emoji:** pemain ber-akun mengunggah nama + gambar + suara lewat halaman `/usulkan-emoji` (dari Toko). Maksimal 3 usulan menunggu per akun; nama tidak boleh bentrok dengan emoji yang ada atau usulan lain. | 🆕 |
| FR-63 | Usulan emoji disimpan di tabel terpisah. Admin menentukan **nama dan harga**, lalu Terima (masuk toko) atau Tolak (file dihapus). | 🆕 |

### 4.8 Admin (`/kamus-admin`, ber-PIN)

| ID | Kebutuhan | Status |
|---|---|---|
| FR-70 | Tab: Usulan Kata, Lobi Aktif, Emoji. | ✅ |
| FR-71 | Admin dapat bergabung ke lobi aktif dan ikut bermain; admin tidak bisa di-kick dan tidak mendapat poin. | ✅ |
| FR-72 | Admin membuat emoji (nama, harga, gambar, suara), menyembunyikan/menampilkan emoji di toko. | ✅ |
| FR-73 | Admin **menghapus emoji** permanen: hilang dari toko, inventory dan slot semua pemain, dan file di Storage. Ada dialog konfirmasi. Koin tidak dikembalikan. | 🆕 |
| FR-74 | Tombol suara terpisah di daftar emoji dihapus karena sudah ada Preview. | 🆕 |
| FR-75 | Panel konfirmasi usulan emoji (FR-63) ada di tab Emoji. | 🆕 |

### 4.9 Berita di beranda

| ID | Kebutuhan | Status |
|---|---|---|
| FR-80 | Beranda menampilkan **running text satu baris** berlatar warna berisi berita hari itu: "Penambahan usulan kata/emoji **“nama”** diterima" (nama dicetak tebal). | 🆕 |
| FR-81 | Setiap berita berjalan kanan ke kiri; **3 detik** setelah selesai, berita berikutnya tampil. Setelah yang terakhir, kembali ke yang pertama (berputar, juga bila hanya 1 berita). | 🆕 |
| FR-82 | Hanya berita hari ini (zona Asia/Jakarta), maksimal 10, terbaru dulu. Tanpa berita, ticker disembunyikan. Disentuh/di-hover = berhenti sementara; "kurangi gerakan" = tampil diam. | 🆕 |

### 4.10 Pengalaman dan suara

| ID | Kebutuhan | Status |
|---|---|---|
| FR-90 | Efek suara menyeluruh (klik, hitung mundur, timer menipis, kata valid/salah, eliminasi, fanfare) dengan tombol mute. | ✅ |
| FR-91 | Layar penuh di beranda, lobi, dan permainan. | ✅ |
| FR-92 | Beranda ringkas: pilihan avatar satu baris yang bisa digeser, avatar terpilih otomatis terlihat. | 🆕 |

---

## 5. Persyaratan non-fungsional

| Area | Persyaratan |
|---|---|
| **Keadilan dan anti-cheat** | Seluruh logika game (timer, kata, giliran, eliminasi, poin) berjalan di fungsi Postgres `SECURITY DEFINER`. Klien tidak bisa mengubah state langsung (RLS tanpa policy tulis untuk anon). |
| **Realtime** | Perubahan state tersinkron ke semua HP lewat Supabase Realtime; timeout aman dipicu banyak klien sekaligus (idempoten, `FOR UPDATE`). |
| **Mobile-first** | Semua halaman nyaman di layar < 400 px; target sentuh minimal 44 px, jarak antar tombol minimal 8 px, tidak ada scroll horizontal pada halaman. |
| **Performa** | Pra-validasi kata di klien (kamus lokal) untuk feedback instan; cek kamus di server hanya beberapa query berindeks per giliran. Animasi hanya `transform`/`opacity`. |
| **Aksesibilitas** | Tombol ikon berlabel (`aria-label`), status terpilih (`aria-pressed`), menghormati "kurangi gerakan", kontras teks memadai. |
| **Keamanan** | Token akun disimpan sebagai hash; PIN admin diverifikasi di dalam SQL; upload file hanya lewat route server dengan service-role key, tipe file dicek dari isi (magic bytes), batas ukuran gambar dan suara. |
| **Konsistensi kamus** | Kamus ada di klien (JSON) dan server (tabel `dictionary`); keduanya diisi dari sumber yang sama. Kata hasil usulan yang disetujui masuk tabel server. |
| **Kompatibilitas** | Browser mobile modern. Fullscreen API terbatas di iOS Safari; audio mobile aktif setelah sentuhan pertama. |
| **Bahasa** | UI dan pesan galat dalam Bahasa Indonesia. |

---

## 6. Aturan bisnis dan konfigurasi

Angka berikut berasal dari `fn_pts_cfg` (satu tempat untuk mengubah aturan poin).

| Aturan | Nilai |
|---|---|
| Rantai minimal agar game bernilai poin | 8 kata (termasuk kata awal); di bawah itu tanpa poin |
| Bonus rantai | 1 poin per 10 kata, maksimal 3 |
| Bonus kata terpanjang | +2, hanya bila kata terpanjang ≥ 8 huruf |
| Mode tim, tim menang | 2 poin (anggota setara lawan terbesar), 3 (anggota lebih sedikit / *underdog*), 1 (lebih banyak / *overdog*) |
| Mode tim, tim kalah | 1 poin |
| Syarat dapat poin tim | anggota menyumbang ≥ 1 kata valid |
| Game diakhiri host | Tanpa poin. ≤ 3 putaran: tanpa penalti. Lebih dari itu bertahap: kunci mulai game 1 menit, lalu 3 menit, lalu potong 5 koin (saldo tidak minus) |
| Papan peringkat "minggu ini" | Jendela 7 hari |
| Akun per perangkat | Maksimal 3 |
| Usulan emoji menunggu per akun | Maksimal 3 |
| Nama emoji | 1–24 karakter, unik tanpa membedakan huruf besar/kecil |
| Harga emoji | 0–100.000 koin, ditentukan admin |
| Slot emoji per pemain | 3 |

---

## 7. Metrik keberhasilan (usulan, belum disepakati)

| Metrik | Alasan |
|---|---|
| Game selesai per room (bukan diakhiri di tengah) | Menunjukkan aturan dan durasi terasa pas |
| Persentase guest yang mendaftar akun setelah game pertama | Mengukur daya tarik poin dan koin |
| Pemain kembali dalam 7 hari | Mengukur retensi |
| Emoji terbeli per pemain ber-akun dan emoji terpasang di slot | Mengukur kegunaan toko dan inventory |
| Usulan kata dan emoji diterima per minggu | Mengukur partisipasi komunitas dan beban admin |
| Gagal beruntun dan keringanan per game | Mengukur apakah kamus atau target terlalu sulit |

---

## 8. Risiko, asumsi, dan pertanyaan terbuka

| # | Hal | Dampak / catatan |
|---|---|---|
| 1 | **PIN admin tertulis di `migration-v7.sql`** dan repo bisa di-clone publik. | Siapa pun dapat membuka `/kamus-admin`. Disarankan mengganti PIN di database dan menghapusnya dari file, atau menjadikan repo private. |
| 2 | Penghapusan emoji **tidak mengembalikan koin**. | Pemain yang sudah membeli bisa kecewa. Putuskan apakah perlu refund. |
| 3 | Upload usulan emoji dibatasi per akun, tetapi belum ada pembatasan laju per IP. | Risiko pemborosan Storage; pantau pemakaian. |
| 4 | Kata awal permainan tidak mendapat keringanan kamus (FR-27 berlaku setelah kata pertama). | Kata awal yang buntu masih mungkin; perlu dicek bila terjadi. |
| 5 | Suara emoji kustom dari pemain lain bisa diblokir autoplay browser di HP yang belum disentuh. | Bubble tetap muncul; suara bisa tidak terdengar. |
| 6 | Kamus ada di dua tempat. | Kamus klien dan server harus disinkronkan saat menambah kata lewat file. |
| 7 | `DOCUMENTATION.md` belum memuat akun, poin, toko, dan voice chat; daftar migrasi di bagian setup berhenti di v5. | Urutan deploy bisa membingungkan; perlu diperbarui. |
| 8 | `functions.sql` dan `migration-v16.sql` versi terbaru belum ada di GitHub saat dokumen ini ditulis. | Repo bisa tidak sinkron dengan database. |
| 9 | Next.js 14.2.15 memiliki anjuran patch keamanan. | Upgrade ke 14.2.33+ lalu uji ulang build. |
| 10 | Toko sebelumnya tersembunyi dari beranda; kini ada tombol langsung. | Pastikan katalog emoji siap sebelum rilis ke semua pemain. |

### Pertanyaan terbuka
- Apakah koin hasil pembelian emoji yang dihapus perlu dikembalikan?
- Apakah slot emoji juga berlaku di halaman permainan (saat ini hanya room dan hasil)?
- Apakah menu "Usulkan Emoji" perlu juga di lobi/hasil, atau cukup dari Toko?
- Apakah ada batas harga atau panduan konten untuk emoji usulan (mis. larangan gambar tidak pantas)?

---

## 9. Roadmap yang disebut pemilik produk

- 💡 Poin ditukar dengan atribut lain, misalnya **badge pemain kustom** (ledger sudah disiapkan untuk jenis transaksi `spend`).
- 💡 Mengganti pembatasan "slot hanya di room dan hasil" bila diperlukan.
