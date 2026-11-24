import type { Metadata } from "next";

/**
 * Halaman room berisi state permainan per kode room: tidak ada nilainya untuk
 * mesin pencari, dan setiap room punya URL sendiri yang jumlahnya tak terbatas.
 */
export const metadata: Metadata = {
  title: "Room",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
