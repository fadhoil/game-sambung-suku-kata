-- =====================================================================
-- Sambung Suku Kata — Migration v8
-- Ambang keringanan DINAMIS berdasarkan jumlah pemain yang masih bertahan.
--
-- Aturan:
--   alive = 2  -> pemicu 1 kegagalan
--   alive = 3  -> pemicu acak 1..2
--   alive = 4  -> pemicu acak 1..3
--   alive = n  -> pemicu acak 1..(n-1)
--
-- "Acak" = benar-benar random tiap kali target baru dibuat. Ambang
-- disimpan per-ronde (kolom relax_threshold) agar perbandingan konsisten
-- selama target yang sama, lalu diacak ulang saat target berganti.
--
-- Jalankan di Supabase SQL Editor (aman diulang), lalu jalankan ulang
-- functions.sql (yang sudah diperbarui untuk memakai kolom & fungsi ini).
-- =====================================================================

-- Ambang kegagalan berturut-turut yang memicu keringanan untuk target saat ini.
alter table public.rounds
  add column if not exists relax_threshold int not null default 1;

-- ---------------------------------------------------------------------
-- fn_relax_threshold: hitung ambang acak berdasarkan jumlah pemain alive.
--   max = greatest(1, alive - 1)
--   hasil = bilangan bulat acak di [1, max]
-- Dipakai saat ronde dibuat & saat target di-reset ke suku kata baru.
-- ---------------------------------------------------------------------
create or replace function public.fn_relax_threshold(p_room_id uuid)
returns int language plpgsql as $$
declare
  v_alive int;
  v_max int;
begin
  select count(*) into v_alive
    from public.players
    where room_id = p_room_id and is_alive;

  -- Minimal 2 pemain untuk main; jaga-jaga bila terbaca < 2.
  v_max := greatest(1, coalesce(v_alive, 2) - 1);

  -- floor(random()*v_max) menghasilkan 0..(v_max-1), +1 => 1..v_max.
  return 1 + floor(random() * v_max)::int;
end;
$$;

grant execute on function public.fn_relax_threshold(uuid) to anon, authenticated;
