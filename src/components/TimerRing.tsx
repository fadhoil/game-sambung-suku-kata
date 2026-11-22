"use client";

interface Props {
  /** sisa detik */
  remaining: number;
  /** total detik */
  total: number;
}

/**
 * Cincin hitung mundur. Warna berubah lembut hijau → kuning → coral.
 */
export default function TimerRing({ remaining, total }: Props) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, remaining / total));
  const offset = circ * (1 - ratio);

  let color = "#A7D7C5"; // sage
  if (ratio <= 0.3) color = "#F4A6A6"; // coral
  else if (ratio <= 0.6) color = "#FDE2C8"; // cream/kuning lembut

  const secs = Math.max(0, Math.ceil(remaining));
  const urgent = ratio <= 0.3;

  return (
    <div className={["relative", urgent ? "heartbeat" : ""].join(" ")}>
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#E1ECF7" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span key={secs} className="tick-pop text-3xl font-extrabold text-ink" aria-live="polite">
          {secs}
        </span>
      </div>
    </div>
  );
}
