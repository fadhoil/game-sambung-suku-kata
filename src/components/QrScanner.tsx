"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onResult: (code: string) => void;
  onClose: () => void;
}

/**
 * Pemindai QR via kamera (html5-qrcode). Dimuat hanya di klien.
 * QR berisi link undangan `.../?join=KODE`; kita ambil bagian KODE-nya.
 */
export default function QrScanner({ onResult, onClose }: Props) {
  const containerId = "qr-reader";
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: any = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        instance = new Html5Qrcode(containerId);
        scannerRef.current = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            const code = extractCode(decodedText);
            if (code) {
              stop(instance).finally(() => onResult(code));
            }
          },
          () => {
            /* abaikan frame gagal decode */
          }
        );
      } catch (e: any) {
        if (!cancelled) {
          setError(
            "Tidak bisa mengakses kamera. Pastikan izin kamera diberikan, atau masukkan kode manual."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stop(scannerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stop(inst: any) {
    try {
      if (inst && inst.isScanning) await inst.stop();
      if (inst) await inst.clear();
    } catch {
      /* abaikan */
    }
  }

  /** Ambil kode dari teks QR: dukung URL `?join=KODE` atau kode polos. */
  function extractCode(text: string): string | null {
    try {
      const url = new URL(text);
      const j = url.searchParams.get("join");
      if (j) return j.toUpperCase().slice(0, 6);
    } catch {
      /* bukan URL -> mungkin kode polos */
    }
    const clean = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return clean.length >= 4 ? clean.slice(0, 6) : null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pindai QR"
    >
      <div className="w-full max-w-sm animate-pop-in rounded-3xl bg-white p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">📷 Scan QR Room</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-bg-end px-3 py-1 text-xs font-bold text-ink active:scale-95"
          >
            Tutup
          </button>
        </div>

        <div
          id={containerId}
          className="overflow-hidden rounded-2xl bg-black/5"
          style={{ minHeight: 240 }}
        />

        {error ? (
          <p className="mt-3 text-sm font-medium text-coral-text">{error}</p>
        ) : (
          <p className="mt-3 text-center text-xs text-ink-soft">
            Arahkan kamera ke QR room. Kode akan terisi otomatis.
          </p>
        )}
      </div>
    </div>
  );
}
