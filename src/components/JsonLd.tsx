/**
 * Menyisipkan JSON-LD terstruktur (schema.org) ke halaman.
 *
 * Dipakai agar Google dan mesin jawaban AI (ChatGPT, Perplexity, Gemini, Bing
 * Copilot) bisa membaca fakta tentang game ini — bukan hanya menebak dari HTML.
 */
export default function JsonLd({
  data,
  id,
}: {
  data: Record<string, unknown>;
  id?: string;
}) {
  return (
    <script
      id={id}
      type="application/ld+json"
      // JSON.stringify aman di sini: datanya dibuat sendiri di server, bukan input pengguna.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
