import type { PassageRef } from "./refs";

// A curated rotation of well-known passages. Picked deterministically by the
// day so everyone sees the same "Verse of the Day". (USFM book ids.)
const VERSES: PassageRef[] = [
  { book: "JHN", chapter: 3, verseStart: 16 },
  { book: "ROM", chapter: 8, verseStart: 28 },
  { book: "PRO", chapter: 3, verseStart: 5, verseEnd: 6 },
  { book: "PSA", chapter: 23, verseStart: 1 },
  { book: "PHP", chapter: 4, verseStart: 13 },
  { book: "ISA", chapter: 40, verseStart: 31 },
  { book: "JOS", chapter: 1, verseStart: 9 },
  { book: "JER", chapter: 29, verseStart: 11 },
  { book: "MAT", chapter: 6, verseStart: 33 },
  { book: "ROM", chapter: 12, verseStart: 2 },
  { book: "GAL", chapter: 2, verseStart: 20 },
  { book: "EPH", chapter: 2, verseStart: 8, verseEnd: 9 },
  { book: "HEB", chapter: 11, verseStart: 1 },
  { book: "JHN", chapter: 1, verseStart: 1 },
  { book: "PSA", chapter: 46, verseStart: 1 },
  { book: "PSA", chapter: 119, verseStart: 105 },
  { book: "MAT", chapter: 11, verseStart: 28 },
  { book: "1CO", chapter: 13, verseStart: 4, verseEnd: 7 },
  { book: "2TI", chapter: 1, verseStart: 7 },
  { book: "JHN", chapter: 14, verseStart: 6 },
  { book: "ROM", chapter: 5, verseStart: 8 },
  { book: "PSA", chapter: 1, verseStart: 1, verseEnd: 2 },
  { book: "MAT", chapter: 28, verseStart: 19, verseEnd: 20 },
  { book: "1JN", chapter: 1, verseStart: 9 },
  { book: "PRO", chapter: 9, verseStart: 10 },
  { book: "GAL", chapter: 5, verseStart: 22, verseEnd: 23 },
  { book: "HEB", chapter: 4, verseStart: 12 },
  { book: "JAS", chapter: 1, verseStart: 22 },
  { book: "PSA", chapter: 37, verseStart: 4 },
  { book: "ROM", chapter: 10, verseStart: 9 },
  { book: "MIC", chapter: 6, verseStart: 8 },
  { book: "2CO", chapter: 5, verseStart: 17 },
];

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((now - start) / 86400000);
}

export function verseOfTheDay(date = new Date()): PassageRef {
  return VERSES[dayOfYear(date) % VERSES.length];
}
