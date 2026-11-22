-- =====================================================================
-- Sambung Suku Kata — Migration v15
-- Toko emoji: katalog emoji (gambar + suara + harga koin) dibuat admin di
-- /kamus-admin, dan dibeli pemain ber-akun dengan koin 🪙 di /toko.
--
--  * emojis          : katalog (file ada di Supabase Storage, bucket "emoji-assets";
--                      di sini hanya path-nya).
--  * account_emojis  : kepemilikan emoji per akun (dasar fitur pakai emoji nanti).
--  * point_ledger    : kind baru 'spend' untuk pembelian (tidak memengaruhi skor 🏆
--                      maupun leaderboard, karena leaderboard hanya menjumlah kind 'game').
--  * RPC admin ber-PIN (fn_admin_pin) dan RPC toko (token akun).
--
-- Tabel tertutup untuk klien (RLS aktif tanpa policy); semua lewat RPC di bawah.
-- File gambar/suara DIUNGGAH oleh route server /api/admin/emoji (butuh env
-- SUPABASE_SERVICE_ROLE_KEY), bukan oleh browser.
--
-- URUTAN DEPLOY: file ini -> functions.sql -> baru deploy Vercel (+ env baru).
-- Prasyarat: migration-v14.sql sudah dijalankan. Aman diulang.
-- =====================================================================

create table if not exists public.emojis (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 24),
  price int not null check (price between 0 and 100000),
  image_path text not null,
  sound_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Nama emoji unik (tanpa membedakan huruf besar/kecil), termasuk yang disembunyikan.
create unique index if not exists uq_emojis_name_ci on public.emojis (lower(btrim(name)));
alter table public.emojis enable row level security;

create table if not exists public.account_emojis (
  account_id uuid not null references public.accounts(id) on delete cascade,
  emoji_id uuid not null references public.emojis(id) on delete restrict,
  price_paid int not null,
  purchased_at timestamptz not null default now(),
  primary key (account_id, emoji_id)
);
create index if not exists idx_account_emojis_emoji on public.account_emojis(emoji_id);
alter table public.account_emojis enable row level security;

-- Ledger: izinkan kind 'spend' (pembelian). Nama constraint bisa berbeda antar-instalasi.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.point_ledger'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.point_ledger drop constraint %I', c);
  end loop;
  alter table public.point_ledger
    add constraint point_ledger_kind_check check (kind in ('game', 'penalty', 'spend'));
end $$;

-- ---------------------------------------------------------------------
-- Admin (ber-PIN, sama seperti usulan kata)
-- ---------------------------------------------------------------------
create or replace function public.admin_check_pin(p_pin text)
returns boolean language sql stable security definer as $$
  select p_pin is not distinct from public.fn_admin_pin();
$$;

-- Catat emoji baru. File sudah diunggah oleh route server; di sini hanya path-nya.
create or replace function public.admin_create_emoji(
  p_pin text, p_name text, p_price int, p_image_path text, p_sound_path text
) returns uuid language plpgsql security definer as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if p_pin is distinct from public.fn_admin_pin() then raise exception 'BAD_PIN'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 24 then raise exception 'INVALID_NAME'; end if;
  if p_price is null or p_price < 0 or p_price > 100000 then raise exception 'INVALID_PRICE'; end if;
  if coalesce(p_image_path, '') = '' or coalesce(p_sound_path, '') = '' then raise exception 'INVALID_FILES'; end if;
  begin
    insert into public.emojis(name, price, image_path, sound_path)
      values (v_name, p_price, p_image_path, p_sound_path)
      returning id into v_id;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;
  return v_id;
end;
$$;

create or replace function public.admin_list_emojis(p_pin text)
returns table (id uuid, name text, price int, image_path text, sound_path text,
               is_active boolean, created_at timestamptz, owners int)
language plpgsql stable security definer as $$
begin
  if p_pin is distinct from public.fn_admin_pin() then raise exception 'BAD_PIN'; end if;
  return query
    select e.id, e.name, e.price, e.image_path, e.sound_path, e.is_active, e.created_at,
           (select count(*)::int from public.account_emojis ae where ae.emoji_id = e.id)
    from public.emojis e
    order by e.created_at desc;
end;
$$;

-- Sembunyikan/tampilkan di toko (tidak menghapus; pemilik lama tetap memilikinya).
create or replace function public.admin_set_emoji_active(p_pin text, p_id uuid, p_active boolean)
returns void language plpgsql security definer as $$
begin
  if p_pin is distinct from public.fn_admin_pin() then raise exception 'BAD_PIN'; end if;
  update public.emojis set is_active = coalesce(p_active, false) where public.emojis.id = p_id;
  if not found then raise exception 'EMOJI_NOT_FOUND'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Toko
-- ---------------------------------------------------------------------
-- Etalase: emoji aktif + apakah sudah dimiliki akun pemanggil (token boleh kosong = guest).
create or replace function public.list_shop_emojis(p_token text default null)
returns table (id uuid, name text, price int, image_path text, sound_path text, owned boolean)
language sql stable security definer as $$
  select e.id, e.name, e.price, e.image_path, e.sound_path,
         exists (select 1 from public.account_emojis ae
                  where ae.emoji_id = e.id and ae.account_id = public.fn_account_id(p_token))
  from public.emojis e
  where e.is_active
  order by e.created_at desc;
$$;

-- Beli emoji dengan koin 🪙. Atomik; mengembalikan sisa koin.
-- Galat: NOT_LOGGED_IN, EMOJI_NOT_FOUND, ALREADY_OWNED, NOT_ENOUGH_COINS.
create or replace function public.buy_emoji(p_token text, p_emoji_id uuid)
returns int language plpgsql security definer as $$
declare
  v_acc uuid := public.fn_account_id(p_token);
  v_emoji public.emojis%rowtype;
  v_coins int;
begin
  if v_acc is null then raise exception 'NOT_LOGGED_IN'; end if;

  select * into v_emoji from public.emojis where public.emojis.id = p_emoji_id and is_active;
  if not found then raise exception 'EMOJI_NOT_FOUND'; end if;

  -- Kunci baris akun: dua pembelian bersamaan tidak bisa sama-sama lolos cek saldo.
  select a.coins into v_coins from public.accounts a where a.id = v_acc for update;

  if exists (select 1 from public.account_emojis ae where ae.account_id = v_acc and ae.emoji_id = v_emoji.id) then
    raise exception 'ALREADY_OWNED';
  end if;
  if v_coins < v_emoji.price then raise exception 'NOT_ENOUGH_COINS'; end if;

  update public.accounts set coins = coins - v_emoji.price where id = v_acc returning coins into v_coins;
  insert into public.account_emojis(account_id, emoji_id, price_paid) values (v_acc, v_emoji.id, v_emoji.price);
  if v_emoji.price > 0 then
    insert into public.point_ledger(account_id, kind, delta, note)
      values (v_acc, 'spend', -v_emoji.price, 'emoji:' || v_emoji.id::text);
  end if;
  return v_coins;
end;
$$;

grant execute on function public.admin_check_pin(text) to anon, authenticated;
grant execute on function public.admin_create_emoji(text, text, int, text, text) to anon, authenticated;
grant execute on function public.admin_list_emojis(text) to anon, authenticated;
grant execute on function public.admin_set_emoji_active(text, uuid, boolean) to anon, authenticated;
grant execute on function public.list_shop_emojis(text) to anon, authenticated;
grant execute on function public.buy_emoji(text, uuid) to anon, authenticated;
