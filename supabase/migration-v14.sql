-- =====================================================================
-- Sambung Suku Kata — Migration v14
--
-- (1) Hapus akun SOFT (flag): akun yang dihapus tidak benar-benar dibuang.
--     Baris akun + ledger poin tetap ada, tetapi diberi flag deleted_at,
--     sehingga skor 🏆 & koin 🪙 "ter-hold": tidak tampil di leaderboard,
--     tidak bisa dipakai (token dianggap guest), tidak menerima poin baru,
--     dan tidak lagi memakai jatah 3 akun per perangkat. Nama akun yang
--     dihapus bisa dipakai lagi oleh akun baru.
--
-- (2) Penonton (spectator): kolom players.is_spectator / joined_late.
--     Penonton ikut berada di room tetapi tidak ikut giliran, tidak dihitung
--     sebagai pemain hidup, dan tidak mendapat poin. Fungsi di migrasi lama
--     yang menghitung baris players disesuaikan di sini.
--
-- URUTAN DEPLOY: file ini -> functions.sql -> baru deploy Vercel.
-- Aman diulang. Prasyarat: migration-v13.sql sudah dijalankan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Skema
-- ---------------------------------------------------------------------
alter table public.accounts add column if not exists deleted_at timestamptz;

alter table public.players add column if not exists is_spectator boolean not null default false;
-- true = masuk saat game sedang berjalan; naik jadi pemain otomatis di play_again.
alter table public.players add column if not exists joined_late boolean not null default false;

-- Nama akun unik hanya di antara akun yang MASIH AKTIF (nama akun terhapus bebas dipakai lagi).
drop index if exists public.uq_accounts_name_ci;
create unique index if not exists uq_accounts_name_ci
  on public.accounts (lower(btrim(name))) where deleted_at is null;

-- ---------------------------------------------------------------------
-- Akun: token milik akun terhapus dianggap tidak dikenal (= guest).
-- ---------------------------------------------------------------------
create or replace function public.fn_account_id(p_token text)
returns uuid language sql stable security definer as $$
  select a.id
  from public.accounts a
  where p_token is not null
    and char_length(p_token) >= 20
    and a.token_hash = public.fn_token_hash(p_token)
    and a.deleted_at is null;
$$;

-- Hapus akun (soft). Mengembalikan true bila akun ditemukan & ditandai terhapus.
-- device_key_hash dikosongkan agar jatah akun perangkat terbebas; skor & koin
-- tetap tersimpan di baris akun/ledger tetapi tidak berlaku lagi.
create or replace function public.delete_account(p_token text)
returns boolean language plpgsql security definer as $$
declare v_id uuid;
begin
  v_id := public.fn_account_id(p_token);
  if v_id is null then return false; end if;
  update public.accounts
    set deleted_at = now(), device_key_hash = null
    where id = v_id;
  return true;
end;
$$;

-- Nama + skor + koin untuk token milik perangkat ini (akun terhapus tidak ikut).
create or replace function public.get_accounts(p_tokens text[])
returns table (account_id uuid, account_name text, account_avatar text, account_score int, account_coins int)
language sql stable security definer as $$
  select a.id, a.name, a.avatar,
         coalesce((select sum(l.delta) from public.point_ledger l
                    where l.account_id = a.id and l.kind = 'game'), 0)::int,
         a.coins
  from public.accounts a
  where a.deleted_at is null
    and a.token_hash in (
      select public.fn_token_hash(t) from unnest(p_tokens[1:10]) t where char_length(t) >= 20
    );
$$;

-- Leaderboard: akun terhapus tidak tampil.
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
    where a.deleted_at is null
  )
  select r.rnk, r.id, r.name, r.avatar, r.pts, r.id = (select id from me)
  from ranked r
  where r.rnk <= greatest(1, least(coalesce(p_limit, 20), 100)) or r.id = (select id from me)
  order by r.rnk, r.created_at;
$$;

-- ---------------------------------------------------------------------
-- Putaran: jumlah pemain TIDAK termasuk penonton.
-- ---------------------------------------------------------------------
create or replace function public.fn_putaran(p_round_id uuid)
returns int language sql stable as $$
  select coalesce(
    (select count(*) from public.moves m
       where m.round_id = p_round_id and (m.is_valid or m.reason = 'timeout'))
    / nullif(
        (select case when r.mode = 'team'
                     then (select count(*) from public.teams t where t.room_id = r.id)
                     else (select count(*) from public.players p
                            where p.room_id = r.id and not p.is_spectator) end
           from public.rounds ro join public.rooms r on r.id = ro.room_id
          where ro.id = p_round_id), 0),
    0)::int;
$$;

-- ---------------------------------------------------------------------
-- Hasil & poin: penonton dikeluarkan dari hitungan jumlah peserta, peringkat,
-- dan daftar penerima hasil (menimpa v13).
-- ---------------------------------------------------------------------
create or replace function public.fn_compute_round_results(p_round_id uuid)
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
  v_team int;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if not found or v_round.status <> 'finished' or v_round.ended_by_host then return; end if;
  if exists (select 1 from public.round_results where round_id = p_round_id) then return; end if;
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
    select count(*) into v_units from public.players
      where room_id = v_room.id and not is_spectator;
  else
    select count(*) into v_units from public.teams where room_id = v_room.id;
  end if;

  for r in
    select p.id as player_id,
      case when v_room.mode = 'ffa' then
        (select count(*) from public.players q
           where q.room_id = v_room.id and not q.is_spectator
             and (coalesce(q.eliminated_order, 2147483647), q.id)
               > (coalesce(p.eliminated_order, 2147483647), p.id)) + 1
      else
        (select count(*) from public.teams t
           where t.room_id = v_room.id
             and coalesce(t.eliminated_order, 2147483647) > coalesce(pt.eliminated_order, 2147483647)) + 1
      end as rnk,
      exists (select 1 from public.moves m
               where m.round_id = p_round_id and m.player_id = p.id and m.is_valid) as contributed,
      (select count(*) from public.players q where q.team_id = pt.id) as own_size,
      coalesce((select max(c) from (
                  select count(*) as c from public.players q2
                   where q2.room_id = v_room.id and q2.team_id is not null and q2.team_id <> pt.id
                   group by q2.team_id) s), 0) as opp_max
    from public.players p
    left join public.teams pt on pt.id = p.team_id
    where p.room_id = v_room.id and not p.is_admin and not p.is_spectator
  loop
    v_place := case
      when v_units <= 2 then (case when r.rnk = 1 then 3 else 1 end)
      when v_units = 3  then (case r.rnk when 1 then 4 when 2 then 2 else 1 end)
      else (case r.rnk when 1 then 5 when 2 then 3 when 3 then 2 else 1 end)
    end;
    v_long := case when r.player_id = v_long_player then public.fn_pts_cfg('longest_bonus') else 0 end;

    -- Mode tim: hanya yang ikut menyumbang kata yang dapat bonus tim (anti numpang).
    v_team := 0;
    if v_room.mode = 'team' and r.contributed then
      if r.rnk = 1 then
        v_team := case when r.own_size < r.opp_max then public.fn_pts_cfg('team_win_underdog')
                       when r.own_size = r.opp_max then public.fn_pts_cfg('team_win')
                       else public.fn_pts_cfg('team_win_overdog') end;
      else
        v_team := public.fn_pts_cfg('team_lose');
      end if;
    end if;

    insert into public.round_results(round_id, player_id, placement, chain_bonus, longest_bonus, team_bonus, total)
      values (p_round_id, r.player_id, v_place, v_chain_bonus, v_long, v_team, v_place + v_chain_bonus + v_long + v_team)
      on conflict do nothing;
  end loop;
end;
$$;

-- Pemberian poin ke akun (menimpa v13): akun yang sudah dihapus tidak menerima poin/koin.
create or replace function public.fn_award_points(p_round_id uuid, p_only_player uuid default null)
returns void language plpgsql security definer as $$
declare
  r record;
  v_ins uuid;
begin
  perform public.fn_compute_round_results(p_round_id);

  for r in
    select rr.player_id, rr.placement, rr.chain_bonus, rr.longest_bonus, rr.team_bonus, rr.total, p.account_id
    from public.round_results rr
    join public.players p on p.id = rr.player_id
    join public.accounts ac on ac.id = p.account_id and ac.deleted_at is null
    where rr.round_id = p_round_id
      and p.account_id is not null and not p.is_admin and not p.is_spectator
      and (p_only_player is null or rr.player_id = p_only_player)
  loop
    v_ins := null;
    insert into public.point_ledger(account_id, round_id, player_id, kind, placement, chain_bonus, longest_bonus, team_bonus, delta)
      values (r.account_id, p_round_id, r.player_id, 'game', r.placement, r.chain_bonus, r.longest_bonus, r.team_bonus, r.total)
      on conflict (round_id, account_id) where kind = 'game' do nothing
      returning id into v_ins;

    if v_ins is not null then
      update public.accounts set coins = coins + r.total where id = r.account_id;  -- skor = jumlah ledger 'game'
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Izin
-- ---------------------------------------------------------------------
grant execute on function public.delete_account(text) to anon, authenticated;
grant execute on function public.get_accounts(text[]) to anon, authenticated;
grant execute on function public.get_leaderboard(text, int, text) to anon, authenticated;
revoke execute on function public.fn_compute_round_results(uuid) from public, anon, authenticated;
revoke execute on function public.fn_award_points(uuid, uuid) from public, anon, authenticated;
