import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * sitemap.xml dinamis. Hanya halaman publik yang bisa berdiri sendiri
 * (tanpa parameter / state room) yang didaftarkan.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/tentang`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/toko`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/usulkan-emoji`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
