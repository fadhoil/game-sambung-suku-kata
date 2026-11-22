import { NextRequest, NextResponse } from "next/server";
import { EMOJI_NAME_MAX } from "@/lib/emojiLimits";
import { fail, readEmojiFiles, removeEmojiFiles, serverClients, uploadEmojiFiles } from "@/lib/emojiServer";

/**
 * Usulan emoji dari pemain (gambar + suara) -> Storage + tabel emoji_suggestions (status pending).
 * Admin menyetujui/menolak di /kamus-admin. Hanya pemain ber-akun (token) yang boleh mengusulkan,
 * dan syarat (login, nama, maks. 3 usulan menunggu) dicek di SQL SEBELUM file diunggah.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rpcFail(msg: string) {
  if (msg.includes("NOT_LOGGED_IN")) return fail(401, "NOT_LOGGED_IN");
  if (msg.includes("INVALID_NAME")) return fail(400, "INVALID_NAME");
  if (msg.includes("NAME_TAKEN")) return fail(409, "NAME_TAKEN");
  if (msg.includes("TOO_MANY_PENDING")) return fail(429, "TOO_MANY_PENDING");
  return fail(502, "UPSTREAM");
}

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
  const token = String(form.get("token") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!token) return fail(401, "NOT_LOGGED_IN");
  if (name.length < 1 || name.length > EMOJI_NAME_MAX) return fail(400, "INVALID_NAME");

  // Cek syarat dulu (murah) agar permintaan tak sah tidak sampai mengunggah file.
  const pre = await anon.rpc("check_emoji_suggest", { p_token: token, p_name: name });
  if (pre.error) return rpcFail(pre.error.message || "");

  const files = await readEmojiFiles(form);
  if (files instanceof NextResponse) return files;

  let imagePath: string, soundPath: string;
  try {
    ({ imagePath, soundPath } = await uploadEmojiFiles(admin, files));
  } catch {
    return fail(502, "STORAGE");
  }

  const saved = await anon.rpc("suggest_emoji", {
    p_token: token,
    p_name: name,
    p_image_path: imagePath,
    p_sound_path: soundPath,
  });
  if (saved.error) {
    await removeEmojiFiles(admin, [imagePath, soundPath]);
    return rpcFail(saved.error.message || "");
  }
  return NextResponse.json({ id: saved.data }, { status: 201 });
}
