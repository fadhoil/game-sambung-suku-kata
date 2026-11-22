-- =====================================================================
-- Sambung Suku Kata — Migration v10
-- Akun pemain berbasis perangkat (device).
--
-- Konsep:
--  * Perangkat yang mendaftar mendapat TOKEN acak (disimpan di localStorage
--    klien, key "ssk:account"). Server hanya menyimpan HASH SHA-256 token itu.
--  * Token sengaja TERPISAH dari players.device_id, karena device_id terbaca
--    publik lewat policy select pada tabel players (dibutuhkan realtime).
--  * Tabel accounts diaktifkan RLS TANPA policy -> anon tidak bisa baca/tulis
--    langsung. Semua akses lewat RPC SECURITY DEFINER di bawah.
--  * players.account_id menautkan baris pemain (per-room) ke akun. Diisi oleh
--    create_room / join_room / register_account.
--
-- URUTAN DEPLOY: jalankan file ini + functions.sql di Supabase SQL Editor
-- LEBIH DULU, baru deploy frontend di Vercel. (Aman diulang.)
-- =====================================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  name text not null check (char_length(name) between 1 and 16),
  avatar text not null default '🙂',
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
-- (sengaja tanpa policy apa pun)

alter table public.players
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
create index if not exists idx_players_account on public.players(account_id);

-- ---------------------------------------------------------------------
-- Helper: hash token & cari akun dari token
-- ---------------------------------------------------------------------
create or replace function public.fn_token_hash(p_token text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Mengembalikan id akun untuk token tsb, atau NULL bila token kosong/tak dikenal.
create or replace function public.fn_account_id(p_token text)
returns uuid language sql stable security definer as $$
  select a.id
  from public.accounts a
  where p_token is not null
    and char_length(p_token) >= 20
    and a.token_hash = public.fn_token_hash(p_token);
$$;

-- ---------------------------------------------------------------------
-- register_account: daftarkan perangkat sebagai akun baru.
--  * Idempoten: token yang sama mengembalikan akun yang sama (created=false).
--  * Opsional p_player_id + p_device_id: tautkan juga baris pemain di room
--    saat ini (hanya bila device cocok & belum punya akun), supaya game
--    berikutnya di room yang sama langsung terhitung sebagai pemain akun.
-- ---------------------------------------------------------------------
drop function if exists public.register_account(text, text, text);
drop function if exists public.register_account(text, text, text, uuid, text);
create or replace function public.register_account(
  p_token text,
  p_name text,
  p_avatar text,
  p_player_id uuid default null,
  p_device_id text default null
)
returns table (account_id uuid, account_name text, account_avatar text, created boolean)
language plpgsql security definer as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 16);
  v_id uuid;
  v_created boolean := false;
begin
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 100 then
    raise exception 'INVALID_TOKEN';
  end if;
  if v_name = '' then
    raise exception 'INVALID_NAME';
  end if;

  insert into public.accounts(token_hash, name, avatar)
    values (public.fn_token_hash(p_token), v_name, coalesce(nullif(p_avatar, ''), '🙂'))
    on conflict (token_hash) do nothing
    returning id into v_id;

  if v_id is not null then
    v_created := true;
  else
    select a.id into v_id from public.accounts a
      where a.token_hash = public.fn_token_hash(p_token);
  end if;

  if p_player_id is not null and p_device_id is not null then
    update public.players
      set account_id = v_id
      where public.players.id = p_player_id
        and public.players.device_id = p_device_id
        and public.players.account_id is null
        and not public.players.is_admin;
  end if;

  return query
    select a.id, a.name, a.avatar, v_created
    from public.accounts a where a.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- get_account: cek apakah token masih terdaftar (kosong bila tidak).
-- ---------------------------------------------------------------------
drop function if exists public.get_account(text);
create or replace function public.get_account(p_token text)
returns table (account_id uuid, account_name text, account_avatar text)
language sql stable security definer as $$
  select a.id, a.name, a.avatar
  from public.accounts a
  where a.id = public.fn_account_id(p_token);
$$;

grant execute on function public.register_account(text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.get_account(text) to anon, authenticated;
