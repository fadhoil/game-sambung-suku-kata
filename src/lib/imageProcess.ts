/**
 * Perkecil gambar emoji di browser sebelum diunggah: sisi terpanjang <= maxSide,
 * transparansi tetap, keluaran WebP (atau PNG bila browser tak bisa encode WebP).
 * Gambar animasi (GIF) menjadi gambar diam (frame pertama).
 */
export async function toEmojiImage(
  file: File,
  maxSide: number,
  maxBytes: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("NO_CANVAS");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let last: Blob | null = null;
  for (const q of [0.9, 0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", q));
    if (!blob) break;
    last = blob;
    if (blob.size <= maxBytes) return { blob, width, height };
  }
  if (last && last.size <= maxBytes) return { blob: last, width, height };
  throw new Error("IMAGE_TOO_COMPLEX");
}

/** Durasi (detik) bila browser bisa memutar file suara ini; null bila tidak. */
export function readSoundDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(null);
    a.src = url;
  });
}
