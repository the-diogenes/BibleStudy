import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getBooks,
  getChapter,
  verseText,
  type BookSummary,
  type Chapter,
} from "../lib/bibleApi";
import {
  getChapterInterlinear,
  getLexicon,
  type ChapterInterlinear,
  type InterlinearWord,
  type StrongsEntry,
} from "../lib/interlinear";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import {
  addBookmark,
  clearHighlight,
  deleteBookmark,
  getBookReads,
  getChapterBookmarks,
  getChapterHighlights,
  markChapterRead,
  setHighlight,
  unmarkChapterRead,
} from "../lib/db";
import { HIGHLIGHT_TINT, type HighlightColor } from "../lib/highlight";
import { readTintStyle } from "../lib/readColor";
import type { Bookmark } from "../types";
import TranslationPicker from "../components/TranslationPicker";
import WordPopover from "../components/WordPopover";
import ShareButton from "../components/ShareButton";
import VerseActionsSheet from "../components/VerseActionsSheet";
import Spinner from "../components/Spinner";
import { ArrowLeft, BookmarkFilledIcon, BookmarkIcon, CheckIcon } from "../components/icons";

export default function Reader() {
  const { book = "", chapter = "1" } = useParams();
  const chapterNum = Number(chapter) || 1;
  const { translation, interlinear, setInterlinear, readColor } = useSettings();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [books, setBooks] = useState<BookSummary[]>([]);
  const [data, setData] = useState<Chapter | null>(null);
  const [inter, setInter] = useState<ChapterInterlinear | null>(null);
  const [lex, setLex] = useState<Record<string, StrongsEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popover, setPopover] = useState<InterlinearWord | null>(null);
  const [highlights, setHighlights] = useState<Map<number, string>>(new Map());
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [read, setRead] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [glowVerse, setGlowVerse] = useState<number | null>(null);

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
    if (!lex) getLexicon().then((l) => active && setLex(l));
    return () => {
      active = false;
    };
  }, [interlinear, book, chapterNum, lex]);

  useEffect(() => {
    if (!profile) {
      setHighlights(new Map());
      return;
    }
    let active = true;
    getChapterHighlights(profile.id, book, chapterNum)
      .then((m) => active && setHighlights(m))
      .catch(() => active && setHighlights(new Map()));
    return () => {
      active = false;
    };
  }, [profile, book, chapterNum]);

  useEffect(() => {
    if (!profile) {
      setBookmarks([]);
      return;
    }
    let active = true;
    getChapterBookmarks(profile.id, book, chapterNum)
      .then((b) => active && setBookmarks(b))
      .catch(() => active && setBookmarks([]));
    return () => {
      active = false;
    };
  }, [profile, book, chapterNum]);

  // Load existing read state for this chapter.
  useEffect(() => {
    if (!profile) {
      setRead(false);
      return;
    }
    let active = true;
    getBookReads(profile.id, book)
      .then((s) => active && setRead(s.has(chapterNum)))
      .catch(() => active && setRead(false));
    return () => {
      active = false;
    };
  }, [profile, book, chapterNum]);

  // Auto-record the chapter as read once it loads (unless undone this visit).
  useEffect(() => {
    if (profile && data && !read) {
      setRead(true);
      void markChapterRead(profile.id, book, chapterNum);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, data, book, chapterNum]);

  async function toggleRead() {
    if (!profile) return;
    const next = !read;
    setRead(next);
    try {
      if (next) await markChapterRead(profile.id, book, chapterNum);
      else await unmarkChapterRead(profile.id, book, chapterNum);
    } catch {
      setRead(!next);
    }
  }

  // Deep links like /read/JHN/3#v16 scroll to and briefly glow the verse.
  useEffect(() => {
    if (!data) return;
    const m = location.hash.match(/^#v(\d+)$/);
    if (!m) return;
    const vnum = Number(m[1]);
    const el = document.getElementById(`v${vnum}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setGlowVerse(vnum);
    const t = setTimeout(() => setGlowVerse(null), 2600);
    return () => clearTimeout(t);
  }, [data, location.hash]);

  async function applyColor(verse: number, color: HighlightColor | null) {
    if (!profile) return;
    const next = new Map(highlights);
    if (color) {
      next.set(verse, color);
      setHighlights(next);
      try {
        await setHighlight(profile.id, book, chapterNum, verse, color);
      } catch {
        /* ignore */
      }
    } else {
      next.delete(verse);
      setHighlights(next);
      try {
        await clearHighlight(profile.id, book, chapterNum, verse);
      } catch {
        /* ignore */
      }
    }
  }

  const currentBook = useMemo(() => books.find((b) => b.id === book), [books, book]);
  const bookName = currentBook?.commonName || book;

  const pageBookmark = useMemo(
    () => bookmarks.find((b) => b.verse == null) || null,
    [bookmarks]
  );

  async function toggleBookmark(verse: number | null, label: string) {
    if (!profile) return;
    const existing = bookmarks.find((b) => (b.verse ?? null) === verse);
    if (existing) {
      setBookmarks((bs) => bs.filter((b) => b.id !== existing.id));
      try {
        await deleteBookmark(existing.id);
      } catch {
        /* ignore */
      }
    } else {
      try {
        const created = await addBookmark(profile.id, book, chapterNum, verse, label);
        setBookmarks((bs) => [created, ...bs]);
      } catch {
        /* ignore */
      }
    }
  }

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
          onClick={() => navigate(`/bible?book=${book}`)}
        >
          <ArrowLeft className="h-4 w-4" /> {bookName}
        </button>
        <div className="flex items-center gap-2">
          {profile && (
            <button
              type="button"
              onClick={() => void toggleRead()}
              aria-pressed={read}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                read ? "" : "border-stone-300 text-stone-500 hover:bg-stone-100"
              }`}
              style={read ? readTintStyle(readColor) : undefined}
            >
              <CheckIcon className="h-3.5 w-3.5" />
              {read ? "Read" : "Mark read"}
            </button>
          )}
          <TranslationPicker />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">
          {bookName} {chapterNum}
        </h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-stone-500">
            <input
              type="checkbox"
              checked={interlinear}
              onChange={(e) => setInterlinear(e.target.checked)}
            />
            Interlinear
          </label>
          <button
            type="button"
            onClick={() => toggleBookmark(null, `${bookName} ${chapterNum}`)}
            aria-label={pageBookmark ? "Remove bookmark" : "Bookmark this chapter"}
            className={`rounded-md p-1.5 hover:bg-stone-100 ${
              pageBookmark ? "text-amber-500" : "text-stone-500 hover:text-ink"
            }`}
          >
            {pageBookmark ? (
              <BookmarkFilledIcon className="h-5 w-5" />
            ) : (
              <BookmarkIcon className="h-5 w-5" />
            )}
          </button>
          <ShareButton
            compact
            routePath={`read/${book}/${chapterNum}`}
            title={`${bookName} ${chapterNum}`}
          />
        </div>
      </div>

      {loading && <Spinner label="Loading passage..." />}
      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Could not load: {error}</p>
      )}

      {data && (
        <article className="prose-scripture font-serif text-[1.075rem] leading-8 text-stone-800">
          {interlinear && !inter && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 font-sans text-xs text-amber-900">
              Original-language data isn't available for this chapter yet. Showing the translation.
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
              const tint = highlights.get(vnum);
              return (
                <p
                  key={i}
                  id={`v${vnum}`}
                  className={`group -mx-1 rounded px-1 transition-colors ${
                    tint ? HIGHLIGHT_TINT[tint] || "" : ""
                  } ${glowVerse === vnum ? "verse-glow" : ""}`}
                >
                  <button
                    onClick={() => setSelectedVerse(vnum)}
                    className="mr-1 align-super font-sans text-[0.7rem] font-semibold text-stone-400 hover:text-ink"
                  >
                    {vnum}
                  </button>
                  {words ? (
                    <span className="inline-flex flex-wrap gap-x-3 gap-y-2 align-top">
                      {words.map((w, wi) => {
                        const pron = w.strongs ? lex?.[w.strongs]?.pronunciation : undefined;
                        return (
                          <button
                            key={wi}
                            onClick={() => setPopover(w)}
                            className="inline-flex flex-col items-center rounded px-0.5 leading-tight hover:bg-amber-50"
                          >
                            <span className="font-serif text-lg">{w.w}</span>
                            {pron && (
                              <span className="font-sans text-[0.6rem] font-medium text-stone-500">
                                {pron}
                              </span>
                            )}
                            {(w.gloss || w.translit) && (
                              <span className="font-sans text-[0.6rem] italic text-stone-400">
                                {w.gloss || w.translit}
                              </span>
                            )}
                          </button>
                        );
                      })}
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

      {selectedVerse != null && data && (
        <VerseActionsSheet
          book={book}
          chapter={chapterNum}
          verse={selectedVerse}
          label={`${bookName} ${chapterNum}:${selectedVerse}`}
          text={verseText(
            data.content.find((c) => c.type === "verse" && c.number === selectedVerse)?.content
          )}
          currentColor={highlights.get(selectedVerse) || null}
          bookmarked={bookmarks.some((b) => b.verse === selectedVerse)}
          onColor={(color) => {
            void applyColor(selectedVerse, color);
            setSelectedVerse(null);
          }}
          onBookmark={() => {
            void toggleBookmark(selectedVerse, `${bookName} ${chapterNum}:${selectedVerse}`);
            setSelectedVerse(null);
          }}
          onClose={() => setSelectedVerse(null)}
        />
      )}
    </div>
  );
}
