-- =====================================================================
-- Sambung Suku Kata — Migration v7
-- Usulan kata dari pemain + halaman konfirmasi admin (ber-PIN).
--
-- Alur:
--   1. Pemain mengusulkan kata (boleh beberapa, dipisah koma) -> masuk
--      tabel word_suggestions dengan status 'pending'.
--   2. Admin membuka halaman khusus (/kamus-admin) + PIN, melihat usulan
--      satu per satu, lalu Setuju/Tolak.
--   3. Setuju -> kata di-insert ke public.dictionary (langsung valid di
--      game) dan status usulan jadi 'approved'. Tolak -> status 'rejected'.
--
-- Catatan keamanan: PIN diverifikasi di DALAM fungsi SECURITY DEFINER,
-- bukan di klien, sehingga daftar & aksi review tidak bisa dipanggil tanpa
-- PIN yang benar. Baca tabel usulan TIDAK diizinkan untuk anon (RLS tanpa
-- policy select) — satu-satunya jalan baca lewat RPC ber-PIN.
--
-- Jalankan di Supabase SQL Editor (aman diulang).
-- =====================================================================

-- ---------- tabel usulan kata ----------
create table if not exists public.word_suggestions (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  suggested_by text,
  room_code text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_word_suggestions_status
  on public.word_suggestions (status, created_at);

-- Cegah usulan ganda untuk kata yang masih pending (hemat & rapi).
create unique index if not exists uq_word_suggestions_pending
  on public.word_suggestions (word)
  where status = 'pending';

-- ---------- RLS ----------
-- Aktifkan RLS TANPA policy select untuk anon: isi tabel hanya bisa dibaca
-- lewat RPC SECURITY DEFINER (list_suggestions) yang mengecek PIN.
alter table public.word_suggestions enable row level security;
-- (sengaja tidak ada policy "read" agar anon tidak bisa SELECT langsung)

-- ---------- PIN akses admin ----------
-- Disimpan di satu fungsi agar mudah diubah di satu tempat.
create or replace function public.fn_admin_pin()
returns text language sql immutable as $$
  select '110966';
$$;

-- ---------- RPC: pemain mengusulkan kata ----------
-- Terima array kata (klien sudah memecah berdasarkan koma). Normalisasi,
-- buang yang sudah ada di kamus atau sudah pending, lalu insert 'pending'.
-- Mengembalikan jumlah usulan baru yang tersimpan.
drop function if exists public.suggest_words(text[], text, text);
create or replace function public.suggest_words(
  p_words text[],
  p_room_code text default null,
  p_suggested_by text default null
)
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  w text;
  v_norm text;
begin
  if p_words is null then return 0; end if;

  foreach w in array p_words loop
    v_norm := public.fn_normalize(w);
    if length(v_norm) < 2 then continue; end if;
    -- Lewati bila sudah ada di kamus.
    if public.fn_in_dict(v_norm) then continue; end if;
    -- Lewati bila sudah ada usulan pending untuk kata yang sama.
    if exists (
      select 1 from public.word_suggestions
      where word = v_norm and status = 'pending'
    ) then continue; end if;

    insert into public.word_suggestions (word, room_code, suggested_by)
      values (v_norm, p_room_code, p_suggested_by);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------- RPC: admin melihat usulan pending (ber-PIN) ----------
drop function if exists public.list_suggestions(text);
create or replace function public.list_suggestions(p_pin text)
returns table (
  id uuid,
  word text,
  suggested_by text,
  room_code text,
  created_at timestamptz
)
language plpgsql security definer as $$
begin
  if p_pin is distinct from public.fn_admin_pin() then
    raise exception 'BAD_PIN';
  end if;
  return query
    select s.id, s.word, s.suggested_by, s.room_code, s.created_at
    from public.word_suggestions s
    where s.status = 'pending'
      -- Sembunyikan usulan yang kata-nya sudah masuk kamus (cek ulang
      -- agar admin tidak meninjau duplikat yang sudah valid).
      and not public.fn_in_dict(s.word)
    order by s.created_at asc;
end;
$$;

-- ---------- RPC: admin menyetujui / menolak satu usulan (ber-PIN) ----------
-- p_approve = true  -> insert ke kamus + status 'approved'
-- p_approve = false -> status 'rejected'
drop function if exists public.review_suggestion(uuid, boolean, text);
create or replace function public.review_suggestion(
  p_id uuid,
  p_approve boolean,
  p_pin text
)
returns json language plpgsql security definer as $$
declare
  v_word text;
begin
  if p_pin is distinct from public.fn_admin_pin() then
    raise exception 'BAD_PIN';
  end if;

  select word into v_word
  from public.word_suggestions
  where id = p_id and status = 'pending'
  for update;

  if not found then
    return json_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  if p_approve then
    -- Cek ulang ke kamus: kata bisa saja sudah masuk sejak diusulkan
    -- (dari usulan lain / seed). Hindari klaim "ditambahkan" yang keliru.
    if public.fn_in_dict(v_word) then
      update public.word_suggestions
        set status = 'approved', reviewed_at = now()
        where id = p_id;
      return json_build_object(
        'ok', true, 'word', v_word, 'approved', true, 'already', true
      );
    end if;

    insert into public.dictionary (word) values (v_word)
      on conflict (word) do nothing;
    update public.word_suggestions
      set status = 'approved', reviewed_at = now()
      where id = p_id;
    return json_build_object(
      'ok', true, 'word', v_word, 'approved', true, 'already', false
    );
  else
    update public.word_suggestions
      set status = 'rejected', reviewed_at = now()
      where id = p_id;
    return json_build_object('ok', true, 'word', v_word, 'approved', false);
  end if;
end;
$$;

grant execute on function public.suggest_words(text[], text, text) to anon, authenticated;
grant execute on function public.list_suggestions(text) to anon, authenticated;
grant execute on function public.review_suggestion(uuid, boolean, text) to anon, authenticated;
