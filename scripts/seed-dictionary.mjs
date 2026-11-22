// Upload seluruh kamus (data/*.json) ke tabel public.dictionary di Supabase
// lewat RPC seed_dictionary. Jalankan dari folder game-apps:
//   node scripts/seed-dictionary.mjs
//
// Prasyarat: migration-v3.sql sudah dijalankan di Supabase.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum diisi di .env");
  process.exit(1);
}

const base = JSON.parse(readFileSync("./data/kata-id.json", "utf8"));
const extra = JSON.parse(readFileSync("./data/kata-id-extra.json", "utf8"));
const kbbi = JSON.parse(readFileSync("./data/kata-id-kbbi.json", "utf8"));
const norm = (w) =>
  w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
const all = Array.from(
  new Set([...base, ...extra, ...kbbi].map(norm).filter((w) => w.length >= 2))
);

console.log(`Total kata unik: ${all.length}`);

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const BATCH = 500;
let inserted = 0;

for (let i = 0; i < all.length; i += BATCH) {
  const chunk = all.slice(i, i + BATCH);
  const r = await fetch(`${url}/rest/v1/rpc/seed_dictionary`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_words: chunk }),
  });
  const text = await r.text();
  if (r.status !== 200) {
    console.error(`Batch ${i / BATCH + 1} GAGAL (status ${r.status}):`, text);
    process.exit(1);
  }
  inserted += Number(text) || 0;
  console.log(`Batch ${i / BATCH + 1}: +${text} kata baru`);
}

console.log(`\nSelesai. Total kata baru dimasukkan: ${inserted}`);
console.log("Verifikasi: cek tabel public.dictionary di Supabase.");
