import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getBooks, type BookSummary } from "../lib/bibleApi";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { getBookReads } from "../lib/db";
import { parseHumanRef } from "../lib/refs";
import { readHex, readTintStyle } from "../lib/readColor";
import TranslationPicker from "../components/TranslationPicker";
import Spinner from "../components/Spinner";
import { BookmarkIcon } from "../components/icons";

export default function BibleBooks() {
  const { translation, readColor } = useSettings();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reads, setReads] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [jumpError, setJumpError] = useState(false);

  // The chosen book lives in the URL (?book=LUK) so the reader's back button can
  // return straight to a book's chapter list, and chapter list back to all books.
  const bookId = searchParams.get("book");
  const selected = useMemo(() => books.find((b) => b.id === bookId) || null, [books, bookId]);
  const selectBook = (b: BookSummary) => setSearchParams({ book: b.id });
  const clearBook = () => setSearchParams({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getBooks(translation)
      .then((b) => active && (setBooks(b), setLoading(false)))
      .catch((e) => active && (setError(String(e.message || e)), setLoading(false)));
    return () => {
      active = false;
    };
  }, [translation]);

  useEffect(() => {
    if (!profile || !selected) {
      setReads(new Set());
      return;
    }
    let active = true;
    getBookReads(profile.id, selected.id)
      .then((s) => active && setReads(s))
      .catch(() => active && setReads(new Set()));
    return () => {
      active = false;
    };
  }, [profile, selected]);

  const { ot, nt } = useMemo(() => {
    const ot = books.filter((b) => b.order <= 39);
    const nt = books.filter((b) => b.order > 39);
    return { ot, nt };
  }, [books]);

  function jump(e: React.FormEvent) {
    e.preventDefault();
    const r = parseHumanRef(query, books);
    if (!r) {
      setJumpError(true);
      return;
    }
    setJumpError(false);
    setQuery("");
    if (r.verseStart) navigate(`/passage/${r.book}/${r.chapter}/${r.verseStart}`);
    else navigate(`/read/${r.book}/${r.chapter}`);
  }

  if (loading) return <Spinner label="Loading books..." />;
  if (error)
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Could not load books: {error}</p>
    );

  if (selected) {
    return (
      <div>
        <button className="mb-3 text-sm text-stone-500" onClick={clearBook}>
          &larr; All books
        </button>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold">{selected.commonName}</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-400">
            <span
              className="h-3 w-3 rounded-sm ring-1"
              style={{ backgroundColor: `${readHex(readColor)}2e`, borderColor: readHex(readColor) }}
            />{" "}
            read
          </span>
        </div>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {Array.from({ length: selected.numberOfChapters }, (_, i) => i + 1).map((c) => {
            const isRead = reads.has(c);
            return (
              <button
                key={c}
                className={`aspect-square rounded-xl border text-sm font-medium shadow-sm transition hover:brightness-95 ${
                  isRead ? "" : "card hover:bg-stone-50"
                }`}
                style={isRead ? readTintStyle(readColor) : undefined}
                onClick={() => navigate(`/read/${selected.id}/${c}`)}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">Bible</h1>
        <TranslationPicker />
      </div>
      <form onSubmit={jump} className="mb-3">
        <input
          className="input"
          placeholder="Jump to a reference, e.g. John 3:16"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setJumpError(false);
          }}
        />
        {jumpError && (
          <p className="mt-1 text-xs text-red-600">
            Couldn't find that reference. Try "John 3" or "Genesis 1:1".
          </p>
        )}
      </form>
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          to="/bookmarks"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-ink"
        >
          <BookmarkIcon className="h-4 w-4" />
          Bookmarks
        </Link>
        <Link
          to="/reference"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-ink"
        >
          <span className="font-serif text-lg">Αα · אב</span>
          Greek &amp; Hebrew alphabet guide
        </Link>
      </div>
      <BookGroup title="Old Testament" books={ot} onSelect={selectBook} />
      <BookGroup title="New Testament" books={nt} onSelect={selectBook} />
    </div>
  );
}

function BookGroup({
  title,
  books,
  onSelect,
}: {
  title: string;
  books: BookSummary[];
  onSelect: (b: BookSummary) => void;
}) {
  if (books.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {books.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
            className="card px-3 py-2.5 text-left text-sm font-medium hover:bg-stone-50"
          >
            {b.commonName}
          </button>
        ))}
      </div>
    </section>
  );
}
