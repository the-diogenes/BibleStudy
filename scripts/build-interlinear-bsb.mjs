#!/usr/bin/env node
/**
 * build-interlinear-bsb.mjs
 *
 * Generates the FULL-Bible original-language interlinear dataset from the
 * public-domain Berean Standard Bible "Translation Tables" (CC-PDDC), plus a
 * complete Strong's lexicon (Hebrew + Greek) from the public-domain
 * openscriptures/strongs dictionaries.
 *
 * Output (consumed by src/lib/interlinear.ts):
 *   public/data/interlinear/<USFM>/<chapter>.json
 *     { "verses": { "1": [ { w, translit, strongs, morph, gloss }, ... ] } }
 *   public/data/strongs.json
 *     { "G3056": { lemma, translit, pronunciation, definition, kjvDef }, ... }
 *
 * Usage:  node scripts/build-interlinear-bsb.mjs
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const interDir = join(root, "public", "data", "interlinear");
const lexPath = join(root, "public", "data", "strongs.json");

const TSV_URL = "https://bereanbible.com/bsb_tables.tsv";
const HEB_DICT = "https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js";
const GRK_DICT = "https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js";

// Berean book names (as they appear in the VerseId column) -> USFM ids
// (the same ids used by the Free Use Bible API / our reader).
const BOOK_USFM = {
  Genesis: "GEN", Exodus: "EXO", Leviticus: "LEV", Numbers: "NUM", Deuteronomy: "DEU",
  Joshua: "JOS", Judges: "JDG", Ruth: "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
  "1 Kings": "1KI", "2 Kings": "2KI", "1 Chronicles": "1CH", "2 Chronicles": "2CH",
  Ezra: "EZR", Nehemiah: "NEH", Esther: "EST", Job: "JOB", Psalm: "PSA", Psalms: "PSA",
  Proverbs: "PRO", Ecclesiastes: "ECC", "Song of Solomon": "SNG", "Song of Songs": "SNG",
  Isaiah: "ISA", Jeremiah: "JER", Lamentations: "LAM", Ezekiel: "EZK", Daniel: "DAN",
  Hosea: "HOS", Joel: "JOL", Amos: "AMO", Obadiah: "OBA", Jonah: "JON", Micah: "MIC",
  Nahum: "NAM", Habakkuk: "HAB", Zephaniah: "ZEP", Haggai: "HAG", Zechariah: "ZEC",
  Malachi: "MAL", Matthew: "MAT", Mark: "MRK", Luke: "LUK", John: "JHN", Acts: "ACT",
  Romans: "ROM", "1 Corinthians": "1CO", "2 Corinthians": "2CO", Galatians: "GAL",
  Ephesians: "EPH", Philippians: "PHP", Colossians: "COL", "1 Thessalonians": "1TH",
  "2 Thessalonians": "2TH", "1 Timothy": "1TI", "2 Timothy": "2TI", Titus: "TIT",
  Philemon: "PHM", Hebrews: "HEB", James: "JAS", "1 Peter": "1PE", "2 Peter": "2PE",
  "1 John": "1JN", "2 John": "2JN", "3 John": "3JN", Jude: "JUD", Revelation: "REV",
};

function strip(s) {
  return (s || "").trim();
}

async function buildInterlinear() {
  console.log(`Downloading ${TSV_URL} ...`);
  const res = await fetch(TSV_URL);
  if (!res.ok) throw new Error(`TSV download failed: ${res.status}`);
  const text = await res.text();
  console.log(`  ${(text.length / 1e6).toFixed(1)} MB downloaded. Parsing...`);

  const lines = text.split(/\r?\n/);
  // books: USFM -> chapter(number) -> verse(number) -> word[]
  const books = new Map();
  const unmapped = new Set();
  let currentRef = null; // { usfm, ch, vs }
  let wordCount = 0;

  // skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.split("\t");
    const orig = strip(c[5]);
    const translit = strip(c[7]);
    const morph = strip(c[8]);
    const strHeb = strip(c[10]);
    const strGrk = strip(c[11]);
    const verseId = strip(c[12]);
    const gloss = strip(c[18]);

    if (verseId) {
      const m = verseId.match(/^(.+?)\s+(\d+):(\d+)$/);
      if (m) {
        const usfm = BOOK_USFM[m[1]];
        if (!usfm) {
          unmapped.add(m[1]);
          currentRef = null;
        } else {
          currentRef = { usfm, ch: Number(m[2]), vs: Number(m[3]) };
        }
      }
    }
    if (!currentRef || !orig) continue;

    let strongs;
    if (strHeb) strongs = `H${parseInt(strHeb, 10)}`;
    else if (strGrk) strongs = `G${parseInt(strGrk, 10)}`;

    const word = { w: orig };
    if (translit) word.translit = translit;
    if (strongs) word.strongs = strongs;
    if (morph) word.morph = morph;
    if (gloss) word.gloss = gloss;

    const { usfm, ch, vs } = currentRef;
    if (!books.has(usfm)) books.set(usfm, new Map());
    const chapters = books.get(usfm);
    if (!chapters.has(ch)) chapters.set(ch, new Map());
    const verses = chapters.get(ch);
    if (!verses.has(vs)) verses.set(vs, []);
    verses.get(vs).push(word);
    wordCount++;
  }

  if (unmapped.size) {
    console.log(`  ⚠ Unmapped book names: ${[...unmapped].join(", ")}`);
  }

  console.log(`  Parsed ${wordCount} words. Writing chapter files...`);
  await rm(interDir, { recursive: true, force: true });
  let fileCount = 0;
  for (const [usfm, chapters] of books) {
    await mkdir(join(interDir, usfm), { recursive: true });
    for (const [ch, verses] of chapters) {
      const obj = { verses: {} };
      for (const [vs, words] of [...verses.entries()].sort((a, b) => a[0] - b[0])) {
        obj.verses[vs] = words;
      }
      await writeFile(join(interDir, usfm, `${ch}.json`), JSON.stringify(obj));
      fileCount++;
    }
  }
  console.log(`  ✓ Wrote ${fileCount} chapter files across ${books.size} books.`);
}

async function buildLexicon() {
  console.log(`Building Strong's lexicon...`);
  const lex = {};

  // Both dictionaries are JS files: "var strongs...Dictionary = { ... };"
  async function loadDict(url, label) {
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.log(`  ⚠ ${label} dictionary HTTP ${r.status}`);
        return;
      }
      const js = await r.text();
      const start = js.indexOf("{");
      const end = js.lastIndexOf("}");
      const dict = JSON.parse(js.slice(start, end + 1));
      for (const [k, v] of Object.entries(dict)) {
        lex[k] = {
          lemma: v.lemma || "",
          translit: v.translit || v.xlit || undefined,
          pronunciation: v.pron || undefined,
          definition: v.strongs_def || v.derivation || "",
          kjvDef: v.kjv_def || undefined,
        };
      }
      console.log(`  ${label} entries: ${Object.keys(dict).length}`);
    } catch (e) {
      console.log(`  ⚠ ${label} dictionary failed: ${e.message}`);
    }
  }

  await loadDict(HEB_DICT, "Hebrew");
  await loadDict(GRK_DICT, "Greek");

  if (Object.keys(lex).length === 0) {
    console.log("  ⚠ No lexicon entries built; leaving strongs.json unchanged.");
    return;
  }
  await writeFile(lexPath, JSON.stringify(lex));
  console.log(`  ✓ Wrote ${Object.keys(lex).length} lexicon entries to strongs.json`);
}

async function main() {
  await buildInterlinear();
  await buildLexicon();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
