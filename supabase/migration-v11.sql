-- =====================================================================
-- Sambung Suku Kata — Migration v11
-- Poin per akun, leaderboard (minggu ini / sepanjang masa), dan penalti host
-- yang mengakhiri game terlalu cepat.
--
-- Prasyarat: migration-v10.sql sudah dijalankan.
-- URUTAN DEPLOY: jalankan file ini, lalu functions.sql, baru deploy Vercel.
-- Aman diulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Konfigurasi aturan (SATU tempat untuk mengubah angka).
-- ---------------------------------------------------------------------
create or replace function public.fn_pts_cfg(p_key text)
returns int language sql immutable as $$
  select case p_key
    -- Pemberian poin
    when 'min_chain'      then 8    -- rantai minimal (kata, termasuk kata awal) agar game bernilai poin
    when 'chain_step'     then 10   -- +1 poin per 10 kata rantai ...
    when 'chain_cap'      then 3    -- ... maksimal +3
    when 'min_longest'    then 8    -- kata terpanjang minimal 8 huruf untuk dapat bonus
    when 'longest_bonus'  then 2
    -- Penalti host yang mengakhiri game
    when 'free_putaran'   then 3    -- <= 3 putaran: tanpa penalti (tetap tanpa poin)
    when 'lock1_seconds'  then 60   -- pelanggaran ke-1: tak bisa memulai game 1 menit
    when 'lock2_seconds'  then 180  -- pelanggaran ke-2: 3 menit
    when 'penalty_points' then 5    -- pelanggaran ke-3 dst: -5 poin (tidak kurang dari 0)
    when 'decay_days'     then 7    -- hitungan pelanggaran di-reset setelah 7 hari bersih
  end;
$$;

-- ---------------------------------------------------------------------
-- Skema
-- ---------------------------------------------------------------------
alter table public.accounts add column if not exists points int not null default 0 check (points >= 0);
alter table public.rounds add column if not exists ended_by_host boolean not null default false;

create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete set null,
  kind text not null check (kind in ('game', 'penalty')),  -- ke depan: 'spend' (tukar emoji/badge)
  placement int not null default 0,
  chain_bonus int not null default 0,
  longest_bonus int not null default 0,
  delta int not null,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_ledger_game on public.point_ledger(round_id, account_id) where kind = 'game';
create index if not exists idx_ledger_account on public.point_ledger(account_id, created_at);
create index if not exists idx_ledger_kind_time on public.point_ledger(kind, created_at);
alter table public.point_ledger enable row level security;   -- tanpa policy: hanya lewat RPC

create table if not exists public.host_penalties (
  device_id text primary key,
  offense_count int not null default 0,
  locked_until timestamptz,
  last_offense_at timestamptz
);
alter table public.host_penalties enable row level security;  -- tanpa policy

-- ---------------------------------------------------------------------
-- Putaran = jumlah giliran selesai (jawaban valid atau timeout) dibagi
-- jumlah pemain (mode tim: jumlah tim), dibulatkan ke bawah.
-- ---------------------------------------------------------------------
create or replace function public.fn_putaran(p_round_id uuid)
returns int language sql stable as $$
  select coalesce(
    (select count(*) from public.moves m
       where m.round_id = p_round_id and (m.is_valid or m.reason = 'timeout'))
    / nullif(
        (select case when r.mode = 'team'
                     then (select count(*) from public.teams t where t.room_id = r.id)
                     else (select count(*) from public.players p where p.room_id = r.id) end
           from public.rounds ro join public.rooms r on r.id = ro.room_id
          where ro.id = p_round_id), 0),
    0)::int;
$$;

-- Nomor pelanggaran berikutnya untuk device ini (1, 2, 3, ...), memperhitungkan reset 7 hari.
create or replace function public.fn_penalty_next(p_device_id text)
returns int language sql stable security definer as $$
  select case when p_device_id is null then 0
         else coalesce((
           select case when hp.last_offense_at < now() - make_interval(days => public.fn_pts_cfg('decay_days'))
                       then 0 else hp.offense_count end
           from public.host_penalties hp where hp.device_id = p_device_id), 0) + 1
         end;
$$;

-- Terapkan penalti: ke-1 kunci 1 mnt, ke-2 kunci 3 mnt, ke-3+ potong poin (min 0).
create or replace function public.fn_apply_host_penalty(p_device_id text, p_account_id uuid)
returns json language plpgsql security definer as $$
declare
  v_n int;
  v_lock int := 0;
  v_ded int := 0;
  v_before int;
  v_after int;
  v_stage text;
begin
  if p_device_id is null then
    return json_build_object('stage', 'none', 'lock_seconds', 0, 'points_deducted', 0);
  end if;

  insert into public.host_penalties(device_id) values (p_device_id) on conflict do nothing;
  perform 1 from public.host_penalties where device_id = p_device_id for update;

  v_n := public.fn_penalty_next(p_device_id);
  if v_n = 1 then
    v_stage := 'lock'; v_lock := public.fn_pts_cfg('lock1_seconds');
  elsif v_n = 2 then
    v_stage := 'lock'; v_lock := public.fn_pts_cfg('lock2_seconds');
  else
    v_stage := 'points';
    if p_account_id is not null then
      select a.points into v_before from public.accounts a where a.id = p_account_id for update;
      update public.accounts
        set points = greatest(0, points - public.fn_pts_cfg('penalty_points'))
        where id = p_account_id
        returning points into v_after;
      v_ded := coalesce(v_before, 0) - coalesce(v_after, 0);
      if v_ded > 0 then
        insert into public.point_ledger(account_id, kind, delta, note)
          values (p_account_id, 'penalty', -v_ded, 'host_end_game');
      end if;
    end if;
  end if;

  update public.host_penalties
    set offense_count = v_n,
        last_offense_at = now(),
        locked_until = case when v_lock > 0 then now() + make_interval(secs => v_lock) else null end
    where device_id = p_device_id;

  return json_build_object('stage', v_stage, 'lock_seconds', v_lock, 'points_deducted', v_ded, 'offense', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- Pemberian poin. Dipanggil dari fn_check_win saat game selesai ALAMI.
-- Idempoten (unique round+akun). Tanpa poin bila game diakhiri host atau
-- rantai < min_chain.
--   Juara   : 2 pemain 3/1 · 3 pemain 4/2/1 · 4+ pemain 5/3/2, lainnya 1
--             (mode tim: peringkat TIM, jumlah = jumlah tim)
--   Rantai  : +1 per 10 kata rantai, maks +3
--   Terpanjang: +2 untuk penyetor kata valid terpanjang (min 8 huruf)
-- Hanya pemain ber-akun (bukan guest / admin) yang mendapat poin.
-- ---------------------------------------------------------------------
create or replace function public.fn_award_points(p_round_id uuid)
returns void language plpgsql security definer as $$
declare
  v_round public.rounds%rowtype;
  v_room public.rooms%rowtype;
  v_units int;
  v_chain int;
  v_chain_bonus int;
  v_long_player uuid;
  v_long_len int;
  r record;
  v_place int;
  v_long int;
  v_total int;
  v_ins uuid;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if not found or v_round.status <> 'finished' or v_round.ended_by_host then return; end if;
  select * into v_room from public.rooms where id = v_round.room_id;

  select count(*) + 1 into v_chain from public.moves where round_id = p_round_id and is_valid;
  if v_chain < public.fn_pts_cfg('min_chain') then return; end if;
  v_chain_bonus := least(public.fn_pts_cfg('chain_cap'), v_chain / public.fn_pts_cfg('chain_step'));

  select m.player_id, char_length(m.word) into v_long_player, v_long_len
    from public.moves m
    where m.round_id = p_round_id and m.is_valid
    order by char_length(m.word) desc, m.created_at asc
    limit 1;
  if coalesce(v_long_len, 0) < public.fn_pts_cfg('min_longest') then v_long_player := null; end if;

  if v_room.mode = 'ffa' then
    select count(*) into v_units from public.players where room_id = v_room.id;
  else
    select count(*) into v_units from public.teams where room_id = v_room.id;
  end if;

  for r in
    select p.id as player_id, p.account_id,
      case when v_room.mode = 'ffa' then
        (select count(*) from public.players q
           where q.room_id = v_room.id
             and (coalesce(q.eliminated_order, 2147483647), q.id)
               > (coalesce(p.eliminated_order, 2147483647), p.id)) + 1
      else
        (select count(*) from public.teams t
           where t.room_id = v_room.id
             and coalesce(t.eliminated_order, 2147483647) > coalesce(pt.eliminated_order, 2147483647)) + 1
      end as rnk
    from public.players p
    left join public.teams pt on pt.id = p.team_id
    where p.room_id = v_room.id and p.account_id is not null and not p.is_admin
  loop
    v_ins := null;
    v_place := case
      when v_units <= 2 then (case when r.rnk = 1 then 3 else 1 end)
      when v_units = 3  then (case r.rnk when 1 then 4 when 2 then 2 else 1 end)
      else (case r.rnk when 1 then 5 when 2 then 3 when 3 then 2 else 1 end)
    end;
    v_long := case when r.player_id = v_long_player then public.fn_pts_cfg('longest_bonus') else 0 end;
    v_total := v_place + v_chain_bonus + v_long;

    insert into public.point_ledger(account_id, round_id, kind, placement, chain_bonus, longest_bonus, delta)
      values (r.account_id, p_round_id, 'game', v_place, v_chain_bonus, v_long, v_total)
      on conflict (round_id, account_id) where kind = 'game' do nothing
      returning id into v_ins;

    if v_ins is not null then
      update public.accounts set points = points + v_total where id = r.account_id;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC publik
-- ---------------------------------------------------------------------

-- Pratinjau konsekuensi mengakhiri game (untuk dialog konfirmasi host).
create or replace function public.end_game_preview(p_room_id uuid, p_player_id uuid)
returns json language plpgsql stable security definer as $$
declare
  v_room public.rooms%rowtype;
  v_put int := 0;
  v_dev text;
  v_next int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_player_id <> p_player_id then raise exception 'NOT_HOST'; end if;
  if v_room.current_round_id is not null then v_put := public.fn_putaran(v_room.current_round_id); end if;

  select device_id into v_dev from public.players where id = p_player_id;
  v_next := public.fn_penalty_next(v_dev);
  if v_put <= public.fn_pts_cfg('free_putaran') or v_dev is null then
    return json_build_object('putaran', v_put, 'stage', 'none', 'lock_seconds', 0, 'points', 0);
  end if;
  return json_build_object(
    'putaran', v_put,
    'stage', case when v_next <= 2 then 'lock' else 'points' end,
    'lock_seconds', case v_next when 1 then public.fn_pts_cfg('lock1_seconds')
                                when 2 then public.fn_pts_cfg('lock2_seconds') else 0 end,
    'points', case when v_next >= 3 then public.fn_pts_cfg('penalty_points') else 0 end
  );
end;
$$;

-- Sisa detik penalti untuk host ini (0 = tidak terkunci).
create or replace function public.get_host_lock(p_player_id uuid)
returns int language sql stable security definer as $$
  select coalesce(greatest(0, ceil(extract(epoch from (
    (select hp.locked_until from public.host_penalties hp
       join public.players p on p.device_id = hp.device_id
      where p.id = p_player_id) - now())))::int), 0);
$$;

-- get_account sekarang juga mengembalikan saldo poin.
drop function if exists public.get_account(text);
create or replace function public.get_account(p_token text)
returns table (account_id uuid, account_name text, account_avatar text, account_points int)
language sql stable security definer as $$
  select a.id, a.name, a.avatar, a.points
  from public.accounts a
  where a.id = public.fn_account_id(p_token);
$$;

-- Rincian poin yang kamu dapat di satu game (kosong bila tak ada).
create or replace function public.get_my_round_points(p_round_id uuid, p_token text)
returns table (placement int, chain_bonus int, longest_bonus int, total int)
language sql stable security definer as $$
  select l.placement, l.chain_bonus, l.longest_bonus, l.delta
  from public.point_ledger l
  where l.round_id = p_round_id
    and l.kind = 'game'
    and l.account_id = public.fn_account_id(p_token);
$$;

-- Leaderboard. p_period: 'week' (Senin 00:00 WIB s/d sekarang) atau selain itu = sepanjang masa.
-- Diurutkan berdasarkan poin yang DIDAPAT dari game (penalti/penukaran tidak menurunkan peringkat).
-- Jika p_token dikenali dan akunnya di luar top N, barisnya tetap ikut ditampilkan.
create or replace function public.get_leaderboard(p_period text, p_limit int default 20, p_token text default null)
returns table (rank int, account_id uuid, account_name text, account_avatar text, points int, is_me boolean)
language sql stable security definer as $$
  with me as (select public.fn_account_id(p_token) as id),
  since as (
    select case when p_period = 'week'
                then (date_trunc('week', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')
                else '-infinity'::timestamptz end as t
  ),
  totals as (
    select l.account_id as aid, sum(l.delta)::int as pts
    from public.point_ledger l, since s
    where l.kind = 'game' and l.created_at >= s.t
    group by l.account_id
    having sum(l.delta) > 0
  ),
  ranked as (
    select rank() over (order by t.pts desc)::int as rnk, a.id, a.name, a.avatar, t.pts, a.created_at
    from totals t join public.accounts a on a.id = t.aid
  )
  select r.rnk, r.id, r.name, r.avatar, r.pts, r.id = (select id from me)
  from ranked r
  where r.rnk <= greatest(1, least(coalesce(p_limit, 20), 100)) or r.id = (select id from me)
  order by r.rnk, r.created_at;
$$;

-- ---------------------------------------------------------------------
-- Izin: RPC publik untuk anon; fungsi internal TIDAK boleh dipanggil klien.
-- ---------------------------------------------------------------------
grant execute on function public.end_game_preview(uuid, uuid) to anon, authenticated;
grant execute on function public.get_host_lock(uuid) to anon, authenticated;
grant execute on function public.get_account(text) to anon, authenticated;
grant execute on function public.get_my_round_points(uuid, text) to anon, authenticated;
grant execute on function public.get_leaderboard(text, int, text) to anon, authenticated;

revoke execute on function public.fn_award_points(uuid) from public, anon, authenticated;
revoke execute on function public.fn_apply_host_penalty(text, uuid) from public, anon, authenticated;
revoke execute on function public.fn_penalty_next(text) from public, anon, authenticated;
revoke execute on function public.fn_putaran(uuid) from public, anon, authenticated;
