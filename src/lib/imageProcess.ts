/**
 * Perkecil gambar emoji di browser sebelum diunggah: sisi terpanjang <= maxSide,
 * transparansi tetap, keluaran WebP (atau PNG bila browser tak bisa encode WebP).
 *
 * GIF animasi TIDAK digambar ulang ke canvas biasa, karena canvas hanya bisa memuat
 * satu frame sehingga animasinya hilang:
 * - GIF yang ukurannya masih di bawah maxBytes diteruskan apa adanya (paling ringan).
 * - GIF yang lebih besar dibongkar frame-nya (WebCodecs ImageDecoder), diperkecil, lalu
 *   di-encode ulang menjadi WebP animasi (libwebp lewat wasm). Animasinya tetap jalan
 *   tanpa perlu diperkecil manual oleh pemiliknya.
 */

/** Galat khusus: GIF animasi tetap melebihi maxBytes walau sudah diperkecil otomatis. */
export const GIF_TOO_LARGE = "GIF_TOO_LARGE";
/** Galat khusus: browser ini tidak punya ImageDecoder, jadi frame GIF tak bisa dibongkar. */
export const GIF_UNSUPPORTED = "GIF_UNSUPPORTED";

/** Batas jumlah frame yang diproses (GIF panjang diambil sebagian, durasinya digabung). */
const MAX_GIF_FRAMES = 40;
/**
 * Percobaan encode berurutan sampai ukurannya muat di bawah maxBytes: turunkan kualitas,
 * lalu (bila masih terlalu besar) ambil sebagian frame dan durasinya digabung.
 */
const WEBP_ATTEMPTS: { quality: number; keep: number }[] = [
  { quality: 80, keep: 1 },
  { quality: 60, keep: 1 },
  { quality: 45, keep: 1 },
  { quality: 55, keep: 2 },
  { quality: 35, keep: 2 },
  { quality: 45, keep: 3 },
  { quality: 30, keep: 4 },
];

/** GIF dikenali dari MIME atau ekstensi (sebagian browser mengosongkan file.type). */
function isGif(file: File) {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

/** Dimensi asli file (untuk GIF: frame pertama) tanpa menggambar ulang ke canvas. */
async function readImageSize(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return size;
}

/** Satu frame GIF yang sudah diperkecil: piksel RGBA + durasi tampil (milidetik). */
interface AnimFrame {
  data: Uint8Array;
  duration: number;
}

/** Bagian dari WebCodecs ImageDecoder yang kita pakai (tanpa bergantung tipe lib.dom). */
interface DecodedFrame {
  image: {
    displayWidth: number;
    displayHeight: number;
    duration: number | null;
    close(): void;
  };
}
interface ImageDecoderLike {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  decode(opts: { frameIndex: number }): Promise<DecodedFrame>;
  close(): void;
}
type ImageDecoderCtor = new (init: { data: ArrayBuffer; type: string }) => ImageDecoderLike;

function imageDecoderCtor(): ImageDecoderCtor | null {
  const ctor = (globalThis as { ImageDecoder?: ImageDecoderCtor }).ImageDecoder;
  return typeof ctor === "function" ? ctor : null;
}

/**
 * Bongkar GIF menjadi frame RGBA yang sudah diperkecil (sisi terpanjang <= maxSide).
 * Frame yang dilewati (bila GIF-nya sangat panjang) digabung ke durasi frame sebelumnya.
 */
async function gifToFrames(file: File, maxSide: number) {
  const Decoder = imageDecoderCtor();
  if (!Decoder) throw new Error(GIF_UNSUPPORTED);

  const decoder = new Decoder({ data: await file.arrayBuffer(), type: "image/gif" });
  try {
    await decoder.tracks.ready;
    const total = Math.max(1, decoder.tracks.selectedTrack?.frameCount ?? 1);
    const stride = Math.max(1, Math.ceil(total / MAX_GIF_FRAMES));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("NO_CANVAS");

    const frames: AnimFrame[] = [];
    let width = 0;
    let height = 0;

    for (let i = 0; i < total; i += stride) {
      const { image } = await decoder.decode({ frameIndex: i });
      try {
        if (!width) {
          const scale = Math.min(1, maxSide / Math.max(image.displayWidth, image.displayHeight));
          width = Math.max(1, Math.round(image.displayWidth * scale));
          height = Math.max(1, Math.round(image.displayHeight * scale));
          canvas.width = width;
          canvas.height = height;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image as unknown as CanvasImageSource, 0, 0, width, height);
        const rgba = ctx.getImageData(0, 0, width, height).data;
        const ms = Math.round((image.duration ?? 100_000) / 1000);
        frames.push({
          data: new Uint8Array(rgba.buffer.slice(0)),
          duration: Math.min(10_000, Math.max(20, ms) * stride),
        });
      } finally {
        image.close();
      }
    }

    if (!frames.length) throw new Error(GIF_UNSUPPORTED);
    return { frames, width, height };
  } finally {
    decoder.close();
  }
}

/** Ambil setiap frame ke-`keep`, durasinya digabung supaya tempo animasi tetap sama. */
function thinFrames(frames: AnimFrame[], keep: number): AnimFrame[] {
  if (keep <= 1) return frames;
  const out: AnimFrame[] = [];
  for (let i = 0; i < frames.length; i += keep) {
    let duration = 0;
    for (let j = i; j < Math.min(i + keep, frames.length); j++) duration += frames[j].duration;
    out.push({ data: frames[i].data, duration });
  }
  return out;
}

/** Encode frame RGBA menjadi WebP animasi; dikecilkan bertahap sampai muat di bawah maxBytes. */
async function encodeAnimatedWebp(frames: AnimFrame[], width: number, height: number, maxBytes: number) {
  const { encodeAnimation } = await import("wasm-webp");
  let best: Blob | null = null;
  for (const { quality, keep } of WEBP_ATTEMPTS) {
    const bytes = await encodeAnimation(
      width,
      height,
      true,
      thinFrames(frames, keep).map((f) => ({ data: f.data, duration: f.duration, config: { lossless: 0, quality } }))
    );
    if (!bytes) continue;
    const blob = new Blob([bytes as BlobPart], { type: "image/webp" });
    if (!best || blob.size < best.size) best = blob;
    if (blob.size <= maxBytes) return blob;
  }
  return best;
}

export async function toEmojiImage(
  file: File,
  maxSide: number,
  maxBytes: number
): Promise<{ blob: Blob; width: number; height: number }> {
  if (isGif(file)) {
    // GIF kecil: diteruskan apa adanya, animasi & ukurannya utuh tanpa encode ulang.
    if (file.size <= maxBytes) return { blob: file, ...(await readImageSize(file)) };

    // GIF besar: perkecil + ubah jadi WebP animasi supaya muat dan tetap bergerak.
    const { frames, width, height } = await gifToFrames(file, maxSide);
    const blob = await encodeAnimatedWebp(frames, width, height, maxBytes);
    if (!blob) throw new Error(GIF_UNSUPPORTED);
    if (blob.size > maxBytes) throw new Error(GIF_TOO_LARGE);
    return { blob, width, height };
  }

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
