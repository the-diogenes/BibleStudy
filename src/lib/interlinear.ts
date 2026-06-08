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

// Friendly expansion of the morphology code tokens used by the Berean tables
// (covers the common Greek and Hebrew parsing abbreviations) so the popover is
// readable even without a full parser. Unknown tokens pass through unchanged.
const MORPH_HINTS: Record<string, string> = {
  // Parts of speech
  N: "noun",
  V: "verb",
  Adj: "adjective",
  Adv: "adverb",
  Art: "article",
  T: "article",
  Pro: "pronoun",
  PPro: "personal pronoun",
  RelPro: "relative pronoun",
  DPro: "demonstrative pronoun",
  IPro: "interrogative pronoun",
  RefPro: "reflexive pronoun",
  R: "pronoun",
  Prep: "preposition",
  P: "preposition",
  Conj: "conjunction",
  C: "conjunction",
  DirObjM: "direct object marker",
  Num: "number",
  Interjection: "interjection",
  Prtcl: "particle",
  // Hebrew verb stems
  Qal: "Qal",
  Niphal: "Niphal",
  Piel: "Piel",
  Pual: "Pual",
  Hiphil: "Hiphil",
  Hophal: "Hophal",
  Hitpael: "Hitpael",
  // Aspect / tense / mood
  Perf: "perfect",
  Impf: "imperfect",
  Impv: "imperative",
  Inf: "infinitive",
  Part: "participle",
  Cohortative: "cohortative",
  Jussive: "jussive",
  Pres: "present",
  Aor: "aorist",
  Fut: "future",
  Imperf: "imperfect",
  Perfect: "perfect",
  Plup: "pluperfect",
  // Greek tense-voice-mood compact codes
  PIA: "present indicative active",
  PIM: "present indicative middle",
  PIP: "present indicative passive",
  AIA: "aorist indicative active",
  AIM: "aorist indicative middle",
  AIP: "aorist indicative passive",
  FIA: "future indicative active",
  IIA: "imperfect indicative active",
  RIA: "perfect indicative active",
  PPA: "present participle active",
  APA: "aorist participle active",
  // Person · gender · number (Hebrew lower-case forms)
  "1cs": "1st c. sing.",
  "2ms": "2nd m. sing.",
  "2fs": "2nd f. sing.",
  "3ms": "3rd m. sing.",
  "3fs": "3rd f. sing.",
  "1cp": "1st c. plur.",
  "2mp": "2nd m. plur.",
  "3mp": "3rd m. plur.",
  "3fp": "3rd f. plur.",
  ms: "masc. sing.",
  fs: "fem. sing.",
  mp: "masc. plur.",
  fp: "fem. plur.",
  // Greek person + number
  "1S": "1st sing.",
  "2S": "2nd sing.",
  "3S": "3rd sing.",
  "1P": "1st plur.",
  "2P": "2nd plur.",
  "3P": "3rd plur.",
  // Greek case-number-gender (NSM etc.)
  NMS: "nom. sing. masc.",
  GMS: "gen. sing. masc.",
  DMS: "dat. sing. masc.",
  AMS: "acc. sing. masc.",
  NFS: "nom. sing. fem.",
  NNS: "nom. sing. neut.",
  NMP: "nom. plur. masc.",
  NSM: "nom. sing. masc.",
  GSM: "gen. sing. masc.",
  DSM: "dat. sing. masc.",
  ASM: "acc. sing. masc.",
  NSF: "nom. sing. fem.",
  NSN: "nom. sing. neut.",
};

export function describeMorph(morph?: string): string {
  if (!morph) return "";
  const parts = morph
    .split(/[-\s|]+/)
    .map((tok) => tok.trim())
    .filter(Boolean)
    .map((tok) => MORPH_HINTS[tok] || tok);
  // If nothing was actually expanded, the code already speaks for itself.
  const expanded = parts.join(" · ");
  return expanded === morph ? "" : expanded;
}
