# SEO, AEO, dan GEO

Dokumen ini menjelaskan optimasi mesin pencari (**SEO**), mesin jawaban (**AEO**), dan mesin generatif (**GEO**) yang sudah dipasang di proyek ini — apa yang ada, di file mana, dan apa yang masih harus dilakukan manual di luar kode.

## Ringkasan

| Lapisan | Tujuan | Status |
|---|---|---|
| SEO teknis | Bisa dirayapi dan diindeks dengan benar | ✅ terpasang |
| SEO konten | Halaman yang layak diperingkat + kata kunci | ✅ `/tentang` + halaman per judul |
| AEO | Game ini bisa muncul sebagai jawaban langsung | ✅ FAQ + JSON-LD |
| GEO | Bisa dikutip/dirujuk mesin AI generatif | ✅ fakta terstruktur + `llms.txt` |
| Otoritas | Dipercaya mesin pencari & AI | ⏳ butuh backlink/mention (di luar kode) |

Ketiganya sebenarnya satu pekerjaan: memberi tahu mesin (pencari maupun AI) **apa** game ini, **untuk siapa**, dan **di mana** membacanya lebih lanjut. AEO dan GEO bukan pekerjaan terpisah dari SEO — keduanya hasil samping dari konten yang jelas dan terstruktur.

## File yang ditambahkan / diubah

| File | Isi |
|---|---|
| `src/lib/seo.ts` | Sumber tunggal konstanta SEO: `SITE_URL`, judul, deskripsi, keywords, OG image |
| `src/app/layout.tsx` | Metadata lengkap (title template, canonical, OpenGraph, Twitter, robots, keywords) + JSON-LD situs |
| `src/app/robots.ts` | `robots.txt` dinamis: sitemap, blokir `/api/` + `/kamus-admin` + `/room/`, izinkan crawler AI |
| `src/app/sitemap.ts` | `sitemap.xml` dinamis untuk halaman publik |
| `src/app/tentang/page.tsx` | Halaman baru: aturan, cara main, ringkasan, FAQ (9 pertanyaan) |
| `src/components/JsonLd.tsx` | Komponen penyisip JSON-LD |
| `src/app/leaderboard/layout.tsx` | Judul + deskripsi + canonical untuk `/leaderboard` |
| `src/app/toko/layout.tsx` | Judul + deskripsi + canonical untuk `/toko` |
| `src/app/usulkan-emoji/layout.tsx` | Judul + deskripsi + canonical untuk `/usulkan-emoji` |
| `src/app/room/[code]/layout.tsx` | `noindex` untuk semua halaman room (state permainan, bukan konten) |
| `src/app/kamus-admin/layout.tsx` | `noindex` untuk panel admin |
| `src/app/page.tsx` | `<h1>` tersembunyi (visual tetap logo) + link internal ke `/tentang` |
| `public/og.png` | Gambar pratinjau 1200×630 untuk WhatsApp, X/Twitter, Facebook, LinkedIn |
| `public/llms.txt` | Ringkasan fakta untuk crawler AI (ChatGPT, Perplexity, Gemini, Copilot) |

## Data terstruktur (JSON-LD) yang dipasang

- `WebSite` — nama, URL, bahasa, publisher.
- `Organization` — pembuat, logo, link GitHub.
- `VideoGame` + `WebApplication` — genre, platform, `numberOfPlayers` 2–16, gratis (`offers` harga 0 IDR).
- `FAQPage` (di `/tentang`) — 9 pertanyaan-jawaban, siap diambil sebagai rich result / jawaban AI.
- `HowTo` (di `/tentang`) — 6 langkah cara main.
- `BreadcrumbList` (di `/tentang`) — Beranda → Tentang.

## Yang perlu dilakukan manual (di luar kode)

1. **Google Search Console** — tambahkan properti `https://ado-sambung-kata.vercel.app`, verifikasi (paling mudah lewat DNS atau file HTML), lalu *Submit sitemap* `sitemap.xml`. Cek juga **Bing Webmaster Tools** untuk mesin AI Microsoft.
2. **Ganti `NEXT_PUBLIC_SITE_URL`** bila nanti memakai domain sendiri, mis. `https://sambungsukukata.com`. Semua canonical, OG URL, sitemap, dan robots mengikuti variabel ini — tidak ada URL yang di-hardcode.
3. **Google Business/Profil?** Tidak relevan untuk game. Yang lebih berguna: daftar ke direktori game web, kirim ke komunitas (Reddit r/indogaming, grup Discord/WhatsApp, Product Hunt), dan minta mention dari situs lain — *backlink* adalah faktor peringkat yang tidak bisa dibuat lewat kode.
4. **Ukur** — Search Console (klik, impresi, kata kunci), Vercel Analytics, dan cek Core Web Vitals di PageSpeed Insights setelah deploy.

## Cek cepat setelah deploy

```bash
curl -sI https://ado-sambung-kata.vercel.app/robots.txt    # harus 200, text/plain
curl -s  https://ado-sambung-kata.vercel.app/robots.txt
curl -sI https://ado-sambung-kata.vercel.app/sitemap.xml   # harus 200, application/xml
curl -s  https://ado-sambung-kata.vercel.app/ | grep -o 'application/ld+json'
curl -sI https://ado-sambung-kata.vercel.app/og.png        # harus 200, image/png
curl -sI https://ado-sambung-kata.vercel.app/tentang       # harus 200
```

Validasi data terstruktur di [Rich Results Test](https://search.google.com/test/rich-results) untuk `/` dan `/tentang`.

## Prinsip yang dipakai

- **Satu fakta, satu tempat.** Semua angka (2–16 pemain, timer 5/7/10/15 detik, nyawa 1–5) ditulis sama di judul, deskripsi, `/tentang`, JSON-LD, `llms.txt`, dan README. Konsistensi inilah yang membuat mesin AI percaya dan mengutip.
- **Halaman `/tentang` adalah "sumber kebenaran" yang bisa dikutip.** Isinya kalimat lengkap yang bisa langsung dipakai sebagai jawaban, bukan sekadar daftar fitur.
- **Jangan noindex halaman publik, jangan indeks halaman privat.** Room, admin, dan API diblokir; beranda, tentang, leaderboard, toko, usulkan-emoji terbuka.
