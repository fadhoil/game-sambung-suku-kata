-- =====================================================================
-- Sambung Suku Kata — Migration v5
-- (1) Sesi per-device: kolom device_id untuk cegah double-join.
-- (2) Peringkat: urutan eliminasi pemain & tim (untuk ranking "bertahan terlama").
-- Jalankan di Supabase SQL Editor (aman diulang). Lalu jalankan ulang functions.sql.
-- =====================================================================

-- Device unik per pemain (cegah pemain fiktif dari device yang sama).
alter table public.players
  add column if not exists device_id text;

-- Urutan eliminasi pemain: 1 = tereliminasi pertama, dst. NULL = belum tereliminasi.
alter table public.players
  add column if not exists eliminated_order int;

-- Urutan eliminasi tim (untuk mode tim): 1 = tim tereliminasi pertama, dst.
alter table public.teams
  add column if not exists eliminated_order int;

-- Counter global eliminasi per room disimpan transien via perhitungan max()+1
-- di fungsi, jadi tidak perlu kolom tambahan di rooms.

-- Index untuk cari pemain berdasarkan device di sebuah room.
create index if not exists idx_players_room_device
  on public.players (room_id, device_id);
