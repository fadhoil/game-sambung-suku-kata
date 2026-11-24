-- =====================================================================
-- Sambung Suku Kata — Migration v16
--  (1) Mode tim: pemain tiap tim dapat giliran merata (kolom players.turn_done).
--  (2) Ambang keringanan mode tim dihitung dari JUMLAH TIM yang masih hidup
--      (FFA tetap dari jumlah pemain hidup). Menimpa fn_relax_threshold (v8).
--  (3) Keringanan otomatis bila suku kata sambung tidak punya kata di kamus:
--      fn_fit_syllable membuang huruf depan satu per satu (min. 1 huruf).
--  (4) Inventory emoji: 3 slot per akun (account_emoji_slots) + RPC.
--
-- URUTAN DEPLOY: file ini -> functions.sql -> deploy Vercel.
-- Prasyarat: migration-v15.sql. Aman diulang.
-- =====================================================================

-- (1) Penanda "sudah dapat giliran di siklus tim ini". Direset otomatis saat
-- semua anggota hidup satu tim sudah main, dan saat start_game.
alter table public.players
  add column if not exists turn_done boolean not null default false;

-- (2) Ambang keringanan: acak 1..(n-1), n = tim hidup (mode tim) / pemain hidup (FFA).
create or replace function public.fn_relax_threshold(p_room_id uuid)
returns int language plpgsql as $$
declare
  v_mode text;
  v_n int;
  v_max int;
begin
  select mode into v_mode from public.rooms where id = p_room_id;

  if v_mode = 'team' then
    select count(*) into v_n from public.teams t
      where t.room_id = p_room_id
        and exists (select 1 from public.players p where p.team_id = t.id and p.is_alive);
  else
    select count(*) into v_n from public.players
      where room_id = p_room_id and is_alive;
  end if;

  v_max := greatest(1, coalesce(v_n, 2) - 1);
  return 1 + floor(random() * v_max)::int;
end;
$$;

grant execute on function public.fn_relax_threshold(uuid) to anon, authenticated;

-- (3) Target terpanjang yang masih punya lanjutan (belum terpakai) di kamus.
-- Huruf DEPAN dibuang satu per satu (sejalan dengan keringanan lama: -UR -> -R),
-- berhenti di 1 huruf. Jalankan SETELAH kata baru masuk used_words.
create or replace function public.fn_fit_syllable(p_round_id uuid, p_syllable text)
returns text language plpgsql stable as $$
declare
  v text := p_syllable;
begin
  while char_length(v) > 1 and not public.fn_has_continuation(p_round_id, v) loop
    v := substr(v, 2);
  end loop;
  return v;
end;
$$;

grant execute on function public.fn_fit_syllable(uuid, text) to anon, authenticated;

-- (4) Slot emoji. FK komposit ke account_emojis => hanya emoji yang DIMILIKI
-- yang bisa dipasang; unique (account_id, emoji_id) => satu emoji hanya di satu slot.
create table if not exists public.account_emoji_slots (
  account_id uuid not null,
  slot smallint not null check (slot between 1 and 3),
  emoji_id uuid not null,
  primary key (account_id, slot),
  unique (account_id, emoji_id),
  foreign key (account_id, emoji_id)
    references public.account_emojis (account_id, emoji_id) on delete cascade
);
alter table public.account_emoji_slots enable row level security;  -- tanpa policy: hanya lewat RPC

-- Emoji milik akun (termasuk yang disembunyikan dari toko) + slot terpasang (null = belum).
create or replace function public.list_my_emojis(p_token text)
returns table (id uuid, name text, image_path text, sound_path text, slot smallint)
language sql stable security definer as $$
  select e.id, e.name, e.image_path, e.sound_path, s.slot
  from public.account_emojis ae
  join public.emojis e on e.id = ae.emoji_id
  left join public.account_emoji_slots s
         on s.account_id = ae.account_id and s.emoji_id = ae.emoji_id
  where ae.account_id = public.fn_account_id(p_token)
  order by ae.purchased_at desc;
$$;

-- Pasang emoji ke slot 1..3; p_emoji_id null = kosongkan slot. Emoji yang sama
-- di slot lain otomatis dipindah. Galat: NOT_LOGGED_IN, INVALID_SLOT, NOT_OWNED.
create or replace function public.set_emoji_slot(p_token text, p_slot int, p_emoji_id uuid)
returns void language plpgsql security definer as $$
declare
  v_acc uuid := public.fn_account_id(p_token);
begin
  if v_acc is null then raise exception 'NOT_LOGGED_IN'; end if;
  if p_slot is null or p_slot not between 1 and 3 then raise exception 'INVALID_SLOT'; end if;
  if p_emoji_id is not null and not exists (
    select 1 from public.account_emojis where account_id = v_acc and emoji_id = p_emoji_id
  ) then raise exception 'NOT_OWNED'; end if;

  delete from public.account_emoji_slots
   where account_id = v_acc and (slot = p_slot or emoji_id = p_emoji_id);
  if p_emoji_id is not null then
    insert into public.account_emoji_slots(account_id, slot, emoji_id)
      values (v_acc, p_slot, p_emoji_id);
  end if;
end;
$$;

grant execute on function public.list_my_emojis(text) to anon, authenticated;
grant execute on function public.set_emoji_slot(text, int, uuid) to anon, authenticated;
