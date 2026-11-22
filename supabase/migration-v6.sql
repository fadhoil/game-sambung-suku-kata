-- =====================================================================
-- Sambung Suku Kata — Migration v6
-- (1) REPLICA IDENTITY FULL agar event DELETE realtime membawa semua kolom
--     lama (termasuk room_id). Tanpa ini, filter `room_id=eq.<id>` pada
--     postgres_changes TIDAK pernah cocok untuk DELETE, sehingga host tidak
--     mendapat notifikasi saat pemain di-kick (harus refresh manual).
-- (2) RPC find_active_session: cek apakah sebuah device masih punya pemain
--     di room yang belum selesai (lobby/playing) -> dipakai untuk menawarkan
--     "lanjutkan permainan?" di halaman awal.
-- Jalankan di Supabase SQL Editor (aman diulang). Lalu jalankan ulang functions.sql.
-- =====================================================================

-- (1) Pastikan payload DELETE lengkap untuk semua tabel yang dipublikasikan realtime.
alter table public.players replica identity full;
alter table public.teams   replica identity full;
alter table public.rooms   replica identity full;
alter table public.rounds  replica identity full;

-- (2) find_active_session: kembalikan room aktif milik device ini (jika ada).
--     Mengembalikan baris kosong bila device tidak sedang berada di room manapun.
drop function if exists public.find_active_session(text);
create or replace function public.find_active_session(p_device_id text)
returns table (
  room_code text,
  room_status text,
  player_id uuid,
  player_name text,
  player_avatar text
)
language sql security definer as $$
  select r.code, r.status, p.id, p.name, p.avatar
  from public.players p
  join public.rooms r on r.id = p.room_id
  where p_device_id is not null
    and p.device_id = p_device_id
    and r.status in ('lobby', 'playing')
  order by p.joined_at desc
  limit 1;
$$;
