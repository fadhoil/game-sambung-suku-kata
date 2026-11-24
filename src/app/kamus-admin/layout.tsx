import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function KamusAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
