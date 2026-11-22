import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { EMOJI_BUCKET, EMOJI_IMAGE_MAX_BYTES, EMOJI_SOUND_MAX_BYTES } from "@/lib/emojiLimits";

/** Helper bersama route server emoji (admin & usulan pemain). Hanya untuk dipakai di server. */

type Detected = { kind: "image" | "sound"; ext: string; mime: string };

/** Tipe file ditentukan dari isi (magic bytes), bukan dari nama/Content-Type kiriman klien. */
export function detect(b: Buffer): Detected | null {
  const ascii = (from: number, to: number) => b.subarray(from, to).toString("latin1");
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return { kind: "image", ext: "png", mime: "image/png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", ext: "jpg", mime: "image/jpeg" };
  if (ascii(0, 4) === "GIF8") return { kind: "image", ext: "gif", mime: "image/gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", ext: "webp", mime: "image/webp" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return { kind: "sound", ext: "wav", mime: "audio/wav" };
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { kind: "sound", ext: "mp3", mime: "audio/mpeg" };
  if (ascii(0, 4) === "OggS") return { kind: "sound", ext: "ogg", mime: "audio/ogg" };
  if (ascii(4, 8) === "ftyp") return { kind: "sound", ext: "m4a", mime: "audio/mp4" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "sound", ext: "webm", mime: "audio/webm" };
  return null;
}

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } };

/** anon = klien biasa (RPC ber-PIN/token); admin = service-role (Storage). Atau Response galat konfigurasi. */
export function serverClients(): { anon: SupabaseClient; admin: SupabaseClient } | NextResponse {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) return fail(500, "CONFIG_SUPABASE");
  if (!serviceKey) return fail(500, "CONFIG_SERVICE_KEY");
  return { anon: createClient(url, anonKey, clientOpts), admin: createClient(url, serviceKey, clientOpts) };
}

let bucketReady = false;
async function ensureBucket(admin: SupabaseClient) {
  if (bucketReady) return;
  const { data } = await admin.storage.getBucket(EMOJI_BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(EMOJI_BUCKET, {
      public: true, // dibaca lewat URL publik (CDN); tulis hanya lewat service-role
      fileSizeLimit: EMOJI_SOUND_MAX_BYTES,
    });
    // "sudah ada" akibat balapan antar-instance bukan masalah
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

export interface EmojiFiles {
  imageBuf: Buffer;
  imageType: Detected;
  soundBuf: Buffer;
  soundType: Detected;
}

/** Baca & validasi field "image" + "sound" (ukuran dan tipe asli file). */
export async function readEmojiFiles(form: FormData): Promise<EmojiFiles | NextResponse> {
  const image = form.get("image");
  const sound = form.get("sound");
  if (!(image instanceof File) || !(sound instanceof File)) return fail(400, "FILES_REQUIRED");
  if (image.size > EMOJI_IMAGE_MAX_BYTES) return fail(413, "IMAGE_TOO_LARGE");
  if (sound.size > EMOJI_SOUND_MAX_BYTES) return fail(413, "SOUND_TOO_LARGE");
  const imageBuf = Buffer.from(await image.arrayBuffer());
  const soundBuf = Buffer.from(await sound.arrayBuffer());
  const imageType = detect(imageBuf);
  const soundType = detect(soundBuf);
  if (!imageType || imageType.kind !== "image") return fail(415, "IMAGE_TYPE");
  if (!soundType || soundType.kind !== "sound") return fail(415, "SOUND_TYPE");
  return { imageBuf, imageType, soundBuf, soundType };
}

/** Unggah gambar + suara (path acak + immutable, aman di-cache CDN selamanya). Melempar bila gagal. */
export async function uploadEmojiFiles(admin: SupabaseClient, f: EmojiFiles) {
  const id = randomUUID();
  const imagePath = `img/${id}.${f.imageType.ext}`;
  const soundPath = `snd/${id}.${f.soundType.ext}`;
  await ensureBucket(admin);
  const up1 = await admin.storage.from(EMOJI_BUCKET).upload(imagePath, f.imageBuf, {
    contentType: f.imageType.mime, cacheControl: "31536000", upsert: false,
  });
  if (up1.error) throw up1.error;
  const up2 = await admin.storage.from(EMOJI_BUCKET).upload(soundPath, f.soundBuf, {
    contentType: f.soundType.mime, cacheControl: "31536000", upsert: false,
  });
  if (up2.error) {
    await admin.storage.from(EMOJI_BUCKET).remove([imagePath]);
    throw up2.error;
  }
  return { imagePath, soundPath };
}

export async function removeEmojiFiles(admin: SupabaseClient, paths: string[]) {
  await admin.storage.from(EMOJI_BUCKET).remove(paths);
}
