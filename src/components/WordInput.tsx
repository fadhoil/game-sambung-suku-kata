"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  required: string;
  disabled?: boolean;
  onSubmit: (word: string) => Promise<{ ok: boolean; reason?: string }>;
  /** Pra-validasi di klien untuk feedback instan (server tetap otoritas). */
  preCheck?: (word: string) => "chain" | "dict" | "dupe" | "deadend" | null;
}

const REASON_TEXT: Record<string, string> = {
  chain: "Harus diawali suku kata itu",
  dict: "Bukan kata di kamus",
  dupe: "Kata sudah dipakai",
  deadend: "Kata itu bikin buntu — tak ada lanjutannya. Coba kata lain.",
  timeout: "Waktu habis!",
  not_your_turn: "Bukan giliranmu",
  inactive: "Ronde tidak aktif",
};

export default function WordInput({ required, disabled, onSubmit, preCheck }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled, required]);

  function showError(reason: string) {
    setError(REASON_TEXT[reason] ?? "Kata tidak valid");
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const word = value.trim();
    if (!word || busy) return;

    // Pra-cek di klien: tolak lebih awal tanpa round-trip ke server.
    const pre = preCheck?.(word);
    if (pre) {
      showError(pre);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await onSubmit(word);
      if (res.ok) {
        setValue("");
      } else {
        showError(res.reason ?? "");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={[
          "flex items-center gap-2 rounded-3xl bg-white p-2 shadow-soft",
          shake ? "animate-shake" : "",
          error ? "ring-2 ring-coral-bg" : "",
        ].join(" ")}
      >
        <span className="pl-3 text-sm font-semibold uppercase text-accent-to">
          {required}…
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          disabled={disabled || busy}
          placeholder="ketik kata"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent px-2 py-3 text-lg font-semibold text-ink outline-none placeholder:text-ink-soft/60"
          aria-label="Ketik kata lanjutan"
        />
        <button
          type="submit"
          disabled={disabled || busy || !value.trim()}
          className="rounded-2xl bg-gradient-to-r from-accent-from to-accent-to sheen px-5 py-3 text-sm font-bold text-ink shadow-soft-sm transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-40"
        >
          Kirim
        </button>
      </div>
      {error && (
        <p className="mt-2 animate-slide-in pl-4 text-sm font-medium text-coral-text" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
