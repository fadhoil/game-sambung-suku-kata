import type { Player } from "@/types/game";

interface Props {
  player: Player;
  isActive?: boolean;
  teamColor?: string;
  showLives?: boolean;
  /** Status online dari presence (lebih akurat dari kolom DB). */
  online?: boolean;
  /** Tampilkan tombol kick (host, di lobby). */
  onKick?: () => void;
  /** Tandai chip ini sebagai "kamu". */
  isMe?: boolean;
  /** Pewarnaan hasil ready-check (informasional). undefined = normal. */
  readyState?: "ready" | "notready";
  /** Pemain ini sedang bicara di voice chat -> beri penanda. */
  speaking?: boolean;
}

export default function PlayerChip({
  player,
  isActive,
  teamColor,
  showLives,
  online,
  onKick,
  isMe,
  readyState,
  speaking,
}: Props) {
  // Jika prop online diberikan (presence), pakai itu; else fallback kolom DB.
  const isOnline = online ?? player.connected;
  // Penonton memang tidak "hidup" di game, tetapi bukan tereliminasi: jangan dicoret/abu-abu.
  const isSpectator = !!player.is_spectator;
  const isOut = !player.is_alive && !isSpectator;

  return (
    <div
      className={[
        "relative flex animate-pop-in items-center gap-2 rounded-2xl px-3 py-2 transition-all duration-300",
        "bg-white shadow-soft-sm",
        isOut ? "opacity-50 grayscale" : isSpectator ? "opacity-80" : "opacity-100",
        isActive ? "turn-pulse scale-105 ring-2 ring-accent-to" : "",
        readyState === "ready" ? "bg-sage-bg/40 ring-2 ring-sage-text" : "",
        readyState === "notready" ? "bg-coral-bg/30 ring-2 ring-coral-text" : "",
        // Sedang bicara di voice chat: ring hijau berdenyut (menimpa state lain).
        speaking ? "ring-2 ring-emerald-400 ring-offset-1 animate-pulse-soft" : "",
      ].join(" ")}
      style={teamColor ? { borderLeft: `4px solid ${teamColor}` } : undefined}
    >
      {speaking && (
        <span
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[9px] shadow"
          title="Sedang bicara"
          aria-label="Sedang bicara"
        >
          🎙️
        </span>
      )}
      <span className="text-xl leading-none">{player.avatar}</span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span
          className={[
            "truncate text-sm font-semibold",
            isOut ? "text-ink-soft line-through" : "text-ink",
          ].join(" ")}
        >
          {player.name}
          {isMe && <span className="ml-1 text-[10px] text-ink-soft">(kamu)</span>}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-ink-soft">
          {player.is_host && <span title="Host">⭐ host</span>}
          {isSpectator && <span title="Penonton">👀 penonton</span>}
          {showLives && player.is_alive && (
            <span title={`${player.lives} nyawa`}>{"❤️".repeat(Math.max(0, player.lives))}</span>
          )}
          {isOnline ? (
            <span className="text-sage-text">● online</span>
          ) : (
            <span>○ offline</span>
          )}
        </span>
      </span>
      {onKick && !player.is_host && !player.is_admin && (
        <button
          onClick={onKick}
          className="shrink-0 rounded-lg bg-coral-bg/20 px-2 py-1 text-xs font-bold text-coral-text active:scale-95"
          aria-label={`Keluarkan ${player.name}`}
          title="Keluarkan pemain"
        >
          ✕
        </button>
      )}
    </div>
  );
}
