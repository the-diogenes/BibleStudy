import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getBooks,
  getChapter,
  verseText,
  type BookSummary,
  type Chapter,
} from "../lib/bibleApi";
import { getChapterInterlinear, type ChapterInterlinear, type InterlinearWord } from "../lib/interlinear";
import { useSettings } from "../context/SettingsContext";
import TranslationPicker from "../components/TranslationPicker";
import WordPopover from "../components/WordPopover";
import Spinner from "../components/Spinner";
import { ArrowLeft } from "../components/icons";

export default function Reader() {
  const { book = "", chapter = "1" } = useParams();
  const chapterNum = Number(chapter) || 1;
  const { translation, interlinear, setInterlinear } = useSettings();
  const navigate = useNavigate();

  const [books, setBooks] = useState<BookSummary[]>([]);
  const [data, setData] = useState<Chapter | null>(null);
  const [inter, setInter] = useState<ChapterInterlinear | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popover, setPopover] = useState<InterlinearWord | null>(null);

  useEffect(() => {
    getBooks(translation).then(setBooks).catch(() => setBooks([]));
  }, [translation]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    getChapter(translation, book, chapterNum)
      .then((c) => active && (setData(c), setLoading(false)))
      .catch((e) => active && (setError(String(e.message || e)), setLoading(false)));
    return () => {
      active = false;
    };
  }, [translation, book, chapterNum]);

  useEffect(() => {
    if (!interlinear) {
      setInter(null);
      return;
    }
    let active = true;
    getChapterInterlinear(book, chapterNum).then((d) => active && setInter(d));
    return () => {
      active = false;
    };
  }, [interlinear, book, chapterNum]);

  const currentBook = useMemo(() => books.find((b) => b.id === book), [books, book]);
  const bookName = currentBook?.commonName || book;

  const { prev, next } = useMemo(() => {
    if (!currentBook) return { prev: null as string | null, next: null as string | null };
    let prev: string | null = null;
    let next: string | null = null;
    if (chapterNum > 1) prev = `/read/${book}/${chapterNum - 1}`;
    else {
      const pb = books.find((b) => b.order === currentBook.order - 1);
      if (pb) prev = `/read/${pb.id}/${pb.numberOfChapters}`;
    }
    if (chapterNum < currentBook.numberOfChapters) next = `/read/${book}/${chapterNum + 1}`;
    else {
      const nb = books.find((b) => b.order === currentBook.order + 1);
      if (nb) next = `/read/${nb.id}/1`;
    }
    return { prev, next };
  }, [books, currentBook, book, chapterNum]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          className="flex items-center gap-1 text-sm text-stone-500"
          onClick={() => navigate("/bible")}
        >
          <ArrowLeft className="h-4 w-4" /> Books
        </button>
        <TranslationPicker />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">
          {bookName} {chapterNum}
        </h1>
        <label className="flex items-center gap-2 text-xs text-stone-500">
          <input
            type="checkbox"
            checked={interlinear}
            onChange={(e) => setInterlinear(e.target.checked)}
          />
          Interlinear
        </label>
      </div>

      {loading && <Spinner label="Loading passage..." />}
      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Could not load: {error}</p>
      )}

      {data && (
        <article className="prose-scripture font-serif text-[1.075rem] leading-8 text-stone-800">
          {interlinear && !inter && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 font-sans text-xs text-amber-900">
              Interlinear data for this chapter isn't bundled yet. Showing the translation.
              See <span className="font-mono">scripts/build-interlinear.mjs</span>.
            </p>
          )}
          {data.content.map((item, i) => {
            if (item.type === "heading") {
              return (
                <h2 key={i} className="mt-5 mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-stone-400">
                  {(item.content || []).join(" ")}
                </h2>
              );
            }
            if (item.type === "verse" && item.number != null) {
              const vnum = item.number;
              const words = interlinear && inter ? inter.verses[String(vnum)] : undefined;
              return (
                <p key={i} id={`v${vnum}`} className="group">
                  <Link
                    to={`/passage/${book}/${chapterNum}/${vnum}`}
                    className="mr-1 align-super font-sans text-[0.7rem] font-semibold text-stone-400 hover:text-ink"
                  >
                    {vnum}
                  </Link>
                  {words ? (
                    <span className="inline-flex flex-wrap gap-x-3 gap-y-2 align-top">
                      {words.map((w, wi) => (
                        <button
                          key={wi}
                          onClick={() => setPopover(w)}
                          className="inline-flex flex-col items-center rounded px-0.5 leading-tight hover:bg-amber-50"
                        >
                          <span className="font-serif text-lg">{w.w}</span>
                          {(w.gloss || w.translit) && (
                            <span className="font-sans text-[0.6rem] text-stone-400">
                              {w.gloss || w.translit}
                            </span>
                          )}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span>{verseText(item.content)} </span>
                  )}
                </p>
              );
            }
            return null;
          })}
        </article>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          className="btn-ghost flex-1 disabled:opacity-40"
          disabled={!prev}
          onClick={() => prev && navigate(prev)}
        >
          &larr; Previous
        </button>
        <button
          className="btn-ghost flex-1 disabled:opacity-40"
          disabled={!next}
          onClick={() => next && navigate(next)}
        >
          Next &rarr;
        </button>
      </div>

      {popover && <WordPopover word={popover} onClose={() => setPopover(null)} />}
    </div>
  );
}
