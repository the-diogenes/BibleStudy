import { useEffect, useState } from "react";
import { getBooks, type BookSummary } from "../lib/bibleApi";
import { useSettings } from "../context/SettingsContext";
import {
  addInvite,
  createLesson,
  createStudy,
  deleteLesson,
  deleteStudy,
  listInvites,
  listLessons,
  listStudies,
  removeInvite,
  updateLesson,
} from "../lib/db";
import type { Lesson, LessonStatus, Study } from "../types";
import Spinner from "../components/Spinner";

export default function Admin() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Admin</h1>
      <Invites />
      <Curriculum />
    </div>
  );
}

function Invites() {
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([]);
  const [email, setEmail] = useState("");
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
    if (!email.trim()) return;
    await addInvite(email.trim(), role);
    setEmail("");
    await load();
  }

  return (
    <section className="card p-4">
      <h2 className="font-serif text-lg font-semibold">Members</h2>
      <p className="mb-3 text-xs text-stone-500">
        Only emails on this list can create an account. Add a member, then have them sign in with a
        magic link.
      </p>
      <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
        <input
          type="email"
          className="input flex-1"
          placeholder="member@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="rounded-lg border border-stone-300 px-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn-primary">Invite</button>
      </form>
      {loading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {invites.map((i) => (
            <li key={i.email} className="flex items-center justify-between py-2">
              <span>
                {i.email} <span className="text-xs text-stone-400">({i.role})</span>
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
          {invites.length === 0 && <li className="py-2 text-stone-400">No invites yet.</li>}
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
