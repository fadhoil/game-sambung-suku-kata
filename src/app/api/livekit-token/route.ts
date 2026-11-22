import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

/**
 * Buat token akses LiveKit (JWT) di sisi server agar API secret TIDAK
 * pernah bocor ke browser. Klien memanggil endpoint ini dengan kode room
 * dan identitas pemain, lalu memakai token untuk connect ke LiveKit.
 *
 * Audio-only: izin publish/subscribe diberikan; track video tidak dipakai
 * di klien (hanya mikrofon).
 *
 * ENV yang dibutuhkan (lihat .env.example):
 *   LIVEKIT_API_KEY, LIVEKIT_API_SECRET  (rahasia, server-only)
 *   NEXT_PUBLIC_LIVEKIT_URL              (URL wss project, dipakai klien)
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit belum dikonfigurasi (LIVEKIT_API_KEY / LIVEKIT_API_SECRET)." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const room = (searchParams.get("room") || "").trim();
  const identity = (searchParams.get("identity") || "").trim();
  const name = (searchParams.get("name") || identity).trim();

  if (!room || !identity) {
    return NextResponse.json(
      { error: "Parameter 'room' dan 'identity' wajib diisi." },
      { status: 400 }
    );
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    // Token berlaku singkat; cukup untuk satu sesi lobi/hasil.
    ttl: "2h",
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    // Audio-only: data channel tidak diperlukan.
    canPublishData: false,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token });
}
