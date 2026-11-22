-- =====================================================================
-- Sambung Suku Kata — Migration v9
-- Dukungan "Admin ikut bermain" + daftar lobi aktif untuk halaman admin.
--
-- Isi:
--   1. Kolom players.is_admin — menandai pemain yang masuk sebagai Admin
--      lewat halaman /kamus-admin (ikut bermain, tapi tidak bisa di-kick).
--   2. RPC list_active_rooms(p_pin) — daftar room beserta status & jumlah
--      pemain untuk ditampilkan di halaman admin. Ber-PIN (SECURITY DEFINER),
--      mengikuti pola list_suggestions di migration-v7.
--
-- Catatan keamanan: PIN diverifikasi di DALAM fungsi SECURITY DEFINER,
-- memakai public.fn_admin_pin() (didefinisikan di migration-v7), sehingga
-- daftar room hanya bisa dibaca dengan PIN yang benar.
--
-- Jalankan di Supabase SQL Editor (aman diulang). Setelah menjalankan ini,
-- JALANKAN ULANG functions.sql agar join_room (param p_is_admin baru) &
-- kick_player (guard CANT_KICK_ADMIN) ikut ter-update.
-- =====================================================================

-- ---------- kolom is_admin pada players ----------
alter table public.players
  add column if not exists is_admin boolean not null default false;

-- ---------- RPC: admin melihat daftar room aktif (ber-PIN) ----------
drop function if exists public.list_active_rooms(text);
create or replace function public.list_active_rooms(p_pin text)
returns table (
  code text,
  status text,
  player_count int,
  created_at timestamptz
)
language plpgsql security definer as $$
begin
  if p_pin is distinct from public.fn_admin_pin() then
    raise exception 'BAD_PIN';
  end if;
  return query
    select r.code,
           r.status,
           (select count(*)::int from public.players p where p.room_id = r.id) as player_count,
           r.created_at
    from public.rooms r
    order by r.created_at desc;
end;
$$;

grant execute on function public.list_active_rooms(text) to anon, authenticated;
