import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SoundProvider from "@/components/SoundProvider";
import JsonLd from "@/components/JsonLd";
import {
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  absoluteUrl,
} from "@/lib/seo";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  // metadataBase membuat semua URL relatif (canonical, OG image) menjadi absolut.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  category: "games",
  authors: [{ name: "Fadhoil", url: "https://github.com/fadhoil" }],
  creator: "Fadhoil",
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Mode "Add to Home Screen" di iOS -> tampilan immersive tanpa address bar
  // (alternatif fullscreen untuk iPhone yang tidak mendukung Fullscreen API).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f9fb",
  width: "device-width",
  initialScale: 1,
  // maximumScale: 1,
  // Android Chrome: saat keyboard muncul, kecilkan area konten (bukan menimpa),
  // supaya panel kata & input tetap terlihat.
  interactiveWidget: "resizes-content",
};

/**
 * Data terstruktur schema.org tingkat situs.
 * Dipakai Google (rich result) sekaligus mesin jawaban AI (AEO/GEO).
 */
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      url: absoluteUrl("/"),
      name: SITE_NAME,
      alternateName: ["Sambung Kata", "SambungSukuKata"],
      description: SITE_DESCRIPTION,
      inLanguage: "id-ID",
      publisher: { "@id": `${absoluteUrl("/")}#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${absoluteUrl("/")}#organization`,
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/logo.png"),
      },
      founder: {
        "@type": "Person",
        name: "Fadhoil",
        url: "https://github.com/fadhoil",
      },
      sameAs: ["https://github.com/fadhoil/game-sambung-suku-kata"],
    },
    {
      "@type": ["VideoGame", "WebApplication"],
      "@id": `${absoluteUrl("/")}#game`,
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description:
        "Game sambung kata multiplayer bahasa Indonesia. Setiap pemain menyambung kata yang diawali suku kata terakhir kata sebelumnya; salah atau kehabisan waktu mengurangi satu nyawa. Pemain terakhir yang bertahan menang.",
      image: absoluteUrl(OG_IMAGE.url),
      screenshot: absoluteUrl(OG_IMAGE.url),
      inLanguage: "id-ID",
      applicationCategory: "GameApplication",
      applicationSubCategory: "Word game",
      operatingSystem: "Web browser (Android, iOS, Windows, macOS)",
      browserRequirements: "Membutuhkan JavaScript dan koneksi internet",
      genre: ["Word game", "Party game", "Multiplayer", "Edukasi"],
      gamePlatform: ["Web browser", "Mobile web", "Desktop web"],
      playMode: ["MultiPlayer"],
      numberOfPlayers: {
        "@type": "QuantitativeValue",
        minValue: 2,
        maxValue: 16,
      },
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "IDR",
        availability: "https://schema.org/InStock",
      },
      publisher: { "@id": `${absoluteUrl("/")}#organization` },
    },
  ],
};

import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={display.variable}>
      <head>
        {/* <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9607539444470683"
          crossOrigin="anonymous"
        ></script> */}
        <Script
          id="adsense-init"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9607539444470683"
          strategy="lazyOnload"
          crossOrigin="anonymous"
        />
        <JsonLd id="jsonld-site" data={siteJsonLd} />
      </head>
      <body>
        <div className="ambient" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <SoundProvider />
        {children}
      </body>
    </html>
  );
}
