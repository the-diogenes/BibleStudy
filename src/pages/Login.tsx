import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { config } from "../lib/config";

export default function Login() {
  const { status, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "member") return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signInWithEmail(email);
    setBusy(false);
    if (error) setError(error);
    else setSent(true);
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
            Ask the group admin to add your email to the invite list, then sign in again.
          </p>
          <button className="btn-ghost mt-4 w-full" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : sent ? (
        <div className="card p-5 text-center text-sm text-stone-600">
          <p className="font-medium text-ink">Check your email.</p>
          <p className="mt-2">
            We sent a magic sign-in link to <span className="font-mono">{email}</span>. Open it
            on this device to continue.
          </p>
          <button className="btn-ghost mt-4 w-full" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-5">
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              className="input mt-1"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Sending..." : "Send magic link"}
          </button>
          <p className="text-center text-xs text-stone-400">
            Members-only. You'll receive a one-time sign-in link by email.
          </p>
        </form>
      )}
    </div>
  );
}
