import { useEffect, useState } from "react";
import {
  describeMorph,
  getLexicon,
  type InterlinearWord,
  type StrongsEntry,
} from "../lib/interlinear";

export default function WordPopover({
  word,
  onClose,
}: {
  word: InterlinearWord;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState<StrongsEntry | null>(null);

  useEffect(() => {
    let active = true;
    if (word.strongs) {
      getLexicon().then((lex) => active && setEntry(lex[word.strongs!] || null));
    }
    return () => {
      active = false;
    };
  }, [word.strongs]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-t-2xl bg-white p-5 shadow-xl safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-2xl">{entry?.lemma || word.w}</span>
          {word.strongs && (
            <span className="chip bg-stone-100 font-mono text-stone-600">{word.strongs}</span>
          )}
        </div>
        {(word.translit || entry?.translit) && (
          <p className="mt-1 text-sm italic text-stone-500">{word.translit || entry?.translit}</p>
        )}
        {word.morph && (
          <p className="mt-2 text-xs text-stone-500">
            <span className="font-mono">{word.morph}</span>
            {describeMorph(word.morph) && ` — ${describeMorph(word.morph)}`}
          </p>
        )}
        {word.gloss && <p className="mt-3 text-sm">Gloss: {word.gloss}</p>}
        {entry?.definition && (
          <p className="mt-2 text-sm text-stone-700">{entry.definition}</p>
        )}
        {!entry && word.strongs && (
          <p className="mt-3 text-xs text-stone-400">
            No lexicon entry bundled for {word.strongs}. Run{" "}
            <span className="font-mono">npm run build:interlinear</span> to add definitions.
          </p>
        )}
        <button className="btn-ghost mt-4 w-full" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
