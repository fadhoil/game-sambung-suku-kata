import { NextRequest, NextResponse } from "next/server";
import { RtcRole, RtcTokenBuilder } from "agora-token";

/**
 * Buat token akses Agora RTC di sisi server agar App Certificate TIDAK
 * pernah bocor ke browser. Klien memanggil endpoint ini dengan kode room
 * dan identitas pemain, lalu memakai token untuk join channel Agora.
 *
 * Audio-only: role PUBLISHER (boleh kirim & terima audio); track video
 * tidak dipakai di klien (hanya mikrofon).
 *
 * Token dibuat dengan *string user account* (identity pemain), sehingga
 * uid di klien = playerId. Konsekuensinya `client.join()` harus dipanggil
 * dengan uid string yang sama, dan semua peserta channel harus memakai
 * tipe uid yang sama (string, bukan angka).
 *
 * ENV yang dibutuhkan (lihat .env.example):
 *   NEXT_PUBLIC_AGORA_APP_ID   (App ID, aman dibaca klien)
 *   AGORA_APP_CERTIFICATE      (rahasia, server-only)
 */

export const dynamic = "force-dynamic";

/** Masa berlaku token: 2 jam, cukup untuk satu sesi lobi/hasil. */
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

/** Kode room game: huruf/angka, dipakai sebagai nama channel Agora. */
const ROOM_RE = /^[A-Za-z0-9]{1,32}$/;
/** String user ID Agora: ASCII, maksimal 255 karakter. */
const IDENTITY_RE = /^[\x20-\x7E]{1,255}$/;

/** Nama channel dipisah dari prefix agar tidak bentrok dengan aplikasi lain. */
function channelFor(room: string) {
  return `ssk_${room}`;
}

export async function GET(req: NextRequest) {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    return NextResponse.json(
      {
        error:
          "Agora belum dikonfigurasi (NEXT_PUBLIC_AGORA_APP_ID / AGORA_APP_CERTIFICATE).",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const room = (searchParams.get("room") || "").trim();
  const identity = (searchParams.get("identity") || "").trim();

  if (!room || !identity) {
    return NextResponse.json(
      { error: "Parameter 'room' dan 'identity' wajib diisi." },
      { status: 400 }
    );
  }
  if (!ROOM_RE.test(room)) {
    return NextResponse.json({ error: "Kode room tidak valid." }, { status: 400 });
  }
  if (!IDENTITY_RE.test(identity)) {
    return NextResponse.json(
      { error: "Identitas pemain tidak valid (harus ASCII, maks 255 karakter)." },
      { status: 400 }
    );
  }

  try {
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelFor(room),
      identity,
      RtcRole.PUBLISHER,
      TOKEN_TTL_SECONDS,
      TOKEN_TTL_SECONDS
    );

    // Token tidak di-cache: setiap permintaan membuat token baru.
    return NextResponse.json(
      { token },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[agora-token] gagal membuat token:", e);
    return NextResponse.json(
      { error: "Gagal membuat token voice." },
      { status: 500 }
    );
  }
}