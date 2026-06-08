import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBooks, getChapter, findVerseText, type BookSummary } from "../lib/bibleApi";
import { useSettings } from "../context/SettingsContext";
import { refLabel, type PassageRef } from "../lib/refs";
import { verseOfTheDay } from "../lib/votd";
import ShareButton from "./ShareButton";

export default function VerseOfDayCard() {
  const { translation } = useSettings();
  const [ref] = useState<PassageRef>(() => verseOfTheDay());
  const [text, setText] = useState("");
  const [books, setBooks] = useState<BookSummary[]>([]);

  useEffect(() => {
    getBooks(translation).then(setBooks).catch(() => setBooks([]));
  }, [translation]);

  useEffect(() => {
    let active = true;
    getChapter(translation, ref.book, ref.chapter)
      .then((c) => active && setText(findVerseText(c, ref.verseStart || 1)))
      .catch(() => active && setText(""));
    return () => {
      active = false;
    };
  }, [translation, ref]);

  const label = refLabel(ref, books);
  const v = ref.verseStart || 1;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Verse of the day
        </p>
        <ShareButton compact routePath={`read/${ref.book}/${ref.chapter}#v${v}`} title={label} text={text} />
      </div>
      <Link to={`/read/${ref.book}/${ref.chapter}#v${v}`} className="mt-2 block">
        <p className="font-serif text-lg leading-7 text-stone-800">
          {text || "…"}
        </p>
        <p className="mt-2 text-sm font-medium text-stone-500">{label}</p>
      </Link>
    </section>
  );
}
