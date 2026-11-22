import { NextRequest, NextResponse } from "next/server";
import { EMOJI_NAME_MAX, EMOJI_PRICE_MAX } from "@/lib/emojiLimits";
import { fail, readEmojiFiles, removeEmojiFiles, serverClients, uploadEmojiFiles } from "@/lib/emojiServer";

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

export async function POST(req: NextRequest) {
  const clients = serverClients();
  if (clients instanceof NextResponse) return clients;
  const { anon, admin } = clients;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "BAD_FORM");
  }

  const pin = String(form.get("pin") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const priceRaw = String(form.get("price") ?? "").trim();

  if (!pin) return fail(401, "BAD_PIN");
  if (name.length < 1 || name.length > EMOJI_NAME_MAX) return fail(400, "INVALID_NAME");
  const price = Number(priceRaw);
  if (!/^\d+$/.test(priceRaw) || !Number.isInteger(price) || price < 0 || price > EMOJI_PRICE_MAX) {
    return fail(400, "INVALID_PRICE");
  }
  const files = await readEmojiFiles(form);
  if (files instanceof NextResponse) return files;

  // 1) PIN diverifikasi di SQL (sumber kebenaran yang sama dengan RPC admin lain).
  const pinCheck = await anon.rpc("admin_check_pin", { p_pin: pin });
  if (pinCheck.error) return fail(502, "UPSTREAM");
  if (pinCheck.data !== true) return fail(401, "BAD_PIN");

  // 2) Unggah file.
  let imagePath: string, soundPath: string;
  try {
    ({ imagePath, soundPath } = await uploadEmojiFiles(admin, files));
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
    await removeEmojiFiles(admin, [imagePath, soundPath]);
    const msg = created.error.message || "";
    if (msg.includes("NAME_TAKEN")) return fail(409, "NAME_TAKEN");
    if (msg.includes("BAD_PIN")) return fail(401, "BAD_PIN");
    if (msg.includes("INVALID_NAME")) return fail(400, "INVALID_NAME");
    if (msg.includes("INVALID_PRICE")) return fail(400, "INVALID_PRICE");
    return fail(502, "UPSTREAM");
  }

  return NextResponse.json({ id: created.data, imagePath, soundPath }, { status: 201 });
}
