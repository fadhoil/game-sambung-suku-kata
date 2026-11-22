import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Pesan jelas saat env belum diisi (biasanya saat setup pertama).
  // Tidak throw agar build tetap jalan; runtime akan menampilkan peringatan.
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi. Salin .env.example ke .env lalu isi kredensial Supabase."
  );
}

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "public-anon-key", {
  realtime: { params: { eventsPerSecond: 10 } },
});
