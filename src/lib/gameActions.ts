import { supabase } from "./supabaseClient";
import { isInDictionary, randomStartingWord } from "./dictionary";
import {
  getDeviceId,
  getDeviceKey,
  getAccounts,
  getAccountToken,
  newAccountToken,
  addAccount,
  removeAccount,
  MAX_ACCOUNTS_PER_DEVICE,
  type Account,
} from "./session";
import { EMOJI_BUCKET } from "./emojiLimits";
import type { GameMode } from "@/types/game";

/**
 * Sertakan token akun hanya bila perangkat sudah terdaftar. Dengan begitu
 * pemain guest tetap memakai bentuk panggilan lama (aman saat rollout).
 */
function accountParam(): { p_account_token?: string } {
  const token = getAccountToken();
  return token ? { p_account_token: token } : {};
}

export type AccountErrorCode = "NAME_TAKEN" | "DEVICE_LIMIT" | "INVALID_NAME" | "OTHER";

/** Galat pendaftaran akun dengan kode yang bisa ditangani UI. */
export class AccountError extends Error {
  constructor(public code: AccountErrorCode, message: string) {
    super(message);
  }
}

function toAccountError(e: any): AccountError {
  const msg = String(e?.message || "");
  if (msg.includes("NAME_TAKEN")) return new AccountError("NAME_TAKEN", msg);
  if (msg.includes("DEVICE_ACCOUNT_LIMIT")) return new AccountError("DEVICE_LIMIT", msg);
  if (msg.includes("INVALID_NAME")) return new AccountError("INVALID_NAME", msg);
  return new AccountError("OTHER", msg);
}

export interface RegisterResult {
  account: Account;
  /** Poin game yang baru selesai yang ikut masuk ke akun ini (0 bila tidak ada). */
  awarded: number;
}

/**
 * Daftarkan akun baru di perangkat ini (maks. 3, nama unik) dan jadikan aktif.
 * Bila playerId + roundId diberikan (halaman hasil), baris pemain di room itu
 * ditautkan dan poin game yang baru selesai ikut masuk ke akun.
 */
export async function registerAccount(
  name: string,
  avatar: string,
  opts: { playerId?: string; roundId?: string } = {}
): Promise<RegisterResult> {
  if (getAccounts().length >= MAX_ACCOUNTS_PER_DEVICE) {
    throw new AccountError("DEVICE_LIMIT", "DEVICE_ACCOUNT_LIMIT");
  }
  const token = newAccountToken();
  const { data, error } = await supabase.rpc("register_account", {
    p_token: token,
    p_name: name,
    p_avatar: avatar,
    p_device_key: getDeviceKey(),
    p_player_id: opts.playerId ?? null,
    p_round_id: opts.roundId ?? null,
  });
  if (error) throw toAccountError(error);
  const row = Array.isArray(data) ? data[0] : data;
  const account: Account = {
    token,
    id: row.account_id,
    name: row.account_name,
    avatar: row.account_avatar,
  };
  addAccount(account);
  return { account, awarded: Number(row.awarded) || 0 };
}

/**
 * Hapus akun (soft delete di server): akun ditandai terhapus sehingga skor & koin
 * ter-hold dan tidak berlaku lagi. Setelah server menandai, akun dilepas dari
 * perangkat ini (bila sedang aktif, perangkat kembali ke mode guest).
 * Melempar galat bila server gagal dijangkau, supaya akun tidak terlepas sepihak.
 */
export async function deleteAccount(account: Account): Promise<void> {
  const { error } = await supabase.rpc("delete_account", { p_token: account.token });
  if (error) throw error;
  removeAccount(account.id);
}

export interface AccountStats {
  id: string;
  name: string;
  avatar: string;
  /** Skor 🏆: akumulasi poin game (dasar leaderboard). */
  score: number;
  /** Koin 🪙: saldo untuk dibelanjakan nanti (dipotong oleh penalti). */
  coins: number;
}

/** Skor & koin semua akun di perangkat ini, dengan id akun sebagai kunci. */
export async function fetchAccountStats(): Promise<Record<string, AccountStats>> {
  const tokens = getAccounts().map((a) => a.token);
  if (tokens.length === 0) return {};
  const { data, error } = await supabase.rpc("get_accounts", { p_tokens: tokens });
  if (error) throw error;
  const out: Record<string, AccountStats> = {};
  for (const r of (data ?? []) as any[]) {
    out[r.account_id] = {
      id: r.account_id,
      name: r.account_name,
      avatar: r.account_avatar,
      score: Number(r.account_score) || 0,
      coins: Number(r.account_coins) || 0,
    };
  }
  return out;
}

export async function createRoom(
  name: string,
  avatar: string,
  mode: GameMode,
  timer: number,
  maxLives = 1
) {
  const { data, error } = await supabase.rpc("create_room", {
    p_name: name,
    p_avatar: avatar,
    p_mode: mode,
    p_timer: timer,
    p_max_lives: maxLives,
    p_device_id: getDeviceId(),
    p_device_key: getDeviceKey(),
    ...accountParam(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { room_id: string; room_code: string; player_id: string };
}

export async function joinRoom(
  code: string,
  name: string,
  avatar: string,
  isAdmin = false
) {
  const { data, error } = await supabase.rpc("join_room", {
    p_code: code.toUpperCase(),
    p_name: name,
    p_avatar: avatar,
    p_device_id: getDeviceId(),
    p_is_admin: isAdmin,
    p_device_key: getDeviceKey(),
    ...accountParam(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { room_id: string; player_id: string };
}

/** Pemain/host berpindah antara pemain <-> penonton (hanya bisa di lobi). */
export async function setSpectator(roomId: string, playerId: string, spectator: boolean) {
  const { error } = await supabase.rpc("set_spectator", {
    p_room_id: roomId,
    p_player_id: playerId,
    p_spectator: spectator,
  });
  if (error) throw error;
}

export async function setRoomSettings(
  roomId: string,
  playerId: string,
  mode: GameMode,
  timer: number,
  maxLives?: number
) {
  const { error } = await supabase.rpc("set_room_settings", {
    p_room_id: roomId,
    p_player_id: playerId,
    p_mode: mode,
    p_timer: timer,
    p_max_lives: maxLives ?? null,
  });
  if (error) throw error;
}

export async function createTeam(roomId: string, playerId: string, name: string, color: string) {
  const { data, error } = await supabase.rpc("upsert_team", {
    p_room_id: roomId,
    p_player_id: playerId,
    p_name: name,
    p_color: color,
  });
  if (error) throw error;
  return data as string;
}

export async function assignPlayerTeam(
  roomId: string,
  hostId: string,
  targetPlayer: string,
  teamId: string
) {
  const { error } = await supabase.rpc("assign_player_team", {
    p_room_id: roomId,
    p_host_id: hostId,
    p_target_player: targetPlayer,
    p_team_id: teamId,
  });
  if (error) throw error;
}

export async function startGame(roomId: string, playerId: string) {
  const starting = randomStartingWord();
  const { data, error } = await supabase.rpc("start_game", {
    p_room_id: roomId,
    p_player_id: playerId,
    p_starting_word: starting,
  });
  if (error) throw error;
  return data as string;
}

export async function submitWord(roundId: string, playerId: string, word: string) {
  const inDict = isInDictionary(word);
  const { data, error } = await supabase.rpc("submit_word", {
    p_round_id: roundId,
    p_player_id: playerId,
    p_word: word,
    p_in_dict: inDict,
  });
  if (error) throw error;
  return data as { ok: boolean; reason?: string };
}

export async function resolveTimeout(roundId: string) {
  const { data, error } = await supabase.rpc("resolve_timeout", {
    p_round_id: roundId,
  });
  if (error) throw error;
  return data as { ok: boolean; reason?: string };
}

export async function playAgain(roomId: string, playerId: string) {
  const { error } = await supabase.rpc("play_again", {
    p_room_id: roomId,
    p_player_id: playerId,
  });
  if (error) throw error;
}

export type PenaltyStage = "none" | "lock" | "points";

export interface EndGameResult {
  ended: boolean;
  putaran?: number;
  penalty?: { stage: PenaltyStage; lock_seconds: number; points_deducted: number };
}

export async function endGame(roomId: string, playerId: string): Promise<EndGameResult> {
  const { data, error } = await supabase.rpc("end_game", {
    p_room_id: roomId,
    p_player_id: playerId,
  });
  if (error) throw error;
  return data as EndGameResult;
}

export interface EndPreview {
  putaran: number;
  stage: PenaltyStage;
  lock_seconds: number;
  points: number;
}

/** Konsekuensi mengakhiri game sekarang (untuk dialog konfirmasi host). */
export async function getEndPreview(roomId: string, playerId: string): Promise<EndPreview> {
  const { data, error } = await supabase.rpc("end_game_preview", {
    p_room_id: roomId,
    p_player_id: playerId,
  });
  if (error) throw error;
  return data as EndPreview;
}

/** Sisa detik penalti host (0 = tidak terkunci). */
export async function getHostLock(playerId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_host_lock", { p_player_id: playerId });
  if (error) throw error;
  return Number(data) || 0;
}

export interface RoundPlayerPoints {
  player_id: string;
  placement: number;
  chain_bonus: number;
  longest_bonus: number;
  /** Bonus mode tim (menang/kalah); 0 di mode FFA. */
  team_bonus: number;
  /** Jumlah yang masuk ke skor 🏆 DAN koin 🪙 (bila pemain ber-akun). */
  total: number;
  /** true = sudah tercatat di akun; false = pemain guest (poin hanya ditampilkan). */
  saved: boolean;
}

/** Poin semua pemain di satu game (termasuk guest), dengan id pemain sebagai kunci. */
export async function getRoundPoints(roundId: string): Promise<Record<string, RoundPlayerPoints>> {
  const { data, error } = await supabase.rpc("get_round_points", { p_round_id: roundId });
  if (error) throw error;
  const out: Record<string, RoundPlayerPoints> = {};
  for (const r of (data ?? []) as RoundPlayerPoints[]) out[r.player_id] = r;
  return out;
}

export type LeaderboardPeriod = "week" | "all";

export interface LeaderboardRow {
  rank: number;
  account_id: string;
  account_name: string;
  account_avatar: string;
  points: number;
  is_me: boolean;
}

export async function getLeaderboard(period: LeaderboardPeriod, limit = 20): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_period: period,
    p_limit: limit,
    p_token: getAccountToken(),
  });
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}


export async function cancelRoom(roomId: string, playerId: string) {
  const { error } = await supabase.rpc("cancel_room", {
    p_room_id: roomId,
    p_player_id: playerId,
  });
  if (error) throw error;
}

export async function removePlayerTeam(roomId: string, hostId: string, targetPlayer: string) {
  const { error } = await supabase.rpc("remove_player_team", {
    p_room_id: roomId,
    p_host_id: hostId,
    p_target_player: targetPlayer,
  });
  if (error) throw error;
}

export async function kickPlayer(roomId: string, hostId: string, targetPlayer: string) {
  const { error } = await supabase.rpc("kick_player", {
    p_room_id: roomId,
    p_host_id: hostId,
    p_target_player: targetPlayer,
  });
  if (error) throw error;
}

export async function leaveRoom(roomId: string, playerId: string) {
  const { error } = await supabase.rpc("leave_room", {
    p_room_id: roomId,
    p_player_id: playerId,
  });
  if (error) throw error;
}

export async function setConnected(playerId: string, connected: boolean) {
  const { error } = await supabase.rpc("set_connected", {
    p_player_id: playerId,
    p_connected: connected,
  });
  if (error) throw error;
}

export interface ActiveSession {
  room_code: string;
  room_status: "lobby" | "playing";
  player_id: string;
  player_name: string;
  player_avatar: string;
}

/**
 * Cek apakah device ini masih punya pemain di room yang belum selesai
 * (lobby/playing). Dipakai di halaman awal untuk menawarkan "lanjutkan?".
 * Mengembalikan null jika tidak ada sesi aktif.
 */
export async function findActiveSession(): Promise<ActiveSession | null> {
  const { data, error } = await supabase.rpc("find_active_session", {
    p_device_id: getDeviceId(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ActiveSession) ?? null;
}

// ---------------------------------------------------------------------
// Usulan kata (pemain mengusulkan kata baru -> konfirmasi admin)
// ---------------------------------------------------------------------

/**
 * Kirim usulan kata dari pemain. `raw` boleh berisi beberapa kata yang
 * dipisah koma. Server menormalisasi, membuang kata yang sudah ada / sudah
 * pending, lalu menyimpan sisanya sebagai 'pending'.
 * Mengembalikan jumlah usulan baru yang tersimpan.
 */
export async function suggestWords(
  raw: string,
  roomCode?: string,
  suggestedBy?: string
): Promise<number> {
  const words = raw
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  const { data, error } = await supabase.rpc("suggest_words", {
    p_words: words,
    p_room_code: roomCode ?? null,
    p_suggested_by: suggestedBy ?? null,
  });
  if (error) throw error;
  return Number(data) || 0;
}

export interface WordSuggestion {
  id: string;
  word: string;
  suggested_by: string | null;
  room_code: string | null;
  created_at: string;
}

export interface ActiveRoom {
  code: string;
  status: "lobby" | "playing" | "finished";
  player_count: number;
  created_at: string;
}

/** Admin: daftar room aktif (butuh PIN yang benar). */
export async function listActiveRooms(pin: string): Promise<ActiveRoom[]> {
  const { data, error } = await supabase.rpc("list_active_rooms", { p_pin: pin });
  if (error) throw error;
  return (data ?? []) as ActiveRoom[];
}

/** Admin: ambil daftar usulan pending (butuh PIN yang benar). */
export async function listSuggestions(pin: string): Promise<WordSuggestion[]> {
  const { data, error } = await supabase.rpc("list_suggestions", { p_pin: pin });
  if (error) throw error;
  return (data ?? []) as WordSuggestion[];
}

/** Admin: setujui/tolak satu usulan (butuh PIN). Setuju -> masuk kamus. */
export async function reviewSuggestion(
  id: string,
  approve: boolean,
  pin: string
): Promise<{ ok: boolean; word?: string; approved?: boolean; already?: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc("review_suggestion", {
    p_id: id,
    p_approve: approve,
    p_pin: pin,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    word?: string;
    approved?: boolean;
    already?: boolean;
    reason?: string;
  };
}

// ---------------------------------------------------------------------
// Toko emoji (lihat supabase/migration-v15.sql)
// ---------------------------------------------------------------------

/** URL publik file emoji di Storage (path acak & immutable, aman di-cache CDN). */
export function emojiAssetUrl(path: string): string {
  return supabase.storage.from(EMOJI_BUCKET).getPublicUrl(path).data.publicUrl;
}

export interface ShopEmoji {
  id: string;
  name: string;
  price: number;
  image_path: string;
  sound_path: string;
  /** Sudah dimiliki akun yang sedang dipakai (selalu false untuk guest). */
  owned: boolean;
}

/** Etalase toko. Memakai akun aktif (bila ada) agar `owned` benar. */
export async function listShopEmojis(): Promise<ShopEmoji[]> {
  const { data, error } = await supabase.rpc("list_shop_emojis", { p_token: getAccountToken() });
  if (error) throw error;
  return (data ?? []) as ShopEmoji[];
}

export type ShopErrorCode = "NOT_LOGGED_IN" | "EMOJI_NOT_FOUND" | "ALREADY_OWNED" | "NOT_ENOUGH_COINS" | "OTHER";

export class ShopError extends Error {
  constructor(public code: ShopErrorCode, message: string) {
    super(message);
  }
}

/** Beli emoji dengan koin 🪙 akun aktif. Mengembalikan sisa koin. */
export async function buyEmoji(emojiId: string): Promise<number> {
  const { data, error } = await supabase.rpc("buy_emoji", { p_token: getAccountToken(), p_emoji_id: emojiId });
  if (error) {
    const msg = String(error.message || "");
    const code = (["NOT_LOGGED_IN", "EMOJI_NOT_FOUND", "ALREADY_OWNED", "NOT_ENOUGH_COINS"] as const).find((c) =>
      msg.includes(c)
    );
    throw new ShopError(code ?? "OTHER", msg);
  }
  return Number(data);
}

export interface MyEmoji {
  id: string;
  name: string;
  image_path: string;
  sound_path: string;
  /** Slot terpasang 1..3; null = belum dipasang. */
  slot: number | null;
}

/** Emoji milik akun aktif + slotnya. Guest: daftar kosong. */
export async function listMyEmojis(): Promise<MyEmoji[]> {
  const token = getAccountToken();
  if (!token) return [];
  const { data, error } = await supabase.rpc("list_my_emojis", { p_token: token });
  if (error) throw error;
  return (data ?? []) as MyEmoji[];
}

/** Pasang emoji ke slot 1..3 (emojiId null = kosongkan slot). */
export async function setEmojiSlot(slot: number, emojiId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_emoji_slot", {
    p_token: getAccountToken(),
    p_slot: slot,
    p_emoji_id: emojiId,
  });
  if (error) throw error;
}

export interface AdminEmoji {
  id: string;
  name: string;
  price: number;
  image_path: string;
  sound_path: string;
  is_active: boolean;
  created_at: string;
  /** Jumlah akun yang sudah membeli. */
  owners: number;
}

export async function adminListEmojis(pin: string): Promise<AdminEmoji[]> {
  const { data, error } = await supabase.rpc("admin_list_emojis", { p_pin: pin });
  if (error) throw error;
  return (data ?? []) as AdminEmoji[];
}

export async function adminSetEmojiActive(pin: string, id: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_emoji_active", { p_pin: pin, p_id: id, p_active: active });
  if (error) throw error;
}

export type CreateEmojiErrorCode =
  | "BAD_PIN" | "INVALID_NAME" | "INVALID_PRICE" | "FILES_REQUIRED" | "IMAGE_TOO_LARGE" | "SOUND_TOO_LARGE"
  | "IMAGE_TYPE" | "SOUND_TYPE" | "NAME_TAKEN" | "CONFIG_SERVICE_KEY" | "CONFIG_SUPABASE" | "STORAGE"
  | "NOT_LOGGED_IN" | "TOO_MANY_PENDING" | "INVALID_ID" | "INVALID_ACTION" | "NOT_FOUND"
  | "UPSTREAM" | "NETWORK" | "OTHER";

export class CreateEmojiError extends Error {
  constructor(public code: CreateEmojiErrorCode) {
    super(code);
  }
}

/** Kirim ke route server emoji; sukses = diam, gagal = CreateEmojiError(kode dari server). */
async function sendEmojiRequest(url: string, init: RequestInit): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new CreateEmojiError("NETWORK");
  }
  if (res.ok) return;
  let code: string | undefined;
  try {
    code = (await res.json())?.error;
  } catch {
    /* bukan JSON */
  }
  throw new CreateEmojiError((code as CreateEmojiErrorCode) || "OTHER");
}

/** Buat emoji baru: file diunggah oleh route server (/api/admin/emoji) setelah PIN diverifikasi. */
export async function createEmoji(
  pin: string,
  input: { name: string; price: number; image: Blob; imageName: string; sound: File }
): Promise<void> {
  const form = new FormData();
  form.set("pin", pin);
  form.set("name", input.name);
  form.set("price", String(input.price));
  form.set("image", input.image, input.imageName);
  form.set("sound", input.sound, input.sound.name);
  await sendEmojiRequest("/api/admin/emoji", { method: "POST", body: form });
}

/** Hapus emoji permanen (toko + inventory semua pemain + file) — butuh route server untuk Storage. */
export async function adminDeleteEmoji(pin: string, id: string): Promise<void> {
  await sendEmojiRequest("/api/admin/emoji-remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, action: "delete", id }),
  });
}

// ---------- usulan emoji dari pemain ----------

/** Pemain (ber-akun) mengusulkan emoji; masuk antrean konfirmasi admin. */
export async function suggestEmoji(input: {
  name: string;
  image: Blob;
  imageName: string;
  sound: File;
}): Promise<void> {
  const token = getAccountToken();
  if (!token) throw new CreateEmojiError("NOT_LOGGED_IN");
  const form = new FormData();
  form.set("token", token);
  form.set("name", input.name);
  form.set("image", input.image, input.imageName);
  form.set("sound", input.sound, input.sound.name);
  await sendEmojiRequest("/api/emoji-suggest", { method: "POST", body: form });
}

export interface EmojiSuggestion {
  id: string;
  name: string;
  image_path: string;
  sound_path: string;
  suggested_by: string | null;
  created_at: string;
}

export async function adminListEmojiSuggestions(pin: string): Promise<EmojiSuggestion[]> {
  const { data, error } = await supabase.rpc("admin_list_emoji_suggestions", { p_pin: pin });
  if (error) throw error;
  return (data ?? []) as EmojiSuggestion[];
}

/** Setujui usulan: masuk toko dengan nama (boleh diedit) dan harga yang ditentukan admin. */
export async function adminApproveEmojiSuggestion(
  pin: string,
  id: string,
  name: string,
  price: number
): Promise<void> {
  const { error } = await supabase.rpc("admin_review_emoji_suggestion", {
    p_pin: pin,
    p_id: id,
    p_approve: true,
    p_name: name,
    p_price: price,
  });
  if (error) throw error;
}

/** Tolak usulan (file usulan ikut dihapus oleh route server). */
export async function adminRejectEmojiSuggestion(pin: string, id: string): Promise<void> {
  await sendEmojiRequest("/api/admin/emoji-remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, action: "reject", id }),
  });
}

// ---------- berita hari ini (running text beranda) ----------

export interface NewsItem {
  kind: "word" | "emoji";
  name: string;
  reviewed_at: string;
}

/** Usulan kata/emoji yang diterima hari ini (terbaru dulu). Gagal = daftar kosong. */
export async function fetchTodayNews(): Promise<NewsItem[]> {
  const { data, error } = await supabase.rpc("list_today_news");
  if (error) return [];
  return (data ?? []) as NewsItem[];
}
