-- =====================================================================
-- Sambung Suku Kata — Migration v3
-- Kamus pindah ke database + validasi anti-buntu (dead-end) di server.
-- Jalankan di Supabase SQL Editor. Aman diulang.
-- Setelah ini: (1) upload kata via skrip, (2) jalankan ulang functions.sql.
-- =====================================================================

-- ---------- perluas alasan move: tambah 'deadend' ----------
alter table public.moves drop constraint if exists moves_reason_check;
alter table public.moves
  add constraint moves_reason_check
  check (reason in ('chain','dict','dupe','timeout','deadend'));

-- ---------- tabel kamus ----------
create table if not exists public.dictionary (
  word text primary key
);

-- Index untuk pencarian "diawali suku kata X" (prefix search cepat).
-- text_pattern_ops mempercepat LIKE 'prefix%'.
create index if not exists idx_dictionary_word_prefix
  on public.dictionary (word text_pattern_ops);

-- ---------- RLS ----------
alter table public.dictionary enable row level security;

drop policy if exists "read_dictionary" on public.dictionary;
create policy "read_dictionary" on public.dictionary for select using (true);

-- Insert kata hanya lewat RPC SECURITY DEFINER (lihat bawah), bukan anon langsung.

-- ---------- fungsi: cek kata ada di kamus ----------
create or replace function public.fn_in_dict(p_word text)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.dictionary where word = public.fn_normalize(p_word)
  );
$$;

-- ---------- fungsi: cek masih ada lanjutan (anti-buntu) ----------
-- true jika ADA kata di kamus yang diawali `p_syllable` dan belum dipakai di ronde.
create or replace function public.fn_has_continuation(p_round_id uuid, p_syllable text)
returns boolean language sql stable as $$
  select exists(
    select 1
    from public.dictionary d
    where d.word like public.fn_normalize(p_syllable) || '%'
      and not exists (
        select 1 from public.used_words u
        where u.round_id = p_round_id and u.word = d.word
      )
  );
$$;

-- ---------- RPC: upload kata (dipakai skrip seed) ----------
-- Terima array kata, normalisasi, insert yang belum ada.
create or replace function public.seed_dictionary(p_words text[])
returns int language plpgsql security definer as $$
declare
  v_count int;
begin
  insert into public.dictionary (word)
  select distinct public.fn_normalize(w)
  from unnest(p_words) as w
  where length(public.fn_normalize(w)) >= 2
  on conflict (word) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.fn_in_dict(text) to anon, authenticated;
grant execute on function public.fn_has_continuation(uuid, text) to anon, authenticated;
grant execute on function public.seed_dictionary(text[]) to anon, authenticated;
