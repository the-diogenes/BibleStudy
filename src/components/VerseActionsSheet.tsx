import { Link } from "react-router-dom";
import {
  HIGHLIGHT_ORDER,
  HIGHLIGHT_SWATCH,
  type HighlightColor,
} from "../lib/highlight";
import { absoluteUrl, canNativeShare, copyToClipboard, nativeShare } from "../lib/share";

interface Props {
  book: string;
  chapter: number;
  verse: number;
  label: string;
  text: string;
  currentColor: string | null;
  bookmarked: boolean;
  onColor: (color: HighlightColor | null) => void;
  onBookmark: () => void;
  onClose: () => void;
}

export default function VerseActionsSheet({
  book,
  chapter,
  verse,
  label,
  text,
  currentColor,
  bookmarked,
  onColor,
  onBookmark,
  onClose,
}: Props) {
  const url = absoluteUrl(`read/${book}/${chapter}#v${verse}`);

  async function share() {
    const payload = { title: label, text: text ? `${label} — ${text}` : label, url };
    if (canNativeShare()) {
      const ok = await nativeShare(payload);
      if (ok) return onClose();
    }
    const ok = await copyToClipboard(url);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="card w-full max-w-md rounded-b-none p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
        <p className="font-serif text-base font-semibold">{label}</p>
        {text && <p className="mt-1 line-clamp-2 text-sm text-stone-500">{text}</p>}

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-stone-400">Highlight</p>
        <div className="mt-2 flex items-center gap-3">
          {HIGHLIGHT_ORDER.map((c) => (
            <button
              key={c}
              aria-label={`Highlight ${c}`}
              onClick={() => onColor(c)}
              className={`h-9 w-9 rounded-full border-2 transition ${
                currentColor === c ? "border-ink scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: HIGHLIGHT_SWATCH[c as HighlightColor] }}
            />
          ))}
          <button
            aria-label="Remove highlight"
            onClick={() => onColor(null)}
            className="ml-auto rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-50 disabled:opacity-40"
            disabled={!currentColor}
          >
            Clear
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button onClick={onBookmark} className="btn-ghost">
            {bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
          <button onClick={share} className="btn-ghost">
            Share
          </button>
          <Link to={`/passage/${book}/${chapter}/${verse}`} className="btn-primary" onClick={onClose}>
            Discuss
          </Link>
        </div>
      </div>
    </div>
  );
}
