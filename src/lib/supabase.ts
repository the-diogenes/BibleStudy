import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "./config";

// A single shared client. Null when the app has not been configured yet, so the
// Bible reader still works offline / without a backend.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Throws a friendly error if backend features are used without configuration. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Copy public/config.example.js to public/config.js and add your project URL + anon key."
    );
  }
  return supabase;
}
