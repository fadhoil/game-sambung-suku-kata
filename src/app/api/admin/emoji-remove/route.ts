import { NextRequest, NextResponse } from "next/server";
import { fail, removeEmojiFiles, serverClients } from "@/lib/emojiServer";

/**
 * Aksi admin yang juga menghapus file di Storage (butuh service-role, jadi lewat server):
 *  - action "delete": hapus emoji permanen (toko + inventory semua pemain) lalu hapus filenya.
 *  - action "reject": tolak usulan emoji lalu hapus file usulannya.
 * PIN diverifikasi di dalam RPC SQL yang bersangkutan.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const clients = serverClients();
  if (clients instanceof NextResponse) return clients;
  const { anon, admin } = clients;

  let body: { pin?: unknown; action?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, "BAD_FORM");
  }
  const pin = String(body.pin ?? "").trim();
  const id = String(body.id ?? "");
  if (!pin) return fail(401, "BAD_PIN");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(400, "INVALID_ID");

  const res =
    body.action === "delete"
      ? await anon.rpc("admin_delete_emoji", { p_pin: pin, p_id: id })
      : body.action === "reject"
        ? await anon.rpc("admin_review_emoji_suggestion", { p_pin: pin, p_id: id, p_approve: false })
        : null;
  if (!res) return fail(400, "INVALID_ACTION");
  if (res.error) return fail(res.error.message?.includes("BAD_PIN") ? 401 : 502, res.error.message?.includes("BAD_PIN") ? "BAD_PIN" : "UPSTREAM");

  const r = res.data as { ok: boolean; reason?: string; image_path?: string; sound_path?: string };
  if (!r?.ok) return fail(404, r?.reason ?? "NOT_FOUND");
  const paths = [r.image_path, r.sound_path].filter((p): p is string => !!p);
  try {
    await removeEmojiFiles(admin, paths);
  } catch {
    /* baris DB sudah terhapus; file yatim tidak mengganggu pemain */
  }
  return NextResponse.json({ ok: true });
}
