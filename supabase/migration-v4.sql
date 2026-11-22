-- =====================================================================
-- Sambung Suku Kata — Migration v4
-- Keringanan suku kata: setelah 2 kegagalan berturut-turut pada target
-- yang sama, target dilonggarkan jadi 1 huruf terakhir.
-- Jalankan di Supabase SQL Editor (aman diulang). Lalu jalankan ulang functions.sql.
-- =====================================================================

-- Jumlah kegagalan berturut-turut pada giliran dengan target saat ini.
alter table public.rounds
  add column if not exists consecutive_fails int not null default 0;

-- Apakah target saat ini sedang dalam mode keringanan (1 huruf).
alter table public.rounds
  add column if not exists relaxed boolean not null default false;

-- Suku kata "penuh" asli (sebelum dilonggarkan), untuk info/UI.
alter table public.rounds
  add column if not exists full_syllable text;
