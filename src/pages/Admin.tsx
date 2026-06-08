import { useEffect, useState } from "react";
import { getBooks, type BookSummary } from "../lib/bibleApi";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import {
  addInvite,
  addThreadMessage,
  adminSetPassword,
  allThreads,
  createLesson,
  createMeeting,
  createStudy,
  deleteLesson,
  deleteMeeting,
  deleteStudy,
  getRequireInvite,
  listInvites,
  listLessons,
  listMembers,
  listMeetings,
  listStudies,
  removeInvite,
  setMemberRole,
  setRequireInvite,
  setThreadStatus,
  threadMessages,
  updateLesson,
} from "../lib/db";
import type { FeedbackMessage, FeedbackThread, Lesson, LessonStatus, Meeting, Profile, Study } from "../types";
import { emailToUsername, usernameToEmail } from "../lib/username";
import { timeAgo } from "../lib/time";
import Spinner from "../components/Spinner";

export default function Admin() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Admin</h1>
      <AccessControl />
      <Members />
      <MeetingsAdmin />
      <FeedbackInbox />
      <Invites />
      <Curriculum />
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

function MeetingsAdmin() {
  const { translation } = useSettings();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    startsAt: "",
    location: "",
    book: "",
    chapter: "",
    notes: "",
  });

  useEffect(() => {
    getBooks(translation).then(setBooks).catch(() => setBooks([]));
  }, [translation]);

  async function load() {
    setLoading(true);
    setMeetings(await listMeetings().catch(() => []));
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await createMeeting({
      title: form.title.trim(),
      starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      location: form.location.trim() || null,
      book: form.book || null,
      chapter: form.chapter ? Number(form.chapter) : null,
      verse_start: null,
      verse_end: null,
      notes: form.notes.trim() || null,
    });
    setForm({ title: "", startsAt: "", location: "", book: "", chapter: "", notes: "" });
    await load();
  }

  return (
    <section className="card p-4">
      <h2 className="font-serif text-lg font-semibold">Meetings</h2>
      <p className="mb-3 text-xs text-stone-500">
        The next upcoming meeting shows on Home with RSVP buttons.
      </p>
      <form onSubmit={add} className="mb-4 space-y-2 rounded-lg bg-stone-50 p-3">
        <input
          className="input"
          placeholder="Title (e.g. Thursday men's study)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
          />
          <input
            className="input flex-1"
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input flex-1"
            value={form.book}
            onChange={(e) => setForm({ ...form, book: e.target.value })}
          >
            <option value="">Passage (optional)</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.commonName}
              </option>
            ))}
          </select>
          <input
            className="input w-24"
            type="number"
            min={1}
            placeholder="Ch"
            value={form.chapter}
            onChange={(e) => setForm({ ...form, chapter: e.target.value })}
          />
        </div>
        <input
          className="input"
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button className="btn-primary">Add meeting</button>
      </form>

      {loading ? (
        <Spinner />
      ) : (
        <ul className="space-y-2">
          {meetings.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.title}</span>
                <span className="block text-xs text-stone-400">
                  {m.starts_at ? new Date(m.starts_at).toLocaleString() : "Time TBD"}
                  {m.location ? ` · ${m.location}` : ""}
                </span>
              </span>
              <button
                className="text-xs text-stone-400 hover:text-red-600"
                onClick={async () => {
                  await deleteMeeting(m.id);
                  await load();
                }}
              >
                Delete
              </button>
            </li>
          ))}
          {meetings.length === 0 && <li className="text-sm text-stone-400">No meetings yet.</li>}
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

function Curriculum() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [activeStudy, setActiveStudy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const s = await listStudies().catch(() => []);
    setStudies(s);
    if (!activeStudy && s[0]) setActiveStudy(s[0].id);
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const s = await createStudy(title.trim(), description.trim());
    setTitle("");
    setDescription("");
    setActiveStudy(s.id);
    await load();
  }

  return (
    <section className="card p-4">
      <h2 className="font-serif text-lg font-semibold">Study plan</h2>
      <form onSubmit={add} className="my-3 space-y-2">
        <input
          className="input"
          placeholder="Study title (e.g. The Gospel of John)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="input"
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="btn-primary">Add study</button>
      </form>

      {loading ? (
        <Spinner />
      ) : studies.length === 0 ? (
        <p className="text-sm text-stone-400">No studies yet.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {studies.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStudy(s.id)}
                className={`chip ${
                  activeStudy === s.id ? "bg-ink text-parchment" : "bg-stone-100 text-stone-600"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
          {activeStudy && (
            <LessonEditor
              studyId={activeStudy}
              onDeleteStudy={async () => {
                await deleteStudy(activeStudy);
                setActiveStudy(null);
                await load();
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function LessonEditor({ studyId, onDeleteStudy }: { studyId: string; onDeleteStudy: () => void }) {
  const { translation } = useSettings();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    book: "JHN",
    chapter: "1",
    verseStart: "",
    verseEnd: "",
    status: "upcoming" as LessonStatus,
  });

  useEffect(() => {
    getBooks(translation).then(setBooks).catch(() => setBooks([]));
  }, [translation]);

  async function load() {
    setLoading(true);
    setLessons(await listLessons(studyId).catch(() => []));
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await createLesson({
      study_id: studyId,
      title: form.title.trim(),
      book: form.book,
      chapter: Number(form.chapter) || 1,
      verse_start: form.verseStart ? Number(form.verseStart) : null,
      verse_end: form.verseEnd ? Number(form.verseEnd) : null,
      status: form.status,
      link: null,
      notes: null,
      position: lessons.length,
    });
    setForm({ ...form, title: "", verseStart: "", verseEnd: "" });
    await load();
  }

  async function move(index: number, dir: -1 | 1) {
    const other = index + dir;
    if (other < 0 || other >= lessons.length) return;
    const a = lessons[index];
    const b = lessons[other];
    await Promise.all([
      updateLesson(a.id, { position: b.position }),
      updateLesson(b.id, { position: a.position }),
    ]);
    await load();
  }

  async function cycleStatus(l: Lesson) {
    const order: LessonStatus[] = ["upcoming", "active", "done"];
    const next = order[(order.indexOf(l.status) + 1) % order.length];
    await updateLesson(l.id, { status: next });
    await load();
  }

  return (
    <div>
      <form onSubmit={add} className="mb-4 space-y-2 rounded-lg bg-stone-50 p-3">
        <input
          className="input"
          placeholder="Lesson title (e.g. The Word became flesh)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div className="flex flex-wrap gap-2">
          <select
            className="input flex-1"
            value={form.book}
            onChange={(e) => setForm({ ...form, book: e.target.value })}
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.commonName}
              </option>
            ))}
          </select>
          <input
            className="input w-20"
            type="number"
            min={1}
            placeholder="Ch"
            value={form.chapter}
            onChange={(e) => setForm({ ...form, chapter: e.target.value })}
          />
          <input
            className="input w-20"
            type="number"
            min={1}
            placeholder="v."
            value={form.verseStart}
            onChange={(e) => setForm({ ...form, verseStart: e.target.value })}
          />
          <input
            className="input w-20"
            type="number"
            min={1}
            placeholder="to"
            value={form.verseEnd}
            onChange={(e) => setForm({ ...form, verseEnd: e.target.value })}
          />
        </div>
        <button className="btn-primary">Add lesson</button>
      </form>

      {loading ? (
        <Spinner />
      ) : (
        <ul className="space-y-2">
          {lessons.map((l, i) => (
            <li key={l.id} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2 text-sm">
              <div className="flex flex-col">
                <button className="text-stone-400 hover:text-ink" onClick={() => move(i, -1)}>
                  ▲
                </button>
                <button className="text-stone-400 hover:text-ink" onClick={() => move(i, 1)}>
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{l.title}</span>
                <span className="text-xs text-stone-400">
                  {l.book} {l.chapter}
                  {l.verse_start ? `:${l.verse_start}` : ""}
                  {l.verse_end && l.verse_end !== l.verse_start ? `-${l.verse_end}` : ""}
                </span>
              </div>
              <button className="chip bg-stone-100 capitalize text-stone-600" onClick={() => cycleStatus(l)}>
                {l.status}
              </button>
              <button
                className="text-xs text-stone-400 hover:text-red-600"
                onClick={async () => {
                  await deleteLesson(l.id);
                  await load();
                }}
              >
                Delete
              </button>
            </li>
          ))}
          {lessons.length === 0 && <li className="text-sm text-stone-400">No lessons yet.</li>}
        </ul>
      )}

      <button className="mt-4 text-xs text-stone-400 hover:text-red-600" onClick={onDeleteStudy}>
        Delete this study
      </button>
    </div>
  );
}
