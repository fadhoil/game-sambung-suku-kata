import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt dinamis (Next.js App Router).
 *
 * - /api/ dan /kamus-admin tidak perlu diindeks (bukan halaman publik).
 * - /room/ tidak diindeks: isinya state permainan per room, bukan konten.
 * - Crawler AI (OAI-SearchBot, PerplexityBot, ClaudeBot, dst.) sengaja
 *   DIIZINKAN agar game ini bisa muncul sebagai jawaban di mesin AI.
 */
export default function robots(): MetadataRoute.Robots {
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "PerplexityBot",
    "Perplexity-User",
    "ClaudeBot",
    "Claude-Web",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
    "Bingbot",
  ];

  return {
    rules: [
      {
        userAgent: aiCrawlers,
        allow: ["/", "/tentang"],
        disallow: ["/api/", "/kamus-admin", "/room/"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/kamus-admin", "/room/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
