import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Toko Emoji",
  description:
    "Toko emoji Sambung Suku Kata: beli emoji reaksi dengan koin yang kamu kumpulkan dari bermain, lalu pasang ke slot untuk dipakai di room.",
  alternates: { canonical: "/toko" },
  openGraph: {
    url: "/toko",
    title: "Toko Emoji · Sambung Suku Kata",
    description:
      "Belanja emoji reaksi dengan koin hasil bermain Sambung Suku Kata, lalu pakai di room dan halaman hasil.",
  },
};

export default function TokoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
