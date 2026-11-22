-- =====================================================================
-- Sambung Suku Kata — Migration v2
-- Menambah: nyawa (lives), mode nyawa, dukungan penonton/eliminasi, end_game.
-- Jalankan file ini di Supabase SQL Editor (aman diulang).
-- Setelah ini, jalankan ulang functions.sql.
-- =====================================================================

-- Kolom jumlah nyawa maksimum per room (1-5).
alter table public.rooms
  add column if not exists max_lives int not null default 1;

-- Pastikan batasan 1-5 (drop dulu jika ada agar idempoten).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_max_lives_check'
  ) then
    alter table public.rooms
      add constraint rooms_max_lives_check check (max_lives between 1 and 5);
  end if;
end $$;

-- Kolom sisa nyawa per pemain.
alter table public.players
  add column if not exists lives int not null default 1;
