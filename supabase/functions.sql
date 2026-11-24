-- =====================================================================
-- Sambung Suku Kata — RPC Functions (logika game otoritatif)
-- Jalankan SETELAH schema.sql
-- Semua fungsi SECURITY DEFINER agar bisa menulis meski RLS anon read-only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Util: normalisasi kata (huruf kecil, hanya a-z)
-- ---------------------------------------------------------------------
create or replace function public.fn_normalize(word text)
returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(word,'')), '[^a-z]', '', 'g');
$$;

-- ---------------------------------------------------------------------
-- Util: suku kata terakhir sebuah kata.
-- Implementasi pola V/VC/KV/KVK dengan digraf (ng, ny, kh, sy).
-- Menjadi sumber kebenaran tunggal di server untuk target sambung.
-- ---------------------------------------------------------------------
create or replace function public.fn_last_syllable(raw text)
returns text language plpgsql immutable as $$
declare
  w text := public.fn_normalize(raw);
  n int := length(w);
  vowels text := 'aiueo';
  vidx int[] := array[]::int[];
  i int;
  ch text;
  boundaries int[] := array[]::int[];
  v int;
  curv int;
  nextv int;
  gap int;
  pair text;
  last_boundary int := 1;
begin
  if n <= 1 then
    return w;
  end if;

  -- kumpulkan indeks vokal (1-based)
  for i in 1..n loop
    ch := substr(w, i, 1);
    if position(ch in vowels) > 0 then
      vidx := array_append(vidx, i);
    end if;
  end loop;

  if array_length(vidx,1) is null then
    return w; -- tanpa vokal
  end if;

  -- tentukan batas potong di antara tiap pasangan vokal berurutan.
  -- Digraf (ng, ny, kh, sy) diperlakukan sebagai SATU unit konsonan.
  declare
    first_unit_len int;
    remaining int;
  begin
    for v in 1..(array_length(vidx,1)-1) loop
      curv := vidx[v];
      nextv := vidx[v+1];
      gap := nextv - curv - 1;
      if gap <= 1 then
        -- VV atau VCV -> potong sebelum konsonan (termasuk si-nga: ng=1 unit).
        boundaries := array_append(boundaries, curv + 1);
      else
        pair := substr(w, curv + 1, 2);
        if pair in ('ng','ny','kh','sy') then
          first_unit_len := 2;
        else
          first_unit_len := 1;
        end if;
        remaining := gap - first_unit_len;
        if remaining <= 0 then
          -- hanya satu unit konsonan -> V-CV
          boundaries := array_append(boundaries, curv + 1);
        else
          -- ada konsonan lain setelah unit pertama -> VC-CV (mis. tang-ga)
          boundaries := array_append(boundaries, curv + 1 + first_unit_len);
        end if;
      end if;
    end loop;
  end;

  -- suku kata terakhir = dari batas terakhir sampai akhir
  if array_length(boundaries,1) is null then
    return w;
  end if;
  last_boundary := boundaries[array_length(boundaries,1)];
  return substr(w, last_boundary);
end;
$$;

-- ---------------------------------------------------------------------
-- Util: generate kode room unik 6 karakter (tanpa huruf ambigu)
-- ---------------------------------------------------------------------
create or replace function public.fn_gen_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  exists_count int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, floor(random()*length(alphabet))::int + 1, 1);
    end loop;
    select count(*) into exists_count from public.rooms where public.rooms.code = v_code;
    exit when exists_count = 0;
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------
-- create_room: buat room + pemain host
-- ---------------------------------------------------------------------
-- Bersihkan SEMUA overload lama create_room & join_room (termasuk sisa versi
-- dengan parameter yang sudah tidak dipakai, mis. p_as_spectator). Tanpa ini,
-- Postgres bisa menolak panggilan dengan "Could not choose the best candidate
-- function" karena dua signature sama-sama cocok. Keduanya dibuat ulang di bawah.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('create_room', 'join_room')
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- Drop versi lama (tanda tangan berubah: tambah p_max_lives, lalu p_device_id).
drop function if exists public.create_room(text, text, text, int);
drop function if exists public.create_room(text, text, text, int, int);
drop function if exists public.create_room(text, text, text, int, int, text);
drop function if exists public.create_room(text, text, text, int, int, text, text);
create or replace function public.create_room(
  p_name text,
  p_avatar text,
  p_mode text default 'ffa',
  p_timer int default 7,
  p_max_lives int default 1,
  p_device_id text default null,
  p_account_token text default null,
  p_device_key text default null
)
returns table (room_id uuid, room_code text, player_id uuid)
language plpgsql security definer as $$
declare
  v_room_id uuid;
  v_code text;
  v_player_id uuid;
  v_lives int := greatest(1, least(5, coalesce(p_max_lives, 1)));
  -- Akun perangkat (NULL = guest). Lihat migration-v10.sql.
  v_account uuid := public.fn_account_id(p_account_token);
  -- Pemain ber-akun memakai NAMA AKUN (tidak bisa diubah per game); guest memakai p_name.
  v_name text := coalesce((select a.name from public.accounts a where a.id = v_account), p_name);
  -- Hash kunci perangkat (rahasia) = bukti kepemilikan baris pemain. Lihat migration-v12.sql.
  v_key_hash text := case when p_device_key is not null and char_length(p_device_key) >= 20
                          then public.fn_token_hash(p_device_key) end;
begin
  v_code := public.fn_gen_code();
  insert into public.rooms(code, mode, timer_seconds, max_lives, status)
    values (v_code, coalesce(p_mode,'ffa'), coalesce(p_timer,7), v_lives, 'lobby')
    returning id into v_room_id;

  insert into public.players(room_id, name, avatar, is_host, turn_order, lives, device_id, account_id)
    values (v_room_id, v_name, coalesce(p_avatar,'🙂'), true, 0, v_lives, p_device_id, v_account)
    returning id into v_player_id;
  if v_key_hash is not null then
    insert into public.player_keys(player_id, key_hash) values (v_player_id, v_key_hash);
  end if;

  update public.rooms set host_player_id = v_player_id where id = v_room_id;

  return query select v_room_id, v_code, v_player_id;
end;
$$;

-- ---------------------------------------------------------------------
-- join_room: gabung room via kode
-- ---------------------------------------------------------------------
-- Drop versi lama (tanda tangan berubah: tambah p_device_id, lalu p_is_admin).
drop function if exists public.join_room(text, text, text);
drop function if exists public.join_room(text, text, text, text);
drop function if exists public.join_room(text, text, text, text, boolean);
drop function if exists public.join_room(text, text, text, text, boolean, text);
create or replace function public.join_room(
  p_code text,
  p_name text,
  p_avatar text,
  p_device_id text default null,
  p_is_admin boolean default false,
  p_account_token text default null,
  p_device_key text default null
)
returns table (room_id uuid, player_id uuid)
language plpgsql security definer as $$
declare
  v_room public.rooms%rowtype;
  v_player_id uuid;
  v_count int;
  v_existing uuid;
  -- Akun perangkat (NULL = guest). Admin-SSK tidak pernah terhubung ke akun.
  v_account uuid := case when coalesce(p_is_admin, false) then null
                         else public.fn_account_id(p_account_token) end;
  -- Pemain ber-akun memakai NAMA AKUN (tidak bisa diubah per game); guest/admin memakai p_name.
  v_name text := coalesce((select a.name from public.accounts a where a.id = v_account), p_name);
  -- Hash kunci perangkat (rahasia). Lihat migration-v12.sql.
  v_key_hash text := case when p_device_key is not null and char_length(p_device_key) >= 20
                          then public.fn_token_hash(p_device_key) end;
  v_stored_key text;
  v_late boolean;
  v_turn int;
begin
  select * into v_room from public.rooms where public.rooms.code = upper(p_code);
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  -- Room yang sudah selesai/dibubarkan tidak bisa dimasuki.
  if v_room.status = 'finished' then
    raise exception 'ROOM_NOT_JOINABLE';
  end if;
  -- Game sedang berjalan: tetap boleh masuk, tetapi sebagai PENONTON.
  v_late := (v_room.status = 'playing');

  -- Sesi per-device: jika device ini sudah punya pemain di room ini,
  -- kembalikan pemain itu (cegah pemain fiktif / double-join).
  if p_device_id is not null then
    select id into v_existing from public.players
      where public.players.room_id = v_room.id
        and public.players.device_id = p_device_id
      limit 1;
    if v_existing is not null then
      -- device_id itu publik: bila pemain ini punya kunci tersimpan, pemanggil harus
      -- membuktikan kepemilikan (cegah orang lain mengganti nama/akun pemain ini).
      select k.key_hash into v_stored_key from public.player_keys k where k.player_id = v_existing;
      if v_stored_key is not null and v_stored_key is distinct from v_key_hash then
        raise exception 'DEVICE_MISMATCH';
      end if;
      if v_stored_key is null and v_key_hash is not null then
        insert into public.player_keys(player_id, key_hash) values (v_existing, v_key_hash)
          on conflict do nothing;
      end if;
      -- Perbarui nama/avatar bila berubah, lalu kembalikan pemain yang ada.
      update public.players
        set name = v_name, avatar = coalesce(p_avatar, avatar),
            account_id = coalesce(v_account, account_id)
        where id = v_existing;
      return query select v_room.id, v_existing;
      return;
    end if;
  end if;

  if v_late then
    -- Penonton dibatasi total 32 baris per room (16 pemain + penonton).
    select count(*) into v_count from public.players where public.players.room_id = v_room.id;
    if v_count >= 32 then
      raise exception 'ROOM_FULL';
    end if;
  else
    -- Batas 16 hanya untuk pemain; penonton sukarela tidak dihitung.
    select count(*) into v_count from public.players
      where public.players.room_id = v_room.id and not public.players.is_spectator;
    if v_count >= 16 then
      raise exception 'ROOM_FULL';
    end if;
  end if;

  -- turn_order = urutan terbesar + 1 (tidak bergantung jumlah baris).
  select coalesce(max(public.players.turn_order), -1) + 1 into v_turn
    from public.players where public.players.room_id = v_room.id;

  insert into public.players(room_id, name, avatar, turn_order, lives, device_id, is_admin, account_id,
                             is_spectator, joined_late, is_alive)
    values (v_room.id, v_name, coalesce(p_avatar,'🙂'), v_turn, v_room.max_lives, p_device_id,
            coalesce(p_is_admin, false), v_account, v_late, v_late, not v_late)
    returning id into v_player_id;
  if v_key_hash is not null then
    insert into public.player_keys(player_id, key_hash) values (v_player_id, v_key_hash);
  end if;

  return query select v_room.id, v_player_id;
end;
$$;

-- ---------------------------------------------------------------------
-- set_room_settings: host ubah mode, timer & nyawa di lobby
-- ---------------------------------------------------------------------
-- Drop versi lama (tanda tangan berubah: tambah p_max_lives).
drop function if exists public.set_room_settings(uuid, uuid, text, int);
create or replace function public.set_room_settings(
  p_room_id uuid,
  p_player_id uuid,
  p_mode text,
  p_timer int,
  p_max_lives int default null
)
returns void language plpgsql security definer as $$
declare
  v_room public.rooms%rowtype;
  v_lives int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_player_id <> p_player_id then raise exception 'NOT_HOST'; end if;
  if v_room.status <> 'lobby' then raise exception 'NOT_LOBBY'; end if;

  v_lives := case when p_max_lives is null then v_room.max_lives
                  else greatest(1, least(5, p_max_lives)) end;

  update public.rooms
    set mode = coalesce(p_mode, mode),
        timer_seconds = coalesce(p_timer, timer_seconds),
        max_lives = v_lives
    where id = p_room_id;

  -- Sinkronkan nyawa semua pemain dengan setting terbaru (masih di lobby).
  update public.players set lives = v_lives where public.players.room_id = p_room_id;
end;
$$;

-- ---------------------------------------------------------------------
-- assign_team: host atur tim seorang pemain (mode tim)
-- ---------------------------------------------------------------------
create or replace function public.upsert_team(
  p_room_id uuid,
  p_player_id uuid,
  p_name text,
  p_color text
)
returns uuid language plpgsql security definer as $$
declare
  v_room public.rooms%rowtype;
  v_team_id uuid;
  v_order int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.host_player_id <> p_player_id then raise exception 'NOT_HOST'; end if;

  select coalesce(max(turn_order)+1,0) into v_order from public.teams where room_id = p_room_id;
  insert into public.teams(room_id, name, color, turn_order)
    values (p_room_id, p_name, coalesce(p_color,'#A5B4FC'), v_order)
    returning id into v_team_id;
  return v_team_id;
end;
$$;

create or replace function public.assign_player_team(
  p_room_id uuid,
  p_host_id uuid,
  p_target_player uuid,
  p_team_id uuid
)
returns void language plpgsql security definer as $$
declare v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.host_player_id <> p_host_id then raise exception 'NOT_HOST'; end if;
  -- Penonton tidak bisa dimasukkan ke tim.
  update public.players set team_id = p_team_id
    where id = p_target_player and room_id = p_room_id and not is_spectator;
end;
$$;

-- ---------------------------------------------------------------------
-- set_spectator: pemain/host berpindah antara PEMAIN <-> PENONTON (hanya di lobby).
-- Penonton ikut berada di room & menonton game, tetapi tidak ikut giliran,
-- tidak dihitung pemain hidup, tidak punya tim, dan tidak mendapat poin.
-- ---------------------------------------------------------------------
create or replace function public.set_spectator(
  p_room_id uuid,
  p_player_id uuid,
  p_spectator boolean
)
returns void language plpgsql security definer as $$
declare
  v_room public.rooms%rowtype;
  v_cnt int;
  v_turn int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'lobby' then raise exception 'NOT_LOBBY'; end if;
  if not exists (select 1 from public.players where id = p_player_id and room_id = p_room_id) then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  if coalesce(p_spectator, false) then
    update public.players
      set is_spectator = true, joined_late = false, is_alive = false, team_id = null
      where id = p_player_id;
  else
    select count(*) into v_cnt from public.players
      where room_id = p_room_id and not is_spectator and id <> p_player_id;
    if v_cnt >= 16 then raise exception 'ROOM_FULL'; end if;
    select coalesce(max(turn_order), -1) + 1 into v_turn
      from public.players where room_id = p_room_id and not is_spectator;
    update public.players
      set is_spectator = false, joined_late = false, is_alive = true, turn_order = v_turn
      where id = p_player_id;
  end if;
end;
$$;

-- remove_player_team: host keluarkan pemain dari tim (team_id jadi null).
create or replace function public.remove_player_team(
  p_room_id uuid,
  p_host_id uuid,
  p_target_player uuid
)
returns void language plpgsql security definer as $$
declare v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.host_player_id <> p_host_id then raise exception 'NOT_HOST'; end if;
  update public.players set team_id = null
    where id = p_target_player and room_id = p_room_id;
end;
$$;

-- kick_player: host mengeluarkan pemain dari room (hanya di lobby).
-- Pemain yang di-kick bisa join lagi (tidak ada blokir permanen).
create or replace function public.kick_player(
  p_room_id uuid,
  p_host_id uuid,
  p_target_player uuid
)
returns void language plpgsql security definer as $$
declare v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_player_id <> p_host_id then raise exception 'NOT_HOST'; end if;
  if v_room.status <> 'lobby' then raise exception 'NOT_LOBBY'; end if;
  if p_target_player = p_host_id then raise exception 'CANT_KICK_HOST'; end if;
  if exists (
    select 1 from public.players
    where id = p_target_player and room_id = p_room_id and is_admin
  ) then
    raise exception 'CANT_KICK_ADMIN';
  end if;
  delete from public.players where id = p_target_player and room_id = p_room_id;
end;
$$;

-- leave_room: pemain (bukan host) keluar dari room sendiri (di lobby).
create or replace function public.leave_room(
  p_room_id uuid,
  p_player_id uuid
)
returns void language plpgsql security definer as $$
declare v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then return; end if;
  -- Host tidak pakai ini (host pakai cancel_room). Abaikan jika host.
  if v_room.host_player_id = p_player_id then raise exception 'HOST_USE_CANCEL'; end if;
  delete from public.players where id = p_player_id and room_id = p_room_id;
end;
$$;

-- set_connected: perbarui status koneksi pemain (dipakai presence klien).
create or replace function public.set_connected(
  p_player_id uuid,
  p_connected boolean
)
returns void language plpgsql security definer as $$
begin
  update public.players set connected = p_connected where id = p_player_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Util internal: tentukan subject giliran pertama & set deadline
-- ---------------------------------------------------------------------
-- Drop dulu karena struktur return berubah dari versi sebelumnya (record -> OUT params).
drop function if exists public.fn_pick_first_subject(uuid);
create or replace function public.fn_pick_first_subject(
  p_room_id uuid,
  out subject_id uuid,
  out team_id uuid
)
language plpgsql as $$
declare
  v_room public.rooms%rowtype;
  v_team uuid;  -- variabel lokal agar tidak ambigu dengan kolom players.team_id
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.mode = 'ffa' then
    -- Pemain pembuka dipilih ACAK dari semua pemain hidup (bukan selalu turn_order 0).
    select id into subject_id from public.players
      where public.players.room_id = p_room_id and is_alive
      order by random() limit 1;
    team_id := null;
  else
    -- Tim pembuka dipilih acak, lalu anggota tim juga acak.
    select id into v_team from public.teams
      where public.teams.room_id = p_room_id
      order by random() limit 1;
    select id into subject_id from public.players
      where public.players.room_id = p_room_id and public.players.team_id = v_team and is_alive
      order by random() limit 1;
    team_id := v_team;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- start_game: host mulai permainan, buat ronde pertama
-- ---------------------------------------------------------------------
create or replace function public.start_game(
  p_room_id uuid,
  p_player_id uuid,
  p_starting_word text
)
returns uuid language plpgsql security definer as $$
declare
  v_room public.rooms%rowtype;
  v_count int;
  v_round_id uuid;
  v_req text;
  v_first record;
  v_locked_until timestamptz;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_player_id <> p_player_id then raise exception 'NOT_HOST'; end if;
  if v_room.status <> 'lobby' then raise exception 'ALREADY_STARTED'; end if;

  -- Penalti host (v11): tidak bisa memulai game selama masa kunci. Pesan: HOST_LOCKED:<detik>
  select hp.locked_until into v_locked_until
    from public.host_penalties hp
    join public.players hpl on hpl.device_id = hp.device_id
   where hpl.id = p_player_id;
  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'HOST_LOCKED:%', ceil(extract(epoch from (v_locked_until - now())))::int;
  end if;

  -- Penonton tidak dihitung sebagai peserta.
  select count(*) into v_count from public.players
    where room_id = p_room_id and not is_spectator;
  if v_count < 2 then raise exception 'NEED_MIN_2_PLAYERS'; end if;

  -- mode tim: pastikan minimal 2 tim dan tiap pemain (bukan penonton) punya tim
  if v_room.mode = 'team' then
    if (select count(*) from public.teams where room_id = p_room_id) < 2 then
      raise exception 'NEED_MIN_2_TEAMS';
    end if;
    if exists (select 1 from public.players
                where room_id = p_room_id and team_id is null and not is_spectator) then
      raise exception 'PLAYER_WITHOUT_TEAM';
    end if;
  end if;

  -- reset status hidup + isi ulang nyawa + reset urutan eliminasi.
  -- Penonton tetap tidak hidup (is_alive=false) sehingga tidak masuk giliran/cek menang.
  update public.players
    set is_alive = not is_spectator, lives = v_room.max_lives, eliminated_order = null,
        turn_done = false
    where room_id = p_room_id;
  update public.teams set eliminated_order = null where room_id = p_room_id;

  v_req := public.fn_last_syllable(p_starting_word);
  select * into v_first from public.fn_pick_first_subject(p_room_id);
  update public.players set turn_done = true where id = v_first.subject_id;

  -- Giliran pertama diberi tambahan 5 detik "grace" untuk menutupi hitung
  -- mundur 5 detik di klien, agar waktu pemain pertama tidak terpotong.
  insert into public.rounds(
    room_id, starting_word, current_word, required_syllable, full_syllable,
    relaxed, consecutive_fails, relax_threshold,
    active_subject_id, active_team_id, turn_started_at, turn_deadline, status
  ) values (
    p_room_id, public.fn_normalize(p_starting_word), public.fn_normalize(p_starting_word), v_req, v_req,
    false, 0, public.fn_relax_threshold(p_room_id),
    v_first.subject_id, v_first.team_id, now(),
    now() + make_interval(secs => v_room.timer_seconds + 5), 'active'
  ) returning id into v_round_id;

  insert into public.used_words(round_id, word) values (v_round_id, public.fn_normalize(p_starting_word));

  update public.rooms set status = 'playing', current_round_id = v_round_id where id = p_room_id;
  return v_round_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Util internal: lanjut giliran berikutnya (tanpa cek menang)
--
-- BUKTI CAKUPAN GILIRAN (semua pemain dapat 1 giliran per putaran):
--   Rotasi TIDAK lagi mengandalkan turn_order yang unik/kontigu. Dulu
--   `turn_order > v_cur_order` mengasumsikan urutan unik 0..n-1; padahal
--   join_room mengisi turn_order = jumlah pemain saat itu, sehingga setelah
--   ada yang keluar/di-kick di lobby seorang joiner baru bisa mendapat
--   turn_order DUPLIKAT. Dengan duplikat di nilai tertinggi, perbandingan
--   `>` tidak pernah bisa memilih pemegang kedua, jadi 1 pemain (biasanya
--   turn_order terbesar / pemain "terakhir") terlewat tiap putaran.
--
--   Perbaikan: urutkan pemain hidup secara deterministik pada TUPEL
--   (turn_order, id) — id (uuid) unik sehingga tupel ini PASTI unik dan
--   total-order, bahkan jika turn_order punya duplikat atau celah. "Next"
--   adalah tupel terkecil yang strictly greater dari tupel pemain saat ini;
--   jika tidak ada (pemain saat ini adalah tupel terbesar), wrap ke tupel
--   terkecil. Relasi successor pada N elemen yang terurut total + wrap
--   membentuk SATU siklus tunggal yang mengunjungi tiap pemain hidup tepat
--   sekali per putaran — tidak ada yang terlewat, tidak ada yang dobel.
--   (Analog sama diterapkan ke rotasi TIM pada tupel (teams.turn_order, id).)
--   Pembuka tetap ACAK karena dipilih oleh fn_pick_first_subject
--   (order by random()), yang sengaja TIDAK diubah di sini.
-- ---------------------------------------------------------------------
create or replace function public.fn_advance_turn(p_round_id uuid)
returns void language plpgsql as $$
declare
  v_round public.rounds%rowtype;
  v_room public.rooms%rowtype;
  v_next_subject uuid;
  v_next_team uuid;
  v_cur_order int;
  v_cur_id uuid;
  v_cur_team_order int;
  v_cur_team_id uuid;
begin
  select * into v_round from public.rounds where id = p_round_id;
  select * into v_room from public.rooms where id = v_round.room_id;

  if v_room.mode = 'ffa' then
    -- cari pemain hidup berikutnya pada tupel (turn_order, id) (wrap-around).
    -- id unik membuat tupel total-order meski turn_order duplikat/bercelah.
    select turn_order, id into v_cur_order, v_cur_id
      from public.players where id = v_round.active_subject_id;
    select id into v_next_subject from public.players
      where room_id = v_room.id and is_alive
        and (turn_order, id) > (v_cur_order, v_cur_id)
      order by turn_order asc, id asc limit 1;
    if v_next_subject is null then
      select id into v_next_subject from public.players
        where room_id = v_room.id and is_alive
        order by turn_order asc, id asc limit 1;
    end if;
    v_next_team := null;
  else
    -- pindah ke tim berikutnya (yang masih punya anggota hidup) pada tupel
    -- (turn_order, id) dengan wrap-around, sama tangguhnya dengan FFA.
    select turn_order, id into v_cur_team_order, v_cur_team_id
      from public.teams where id = v_round.active_team_id;
    select t.id into v_next_team from public.teams t
      where t.room_id = v_room.id
        and (t.turn_order, t.id) > (v_cur_team_order, v_cur_team_id)
        and exists (select 1 from public.players p where p.team_id = t.id and p.is_alive)
      order by t.turn_order asc, t.id asc limit 1;
    if v_next_team is null then
      select t.id into v_next_team from public.teams t
        where t.room_id = v_room.id
          and exists (select 1 from public.players p where p.team_id = t.id and p.is_alive)
        order by t.turn_order asc, t.id asc limit 1;
    end if;
    -- acak anggota hidup tim tsb yang BELUM dapat giliran di siklus tim ini;
    -- bila semua sudah main, mulai siklus baru (reset penanda). Dengan begitu
    -- tiap anggota main sekali per siklus walau ukuran tim berbeda (3 vs 4).
    if not exists (select 1 from public.players
                    where team_id = v_next_team and is_alive and not turn_done) then
      update public.players set turn_done = false where team_id = v_next_team;
    end if;
    select id into v_next_subject from public.players
      where team_id = v_next_team and is_alive and not turn_done
      order by random() limit 1;
    update public.players set turn_done = true where id = v_next_subject;
  end if;

  update public.rounds
    set active_subject_id = v_next_subject,
        active_team_id = v_next_team,
        turn_started_at = now(),
        turn_deadline = now() + make_interval(secs => v_room.timer_seconds)
    where id = p_round_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Util internal: cek kondisi menang; set finished bila tercapai.
-- return true jika game selesai.
-- ---------------------------------------------------------------------
create or replace function public.fn_check_win(p_round_id uuid)
returns boolean language plpgsql as $$
declare
  v_round public.rounds%rowtype;
  v_room public.rooms%rowtype;
  v_alive int;
  v_winner uuid;
  v_alive_teams int;
  v_winner_team uuid;
begin
  select * into v_round from public.rounds where id = p_round_id;
  select * into v_room from public.rooms where id = v_round.room_id;

  if v_room.mode = 'ffa' then
    select count(*) into v_alive from public.players where room_id = v_room.id and is_alive;
    if v_alive <= 1 then
      select id into v_winner from public.players where room_id = v_room.id and is_alive limit 1;
      update public.rounds set status='finished', winner_player_id=v_winner where id=p_round_id;
      update public.rooms set status='finished' where id=v_room.id;
      perform public.fn_award_points(p_round_id);  -- poin hanya untuk selesai alami (v11)
      return true;
    end if;
  else
    select count(*) into v_alive_teams from public.teams t
      where t.room_id = v_room.id
        and exists (select 1 from public.players p where p.team_id = t.id and p.is_alive);
    if v_alive_teams <= 1 then
      select t.id into v_winner_team from public.teams t
        where t.room_id = v_room.id
          and exists (select 1 from public.players p where p.team_id = t.id and p.is_alive)
        limit 1;
      update public.rounds set status='finished', winner_team_id=v_winner_team where id=p_round_id;
      update public.rooms set status='finished' where id=v_room.id;
      perform public.fn_award_points(p_round_id);  -- poin hanya untuk selesai alami (v11)
      return true;
    end if;
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_handle_timeout: pemain gagal menjawab tepat waktu.
-- Kurangi 1 nyawa. Jika nyawa habis (<=0) -> eliminasi (is_alive=false).
-- Selalu lanjut giliran berikutnya (kecuali game sudah selesai).
-- Mengembalikan json ringkas untuk info klien.
-- ---------------------------------------------------------------------
create or replace function public.fn_handle_timeout(p_round_id uuid, p_player_id uuid)
returns json language plpgsql as $$
declare
  v_lives int;
  v_eliminated boolean := false;
  v_finished boolean := false;
  v_round public.rounds%rowtype;
  v_full text;
  v_relaxed_now boolean := false;
  v_room_id uuid;
  v_team_id uuid;
  v_next_order int;
  v_team_alive int;
begin
  insert into public.moves(round_id, player_id, word, is_valid, reason)
    values (p_round_id, p_player_id, '', false, 'timeout');

  update public.players
    set lives = greatest(0, lives - 1)
    where id = p_player_id
    returning lives, room_id, team_id into v_lives, v_room_id, v_team_id;

  if coalesce(v_lives, 0) <= 0 then
    -- Catat urutan eliminasi pemain (untuk peringkat "bertahan terlama").
    select coalesce(max(eliminated_order), 0) + 1 into v_next_order
      from public.players where room_id = v_room_id;
    update public.players
      set is_alive = false, eliminated_order = v_next_order
      where id = p_player_id;
    v_eliminated := true;

    -- Mode tim: jika tim ini kehabisan anggota hidup, catat urutan eliminasi tim.
    if v_team_id is not null then
      select count(*) into v_team_alive
        from public.players where team_id = v_team_id and is_alive;
      if v_team_alive = 0 then
        select coalesce(max(eliminated_order), 0) + 1 into v_next_order
          from public.teams where room_id = v_room_id;
        update public.teams set eliminated_order = v_next_order where id = v_team_id;
      end if;
    end if;

    v_finished := public.fn_check_win(p_round_id);
  end if;

  -- Keringanan: hitung kegagalan berturut-turut pada target yang sama.
  -- Ambang pemicu bersifat DINAMIS (relax_threshold), diacak per target
  -- berdasarkan jumlah pemain bertahan. Setelah tercapai, longgarkan target
  -- jadi 1 huruf terakhir (sekali).
  if not v_finished then
    select * into v_round from public.rounds where id = p_round_id;

    -- Eliminasi barusan bisa menurunkan jumlah pemain/tim bertahan. Bila ambang
    -- lama kini melebihi batas atas baru (n-1), acak ulang di rentang yang baru
    -- (mis. sisa 2 => ambang 1). Ambang yang masih di dalam rentang dibiarkan.
    if v_round.relax_threshold > greatest(1, public.fn_relax_n(v_room_id) - 1) then
      update public.rounds
        set relax_threshold = public.fn_relax_threshold(v_room_id)
        where id = p_round_id;
    end if;

    update public.rounds
      set consecutive_fails = consecutive_fails + 1
      where id = p_round_id
      returning * into v_round;

    -- Syarat "masih bisa dilonggarkan" = target masih > 1 huruf. Jadi keringanan
    -- karena gagal tetap berlaku walau target sudah dipangkas keringanan kamus
    -- (keduanya saling menambah, bukan saling menggantikan).
    if v_round.consecutive_fails >= v_round.relax_threshold
       and char_length(v_round.required_syllable) > 1 then
      v_full := coalesce(v_round.full_syllable, v_round.required_syllable);
      update public.rounds
        set relaxed = true,
            full_syllable = v_full,
            required_syllable = right(v_full, 1)  -- turun ke 1 huruf terakhir
        where id = p_round_id;
      v_relaxed_now := true;
    end if;

    perform public.fn_advance_turn(p_round_id);

    -- Bila baru saja dilonggarkan, beri "hold" 3 detik (timer ditahan) agar
    -- pemain berikutnya sempat membaca pop-up keringanan.
    if v_relaxed_now then
      update public.rounds
        set turn_deadline = turn_deadline + make_interval(secs => 3)
        where id = p_round_id;
    end if;
  end if;

  return json_build_object(
    'ok', false, 'reason', 'timeout',
    'lives_left', coalesce(v_lives, 0),
    'eliminated', v_eliminated,
    'finished', v_finished,
    'relaxed', v_relaxed_now
  );
end;
$$;

-- ---------------------------------------------------------------------
-- submit_word: pemain submit kata. p_in_dict ditentukan klien dari kamus
-- (kamus ada di sisi klien). Validasi sambung & duplikat & deadline di server.
-- ---------------------------------------------------------------------
create or replace function public.submit_word(
  p_round_id uuid,
  p_player_id uuid,
  p_word text,
  p_in_dict boolean
)
returns json language plpgsql security definer as $$
declare
  v_round public.rounds%rowtype;
  v_norm text;
  v_reason text;
  v_next_syl text;
  v_fit text;
  v_finished boolean;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found or v_round.status <> 'active' then
    return json_build_object('ok', false, 'reason', 'inactive');
  end if;
  if v_round.active_subject_id <> p_player_id then
    return json_build_object('ok', false, 'reason', 'not_your_turn');
  end if;

  -- cek deadline (otoritatif di server)
  if now() > v_round.turn_deadline then
    -- timeout: kurangi nyawa / eliminasi via helper
    return public.fn_handle_timeout(p_round_id, p_player_id);
  end if;

  v_norm := public.fn_normalize(p_word);

  -- validasi sambung (server otoritatif: kamus & anti-buntu dicek di DB).
  -- Catatan: p_in_dict dari klien diabaikan; kebenaran ada di tabel dictionary.
  if position(v_round.required_syllable in v_norm) <> 1 then
    v_reason := 'chain';
  elsif not public.fn_in_dict(v_norm) then
    v_reason := 'dict';
  elsif exists (select 1 from public.used_words where round_id = p_round_id and word = v_norm) then
    v_reason := 'dupe';
  else
    v_reason := null;
  end if;

  -- Anti-buntu (dilonggarkan): kata diterima selama HURUF TERAKHIRNYA masih
  -- punya lanjutan di kamus. Kalau suku kata penuh buntu, permainan akan
  -- otomatis memberi keringanan (turun ke 1 huruf) setelah 2 kegagalan,
  -- jadi kata tidak perlu ditolak selama fallback 1-huruf masih hidup.
  if v_reason is null then
    v_next_syl := public.fn_last_syllable(v_norm);
    if not public.fn_has_continuation(p_round_id, right(v_next_syl, 1)) then
      v_reason := 'deadend';
    end if;
  end if;

  if v_reason is not null then
    -- submit salah: catat, TAPI jangan eliminasi (pemain bisa coba lagi selama timer jalan)
    insert into public.moves(round_id, player_id, word, is_valid, reason)
      values (p_round_id, p_player_id, v_norm, false, v_reason);
    return json_build_object('ok', false, 'reason', v_reason);
  end if;

  -- valid: reset keringanan, target kembali ke suku kata penuh dari kata baru.
  insert into public.moves(round_id, player_id, word, is_valid, reason)
    values (p_round_id, p_player_id, v_norm, true, null);
  insert into public.used_words(round_id, word) values (p_round_id, v_norm);

  -- Keringanan kamus: bila suku kata penuh tak punya kata (belum terpakai) di
  -- kamus, buang huruf depan satu per satu (min. 1 huruf) -> relaxed otomatis.
  v_fit := public.fn_fit_syllable(p_round_id, v_next_syl);

  update public.rounds
    set current_word = v_norm,
        required_syllable = v_fit,
        full_syllable = v_next_syl,
        relaxed = (v_fit <> v_next_syl),
        consecutive_fails = 0,
        -- Acak ulang ambang keringanan untuk target baru (berdasar jumlah
        -- pemain yang masih bertahan saat ini).
        relax_threshold = public.fn_relax_threshold(v_round.room_id)
    where id = p_round_id;

  perform public.fn_advance_turn(p_round_id);

  -- Hold 3 detik untuk pop-up keringanan (sama seperti keringanan dari timeout).
  if v_fit <> v_next_syl then
    update public.rounds
      set turn_deadline = turn_deadline + make_interval(secs => 3)
      where id = p_round_id;
  end if;
  return json_build_object('ok', true, 'relaxed', v_fit <> v_next_syl);
end;
$$;

-- ---------------------------------------------------------------------
-- resolve_timeout: dipanggil klien saat deadline lewat & belum ada submit.
-- Idempoten: hanya bertindak bila memang sudah lewat deadline.
-- ---------------------------------------------------------------------
create or replace function public.resolve_timeout(p_round_id uuid)
returns json language plpgsql security definer as $$
declare
  v_round public.rounds%rowtype;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found or v_round.status <> 'active' then
    return json_build_object('ok', false, 'reason', 'inactive');
  end if;
  if now() <= v_round.turn_deadline then
    return json_build_object('ok', false, 'reason', 'not_yet');
  end if;

  -- Gunakan helper yang sama: kurangi nyawa / eliminasi, lalu lanjut giliran.
  return public.fn_handle_timeout(p_round_id, v_round.active_subject_id);
end;
$$;

-- ---------------------------------------------------------------------
-- play_again: host reset room ke lobby untuk ronde baru
-- ---------------------------------------------------------------------
create or replace function public.play_again(p_room_id uuid, p_player_id uuid)
returns void language plpgsql security definer as $$
declare v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.host_player_id <> p_player_id then raise exception 'NOT_HOST'; end if;

  -- Penonton yang masuk saat game berjalan (joined_late) naik jadi pemain untuk
  -- ronde berikutnya. Penonton sukarela tetap penonton sampai mengubahnya sendiri.
  with mx as (
    select coalesce(max(turn_order), -1) as m
      from public.players where room_id = p_room_id and not is_spectator
  ), late as (
    select id, row_number() over (order by joined_at, id) as rn
      from public.players
      where room_id = p_room_id and is_spectator and joined_late
  )
  update public.players p
    set is_spectator = false, joined_late = false, turn_order = (select m from mx) + late.rn
    from late
    where p.id = late.id;

  update public.players
    set is_alive = not is_spectator, lives = v_room.max_lives, eliminated_order = null
    where room_id = p_room_id;
  update public.teams set eliminated_order = null where room_id = p_room_id;
  update public.rooms set status='lobby', current_round_id=null where id=p_room_id;
end;
$$;

-- ---------------------------------------------------------------------
-- end_game: host akhiri sesi permainan kapan saja (room -> finished).
-- Pemenang = pemain/tim hidup terbanyak nyawanya (bila ada), else null.
-- ---------------------------------------------------------------------
drop function if exists public.end_game(uuid, uuid);
create or replace function public.end_game(p_room_id uuid, p_player_id uuid)
returns json language plpgsql security definer as $$
declare
  v_room public.rooms%rowtype;
  v_winner uuid;
  v_winner_team uuid;
  v_put int := 0;
  v_dev text;
  v_acc uuid;
  v_pen json;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_player_id <> p_player_id then raise exception 'NOT_HOST'; end if;
  -- Idempoten: hanya game yang sedang berjalan yang bisa diakhiri (cegah penalti ganda).
  if v_room.status <> 'playing' then return json_build_object('ended', false); end if;

  if v_room.current_round_id is not null then
    v_put := public.fn_putaran(v_room.current_round_id);
    if v_room.mode = 'ffa' then
      select id into v_winner from public.players
        where public.players.room_id = p_room_id and is_alive
        order by lives desc limit 1;
      update public.rounds set status='finished', winner_player_id=v_winner, ended_by_host=true
        where id = v_room.current_round_id;
    else
      select t.id into v_winner_team from public.teams t
        where t.room_id = p_room_id
          and exists (select 1 from public.players p where p.team_id = t.id and p.is_alive)
        limit 1;
      update public.rounds set status='finished', winner_team_id=v_winner_team, ended_by_host=true
        where id = v_room.current_round_id;
    end if;
  end if;

  update public.rooms set status='finished' where id = p_room_id;

  -- Diakhiri host: TANPA poin untuk siapa pun. Penalti hanya bila sudah > free_putaran putaran (v11).
  if v_put > public.fn_pts_cfg('free_putaran') then
    select device_id, account_id into v_dev, v_acc from public.players where id = p_player_id;
    v_pen := public.fn_apply_host_penalty(v_dev, v_acc);
  end if;

  return json_build_object(
    'ended', true,
    'putaran', v_put,
    'penalty', coalesce(v_pen, json_build_object('stage', 'none', 'lock_seconds', 0, 'points_deducted', 0))
  );
end;
$$;

-- ---------------------------------------------------------------------
-- cancel_room: host membatalkan/membubarkan room dari lobby.
-- Set status 'finished' agar semua klien keluar ke halaman akhir/awal.
-- (Tidak menghapus baris agar klien yang sedang melihat tidak error;
--  room kosong akan hilang sendiri seiring waktu / bisa dibersihkan berkala.)
-- ---------------------------------------------------------------------
create or replace function public.cancel_room(p_room_id uuid, p_player_id uuid)
returns void language plpgsql security definer as $$
declare v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  -- Host ATAU admin (Admin-SSK) boleh membubarkan room.
  if v_room.host_player_id <> p_player_id
     and not exists (
       select 1 from public.players
       where id = p_player_id and room_id = p_room_id and is_admin
     )
  then raise exception 'NOT_HOST'; end if;
  update public.rooms set status='finished', current_round_id=null where id = p_room_id;
end;
$$;

-- =====================================================================
-- Izin eksekusi RPC untuk anon & authenticated
-- =====================================================================
grant execute on all functions in schema public to anon, authenticated;

-- Fungsi internal poin/penalti (v11) tidak boleh dipanggil langsung oleh klien.
do $$
begin
  if to_regprocedure('public.fn_award_points(uuid, uuid)') is not null then
    revoke execute on function public.fn_award_points(uuid, uuid) from public, anon, authenticated;
    revoke execute on function public.fn_apply_host_penalty(text, uuid) from public, anon, authenticated;
    revoke execute on function public.fn_penalty_next(text) from public, anon, authenticated;
    revoke execute on function public.fn_putaran(uuid) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.fn_compute_round_results(uuid)') is not null then
    revoke execute on function public.fn_compute_round_results(uuid) from public, anon, authenticated;
  end if;
end $$;
