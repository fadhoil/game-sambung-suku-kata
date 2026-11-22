import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
  EMOJI_BUCKET,
  EMOJI_IMAGE_MAX_BYTES,
  EMOJI_SOUND_MAX_BYTES,
  EMOJI_NAME_MAX,
  EMOJI_PRICE_MAX,
} from "@/lib/emojiLimits";

/**
 * Unggah emoji baru (gambar + suara) ke Supabase Storage lalu catat di katalog.
 *
 * Kenapa lewat server: Storage tidak mengenal PIN admin, jadi mengizinkan klien (anon)
 * mengunggah langsung berarti siapa pun bisa mengunggah. Di sini PIN diverifikasi lebih
 * dulu (lewat SQL yang sama dengan halaman admin), baru file diunggah memakai service-role
 * key yang HANYA ada di server (SUPABASE_SERVICE_ROLE_KEY).
 *
 * Tipe file ditentukan dari isi file (magic bytes), bukan dari nama/Content-Type kiriman klien.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Detected = { kind: "image" | "sound"; ext: string; mime: string };

function detect(b: Buffer): Detected | null {
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

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

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

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) return fail(500, "CONFIG_SUPABASE");
  if (!serviceKey) return fail(500, "CONFIG_SERVICE_KEY");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "BAD_FORM");
  }

  const pin = String(form.get("pin") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const priceRaw = String(form.get("price") ?? "").trim();
  const image = form.get("image");
  const sound = form.get("sound");

  if (!pin) return fail(401, "BAD_PIN");
  if (name.length < 1 || name.length > EMOJI_NAME_MAX) return fail(400, "INVALID_NAME");
  const price = Number(priceRaw);
  if (!/^\d+$/.test(priceRaw) || !Number.isInteger(price) || price < 0 || price > EMOJI_PRICE_MAX) {
    return fail(400, "INVALID_PRICE");
  }
  if (!(image instanceof File) || !(sound instanceof File)) return fail(400, "FILES_REQUIRED");
  if (image.size > EMOJI_IMAGE_MAX_BYTES) return fail(413, "IMAGE_TOO_LARGE");
  if (sound.size > EMOJI_SOUND_MAX_BYTES) return fail(413, "SOUND_TOO_LARGE");

  const imageBuf = Buffer.from(await image.arrayBuffer());
  const soundBuf = Buffer.from(await sound.arrayBuffer());
  const imageType = detect(imageBuf);
  const soundType = detect(soundBuf);
  if (!imageType || imageType.kind !== "image") return fail(415, "IMAGE_TYPE");
  if (!soundType || soundType.kind !== "sound") return fail(415, "SOUND_TYPE");

  // 1) PIN diverifikasi di SQL (sumber kebenaran yang sama dengan RPC admin lain).
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const pinCheck = await anon.rpc("admin_check_pin", { p_pin: pin });
  if (pinCheck.error) return fail(502, "UPSTREAM");
  if (pinCheck.data !== true) return fail(401, "BAD_PIN");

  // 2) Unggah file (path acak + immutable, jadi aman di-cache CDN selamanya).
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const id = randomUUID();
  const imagePath = `img/${id}.${imageType.ext}`;
  const soundPath = `snd/${id}.${soundType.ext}`;
  try {
    await ensureBucket(admin);
    const up1 = await admin.storage.from(EMOJI_BUCKET).upload(imagePath, imageBuf, {
      contentType: imageType.mime, cacheControl: "31536000", upsert: false,
    });
    if (up1.error) throw up1.error;
    const up2 = await admin.storage.from(EMOJI_BUCKET).upload(soundPath, soundBuf, {
      contentType: soundType.mime, cacheControl: "31536000", upsert: false,
    });
    if (up2.error) {
      await admin.storage.from(EMOJI_BUCKET).remove([imagePath]);
      throw up2.error;
    }
  } catch {
    return fail(502, "STORAGE");
  }

  // 3) Catat di katalog; bila gagal, bersihkan file yang baru diunggah.
  const created = await anon.rpc("admin_create_emoji", {
    p_pin: pin,
    p_name: name,
    p_price: price,
    p_image_path: imagePath,
    p_sound_path: soundPath,
  });
  if (created.error) {
    await admin.storage.from(EMOJI_BUCKET).remove([imagePath, soundPath]);
    const msg = created.error.message || "";
    if (msg.includes("NAME_TAKEN")) return fail(409, "NAME_TAKEN");
    if (msg.includes("BAD_PIN")) return fail(401, "BAD_PIN");
    if (msg.includes("INVALID_NAME")) return fail(400, "INVALID_NAME");
    if (msg.includes("INVALID_PRICE")) return fail(400, "INVALID_PRICE");
    return fail(502, "UPSTREAM");
  }

  return NextResponse.json({ id: created.data, imagePath, soundPath }, { status: 201 });
}
