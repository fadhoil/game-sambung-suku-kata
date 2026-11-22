/** Lencana poin kecil: jumlah yang sama masuk ke skor 🏆 dan koin 🪙. */
export default function PointsPill({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-accent-to/20 px-2 py-0.5 text-[11px] font-bold text-accent-deep",
        className,
      ].join(" ")}
      title={`+${value} skor dan +${value} koin`}
    >
      +{value} <span aria-hidden>🏆🪙</span>
    </span>
  );
}
