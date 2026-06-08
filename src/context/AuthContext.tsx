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
import type { Profile } from "../types";

type AuthStatus = "loading" | "signed_out" | "member" | "not_invited" | "unconfigured";

interface AuthValue {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  signInWithEmail: (email: string) => Promise<{ error?: string }>;
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

      // No profile yet: try to create one. RLS only allows this for invited emails.
      const fallbackName = (s.user.email || "Member").split("@")[0];
      const { data: created, error } = await supabase
        .from("profiles")
        .insert({ id: s.user.id, display_name: fallbackName })
        .select("*")
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

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) return { error: "App is not configured for sign-in yet." };
    const redirectTo = window.location.origin + import.meta.env.BASE_URL;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
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
    signInWithEmail,
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
