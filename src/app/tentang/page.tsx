import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Tentang, Aturan, dan Cara Main",
  description:
    "Sambung Suku Kata adalah game sambung kata bahasa Indonesia untuk 2–16 pemain. Baca aturan lengkap, cara main, pilihan timer dan nyawa, mode tim, serta pertanyaan yang sering ditanya.",
  alternates: { canonical: "/tentang" },
  openGraph: {
    type: "article",
    url: "/tentang",
    title: `Tentang, Aturan, dan Cara Main ${SITE_NAME}`,
    description:
      "Aturan lengkap dan cara main Sambung Suku Kata: game sambung kata multiplayer bahasa Indonesia untuk 2–16 pemain, gratis dan tanpa instal.",
  },
  twitter: {
    card: "summary_large_image",
    title: `Tentang, Aturan, dan Cara Main ${SITE_NAME}`,
    description:
      "Aturan lengkap dan cara main Sambung Suku Kata: game sambung kata multiplayer 2–16 pemain, gratis tanpa instal.",
  },
};

/** Dipakai dua kali: untuk tampilan dan untuk JSON-LD FAQPage (AEO). */
const FAQ = [
  {
    q: "Apa itu Sambung Suku Kata?",
    a: "Sambung Suku Kata adalah game kata multiplayer berbahasa Indonesia untuk 2–16 pemain dalam satu room. Setiap pemain harus menyambung kata baru yang diawali suku kata terakhir kata sebelumnya — misalnya LUKISAN disambung menjadi SANTAI. Pemain yang salah, kehabisan waktu, atau kehilangan semua nyawa tereliminasi, dan pemain terakhir yang bertahan menang.",
  },
  {
    q: "Berapa pemain minimum dan maksimum dalam satu room?",
    a: "Satu room bisa diisi 2 sampai 16 pemain. Semua pemain masuk ke room yang sama dengan kode 6 karakter, link undangan, atau scan QR, lalu bermain dari HP masing-masing.",
  },
  {
    q: "Apakah harus instal aplikasi atau mendaftar akun?",
    a: "Tidak. Sambung Suku Kata langsung jalan di browser HP maupun desktop tanpa instal dan tanpa pendaftaran. Cukup isi nama, pilih avatar, lalu buat atau gabung room. Akun hanya diperlukan bila ingin menyimpan skor, koin, dan emoji.",
  },
  {
    q: "Bagaimana cara mengajak teman bergabung?",
    a: "Host membuat room dan mendapat kode 6 karakter. Bagikan kode itu, link undangan, atau tampilkan QR untuk dipindai teman. Mereka cukup membuka ado-sambung-kata.vercel.app, menekan Gabung Room, lalu memasukkan kode.",
  },
  {
    q: "Berapa lama waktu menjawab dan berapa nyawa setiap pemain?",
    a: "Timer per giliran bisa dipilih host: 5, 7, 10, atau 15 detik, dan dihitung otoritatif di server agar adil. Nyawa bisa diatur 1 sampai 5 per pemain. Kehabisan waktu atau menjawab salah mengurangi satu nyawa.",
  },
  {
    q: "Apakah ada mode tim?",
    a: "Ada. Selain Free For All, host bisa memilih mode Tim dengan komposisi bebas, dan giliran dibagi merata ke semua anggota tim. Tim terakhir yang masih punya anggota hidup menjadi pemenang.",
  },
  {
    q: "Apakah game ini gratis?",
    a: "Ya, Sambung Suku Kata gratis dimainkan tanpa biaya, tanpa iklan berbayar, dan tanpa batas jumlah permainan. Voice chat memakai kuota gratis penyedia layanan suara, jadi tidak ada biaya untuk pemain.",
  },
  {
    q: "Kata apa saja yang diterima?",
    a: "Kata harus ada di kamus Bahasa Indonesia bawaan game, termasuk banyak kata percakapan sehari-hari, belum dipakai di ronde tersebut, dan tidak membuat permainan buntu. Bila suku kata target tidak punya kata sama sekali, target dilonggarkan otomatis agar permainan tetap jalan.",
  },
  {
    q: "Bisa dimainkan di acara online seperti Zoom atau Google Meet?",
    a: "Bisa. Setiap peserta membuka game di browser masing-masing sambil tetap di panggilan video, lalu host membagikan kode room. Cocok untuk kumpul keluarga, acara kantor, kelas, hingga sesi ice breaking.",
  },
];

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 text-lg font-extrabold text-ink">{children}</h2>
);

export default function TentangPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/tentang")}#faq`,
    inLanguage: "id-ID",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Beranda",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tentang",
        item: absoluteUrl("/tentang"),
      },
    ],
  };

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cara main Sambung Suku Kata",
    description:
      "Langkah membuat room dan bermain Sambung Suku Kata bersama 2–16 pemain.",
    totalTime: "PT2M",
    inLanguage: "id-ID",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Buka game",
        text: `Buka ${SITE_URL} di browser HP atau desktop. Tidak perlu instal aplikasi.`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Isi nama dan pilih avatar",
        text: "Tulis nama panggilan (maksimal 16 karakter) lalu pilih avatar yang disukai.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Buat room",
        text: "Tekan Buat Room. Kamu mendapat kode 6 karakter untuk dibagikan ke teman.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Bagikan kode, link, atau QR",
        text: "Teman membuka game lalu memilih Gabung Room dan memasukkan kode, atau memindai QR.",
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: "Atur mode, timer, dan nyawa",
        text: "Host memilih Free For All atau Tim, timer 5/7/10/15 detik, dan nyawa 1–5.",
      },
      {
        "@type": "HowToStep",
        position: 6,
        name: "Mulai dan sambung kata",
        text: "Setelah hitung mundur, ketik kata yang diawali suku kata target dan ada di kamus. Pemain terakhir yang bertahan menang.",
      },
    ],
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-10">
      <JsonLd id="jsonld-faq" data={faqJsonLd} />
      <JsonLd id="jsonld-breadcrumb" data={breadcrumbJsonLd} />
      <JsonLd id="jsonld-howto" data={howToJsonLd} />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
      >
        ← Main
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-extrabold leading-tight text-ink">
          Tentang Sambung Suku Kata
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          <strong className="text-ink">Sambung Suku Kata</strong> adalah game
          kata multiplayer berbahasa Indonesia untuk <strong>2–16 pemain</strong>{" "}
          dalam satu room. Setiap pemain menyambung kata baru yang diawali{" "}
          <strong>suku kata terakhir</strong> kata sebelumnya — LUKISAN menjadi{" "}
          <strong>SAN</strong>TAI, SANTAI menjadi <strong>TAI</strong>… dan
          seterusnya. Salah, kehabisan waktu, atau memakai kata yang sudah
          dipakai berarti kehilangan satu nyawa. Pemain terakhir yang bertahan
          menang.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Game ini gratis, tanpa instal, dan langsung jalan di browser HP maupun
          desktop. Cocok untuk kumpul keluarga, acara kantor, kelas, sesi ice
          breaking, atau sekadar iseng bareng teman.
        </p>
      </header>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-soft">
        <h2 className="text-base font-extrabold text-ink">Ringkasan singkat</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {[
            ["Pemain", "2–16 orang per room"],
            ["Bahasa", "Indonesia (termasuk kata percakapan)"],
            ["Mode", "Free For All dan Tim"],
            ["Timer", "5 / 7 / 10 / 15 detik per giliran"],
            ["Nyawa", "1–5 per pemain"],
            ["Biaya", "Gratis, tanpa instal"],
            ["Platform", "Browser HP dan desktop"],
            ["Voice chat", "Tersedia di lobi dan halaman hasil"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {k}
              </dt>
              <dd className="font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <H>Cara main dalam 6 langkah</H>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>
            Buka <strong className="text-ink">ado-sambung-kata.vercel.app</strong>{" "}
            di HP masing-masing, tanpa perlu instal aplikasi.
          </li>
          <li>Isi nama panggilan, pilih avatar.</li>
          <li>
            Host menekan <strong className="text-ink">Buat Room</strong> dan
            mendapat kode 6 karakter.
          </li>
          <li>
            Bagikan kode, link undangan, atau QR. Teman memilih{" "}
            <strong className="text-ink">Gabung Room</strong>.
          </li>
          <li>
            Host mengatur mode (FFA/Tim), timer, dan nyawa, lalu menekan{" "}
            <strong className="text-ink">Mulai</strong>.
          </li>
          <li>
            Giliranmu tiba: ketik kata yang diawali suku kata target, ada di
            kamus, belum dipakai, dan tidak membuat buntu.
          </li>
        </ol>
      </section>

      <section>
        <H>Aturan permainan</H>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>
            Kata wajib diawali <strong className="text-ink">suku kata target</strong>{" "}
            yang ditampilkan sebagai “Sambung dari: -XXX”.
          </li>
          <li>
            Kata wajib ada di <strong className="text-ink">kamus game</strong> dan
            belum dipakai di ronde tersebut.
          </li>
          <li>
            Salah, kehabisan waktu, atau kata yang membuat permainan buntu
            mengurangi <strong className="text-ink">satu nyawa</strong>.
          </li>
          <li>
            Nyawa habis berarti tereliminasi; pemain itu menjadi penonton sampai
            ronde selesai.
          </li>
          <li>
            <strong className="text-ink">Free For All:</strong> pemain terakhir
            yang hidup menang. <strong className="text-ink">Tim:</strong> tim
            terakhir yang masih punya anggota hidup menang.
          </li>
          <li>
            Timer dihitung di server, jadi tidak bisa dimanipulasi dari browser.
          </li>
        </ul>
      </section>

      <section>
        <H>Kenapa game ini dibuat</H>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Banyak game kata hanya bisa dimainkan sendiri atau mengharuskan unduh
          aplikasi. Sambung Suku Kata dibuat supaya satu grup bisa langsung main
          bareng dalam hitungan detik — cukup satu link atau satu kode room.
          Tidak ada unduhan, tidak ada pendaftaran, dan tidak ada biaya.
        </p>
      </section>

      <section id="faq">
        <H>Pertanyaan yang sering diajukan</H>
        <div className="mt-3 space-y-2">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl bg-white p-4 shadow-soft-sm"
            >
              <summary className="cursor-pointer list-none text-sm font-bold text-ink marker:content-none">
                <span className="mr-1 text-accent-deep group-open:hidden">＋</span>
                <span className="mr-1 hidden text-accent-deep group-open:inline">
                  －
                </span>
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/"
          className="rounded-2xl bg-gradient-to-r from-accent-from to-accent-to px-5 py-2.5 text-sm font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
        >
          🎮 Main sekarang
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
        >
          🏆 Papan Peringkat
        </Link>
        <a
          href="https://github.com/fadhoil/game-sambung-suku-kata"
          rel="noopener noreferrer"
          target="_blank"
          className="rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95"
        >
          ⭐ Repo GitHub
        </a>
      </section>

      <p className="mt-8 text-center text-xs text-ink-soft">
        Dibuat oleh{" "}
        <a
          href="https://github.com/fadhoil"
          rel="noopener noreferrer"
          target="_blank"
          className="font-semibold text-ink underline decoration-accent-to decoration-2 underline-offset-2"
        >
          Fadhoil
        </a>
        . Kode sumber terbuka dengan lisensi MIT.
      </p>
    </main>
  );
}
