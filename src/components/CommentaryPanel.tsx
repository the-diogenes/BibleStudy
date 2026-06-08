import { useEffect, useState } from "react";
import {
  getCommentaries,
  getCommentaryChapter,
  verseText,
  type Commentary,
} from "../lib/bibleApi";
import Spinner from "./Spinner";

const STORE_KEY = "bs:commentary";

export default function CommentaryPanel({
  book,
  chapter,
  verse,
}: {
  book: string;
  chapter: number;
  verse: number | null;
}) {
  const [commentaries, setCommentaries] = useState<Commentary[]>([]);
  const [selected, setSelected] = useState<string>(
    () => localStorage.getItem(STORE_KEY) || "jamieson-fausset-brown"
  );
  const [text, setText] = useState<string>("");
  const [intro, setIntro] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCommentaries().then(setCommentaries).catch(() => setCommentaries([]));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, selected);
    let active = true;
    setLoading(true);
    setError(null);
    setText("");
    setIntro("");
    getCommentaryChapter(selected, book, chapter)
      .then((c) => {
        if (!active) return;
        if (c.introduction && !verse) setIntro(c.introduction);
        if (verse) {
          const item = c.content.find((x) => x.type === "verse" && x.number === verse);
          setText(item ? verseText(item.content) : "");
        } else {
          const all = c.content
            .filter((x) => x.type === "verse")
            .map((x) => `${x.number}. ${verseText(x.content)}`)
            .join("\n\n");
          setText(all);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e.message || e));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, book, chapter, verse]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-stone-500">Commentary</label>
        <select
          className="input max-w-[16rem]"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {commentaries.length === 0 && <option value={selected}>{selected}</option>}
          {commentaries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.englishName}
            </option>
          ))}
        </select>
      </div>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-600">Could not load commentary: {error}</p>}

      {!loading && !error && (
        <div className="prose-scripture text-sm leading-7 text-stone-700">
          {intro && <p className="mb-3 italic text-stone-500">{intro}</p>}
          {text ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <p className="text-stone-500">No commentary note for this {verse ? "verse" : "chapter"}.</p>
          )}
          <p className="mt-4 text-xs text-stone-400">
            Public-domain commentary via the Free Use Bible API. These reflect their authors'
            views, not necessarily your group's.
          </p>
        </div>
      )}
    </div>
  );
}
