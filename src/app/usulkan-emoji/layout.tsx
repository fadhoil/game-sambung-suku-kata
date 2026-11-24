import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Usulkan Emoji",
  description:
    "Usulkan emoji baru untuk Sambung Suku Kata. Emoji yang disetujui admin akan masuk ke toko dan bisa dipakai semua pemain.",
  alternates: { canonical: "/usulkan-emoji" },
  openGraph: {
    url: "/usulkan-emoji",
    title: "Usulkan Emoji · Sambung Suku Kata",
    description:
      "Usulkan emoji buatanmu sendiri untuk dipakai di game sambung kata Sambung Suku Kata.",
  },
};

export default function UsulkanEmojiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
