import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { isSupabaseConfigured } from "../lib/config";
import { usernameToEmail } from "../lib/username";
import type { Profile } from "../types";

type AuthStatus = "loading" | "signed_out" | "member" | "not_invited" | "unconfigured";

interface AuthResult {
  error?: string;
  needsConfirmation?: boolean;
}

interface AuthValue {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  signInWithPassword: (username: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (username: string, password: string) => Promise<AuthResult>;
  changePassword: (newPassword: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "loading" : "unconfigured"
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const loadingProfile = useRef(false);

  const loadProfile = useCallback(async (s: Session) => {
    if (!supabase || loadingProfile.current) return;
    loadingProfile.current = true;
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", s.user.id)
        .maybeSingle();

      if (existing) {
        setProfile(existing as Profile);
        setStatus("member");
        return;
      }

      // No profile yet: create one via the onboarding function. It verifies the
      // invite server-side and returns the new profile (or errors if not invited).
      const metaName = (s.user.user_metadata?.username as string | undefined) || "";
      const fallbackName = metaName || (s.user.email || "Member").split("@")[0];
      const { data: created, error } = await supabase
        .rpc("ensure_profile", { p_display_name: fallbackName })
        .single();

      if (error || !created) {
        setProfile(null);
        setStatus("not_invited");
        return;
      }
      setProfile(created as Profile);
      setStatus("member");
    } finally {
      loadingProfile.current = false;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        void loadProfile(data.session);
      } else {
        setStatus("signed_out");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        setStatus("loading");
        void loadProfile(s);
      } else {
        setProfile(null);
        setStatus("signed_out");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithPassword = useCallback(async (username: string, password: string) => {
    if (!supabase) return { error: "App is not configured for sign-in yet." };
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    return error ? { error: error.message } : {};
  }, []);

  const signUpWithPassword = useCallback(async (username: string, password: string) => {
    if (!supabase) return { error: "App is not configured for sign-in yet." };
    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password,
      options: { data: { username: username.trim() } },
    });
    if (error) return { error: error.message };
    // If email confirmation is enabled in Supabase, there is no session yet.
    if (!data.session) return { needsConfirmation: true };
    return {};
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!supabase) return { error: "Not signed in." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
    setStatus("signed_out");
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session);
  }, [session, loadProfile]);

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!supabase || !profile) return { error: "Not signed in." };
      const { data, error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() })
        .eq("id", profile.id)
        .select("*")
        .single();
      if (error) return { error: error.message };
      setProfile(data as Profile);
      return {};
    },
    [profile]
  );

  const value: AuthValue = {
    status,
    session,
    profile,
    isAdmin: profile?.role === "admin",
    signInWithPassword,
    signUpWithPassword,
    changePassword,
    signOut,
    refreshProfile,
    updateDisplayName,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
