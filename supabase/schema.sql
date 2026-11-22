-- =====================================================================
-- Sambung Suku Kata — Skema Database (Supabase / Postgres)
-- Jalankan file ini di Supabase SQL Editor SEBELUM functions.sql
-- =====================================================================

-- Ekstensi untuk uuid
create extension if not exists "pgcrypto";

-- ---------- rooms ----------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'lobby' check (status in ('lobby','playing','finished')),
  mode text not null default 'ffa' check (mode in ('ffa','team')),
  timer_seconds int not null default 7 check (timer_seconds in (5,7,10,15)),
  max_lives int not null default 1 check (max_lives between 1 and 5),
  host_player_id uuid,
  current_round_id uuid,
  created_at timestamptz not null default now()
);

-- ---------- players ----------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  avatar text not null default '🙂',
  team_id uuid,
  is_host boolean not null default false,
  is_alive boolean not null default true,
  lives int not null default 1,
  turn_order int not null default 0,
  connected boolean not null default true,
  joined_at timestamptz not null default now()
);

-- ---------- teams ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  color text not null default '#A5B4FC',
  turn_order int not null default 0
);

-- ---------- rounds ----------
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  starting_word text not null,
  current_word text not null,
  required_syllable text not null,
  active_subject_id uuid,
  active_team_id uuid,
  turn_started_at timestamptz not null default now(),
  turn_deadline timestamptz not null,
  status text not null default 'active' check (status in ('active','finished')),
  winner_player_id uuid,
  winner_team_id uuid
);

-- ---------- moves ----------
create table if not exists public.moves (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  word text not null,
  is_valid boolean not null,
  reason text check (reason in ('chain','dict','dupe','timeout')),
  created_at timestamptz not null default now()
);

-- ---------- used_words (anti-duplikat cepat per ronde) ----------
create table if not exists public.used_words (
  round_id uuid not null references public.rounds(id) on delete cascade,
  word text not null,
  primary key (round_id, word)
);

-- ---------- index ----------
create index if not exists idx_players_room on public.players(room_id);
create index if not exists idx_rounds_room on public.rounds(room_id);
create index if not exists idx_moves_round on public.moves(round_id);

-- =====================================================================
-- Realtime: publikasikan tabel agar perubahan ter-broadcast ke klien
-- =====================================================================
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.moves;

-- =====================================================================
-- RLS (Row Level Security)
-- Untuk versi awal game kasual: aktifkan RLS, izinkan baca untuk anon,
-- dan arahkan SEMUA mutasi lewat RPC SECURITY DEFINER (lihat functions.sql).
-- =====================================================================
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.rounds enable row level security;
alter table public.moves enable row level security;
alter table public.used_words enable row level security;

-- Baca: izinkan untuk semua (anon) agar klien bisa subscribe realtime.
drop policy if exists "read_rooms" on public.rooms;
create policy "read_rooms" on public.rooms for select using (true);

drop policy if exists "read_players" on public.players;
create policy "read_players" on public.players for select using (true);

drop policy if exists "read_teams" on public.teams;
create policy "read_teams" on public.teams for select using (true);

drop policy if exists "read_rounds" on public.rounds;
create policy "read_rounds" on public.rounds for select using (true);

drop policy if exists "read_moves" on public.moves;
create policy "read_moves" on public.moves for select using (true);

drop policy if exists "read_used_words" on public.used_words;
create policy "read_used_words" on public.used_words for select using (true);

-- Tidak ada policy INSERT/UPDATE/DELETE untuk anon:
-- semua perubahan state dilakukan melalui RPC SECURITY DEFINER.
