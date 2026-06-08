import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBooks, type BookSummary } from "../lib/bibleApi";
import { recentThreads } from "../lib/db";
import { labelFromKey } from "../lib/refs";
import { useSettings } from "../context/SettingsContext";
import type { Thread } from "../types";
import Spinner from "../components/Spinner";
import { timeAgo } from "../lib/time";
import { ChevronRight } from "../components/icons";

export default function Threads() {
  const { status } = useAuth();
  const { translation } = useSettings();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    getBooks(translation).then(setBooks).catch(() => setBooks([]));
  }, [translation]);

  useEffect(() => {
    if (status !== "member") {
      setLoading(false);
      return;
    }
    recentThreads()
      .then(setThreads)
      .catch(() => setThreads([]))
      .finally(() => setLoading(false));
  }, [status]);

  function pathForThread(t: Thread): string {
    return t.verse_start
      ? `/passage/${t.book}/${t.chapter}/${t.verse_start}`
      : `/passage/${t.book}/${t.chapter}`;
  }

  const shown = threads.filter((t) => {
    if (!filter.trim()) return true;
    const hay = `${t.title || ""} ${labelFromKey(t.ref, books)}`.toLowerCase();
    return hay.includes(filter.toLowerCase());
  });

  return (
    <div>
      <h1 className="mb-4 font-serif text-2xl font-semibold">Discussions</h1>
      {status !== "member" ? (
        <p className="text-sm text-stone-500">Sign in as a member to see discussions.</p>
      ) : loading ? (
        <Spinner />
      ) : threads.length === 0 ? (
        <p className="text-sm text-stone-500">
          No discussions yet. Open any passage in the reader and start one.
        </p>
      ) : (
        <>
        <input
          className="input mb-3"
          placeholder="Filter discussions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="space-y-2">
          {shown.map((t) => (
            <li key={t.id}>
              <Link
                to={pathForThread(t)}
                className="card flex items-center justify-between px-4 py-3 hover:bg-stone-50"
              >
                <span>
                  <span className="font-medium">{t.title || labelFromKey(t.ref, books)}</span>
                  <span className="block text-xs text-stone-400">
                    {labelFromKey(t.ref, books)} · started {timeAgo(t.created_at)}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 text-stone-300" />
              </Link>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
