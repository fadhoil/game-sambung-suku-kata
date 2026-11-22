import type { CSSProperties } from "react";

/** Urutan masuk bertahap untuk class `.rise` (jeda = i × 70ms, lihat globals.css). */
export const stagger = (i: number): CSSProperties => ({ ["--i" as string]: i }) as CSSProperties;
