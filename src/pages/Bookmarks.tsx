import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deleteBookmark, listBookmarks } from "../lib/db";
import type { Bookmark } from "../types";
import Spinner from "../components/Spinner";
import { BookmarkIcon, TrashIcon } from "../components/icons";

function targetPath(b: Bookmark): string {
  return b.verse != null
    ? `/read/${b.book}/${b.chapter}#v${b.verse}`
    : `/read/${b.book}/${b.chapter}`;
}

function label(b: Bookmark): string {
  if (b.label) return b.label;
  return b.verse != null ? `${b.book} ${b.chapter}:${b.verse}` : `${b.book} ${b.chapter}`;
}

export default function Bookmarks() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    listBookmarks(profile.id)
      .then((b) => active && (setItems(b), setLoading(false)))
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [profile]);

  async function remove(id: string) {
    setItems((bs) => bs.filter((b) => b.id !== id));
    try {
      await deleteBookmark(id);
    } catch {
      /* ignore */
    }
  }

  if (loading) return <Spinner label="Loading bookmarks..." />;

  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl font-semibold">Bookmarks</h1>
      <p className="mb-4 text-sm text-stone-500">
        Tap a verse number while reading to bookmark it, or use the bookmark icon to save a whole
        chapter. Jump back here anytime.
      </p>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center text-sm text-stone-500">
          <BookmarkIcon className="h-7 w-7 text-stone-300" />
          <p>No bookmarks yet.</p>
          <Link to="/bible" className="font-medium text-ink hover:underline">
            Open the Bible
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((b) => (
            <li key={b.id} className="card flex items-center justify-between gap-2 px-3 py-3">
              <Link to={targetPath(b)} className="flex min-w-0 flex-1 items-center gap-3">
                <BookmarkIcon className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="truncate font-serif text-base font-medium">{label(b)}</span>
                {b.verse == null && (
                  <span className="chip bg-stone-100 text-stone-500">chapter</span>
                )}
              </Link>
              <button
                onClick={() => remove(b.id)}
                aria-label="Delete bookmark"
                className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
