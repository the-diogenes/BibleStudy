import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBooks, getChapter, verseText, type BookSummary } from "../lib/bibleApi";
import { useSettings } from "../context/SettingsContext";
import { refLabel, type PassageRef } from "../lib/refs";
import Discussion from "../components/Discussion";
import NotesPanel from "../components/NotesPanel";
import CommentaryPanel from "../components/CommentaryPanel";
import ShareButton from "../components/ShareButton";
import { ArrowLeft } from "../components/icons";

type Tab = "discussion" | "notes" | "commentary";

export default function Passage() {
  const { book = "", chapter = "1", verse } = useParams();
  const chapterNum = Number(chapter) || 1;
  const verseNum = verse ? Number(verse) : null;
  const { translation } = useSettings();

  const passage: PassageRef = useMemo(
    () => ({ book, chapter: chapterNum, verseStart: verseNum, verseEnd: verseNum }),
    [book, chapterNum, verseNum]
  );

  const [books, setBooks] = useState<BookSummary[]>([]);
  const [text, setText] = useState<string>("");
  const [tab, setTab] = useState<Tab>("discussion");

  useEffect(() => {
    getBooks(translation).then(setBooks).catch(() => setBooks([]));
  }, [translation]);

  useEffect(() => {
    let active = true;
    getChapter(translation, book, chapterNum)
      .then((c) => {
        if (!active) return;
        if (verseNum) {
          const item = c.content.find((x) => x.type === "verse" && x.number === verseNum);
          setText(item ? verseText(item.content) : "");
        } else {
          setText("");
        }
      })
      .catch(() => active && setText(""));
    return () => {
      active = false;
    };
  }, [translation, book, chapterNum, verseNum]);

  const label = refLabel(passage, books);

  return (
    <div>
      <Link to={`/read/${book}/${chapterNum}`} className="mb-3 flex items-center gap-1 text-sm text-stone-500">
        <ArrowLeft className="h-4 w-4" /> Read chapter
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">{label}</h1>
        <ShareButton
          routePath={verseNum ? `passage/${book}/${chapterNum}/${verseNum}` : `read/${book}/${chapterNum}`}
          title={label}
          text={verseNum && text ? text : undefined}
        />
      </div>

      {verseNum ? (
        text ? (
          <blockquote className="mt-3 border-l-4 border-amber-300 bg-white p-4 font-serif text-lg leading-8 text-stone-800">
            {text}
            <span className="ml-1 align-super text-xs text-stone-400">{translation}</span>
          </blockquote>
        ) : (
          <p className="mt-3 text-sm text-stone-500">Loading verse…</p>
        )
      ) : (
        <p className="mt-2 text-sm text-stone-500">
          Chapter-level discussion. <Link className="underline" to={`/read/${book}/${chapterNum}`}>Open the reader</Link> to pick a verse.
        </p>
      )}

      <div className="mt-5 flex gap-1 rounded-lg bg-stone-100 p-1 text-sm">
        {(["discussion", "notes", "commentary"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 font-medium capitalize transition ${
              tab === t ? "bg-white text-ink shadow-sm" : "text-stone-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "discussion" && <Discussion passage={passage} />}
        {tab === "notes" && <NotesPanel passage={passage} />}
        {tab === "commentary" && <CommentaryPanel book={book} chapter={chapterNum} verse={verseNum} />}
      </div>
    </div>
  );
}
