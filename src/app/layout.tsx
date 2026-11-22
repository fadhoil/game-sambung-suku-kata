import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SoundProvider from "@/components/SoundProvider";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Sambung Suku Kata",
  description: "Game kekompakan: sambung kata pakai suku kata terakhir. 2–16 pemain.",
  // Mode "Add to Home Screen" di iOS -> tampilan immersive tanpa address bar
  // (alternatif fullscreen untuk iPhone yang tidak mendukung Fullscreen API).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sambung Suku Kata",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f9fb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Android Chrome: saat keyboard muncul, kecilkan area konten (bukan menimpa),
  // supaya panel kata & input tetap terlihat.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={display.variable}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9607539444470683"
          crossOrigin="anonymous"
        ></script>
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
