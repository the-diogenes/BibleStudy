export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  groupName: string;
  /** Where contact/feedback notifications are emailed (FormSubmit). */
  notifyEmail: string;
  /** Optional Ko-fi page for "Support" links (empty hides them). */
  kofiUrl: string;
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
  notifyEmail: runtime.notifyEmail || import.meta.env.VITE_NOTIFY_EMAIL || "john.raymond.jr@gmail.com",
  kofiUrl: runtime.kofiUrl || import.meta.env.VITE_KOFI_URL || "",
};

/** True when Supabase credentials are present (accounts, threads, notes available). */
export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
