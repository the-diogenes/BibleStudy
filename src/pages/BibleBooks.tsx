import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBooks, type BookSummary } from "../lib/bibleApi";
import { useSettings } from "../context/SettingsContext";
import { parseHumanRef } from "../lib/refs";
import TranslationPicker from "../components/TranslationPicker";
import Spinner from "../components/Spinner";

export default function BibleBooks() {
  const { translation } = useSettings();
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BookSummary | null>(null);
  const [query, setQuery] = useState("");
  const [jumpError, setJumpError] = useState(false);

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
        <button className="mb-3 text-sm text-stone-500" onClick={() => setSelected(null)}>
          &larr; All books
        </button>
        <h2 className="mb-3 font-serif text-2xl font-semibold">{selected.commonName}</h2>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {Array.from({ length: selected.numberOfChapters }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              className="card aspect-square text-sm font-medium hover:bg-stone-50"
              onClick={() => navigate(`/read/${selected.id}/${c}`)}
            >
              {c}
            </button>
          ))}
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
      <form onSubmit={jump} className="mb-5">
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
      <BookGroup title="Old Testament" books={ot} onSelect={setSelected} />
      <BookGroup title="New Testament" books={nt} onSelect={setSelected} />
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
