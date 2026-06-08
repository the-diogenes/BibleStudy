import type { BookSummary } from "./bibleApi";

// A passage reference in this app is stored structurally (book id + chapter +
// optional verse range) and rendered to a human label using the loaded book list.

export interface PassageRef {
  book: string; // USFM-ish id, e.g. "JHN"
  chapter: number;
  verseStart?: number | null;
  verseEnd?: number | null;
}

/** Canonical dotted key used to look up threads/notes, e.g. "JHN.1.1-18". */
export function refKey(r: PassageRef): string {
  const base = `${r.book}.${r.chapter}`;
  if (!r.verseStart) return base;
  if (r.verseEnd && r.verseEnd !== r.verseStart) {
    return `${base}.${r.verseStart}-${r.verseEnd}`;
  }
  return `${base}.${r.verseStart}`;
}

export function parseRefKey(key: string): PassageRef | null {
  // BOOK.CHAP[.Vs[-Ve]]
  const m = key.match(/^([A-Z0-9]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/);
  if (!m) return null;
  return {
    book: m[1],
    chapter: Number(m[2]),
    verseStart: m[3] ? Number(m[3]) : null,
    verseEnd: m[4] ? Number(m[4]) : null,
  };
}

export function refLabel(r: PassageRef, books: BookSummary[]): string {
  const book = books.find((b) => b.id === r.book);
  const name = book ? book.commonName : r.book;
  let label = `${name} ${r.chapter}`;
  if (r.verseStart) {
    label += `:${r.verseStart}`;
    if (r.verseEnd && r.verseEnd !== r.verseStart) label += `-${r.verseEnd}`;
  }
  return label;
}

export function labelFromKey(key: string, books: BookSummary[]): string {
  const r = parseRefKey(key);
  return r ? refLabel(r, books) : key;
}

// Parse a human reference like "John 3:16", "1 John 2", "Song of Solomon 1:1-3"
// into a PassageRef, matching the longest book name against the loaded book list.
export function parseHumanRef(input: string, books: BookSummary[]): PassageRef | null {
  const text = input.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const m = text.match(/^(.*?)\s*(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!m) return null;
  const namePart = m[1].trim().toLowerCase();
  if (!namePart) return null;

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const candidates = books
    .map((b) => ({ b, name: norm(b.commonName) }))
    .filter(({ name, b }) => name === namePart || name.startsWith(namePart) || b.id.toLowerCase() === namePart)
    .sort((a, b) => a.name.length - b.name.length);

  const match = candidates[0]?.b;
  if (!match) return null;

  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > match.numberOfChapters) {
    return { book: match.id, chapter: Math.min(Math.max(chapter, 1), match.numberOfChapters) };
  }
  return {
    book: match.id,
    chapter,
    verseStart: m[3] ? Number(m[3]) : null,
    verseEnd: m[4] ? Number(m[4]) : null,
  };
}
