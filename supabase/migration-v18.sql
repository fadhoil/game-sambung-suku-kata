-- =====================================================================
-- Sambung Suku Kata — Migration v18
--  Keringanan karena GAGAL mengikuti jumlah pemain/tim yang BERTAHAN saat ini.
--  Ambang diacak 1..(n-1): sisa 2 -> 1; sisa 3 -> acak 1-2; sisa 4 -> acak 1-3; dst.
--  n = pemain hidup (FFA) atau tim hidup (mode Tim).
--  fn_relax_n = penghitung n (dipakai juga oleh fn_handle_timeout untuk mengacak
--  ulang ambang bila n turun setelah eliminasi).
--  Menimpa fn_relax_threshold (v16) tanpa mengubah perilakunya.
--
-- URUTAN DEPLOY: file ini -> functions.sql -> deploy Vercel.
-- Prasyarat: migration-v16.sql. Aman diulang.
-- =====================================================================

create or replace function public.fn_relax_n(p_room_id uuid)
returns int language plpgsql stable as $$
declare
  v_mode text;
  v_n int;
begin
  select mode into v_mode from public.rooms where id = p_room_id;

  if v_mode = 'ffa' then
    select count(*) into v_n from public.players
      where room_id = p_room_id and is_alive;
  else
    select count(*) into v_n from public.teams t
      where t.room_id = p_room_id
        and exists (select 1 from public.players p where p.team_id = t.id and p.is_alive);
  end if;

  return coalesce(v_n, 2);
end;
$$;

create or replace function public.fn_relax_threshold(p_room_id uuid)
returns int language plpgsql as $$
declare
  v_max int := greatest(1, public.fn_relax_n(p_room_id) - 1);
begin
  -- floor(random()*v_max) = 0..(v_max-1), +1 => 1..v_max.
  return 1 + floor(random() * v_max)::int;
end;
$$;

grant execute on function public.fn_relax_n(uuid) to anon, authenticated;
grant execute on function public.fn_relax_threshold(uuid) to anon, authenticated;
