-- =====================================================================
-- Sambung Suku Kata — Migration v13
-- Perolehan poin SEMUA pemain per game (termasuk guest) disimpan di
-- round_results, supaya halaman hasil & kartu bagikan bisa menampilkan poin
-- pemain yang belum punya akun. Ledger akun (skor 🏆 / koin 🪙) tetap hanya
-- untuk pemain ber-akun dan diturunkan dari round_results.
--
-- Prasyarat: migration-v12.sql sudah dijalankan.
-- URUTAN DEPLOY: file ini -> functions.sql -> baru deploy Vercel.
-- Aman diulang. JANGAN jalankan ulang migration-v12.sql sesudahnya.
-- =====================================================================

create table if not exists public.round_results (
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  placement int not null default 0,
  chain_bonus int not null default 0,
  longest_bonus int not null default 0,
  team_bonus int not null default 0,
  total int not null,
  primary key (round_id, player_id)
);
alter table public.round_results enable row level security;  -- tanpa policy: hanya lewat RPC

-- ---------------------------------------------------------------------
-- Hitung & simpan hasil SEMUA pemain (bukan admin) sekali per ronde.
-- Aturan poin sama dengan v12 (lihat fn_pts_cfg). Tanpa hasil bila game
-- diakhiri host atau rantai < min_chain.
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
    select count(*) into v_units from public.players where room_id = v_room.id;
  else
    select count(*) into v_units from public.teams where room_id = v_room.id;
  end if;

  for r in
    select p.id as player_id,
      case when v_room.mode = 'ffa' then
        (select count(*) from public.players q
           where q.room_id = v_room.id
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
    where p.room_id = v_room.id and not p.is_admin
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

-- ---------------------------------------------------------------------
-- Pemberian poin ke akun (menimpa v12): turunan dari round_results.
-- p_only_player: hanya proses pemain itu (klaim saat guest mendaftar).
-- ---------------------------------------------------------------------
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
    where rr.round_id = p_round_id
      and p.account_id is not null and not p.is_admin
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
-- Poin SEMUA pemain di satu game (termasuk guest). saved = sudah tercatat di akun.
-- Ronde yang selesai sebelum v13 (hanya ada di ledger) tetap ditampilkan.
-- ---------------------------------------------------------------------
drop function if exists public.get_round_points(uuid);
create or replace function public.get_round_points(p_round_id uuid)
returns table (player_id uuid, placement int, chain_bonus int, longest_bonus int, team_bonus int, total int, saved boolean)
language sql stable security definer as $$
  select rr.player_id, rr.placement, rr.chain_bonus, rr.longest_bonus, rr.team_bonus, rr.total,
         exists (select 1 from public.point_ledger l
                  where l.round_id = rr.round_id and l.player_id = rr.player_id and l.kind = 'game')
  from public.round_results rr
  where rr.round_id = p_round_id
  union all
  select l.player_id, l.placement, l.chain_bonus, l.longest_bonus, l.team_bonus, l.delta, true
  from public.point_ledger l
  where l.round_id = p_round_id and l.kind = 'game' and l.player_id is not null
    and not exists (select 1 from public.round_results rr
                     where rr.round_id = l.round_id and rr.player_id = l.player_id);
$$;

grant execute on function public.get_round_points(uuid) to anon, authenticated;
revoke execute on function public.fn_compute_round_results(uuid) from public, anon, authenticated;
revoke execute on function public.fn_award_points(uuid, uuid) from public, anon, authenticated;
