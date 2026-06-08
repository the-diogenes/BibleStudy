import { useEffect, useState } from "react";
import { getBooks, type BookSummary } from "../lib/bibleApi";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import { useSettings } from "../context/SettingsContext";
import {
  createGroup,
  createLesson,
  createMeeting,
  createStudy,
  deleteGroup,
  deleteLesson,
  deleteMeeting,
  deleteStudy,
  joinGroup,
  listGroupMembers,
  listLessons,
  listMeetings,
  listStudies,
  lookupGroup,
  removeGroupMember,
  renameGroup,
  setGroupMemberRole,
  updateLesson,
} from "../lib/db";
import type { GroupMember, Lesson, LessonStatus, Meeting, Study } from "../types";
import Spinner from "../components/Spinner";
import { CheckIcon, CopyIcon } from "../components/icons";

export default function Groups() {
  const { loading, groups, activeGroup, activeGroupId, isGroupAdmin, setActiveGroup, refresh } =
    useGroups();

  if (loading) return <Spinner label="Loading your groups..." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Groups</h1>
        <p className="mt-1 text-sm text-stone-500">
          Each group has its own study plan, discussions, and notes. Share a group's code to invite
          others.
        </p>
      </div>

      {groups.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Your groups
          </h2>
          <div className="space-y-2">
            {groups.map((g) => (
              <button
                key={g.group.id}
                onClick={() => setActiveGroup(g.group.id)}
                className={`card flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${
                  g.group.id === activeGroupId ? "ring-2 ring-ink" : "hover:bg-stone-50"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-serif text-base font-medium">
                    {g.group.name}
                  </span>
                  <span className="block text-xs text-stone-400">
                    {g.role === "admin" ? "Group admin" : "Member"}
                    {g.group.id === activeGroupId ? " · active" : ""}
                  </span>
                </span>
                {g.group.id === activeGroupId && <CheckIcon className="h-5 w-5 shrink-0 text-ink" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {activeGroup && (
        <ManageGroup
          key={activeGroup.id}
          groupId={activeGroup.id}
          isAdmin={isGroupAdmin}
          onChanged={refresh}
        />
      )}

      {activeGroup && isGroupAdmin && (
        <>
          <Curriculum groupId={activeGroup.id} />
          <MeetingsAdmin groupId={activeGroup.id} />
        </>
      )}

      <CreateOrJoin onDone={refresh} canCreate={groups.filter((g) => g.role === "admin").length < 5} />
    </div>
  );
}

function ManageGroup({
  groupId,
  isAdmin,
  onChanged,
}: {
  groupId: string;
  isAdmin: boolean;
  onChanged: () => Promise<void>;
}) {
  const { profile } = useAuth();
  const { groups, setActiveGroup } = useGroups();
  const group = groups.find((g) => g.group.id === groupId)?.group;
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [name, setName] = useState(group?.name || "");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function loadMembers() {
    setMembers(await listGroupMembers(groupId).catch(() => []));
  }
  useEffect(() => {
    setName(group?.name || "");
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function copyCode() {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function saveName() {
    if (!group || !name.trim() || name.trim() === group.name) return;
    await renameGroup(groupId, name.trim());
    await onChanged();
  }

  async function toggleRole(m: GroupMember) {
    await setGroupMemberRole(groupId, m.user_id, m.role === "admin" ? "member" : "admin");
    await loadMembers();
    await onChanged();
  }

  async function kick(m: GroupMember) {
    await removeGroupMember(groupId, m.user_id);
    await loadMembers();
  }

  async function leave() {
    if (!profile) return;
    await removeGroupMember(groupId, profile.id);
    await onChanged();
  }

  async function destroy() {
    await deleteGroup(groupId);
    setActiveGroup("");
    await onChanged();
  }

  if (!group) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
        {group.name}
      </h2>

      <div className="card space-y-4 p-4 text-sm">
        <div>
          <p className="font-medium">Share code</p>
          <p className="mt-1 text-stone-500">
            Anyone can join by entering this code under "Join a group."
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg bg-stone-100 px-3 py-2 font-mono text-base tracking-widest">
              {group.code}
            </code>
            <button onClick={() => void copyCode()} className="btn-ghost">
              {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {isAdmin && (
          <div>
            <p className="font-medium">Group name</p>
            <div className="mt-2 flex gap-2">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              <button
                className="btn-primary"
                disabled={!name.trim() || name.trim() === group.name}
                onClick={() => void saveName()}
              >
                Save
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="font-medium">Members ({members.length})</p>
          <ul className="mt-2 divide-y divide-stone-100">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block text-xs text-stone-400">
                    {m.role === "admin" ? "Group admin" : "Member"}
                    {m.user_id === profile?.id ? " · you" : ""}
                  </span>
                </span>
                {isAdmin && m.user_id !== profile?.id && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      className="chip bg-stone-100 text-stone-600"
                      onClick={() => void toggleRole(m)}
                    >
                      {m.role === "admin" ? "Make member" : "Make admin"}
                    </button>
                    <button
                      className="chip bg-stone-100 text-stone-600 hover:text-red-600"
                      onClick={() => void kick(m)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
          <button className="text-xs text-stone-400 hover:text-red-600" onClick={() => void leave()}>
            Leave group
          </button>
          {isAdmin &&
            (confirmDelete ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-red-600">Delete this group and all its content?</span>
                <button className="font-medium text-red-600 underline" onClick={() => void destroy()}>
                  Yes, delete
                </button>
                <button className="text-stone-400 underline" onClick={() => setConfirmDelete(false)}>
                  cancel
                </button>
              </span>
            ) : (
              <button
                className="text-xs text-stone-400 hover:text-red-600"
                onClick={() => setConfirmDelete(true)}
              >
                Delete group
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}

function CreateOrJoin({
  onDone,
  canCreate,
}: {
  onDone: () => Promise<void>;
  canCreate: boolean;
}) {
  const { setActiveGroup } = useGroups();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ id: string; name: string; member_count: number } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const g = await createGroup(name.trim());
      setName("");
      await onDone();
      setActiveGroup(g.id);
    } catch (e) {
      const msg = (e as Error).message || "";
      setErr(/limit/i.test(msg) ? "You can create up to 5 groups." : "Could not create the group.");
    } finally {
      setBusy(false);
    }
  }

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    setPreview(null);
    try {
      const g = await lookupGroup(code.trim());
      if (!g) setErr("No group found with that code.");
      else setPreview(g);
    } catch {
      setErr("Could not look up that code.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!preview) return;
    setBusy(true);
    setErr(null);
    try {
      const g = await joinGroup(code.trim());
      setCode("");
      setPreview(null);
      await onDone();
      setActiveGroup(g.id);
    } catch {
      setErr("Could not join that group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
        Start or join a group
      </h2>

      <form onSubmit={create} className="card space-y-2 p-4 text-sm">
        <p className="font-medium">Create a group</p>
        <p className="text-stone-500">You'll be its group admin and get a code to share.</p>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Group name (e.g. Thursday Men's Study)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canCreate}
          />
          <button className="btn-primary" disabled={busy || !name.trim() || !canCreate}>
            Create
          </button>
        </div>
        {!canCreate && (
          <p className="text-xs text-stone-400">You've reached the limit of 5 groups you can create.</p>
        )}
      </form>

      <form onSubmit={find} className="card space-y-2 p-4 text-sm">
        <p className="font-medium">Join a group</p>
        <p className="text-stone-500">Enter the code someone shared with you.</p>
        <div className="flex gap-2">
          <input
            className="input font-mono tracking-widest"
            placeholder="GROUP CODE"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setPreview(null);
            }}
          />
          <button className="btn-ghost" disabled={busy || !code.trim()}>
            Find
          </button>
        </div>
        {preview && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate font-medium">{preview.name}</span>
              <span className="block text-xs text-stone-400">{preview.member_count} member(s)</span>
            </span>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void join()}>
              Join
            </button>
          </div>
        )}
      </form>

      {err && <p className="text-sm text-red-600">{err}</p>}
    </section>
  );
}

// ───────────────────────── Curriculum (group admin) ─────────────────────────
function Curriculum({ groupId }: { groupId: string }) {
  const [studies, setStudies] = useState<Study[]>([]);
  const [activeStudy, setActiveStudy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const s = await listStudies(groupId).catch(() => []);
    setStudies(s);
    if (!activeStudy && s[0]) setActiveStudy(s[0].id);
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const s = await createStudy(groupId, title.trim(), description.trim());
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
              groupId={groupId}
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

function LessonEditor({
  groupId,
  studyId,
  onDeleteStudy,
}: {
  groupId: string;
  studyId: string;
  onDeleteStudy: () => void;
}) {
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
      group_id: groupId,
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

// ───────────────────────── Meetings (group admin) ─────────────────────────
function MeetingsAdmin({ groupId }: { groupId: string }) {
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
    setMeetings(await listMeetings(groupId).catch(() => []));
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await createMeeting({
      group_id: groupId,
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
