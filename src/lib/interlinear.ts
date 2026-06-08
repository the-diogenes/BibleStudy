// Original-language (Greek/Hebrew) interlinear support.
//
// Data is shipped as static JSON under public/data/ so it is cached by the
// service worker and works offline. Generate/extend it with:
//   npm run build:interlinear      (see scripts/build-interlinear.mjs)
//
// Chapter file: public/data/interlinear/<BOOK>/<chapter>.json
//   { "verses": { "1": [ { "w": "...", "translit": "...", "strongs": "G3056",
//                          "morph": "N-NSM", "gloss": "word" }, ... ] } }
//
// Lexicon file: public/data/strongs.json
//   { "G3056": { "lemma": "λόγος", "translit": "logos", "definition": "..." }, ... }

export interface InterlinearWord {
  w: string;
  translit?: string;
  strongs?: string;
  morph?: string;
  gloss?: string;
}

export interface ChapterInterlinear {
  verses: Record<string, InterlinearWord[]>;
}

export interface StrongsEntry {
  lemma: string;
  translit?: string;
  pronunciation?: string;
  definition: string;
  kjvDef?: string;
}

const base = import.meta.env.BASE_URL;
const chapterCache = new Map<string, ChapterInterlinear | null>();
let lexicon: Record<string, StrongsEntry> | null | undefined;

export async function getChapterInterlinear(
  book: string,
  chapter: number
): Promise<ChapterInterlinear | null> {
  const key = `${book}/${chapter}`;
  if (chapterCache.has(key)) return chapterCache.get(key)!;
  try {
    const res = await fetch(`${base}data/interlinear/${book}/${chapter}.json`);
    if (!res.ok) {
      chapterCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as ChapterInterlinear;
    chapterCache.set(key, data);
    return data;
  } catch {
    chapterCache.set(key, null);
    return null;
  }
}

export async function getLexicon(): Promise<Record<string, StrongsEntry>> {
  if (lexicon !== undefined && lexicon !== null) return lexicon;
  try {
    const res = await fetch(`${base}data/strongs.json`);
    lexicon = res.ok ? ((await res.json()) as Record<string, StrongsEntry>) : {};
  } catch {
    lexicon = {};
  }
  return lexicon;
}

// Minimal, friendly expansion of the most common morphology code tokens so the
// popover is readable even without a full parser.
const MORPH_HINTS: Record<string, string> = {
  N: "noun",
  V: "verb",
  A: "adjective",
  Adj: "adjective",
  R: "pronoun",
  P: "preposition",
  C: "conjunction",
  D: "adverb",
  T: "article",
  NSM: "nom. sing. masc.",
  GSM: "gen. sing. masc.",
  DSM: "dat. sing. masc.",
  ASM: "acc. sing. masc.",
  NSF: "nom. sing. fem.",
  NSN: "nom. sing. neut.",
};

export function describeMorph(morph?: string): string {
  if (!morph) return "";
  return morph
    .split(/[-\s]/)
    .map((tok) => MORPH_HINTS[tok] || tok)
    .join(" · ");
}
