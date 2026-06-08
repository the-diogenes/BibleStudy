import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { config } from "../lib/config";

type Mode = "login" | "signup";

export default function Login() {
  const { status, signInWithPassword, signUpWithPassword, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "member") return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const fn = mode === "login" ? signInWithPassword : signUpWithPassword;
    const res = await fn(username, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else if (res.needsConfirmation) {
      setInfo(
        "Account created, but email confirmation is enabled in Supabase. Ask the admin to disable 'Confirm email' so username sign-in works."
      );
    }
    // On success, the auth listener flips status to "member" and we redirect.
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-semibold">{config.groupName}</h1>
        <p className="mt-2 text-sm text-stone-500">
          A place to read, study, and discuss the Scriptures together.
        </p>
      </div>

      {status === "unconfigured" ? (
        <div className="card p-5 text-sm text-stone-600">
          <p className="font-medium text-ink">Sign-in isn't set up yet.</p>
          <p className="mt-2">
            Add your Supabase project URL and anon key to{" "}
            <span className="font-mono">public/config.js</span> and run{" "}
            <span className="font-mono">supabase/schema.sql</span>. The Bible reader works
            without this.
          </p>
        </div>
      ) : status === "not_invited" ? (
        <div className="card p-5 text-sm text-stone-600">
          <p className="font-medium text-ink">You're signed in, but not on the member list.</p>
          <p className="mt-2">
            Ask the group admin to add your username to the member list, then sign in again.
          </p>
          <button className="btn-ghost mt-4 w-full" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-5">
          <div className="flex gap-1 rounded-lg bg-stone-100 p-1 text-sm">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setInfo(null);
                }}
                className={`flex-1 rounded-md py-1.5 font-medium transition ${
                  mode === m ? "bg-white text-ink shadow-sm" : "text-stone-500"
                }`}
              >
                {m === "login" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>

          <label className="block text-sm font-medium">
            Username
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className="input mt-1"
              placeholder="e.g. lazorRaptor"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="input mt-1"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-amber-700">{info}</p>}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>

          <p className="text-center text-xs text-stone-400">
            {mode === "login"
              ? "Members only. First time? Switch to Create account."
              : "Use the username your admin added to the member list."}
          </p>
        </form>
      )}
    </div>
  );
}
