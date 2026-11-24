import type { Metadata } from "next";

/**
 * page.tsx halaman ini adalah client component (butuh state), jadi metadata
 * SEO dideklarasikan di layout-nya.
 */
export const metadata: Metadata = {
  title: "Papan Peringkat Pemain",
  description:
    "Peringkat pemain Sambung Suku Kata untuk minggu ini dan sepanjang masa, berdasarkan skor dan koin dari permainan sambung kata multiplayer.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    url: "/leaderboard",
    title: "Papan Peringkat Pemain · Sambung Suku Kata",
    description:
      "Lihat pemain dengan skor tertinggi minggu ini dan sepanjang masa di game sambung kata multiplayer Sambung Suku Kata.",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
