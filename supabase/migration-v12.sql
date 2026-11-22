-- =====================================================================
-- Sambung Suku Kata — Migration v12
--  * Dua jenis poin: skor 🏆 (akumulasi, untuk leaderboard) dan koin 🪙 (saldo,
--    nanti untuk membeli atribut di toko). Tiap game memberi jumlah yang sama
--    ke keduanya; penalti host hanya memotong koin.
--  * Nama akun unik (tanpa membedakan huruf besar/kecil) dan maksimal 3 akun
--    per perangkat.
--  * Poin game yang baru selesai ikut masuk ke akun yang didaftarkan SESUDAH
--    game itu (klaim, dengan bukti kepemilikan lewat kunci perangkat).
--  * Mode tim: tambahan poin untuk tim menang/kalah.
--
-- Prasyarat: migration-v10.sql dan migration-v11.sql sudah dijalankan.
-- URUTAN DEPLOY: file ini -> functions.sql -> baru deploy Vercel.
-- Jalankan SEKALI per tahap; JANGAN jalankan ulang migration-v11.sql sesudah
-- file ini (v11 mendefinisikan versi lama fungsi yang di sini diganti).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Konfigurasi (menimpa v11; semua kunci lama dipertahankan).
-- ---------------------------------------------------------------------
create or replace function public.fn_pts_cfg(p_key text)
returns int language sql immutable as $$
  select case p_key
    when 'min_chain'      then 8
    when 'chain_step'     then 10
    when 'chain_cap'      then 3
    when 'min_longest'    then 8
    when 'longest_bonus'  then 2
    -- Mode tim (hanya untuk anggota yang menyumbang >= 1 kata valid):
    when 'team_win'          then 2   -- tim menang, jumlah anggota setara dengan lawan terbesar
    when 'team_win_underdog' then 3   -- tim menang dengan anggota LEBIH SEDIKIT dari lawan terbesar
    when 'team_win_overdog'  then 1   -- tim menang dengan anggota LEBIH BANYAK dari lawan terbesar
    when 'team_lose'         then 1   -- tim yang tidak menang
    when 'free_putaran'   then 3
    when 'lock1_seconds'  then 60
    when 'lock2_seconds'  then 180
    when 'penalty_points' then 5      -- dipotong dari KOIN
    when 'decay_days'     then 7
    when 'max_accounts_per_device' then 3
  end;
$$;

-- ---------------------------------------------------------------------
-- Skema
-- ---------------------------------------------------------------------
-- accounts.points (v11) = saldo -> berganti nama jadi coins.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'accounts' and column_name = 'points')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'accounts' and column_name = 'coins') then
    alter table public.accounts rename column points to coins;
  end if;
end $$;
alter table public.accounts add column if not exists coins int not null default 0 check (coins >= 0);
alter table public.accounts add column if not exists device_key_hash text;
create index if not exists idx_accounts_device_key on public.accounts(device_key_hash);

alter table public.point_ledger add column if not exists team_bonus int not null default 0;
alter table public.point_ledger add column if not exists player_id uuid references public.players(id) on delete set null;

-- Nama unik tanpa membedakan huruf besar/kecil. Nama kembar yang sudah ada diberi
-- akhiran angka (yang terlama tetap), supaya indeks unik bisa dibuat.
do $$
declare r record; n int; cand text;
begin
  for r in
    select id, name,
           row_number() over (partition by lower(btrim(name)) order by created_at, id) as rn
    from public.accounts
  loop
    if r.rn > 1 then
      n := r.rn;
      loop
        cand := left(btrim(r.name), 16 - length(n::text)) || n::text;
        exit when not exists (select 1 from public.accounts a where lower(btrim(a.name)) = lower(cand));
        n := n + 1;
      end loop;
      update public.accounts set name = cand where id = r.id;
    end if;
  end loop;
end $$;
create unique index if not exists uq_accounts_name_ci on public.accounts (lower(btrim(name)));

-- Kunci perangkat per pemain (rahasia; hanya hash). Dipakai sebagai bukti
-- kepemilikan baris pemain saat mengklaim poin. Tanpa policy = tertutup untuk klien.
create table if not exists public.player_keys (
  player_id uuid primary key references public.players(id) on delete cascade,
  key_hash text not null
);
alter table public.player_keys enable row level security;

-- ---------------------------------------------------------------------
-- Pemberian poin (menimpa v11). p_only_player: hanya proses pemain itu (klaim).
-- ---------------------------------------------------------------------
drop function if exists public.fn_award_points(uuid);
create or replace function public.fn_award_points(p_round_id uuid, p_only_player uuid default null)
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
    where p.room_id = v_room.id and p.account_id is not null and not p.is_admin
      and (p_only_player is null or p.id = p_only_player)
  loop
    v_ins := null;
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

    v_total := v_place + v_chain_bonus + v_long + v_team;

    insert into public.point_ledger(account_id, round_id, player_id, kind, placement, chain_bonus, longest_bonus, team_bonus, delta)
      values (r.account_id, p_round_id, r.player_id, 'game', v_place, v_chain_bonus, v_long, v_team, v_total)
      on conflict (round_id, account_id) where kind = 'game' do nothing
      returning id into v_ins;

    if v_ins is not null then
      update public.accounts set coins = coins + v_total where id = r.account_id;  -- skor = jumlah ledger 'game'
    end if;
  end loop;
end;
$$;

-- Penalti host (menimpa v11): memotong KOIN, tidak menyentuh skor/leaderboard.
create or replace function public.fn_apply_host_penalty(p_device_id text, p_account_id uuid)
returns json language plpgsql security definer as $$
declare
  v_n int; v_lock int := 0; v_ded int := 0; v_before int; v_after int; v_stage text;
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
      select a.coins into v_before from public.accounts a where a.id = p_account_id for update;
      update public.accounts
        set coins = greatest(0, coins - public.fn_pts_cfg('penalty_points'))
        where id = p_account_id
        returning coins into v_after;
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
-- Akun: daftar (menimpa v10), dengan nama unik, kuota perangkat, dan klaim poin.
-- Galat: INVALID_TOKEN, INVALID_NAME, INVALID_DEVICE_KEY, NAME_TAKEN, DEVICE_ACCOUNT_LIMIT.
-- ---------------------------------------------------------------------
drop function if exists public.register_account(text, text, text, uuid, text);
drop function if exists public.register_account(text, text, text, text, uuid, uuid);
create or replace function public.register_account(
  p_token text,
  p_name text,
  p_avatar text,
  p_device_key text,
  p_player_id uuid default null,
  p_round_id uuid default null
)
returns table (account_id uuid, account_name text, account_avatar text, created boolean, awarded int)
language plpgsql security definer as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 16);
  v_hash text;
  v_dev text;
  v_id uuid;
  v_created boolean := false;
  v_awarded int := 0;
begin
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 100 then
    raise exception 'INVALID_TOKEN';
  end if;
  if p_device_key is null or char_length(p_device_key) < 20 or char_length(p_device_key) > 100 then
    raise exception 'INVALID_DEVICE_KEY';
  end if;
  if v_name = '' then raise exception 'INVALID_NAME'; end if;

  v_hash := public.fn_token_hash(p_token);
  v_dev := public.fn_token_hash(p_device_key);

  -- Serialkan pendaftaran dari perangkat yang sama agar kuota tidak bisa dilampaui lewat balapan.
  perform pg_advisory_xact_lock(hashtext(v_dev));

  select a.id into v_id from public.accounts a where a.token_hash = v_hash;
  if v_id is null then
    if (select count(*) from public.accounts a where a.device_key_hash = v_dev)
         >= public.fn_pts_cfg('max_accounts_per_device') then
      raise exception 'DEVICE_ACCOUNT_LIMIT';
    end if;
    begin
      insert into public.accounts(token_hash, name, avatar, device_key_hash)
        values (v_hash, v_name, coalesce(nullif(p_avatar, ''), '🙂'), v_dev)
        returning id into v_id;
      v_created := true;
    exception when unique_violation then
      select a.id into v_id from public.accounts a where a.token_hash = v_hash;
      if v_id is null then raise exception 'NAME_TAKEN'; end if;
    end;
  end if;

  -- Klaim baris pemain di room (hanya bila kunci perangkat cocok dengan kunci saat bergabung).
  if p_player_id is not null
     and exists (select 1 from public.player_keys k where k.player_id = p_player_id and k.key_hash = v_dev) then
    update public.players
      set account_id = v_id
      where public.players.id = p_player_id
        and public.players.account_id is null
        and not public.players.is_admin;
    -- Poin game yang BARU selesai (ronde terakhir room itu) ikut masuk ke akun ini.
    if found and p_round_id is not null
       and exists (select 1 from public.rooms rm
                     join public.players pl on pl.room_id = rm.id
                    where pl.id = p_player_id and rm.current_round_id = p_round_id) then
      perform public.fn_award_points(p_round_id, p_player_id);
      select coalesce(sum(l.delta), 0)::int into v_awarded
        from public.point_ledger l
        where l.round_id = p_round_id and l.account_id = v_id and l.kind = 'game';
    end if;
  end if;

  return query
    select a.id, a.name, a.avatar, v_created, v_awarded
    from public.accounts a where a.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Membaca data
-- ---------------------------------------------------------------------
drop function if exists public.get_account(text);
drop function if exists public.get_my_round_points(uuid, text);

-- Nama + skor + koin untuk token-token milik perangkat ini (maks 10 token per panggilan).
create or replace function public.get_accounts(p_tokens text[])
returns table (account_id uuid, account_name text, account_avatar text, account_score int, account_coins int)
language sql stable security definer as $$
  select a.id, a.name, a.avatar,
         coalesce((select sum(l.delta) from public.point_ledger l
                    where l.account_id = a.id and l.kind = 'game'), 0)::int,
         a.coins
  from public.accounts a
  where a.token_hash in (
    select public.fn_token_hash(t) from unnest(p_tokens[1:10]) t where char_length(t) >= 20
  );
$$;

-- Poin semua pemain di satu game (untuk daftar hasil & kartu bagikan). Pemain guest tidak muncul.
create or replace function public.get_round_points(p_round_id uuid)
returns table (player_id uuid, placement int, chain_bonus int, longest_bonus int, team_bonus int, total int)
language sql stable security definer as $$
  select l.player_id, l.placement, l.chain_bonus, l.longest_bonus, l.team_bonus, l.delta
  from public.point_ledger l
  where l.round_id = p_round_id and l.kind = 'game' and l.player_id is not null;
$$;

-- ---------------------------------------------------------------------
-- Izin
-- ---------------------------------------------------------------------
grant execute on function public.register_account(text, text, text, text, uuid, uuid) to anon, authenticated;
grant execute on function public.get_accounts(text[]) to anon, authenticated;
grant execute on function public.get_round_points(uuid) to anon, authenticated;
revoke execute on function public.fn_award_points(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_apply_host_penalty(text, uuid) from public, anon, authenticated;
