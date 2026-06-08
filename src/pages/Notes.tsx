import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBooks, type BookSummary } from "../lib/bibleApi";
import { getMembersMap, listGroupNotes, listMyNotes } from "../lib/db";
import { labelFromKey } from "../lib/refs";
import { useSettings } from "../context/SettingsContext";
import type { Note } from "../types";
import Spinner from "../components/Spinner";
import { timeAgo } from "../lib/time";

type Scope = "mine" | "group";

export default function Notes() {
  const { status, profile } = useAuth();
  const { translation } = useSettings();
  const [scope, setScope] = useState<Scope>("mine");
  const [notes, setNotes] = useState<Note[]>([]);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    getBooks(translation).then(setBooks).catch(() => setBooks([]));
  }, [translation]);

  useEffect(() => {
    if (status !== "member" || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const fetcher = scope === "mine" ? listMyNotes(profile.id) : listGroupNotes();
    Promise.all([fetcher, getMembersMap()])
      .then(([n, m]) => {
        setNotes(n);
        setMembers(m);
      })
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [status, profile, scope]);

  function pathFor(n: Note): string {
    return n.verse_start
      ? `/passage/${n.book}/${n.chapter}/${n.verse_start}`
      : `/passage/${n.book}/${n.chapter}`;
  }

  const shown = notes.filter((n) => {
    if (!filter.trim()) return true;
    const hay = `${n.body} ${labelFromKey(n.ref, books)}`.toLowerCase();
    return hay.includes(filter.toLowerCase());
  });

  return (
    <div>
      <h1 className="mb-4 font-serif text-2xl font-semibold">Notes</h1>

      <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1 text-sm">
        {(["mine", "group"] as Scope[]).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`flex-1 rounded-md py-1.5 font-medium capitalize transition ${
              scope === s ? "bg-white text-ink shadow-sm" : "text-stone-500"
            }`}
          >
            {s === "mine" ? "My notes" : "Group notes"}
          </button>
        ))}
      </div>

      {status !== "member" ? (
        <p className="text-sm text-stone-500">Sign in as a member to keep and read notes.</p>
      ) : loading ? (
        <Spinner />
      ) : notes.length === 0 ? (
        <p className="text-sm text-stone-500">No notes here yet.</p>
      ) : (
        <>
        <input
          className="input mb-3"
          placeholder="Filter notes..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="space-y-2">
          {shown.map((n) => (
            <li key={n.id} className="card p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                <Link to={pathFor(n)} className="font-medium text-stone-600 hover:text-ink">
                  {labelFromKey(n.ref, books)}
                </Link>
                <span>{timeAgo(n.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-stone-800">{n.body}</p>
              {scope === "group" && (
                <p className="mt-1 text-xs text-stone-400">— {members.get(n.author) || "Member"}</p>
              )}
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
