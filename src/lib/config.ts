export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  groupName: string;
}

declare global {
  interface Window {
    __BIBLE_CONFIG__?: Partial<AppConfig>;
  }
}

const runtime = (typeof window !== "undefined" && window.__BIBLE_CONFIG__) || {};

export const config: AppConfig = {
  supabaseUrl: runtime.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: runtime.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  groupName: runtime.groupName || import.meta.env.VITE_GROUP_NAME || "Our Bible Study",
};

/** True when Supabase credentials are present (accounts, threads, notes available). */
export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
