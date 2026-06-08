import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings, type ThemePref } from "../context/SettingsContext";
import { emailToUsername } from "../lib/username";
import { READ_COLORS } from "../lib/readColor";
import TranslationPicker from "../components/TranslationPicker";

export default function Profile() {
  const { profile, session, status, isAdmin, signOut, updateDisplayName, changePassword } = useAuth();
  const { theme, setTheme, readColor, setReadColor } = useSettings();
  const [name, setName] = useState(profile?.display_name || "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

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

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    const { error } = await changePassword(pw);
    setPwBusy(false);
    if (error) setPwMsg(error);
    else {
      setPw("");
      setPwMsg("Password updated.");
      setTimeout(() => setPwMsg(null), 2500);
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
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Profile</h1>

      {/* ─────────── Account ─────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Account</h2>

        <form onSubmit={save} className="card space-y-3 p-4">
          <div>
            <label className="text-sm font-medium">Display name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <p className="text-xs text-stone-400">
            Signed in as {session?.user.email ? emailToUsername(session.user.email) : "member"}{" "}
            {isAdmin && "· Admin"}
          </p>
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </button>
            {saved && <span className="text-sm text-emerald-600">Saved</span>}
          </div>
        </form>

        <form onSubmit={savePassword} className="card space-y-3 p-4">
          <p className="text-sm font-medium">Change password</p>
          <input
            type="password"
            className="input"
            placeholder="New password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={pwBusy || pw.length < 6}>
              {pwBusy ? "Updating..." : "Update password"}
            </button>
            {pwMsg && <span className="text-sm text-stone-500">{pwMsg}</span>}
          </div>
        </form>
      </section>

      {/* ─────────── Reading ─────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Reading</h2>

        <div className="card space-y-5 p-4 text-sm">
          <div>
            <p className="font-medium">Default translation</p>
            <p className="mt-1 text-stone-500">Used everywhere you read. Saved on this device.</p>
            <TranslationPicker className="mt-2 max-w-full" />
          </div>
          <div>
            <p className="font-medium">Read indicator color</p>
            <p className="mt-1 text-stone-500">
              Chapters you've read are tinted this color in the chapter list.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {READ_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={readColor === c.id}
                  onClick={() => setReadColor(c.id)}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    readColor === c.id ? "border-ink scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Appearance ─────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Appearance</h2>

        <div className="card p-4 text-sm">
          <p className="font-medium">Theme</p>
          <div className="mt-2 flex gap-1 rounded-lg bg-stone-100 p-1">
            {(["light", "dark", "system"] as ThemePref[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-md py-1.5 font-medium capitalize transition ${
                  theme === t ? "bg-white text-ink shadow-sm" : "text-stone-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── More ─────────── */}
      <div className="flex flex-wrap gap-3">
        <Link to="/bookmarks" className="btn-ghost">
          Bookmarks
        </Link>
        <Link to="/contact" className="btn-ghost">
          Contact &amp; feedback
        </Link>
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
