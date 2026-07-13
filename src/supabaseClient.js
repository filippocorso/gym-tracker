import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error(
    "Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Controlla il file .env (vedi README)."
  );
}

export const supabase = createClient(url, key);
