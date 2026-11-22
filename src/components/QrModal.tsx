"use client";

interface Props {
  open: boolean;
  onClose: () => void;
  joinUrl: string;
  code: string;
}

/** Pop-up menampilkan QR undangan room (tanpa pindah halaman). */
export default function QrModal({ open, onClose, joinUrl, code }: Props) {
  if (!open) return null;
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
    joinUrl
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="QR Room"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs animate-pop-in rounded-3xl bg-white p-6 text-center shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-extrabold text-ink">Scan untuk Gabung</h2>
        <p className="mb-4 text-xs text-ink-soft">
          Kode: <b className="tracking-widest text-ink">{code}</b>
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`QR untuk gabung room ${code}`}
          width={240}
          height={240}
          className="mx-auto rounded-2xl"
        />
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-accent-from to-accent-to py-3 font-bold text-ink shadow-soft-sm active:scale-95"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
