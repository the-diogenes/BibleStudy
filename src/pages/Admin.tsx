import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  addInvite,
  addThreadMessage,
  adminSetPassword,
  allThreads,
  getRequireInvite,
  listInvites,
  listMembers,
  removeInvite,
  setMemberRole,
  setRequireInvite,
  setThreadStatus,
  threadMessages,
} from "../lib/db";
import type { FeedbackMessage, FeedbackThread, Profile } from "../types";
import { emailToUsername, usernameToEmail } from "../lib/username";
import { timeAgo } from "../lib/time";
import Spinner from "../components/Spinner";

export default function Admin() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Admin</h1>
      <p className="text-sm text-stone-500">
        Site-wide controls. Study plans and meetings now live inside each group — open{" "}
        <Link to="/groups" className="underline">
          Groups
        </Link>{" "}
        to manage those.
      </p>
      <AccessControl />
      <Members />
      <FeedbackInbox />
      <Invites />
    </div>
  );
}

function AccessControl() {
  const [requireInvite, setRequire] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRequireInvite()
      .then(setRequire)
      .catch(() => setRequire(false));
  }, []);

  async function toggle() {
    if (requireInvite == null) return;
    const next = !requireInvite;
    setBusy(true);
    setRequire(next);
    try {
      await setRequireInvite(next);
    } catch {
      setRequire(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="font-serif text-lg font-semibold">Who can join</h2>
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="text-sm text-stone-500">
          {requireInvite
            ? "Invite-only: only usernames on the members list (below) can create an account."
            : "Open: anyone with the link can create their own account."}
        </p>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy || requireInvite == null}
          aria-pressed={!!requireInvite}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            requireInvite ? "bg-ink" : "bg-stone-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              requireInvite ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-400">
        {requireInvite == null ? "Loading…" : "Require an invite to join"}
      </p>
    </section>
  );
}

function Members() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMembers(await listMembers().catch(() => []));
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function changeRole(m: Profile) {
    await setMemberRole(m.id, m.role === "admin" ? "member" : "admin");
    await load();
  }

  async function savePassword(id: string) {
    if (pwValue.length < 6) return;
    setMsg(null);
    try {
      await adminSetPassword(id, pwValue);
      setMsg("Password updated. Share it with the member.");
      setPwFor(null);
      setPwValue("");
      setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setMsg((e as Error).message || "Could not update password.");
    }
  }

  return (
    <section className="card p-4">
      <h2 className="font-serif text-lg font-semibold">Member roster</h2>
      <p className="mb-3 text-xs text-stone-500">
        Promote/demote admins, or set a temporary password for someone who's locked out.
      </p>
      {msg && <p className="mb-2 text-sm text-emerald-700">{msg}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {members.map((m) => (
            <li key={m.id} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.display_name || m.username}</span>
                  <span className="block text-xs text-stone-400">
                    @{m.username || "?"} · {m.role}
                  </span>
                </span>
                <div className="flex shrink-0 gap-2">
                  <button className="chip bg-stone-100 text-stone-600" onClick={() => void changeRole(m)}>
                    {m.role === "admin" ? "Make member" : "Make admin"}
                  </button>
                  <button
                    className="chip bg-stone-100 text-stone-600"
                    onClick={() => {
                      setPwFor(pwFor === m.id ? null : m.id);
                      setPwValue("");
                    }}
                  >
                    Password
                  </button>
                </div>
              </div>
              {pwFor === m.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="input"
                    type="text"
                    placeholder="New temporary password (min 6)"
                    value={pwValue}
                    onChange={(e) => setPwValue(e.target.value)}
                  />
                  <button
                    className="btn-primary"
                    disabled={pwValue.length < 6}
                    onClick={() => void savePassword(m.id)}
                  >
                    Set
                  </button>
                </div>
              )}
            </li>
          ))}
          {members.length === 0 && <li className="py-2 text-stone-400">No members yet.</li>}
        </ul>
      )}
    </section>
  );
}

function FeedbackInbox() {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setThreads(await allThreads().catch(() => []));
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function openThread(t: FeedbackThread) {
    if (openId === t.id) {
      setOpenId(null);
      return;
    }
    setOpenId(t.id);
    setMessages(await threadMessages(t.id).catch(() => []));
  }

  async function send(threadId: string) {
    if (!profile || !reply.trim()) return;
    setBusy(true);
    try {
      await addThreadMessage(threadId, profile.id, "admin", reply.trim());
      setReply("");
      setMessages(await threadMessages(threadId));
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="font-serif text-lg font-semibold">Feedback inbox</h2>
      <p className="mb-3 text-xs text-stone-500">Messages members send you. Reply here.</p>
      {loading ? (
        <Spinner />
      ) : threads.length === 0 ? (
        <p className="text-sm text-stone-400">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.id} className="rounded-lg border border-stone-200">
              <button
                onClick={() => void openThread(t)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.subject}</span>
                  <span className="block text-xs text-stone-400">{timeAgo(t.updated_at)}</span>
                </span>
                <span
                  className={`chip ${
                    t.status === "open"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {t.status}
                </span>
              </button>
              {openId === t.id && (
                <div className="border-t border-stone-100 p-3">
                  <div className="space-y-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            m.sender_role === "admin" ? "bg-ink text-parchment" : "bg-stone-100"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className="mt-1 text-[0.65rem] text-stone-400">{timeAgo(m.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input"
                      placeholder="Reply…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                    <button className="btn-primary" disabled={busy || !reply.trim()} onClick={() => void send(t.id)}>
                      Send
                    </button>
                  </div>
                  <button
                    className="mt-2 text-xs text-stone-400 hover:text-ink"
                    onClick={async () => {
                      await setThreadStatus(t.id, t.status === "open" ? "closed" : "open");
                      await load();
                    }}
                  >
                    Mark {t.status === "open" ? "closed" : "open"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Invites() {
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setInvites(await listInvites().catch(() => []));
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    await addInvite(usernameToEmail(username), role);
    setUsername("");
    await load();
  }

  return (
    <section className="card p-4">
      <h2 className="font-serif text-lg font-semibold">Members</h2>
      <p className="mb-3 text-xs text-stone-500">
        Only usernames on this list can create an account. Add a member here, then have them go to
        the login screen, choose "Create account," and set their own password.
      </p>
      <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
        <input
          type="text"
          autoCapitalize="none"
          className="input flex-1"
          placeholder="username (e.g. lazorRaptor)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <select
          className="rounded-lg border border-stone-300 px-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn-primary">Add</button>
      </form>
      {loading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {invites.map((i) => (
            <li key={i.email} className="flex items-center justify-between py-2">
              <span>
                {emailToUsername(i.email)}{" "}
                <span className="text-xs text-stone-400">({i.role})</span>
              </span>
              <button
                className="text-xs text-stone-400 hover:text-red-600"
                onClick={async () => {
                  await removeInvite(i.email);
                  await load();
                }}
              >
                Remove
              </button>
            </li>
          ))}
          {invites.length === 0 && <li className="py-2 text-stone-400">No members yet.</li>}
        </ul>
      )}
    </section>
  );
}

