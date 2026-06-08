import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { getBooks, type BookSummary } from "../lib/bibleApi";
import { listLessons, listStudies, myProgress, setProgress } from "../lib/db";
import { refLabel } from "../lib/refs";
import type { Lesson, Study } from "../types";
import Spinner from "../components/Spinner";
import ShareButton from "../components/ShareButton";
import VerseOfDayCard from "../components/VerseOfDayCard";
import MeetingCard from "../components/MeetingCard";
import { ChevronRight } from "../components/icons";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  upcoming: "bg-stone-100 text-stone-500",
  done: "bg-stone-200 text-stone-500 line-through",
};

export default function Home() {
  const { status, profile, isAdmin } = useAuth();
  const { translation } = useSettings();
  const [studies, setStudies] = useState<Study[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [progress, setProgressMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBooks(translation).then(setBooks).catch(() => setBooks([]));
  }, [translation]);

  useEffect(() => {
    if (status !== "member") {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const s = await listStudies();
        setStudies(s);
        const current = s[0];
        if (current) setLessons(await listLessons(current.id));
        if (profile) setProgressMap(await myProgress(profile.id));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [status, profile]);

  async function toggle(lesson: Lesson) {
    if (!profile) return;
    const next = !progress.get(lesson.id);
    setProgressMap(new Map(progress).set(lesson.id, next));
    try {
      await setProgress(lesson.id, profile.id, next);
    } catch {
      setProgressMap(new Map(progress).set(lesson.id, !next));
    }
  }

  function lessonHref(l: Lesson): string {
    return l.verse_start
      ? `/passage/${l.book}/${l.chapter}/${l.verse_start}`
      : `/read/${l.book}/${l.chapter}`;
  }

  const current = studies[0];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#1c1917] p-5 text-[#f5f2ec]">
        <p className="text-xs uppercase tracking-wide text-[#a8a29e]">Welcome</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold">
          {current ? current.title : "Let's study the Word"}
        </h1>
        {current?.description && (
          <p className="mt-2 text-sm text-[#d6d0c8]">{current.description}</p>
        )}
        <div className="mt-4 flex gap-2">
          <Link to="/bible" className="btn bg-[#f5f2ec] text-[#1c1917] hover:opacity-90">
            Open the Bible
          </Link>
          <Link to="/about" className="btn border border-[#57534e] text-[#f5f2ec] hover:bg-[#2a2520]">
            About
          </Link>
        </div>
      </section>

      {status === "member" && (
        <>
          <VerseOfDayCard />
          <MeetingCard />
        </>
      )}

      {status !== "member" ? (
        <p className="text-sm text-stone-500">
          <Link to="/login" className="underline">
            Sign in
          </Link>{" "}
          to see the group's study plan and join the discussion.
        </p>
      ) : loading ? (
        <Spinner />
      ) : !current ? (
        <div className="card p-5 text-sm text-stone-600">
          <p className="font-medium text-ink">No study plan yet.</p>
          <p className="mt-1">
            {isAdmin ? (
              <>
                Head to <Link className="underline" to="/admin">Admin</Link> to create your first
                study and add lessons.
              </>
            ) : (
              "Your group admin hasn't added a study plan yet."
            )}
          </p>
        </div>
      ) : (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Checklist</h2>
            {isAdmin && (
              <Link to="/admin" className="text-xs text-stone-500 underline">
                Edit
              </Link>
            )}
          </div>
          {lessons.length === 0 ? (
            <p className="text-sm text-stone-500">No lessons added yet.</p>
          ) : (
            <ul className="space-y-2">
              {lessons.map((l) => (
                <li key={l.id} className="card flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-stone-800"
                    checked={!!progress.get(l.id)}
                    onChange={() => toggle(l)}
                    aria-label="Mark complete"
                  />
                  <Link to={lessonHref(l)} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.title}</span>
                    <span className="block text-xs text-stone-400">
                      {refLabel(
                        { book: l.book, chapter: l.chapter, verseStart: l.verse_start, verseEnd: l.verse_end },
                        books
                      )}
                    </span>
                  </Link>
                  <span className={`chip ${STATUS_STYLE[l.status] || STATUS_STYLE.upcoming}`}>
                    {l.status}
                  </span>
                  <ShareButton
                    compact
                    routePath={lessonHref(l).replace(/^\//, "")}
                    title={`${l.title} — ${refLabel(
                      { book: l.book, chapter: l.chapter, verseStart: l.verse_start, verseEnd: l.verse_end },
                      books
                    )}`}
                  />
                  <ChevronRight className="h-5 w-5 shrink-0 text-stone-300" />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
