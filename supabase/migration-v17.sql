-- =====================================================================
-- Sambung Suku Kata — Migration v17
--  (1) Usulan emoji dari pemain (tabel terpisah emoji_suggestions) + konfirmasi admin.
--      Setuju -> masuk tabel emojis (tampil di toko). Tolak -> status 'rejected'.
--  (2) Admin hapus emoji: hilang dari toko DAN inventory/slot semua pemain.
--  (3) Berita hari ini untuk running text halaman utama.
--
-- Prasyarat: migration-v15.sql (emojis) dan migration-v16.sql. Aman diulang.
-- File di Storage dihapus oleh route server (/api/admin/emoji-remove), bukan SQL.
-- =====================================================================

-- (1) Usulan emoji. File sudah ada di Storage saat baris dibuat.
create table if not exists public.emoji_suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 24),
  image_path text not null,
  sound_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  account_id uuid references public.accounts(id) on delete set null,
  suggested_by text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists idx_emoji_suggestions_status on public.emoji_suggestions (status, created_at);
alter table public.emoji_suggestions enable row level security;  -- tanpa policy: hanya lewat RPC

-- Cek syarat mengusulkan (dipanggil route SEBELUM mengunggah file, dan lagi oleh suggest_emoji).
-- Galat: NOT_LOGGED_IN, INVALID_NAME, NAME_TAKEN, TOO_MANY_PENDING (maks. 3 usulan menunggu per akun).
create or replace function public.check_emoji_suggest(p_token text, p_name text)
returns uuid language plpgsql stable security definer as $$
declare
  v_acc uuid := public.fn_account_id(p_token);
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_acc is null then raise exception 'NOT_LOGGED_IN'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 24 then raise exception 'INVALID_NAME'; end if;
  if exists (select 1 from public.emojis where lower(btrim(name)) = lower(v_name))
     or exists (select 1 from public.emoji_suggestions
                 where status = 'pending' and lower(btrim(name)) = lower(v_name)) then
    raise exception 'NAME_TAKEN';
  end if;
  if (select count(*) from public.emoji_suggestions
       where account_id = v_acc and status = 'pending') >= 3 then
    raise exception 'TOO_MANY_PENDING';
  end if;
  return v_acc;
end;
$$;

create or replace function public.suggest_emoji(
  p_token text, p_name text, p_image_path text, p_sound_path text
) returns uuid language plpgsql security definer as $$
declare
  v_acc uuid := public.check_emoji_suggest(p_token, p_name);
  v_id uuid;
begin
  if coalesce(p_image_path, '') = '' or coalesce(p_sound_path, '') = '' then
    raise exception 'INVALID_FILES';
  end if;
  insert into public.emoji_suggestions(name, image_path, sound_path, account_id, suggested_by)
    values (btrim(p_name), p_image_path, p_sound_path, v_acc,
            (select name from public.accounts where id = v_acc))
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_list_emoji_suggestions(p_pin text)
returns table (id uuid, name text, image_path text, sound_path text, suggested_by text, created_at timestamptz)
language plpgsql stable security definer as $$
begin
  if p_pin is distinct from public.fn_admin_pin() then raise exception 'BAD_PIN'; end if;
  return query
    select s.id, s.name, s.image_path, s.sound_path, s.suggested_by, s.created_at
    from public.emoji_suggestions s
    where s.status = 'pending'
    order by s.created_at asc;
end;
$$;

-- Setuju (p_approve = true): p_name (opsional, default nama usulan) + p_price wajib -> insert ke emojis.
-- Tolak: status 'rejected'. Keduanya mengembalikan path file agar route bisa menghapus file saat ditolak.
create or replace function public.admin_review_emoji_suggestion(
  p_pin text, p_id uuid, p_approve boolean, p_name text default null, p_price int default null
) returns json language plpgsql security definer as $$
declare
  s public.emoji_suggestions;
  v_name text;
begin
  if p_pin is distinct from public.fn_admin_pin() then raise exception 'BAD_PIN'; end if;
  select * into s from public.emoji_suggestions where id = p_id and status = 'pending' for update;
  if not found then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;

  if p_approve then
    v_name := btrim(coalesce(nullif(btrim(coalesce(p_name, '')), ''), s.name));
    if char_length(v_name) < 1 or char_length(v_name) > 24 then raise exception 'INVALID_NAME'; end if;
    if p_price is null or p_price < 0 or p_price > 100000 then raise exception 'INVALID_PRICE'; end if;
    begin
      insert into public.emojis(name, price, image_path, sound_path)
        values (v_name, p_price, s.image_path, s.sound_path);
    exception when unique_violation then
      raise exception 'NAME_TAKEN';
    end;
    update public.emoji_suggestions set status = 'approved', name = v_name, reviewed_at = now() where id = p_id;
  else
    update public.emoji_suggestions set status = 'rejected', reviewed_at = now() where id = p_id;
  end if;

  return json_build_object('ok', true, 'approved', p_approve, 'name', s.name,
                           'image_path', s.image_path, 'sound_path', s.sound_path);
end;
$$;

-- (2) Hapus emoji permanen. account_emojis dihapus dulu (slot ikut terhapus lewat FK cascade).
-- Koin pembelian TIDAK dikembalikan. Mengembalikan path file untuk dibersihkan route.
create or replace function public.admin_delete_emoji(p_pin text, p_id uuid)
returns json language plpgsql security definer as $$
declare
  e public.emojis;
begin
  if p_pin is distinct from public.fn_admin_pin() then raise exception 'BAD_PIN'; end if;
  select * into e from public.emojis where id = p_id for update;
  if not found then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
  delete from public.account_emojis where emoji_id = p_id;
  delete from public.emojis where id = p_id;
  return json_build_object('ok', true, 'image_path', e.image_path, 'sound_path', e.sound_path);
end;
$$;

-- (3) Berita hari ini (zona Asia/Jakarta): usulan kata & emoji yang diterima, terbaru dulu.
create or replace function public.list_today_news()
returns table (kind text, name text, reviewed_at timestamptz)
language sql stable security definer as $$
  select n.kind, n.name, n.reviewed_at from (
    select 'word'::text as kind, w.word as name, w.reviewed_at
      from public.word_suggestions w
     where w.status = 'approved' and w.reviewed_at is not null
       and (w.reviewed_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
    union all
    select 'emoji'::text, s.name, s.reviewed_at
      from public.emoji_suggestions s
     where s.status = 'approved' and s.reviewed_at is not null
       and (s.reviewed_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
  ) n
  order by n.reviewed_at desc
  limit 10;
$$;

grant execute on function public.check_emoji_suggest(text, text) to anon, authenticated;
grant execute on function public.suggest_emoji(text, text, text, text) to anon, authenticated;
grant execute on function public.admin_list_emoji_suggestions(text) to anon, authenticated;
grant execute on function public.admin_review_emoji_suggestion(text, uuid, boolean, text, int) to anon, authenticated;
grant execute on function public.admin_delete_emoji(text, uuid) to anon, authenticated;
grant execute on function public.list_today_news() to anon, authenticated;
