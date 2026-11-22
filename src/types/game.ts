export type RoomStatus = "lobby" | "playing" | "finished";
export type GameMode = "ffa" | "team";
export type RoundStatus = "active" | "finished";
export type InvalidReason = "chain" | "dict" | "dupe" | "timeout";

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  mode: GameMode;
  timer_seconds: number;
  max_lives: number;
  host_player_id: string | null;
  current_round_id: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  avatar: string;
  team_id: string | null;
  is_host: boolean;
  is_admin: boolean;
  is_alive: boolean;
  lives: number;
  eliminated_order: number | null;
  device_id: string | null;
  /** Akun perangkat (null = guest). Lihat supabase/migration-v10.sql. */
  account_id: string | null;
  /** Penonton: ada di room & menonton, tetapi tidak ikut giliran/poin. Lihat migration-v14.sql. */
  is_spectator: boolean;
  /** Masuk saat game berjalan; naik jadi pemain otomatis saat host "Main Lagi". */
  joined_late: boolean;
  turn_order: number;
  connected: boolean;
  joined_at: string;
}

export interface Team {
  id: string;
  room_id: string;
  name: string;
  color: string;
  turn_order: number;
  eliminated_order: number | null;
}

export interface Round {
  id: string;
  room_id: string;
  starting_word: string;
  current_word: string;
  required_syllable: string;
  full_syllable: string | null;
  relaxed: boolean;
  consecutive_fails: number;
  active_subject_id: string | null;
  active_team_id: string | null;
  turn_started_at: string;
  turn_deadline: string;
  status: RoundStatus;
  winner_player_id: string | null;
  winner_team_id: string | null;
  /** true = game diakhiri host sebelum selesai (tanpa poin). Lihat supabase/migration-v11.sql. */
  ended_by_host: boolean;
}

export interface Move {
  id: string;
  round_id: string;
  player_id: string;
  word: string;
  is_valid: boolean;
  reason: InvalidReason | null;
  created_at: string;
}

export interface SubmitResult {
  ok: boolean;
  reason?: InvalidReason;
  message?: string;
}
