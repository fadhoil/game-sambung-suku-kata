"use client";

/**
 * Identitas pemain disimpan di localStorage per kode room,
 * agar refresh halaman tidak menghilangkan siapa "saya".
 */
const KEY = "ssk:identity";

export interface Identity {
  playerId: string;
  name: string;
  avatar: string;
  /** true bila pemain ini adalah Admin-SSK (join lewat halaman kamus-admin). */
  isAdmin?: boolean;
}

type Store = Record<string, Identity>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveIdentity(roomCode: string, identity: Identity) {
  if (typeof window === "undefined") return;
  const store = read();
  store[roomCode.toUpperCase()] = identity;
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function getIdentity(roomCode: string): Identity | null {
  const store = read();
  return store[roomCode.toUpperCase()] ?? null;
}

/**
 * ID unik per device (persisten di localStorage). Dipakai server untuk
 * mencegah satu device menjadi beberapa pemain di room yang sama.
 */
const DEVICE_KEY = "ssk:deviceId";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      (crypto.randomUUID && crypto.randomUUID()) ||
      `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/**
 * Akun pemain berbasis perangkat (maks. 3 per perangkat). Disimpan di localStorage;
 * di server hanya HASH token yang tersimpan. Token sengaja terpisah dari deviceId
 * karena deviceId terbaca publik (kolom players.device_id).
 * Catatan: menghapus data browser / ganti browser = akun tidak dikenali lagi.
 */
const ACCOUNTS_KEY = "ssk:accounts";
const LEGACY_ACCOUNT_KEY = "ssk:account"; // format lama (satu akun)
const DEVICE_KEY_KEY = "ssk:deviceKey";

export const MAX_ACCOUNTS_PER_DEVICE = 3;

export interface Account {
  token: string;
  id: string;
  name: string;
  avatar: string;
}

interface AccountStore {
  list: Account[];
  /** id akun yang sedang dipakai; null = main sebagai guest. */
  active: string | null;
}

const isAccount = (a: any): a is Account =>
  !!a && typeof a.token === "string" && typeof a.id === "string" && typeof a.name === "string";

function readStore(): AccountStore {
  if (typeof window === "undefined") return { list: [], active: null };
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "null");
    if (raw && Array.isArray(raw.list)) {
      const list = (raw.list as unknown[]).filter(isAccount).slice(0, MAX_ACCOUNTS_PER_DEVICE);
      const active = list.some((a) => a.id === raw.active) ? (raw.active as string) : null;
      return { list, active };
    }
    // Migrasi sekali dari format lama (satu akun) -> daftar berisi satu akun aktif.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_ACCOUNT_KEY) || "null");
    if (isAccount(legacy)) {
      const store: AccountStore = { list: [legacy], active: legacy.id };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store));
      localStorage.removeItem(LEGACY_ACCOUNT_KEY);
      return store;
    }
  } catch {
    /* data rusak: anggap kosong */
  }
  return { list: [], active: null };
}

function writeStore(store: AccountStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store));
}

/** Semua akun di perangkat ini. */
export function getAccounts(): Account[] {
  return readStore().list;
}

/** Akun yang sedang dipakai (null = guest). */
export function getAccount(): Account | null {
  const { list, active } = readStore();
  return list.find((a) => a.id === active) ?? null;
}

export function getAccountToken(): string | null {
  return getAccount()?.token ?? null;
}

/** Tambah akun baru dan langsung aktifkan. false = kuota perangkat penuh (tidak disimpan). */
export function addAccount(account: Account): boolean {
  const store = readStore();
  const exists = store.list.some((a) => a.id === account.id);
  if (!exists && store.list.length >= MAX_ACCOUNTS_PER_DEVICE) return false;
  const list = exists ? store.list.map((a) => (a.id === account.id ? account : a)) : [...store.list, account];
  writeStore({ list, active: account.id });
  return true;
}

/** Lepas akun dari perangkat ini (dipanggil setelah akun ditandai terhapus di server). */
export function removeAccount(id: string) {
  const store = readStore();
  const list = store.list.filter((a) => a.id !== id);
  writeStore({ list, active: store.active === id ? null : store.active });
}

/** Ganti akun aktif; null = main sebagai guest. */
export function setActiveAccount(id: string | null) {
  const store = readStore();
  writeStore({ list: store.list, active: store.list.some((a) => a.id === id) ? id : null });
}

function randomHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Token acak 128-bit (hex). getRandomValues tersedia juga di konteks non-HTTPS. */
export function newAccountToken(): string {
  return randomHex();
}

/**
 * Kunci perangkat RAHASIA (dibuat sekali). Server hanya menyimpan hash-nya: dipakai
 * sebagai bukti kepemilikan baris pemain (klaim poin) dan untuk kuota akun per perangkat.
 * Berbeda dari deviceId, kunci ini tidak pernah terbaca pemain lain.
 */
export function getDeviceKey(): string {
  if (typeof window === "undefined") return "";
  let k = localStorage.getItem(DEVICE_KEY_KEY);
  if (!k || k.length < 20) {
    k = randomHex();
    localStorage.setItem(DEVICE_KEY_KEY, k);
  }
  return k;
}

export const AVATARS = [
  "🦊", "🐼", "🐨", "🦁", "🐯", "🐸", "🐵", "🐧", "🦉", "🦄",
  "🐙", "🦖", "🐢", "🐳", "🦋", "🐝", "🌟", "🍀", "🔥", "🌈",
];

/**
 * Avatar robot khusus admin (Admin-SSK). Sengaja TIDAK dimasukkan ke AVATARS
 * agar pemain biasa tidak pernah mendapatkannya.
 */
export const ADMIN_AVATAR = "\uD83E\uDD16"; // 🤖

export function randomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}
