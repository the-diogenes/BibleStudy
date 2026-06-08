import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

export default function Profile() {
  const { profile, session, status, isAdmin, signOut, updateDisplayName } = useAuth();
  const { translation } = useSettings();
  const [name, setName] = useState(profile?.display_name || "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    const { error } = await updateDisplayName(name);
    setBusy(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (status !== "member" || !profile) {
    return (
      <div>
        <h1 className="mb-4 font-serif text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-stone-500">
          You're browsing as a guest.{" "}
          <Link to="/login" className="underline">
            Sign in
          </Link>{" "}
          to participate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">Profile</h1>

      <form onSubmit={save} className="card space-y-3 p-4">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className="text-xs text-stone-400">
          Signed in as {session?.user.email} {isAdmin && "· Admin"}
        </p>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved</span>}
        </div>
      </form>

      <div className="card p-4 text-sm">
        <p className="font-medium">Reading preferences</p>
        <p className="mt-1 text-stone-500">
          Default translation: <span className="font-mono">{translation}</span> (change it from the
          Bible tab).
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/about" className="btn-ghost">
          About this group
        </Link>
        {isAdmin && (
          <Link to="/admin" className="btn-ghost">
            Admin tools
          </Link>
        )}
        <button className="btn-ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
