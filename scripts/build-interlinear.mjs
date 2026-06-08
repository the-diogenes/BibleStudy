#!/usr/bin/env node
/**
 * build-interlinear.mjs
 *
 * Validates and reports on the original-language (Greek/Hebrew) interlinear data
 * shipped under public/data/, and is the place to plug in a full-Bible build.
 *
 * ── Data formats ────────────────────────────────────────────────────────────
 * Chapter file: public/data/interlinear/<BOOK>/<chapter>.json
 *   { "verses": { "1": [ { "w","translit","strongs","morph","gloss" }, ... ] } }
 *   <BOOK> uses the same USFM-style ids as the Free Use Bible API (GEN, JHN, ...).
 *
 * Lexicon file: public/data/strongs.json
 *   { "G3056": { "lemma","translit","definition","kjvDef?" }, ... }
 *
 * ── Generating the FULL dataset (all public domain / free) ───────────────────
 * Recommended sources to convert into the format above:
 *   - Berean Bible word/Strong's tables (per-word English↔Strong's↔original):
 *       https://berean.bible/downloads.htm   (public domain, CC0)
 *   - Open Scriptures Hebrew Bible (Hebrew OT, lemma + morphology + Strong's):
 *       https://github.com/openscriptures/morphhb   (OSIS XML / JSON)
 *   - SBLGNT / OpenGNT (Greek NT, morphology + Strong's):
 *       https://github.com/LogosBible/SBLGNT , https://github.com/eliranwong/OpenGNT
 *   - Strong's dictionaries (definitions):
 *       https://github.com/openscriptures/strongs   (public domain)
 *
 * Drop converted chapter files into public/data/interlinear/<BOOK>/<chapter>.json
 * and merge lexicon entries into public/data/strongs.json, then run this script
 * to validate coverage.
 *
 * Usage:  node scripts/build-interlinear.mjs
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "public", "data");
const interDir = join(dataDir, "interlinear");
const lexPath = join(dataDir, "strongs.json");

let errors = 0;
let chapters = 0;
let words = 0;
const missingStrongs = new Set();

async function main() {
  if (!existsSync(interDir)) {
    console.error(`No interlinear directory at ${interDir}`);
    process.exit(1);
  }

  const lexicon = JSON.parse(await readFile(lexPath, "utf8"));
  const lexKeys = new Set(Object.keys(lexicon));

  const books = await readdir(interDir);
  for (const book of books) {
    const bookPath = join(interDir, book);
    if (!(await stat(bookPath)).isDirectory()) continue;
    const files = (await readdir(bookPath)).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const full = join(bookPath, file);
      let data;
      try {
        data = JSON.parse(await readFile(full, "utf8"));
      } catch (e) {
        console.error(`✗ Invalid JSON: ${book}/${file} - ${e.message}`);
        errors++;
        continue;
      }
      if (!data.verses || typeof data.verses !== "object") {
        console.error(`✗ Missing "verses" object: ${book}/${file}`);
        errors++;
        continue;
      }
      chapters++;
      for (const [v, list] of Object.entries(data.verses)) {
        if (!Array.isArray(list)) {
          console.error(`✗ Verse ${book} ${file} v${v} is not an array`);
          errors++;
          continue;
        }
        for (const word of list) {
          words++;
          if (!word.w) {
            console.error(`✗ Word missing "w" in ${book} ${file} v${v}`);
            errors++;
          }
          if (word.strongs && !lexKeys.has(word.strongs)) {
            missingStrongs.add(word.strongs);
          }
        }
      }
    }
  }

  console.log(`\nInterlinear validation`);
  console.log(`  Chapters: ${chapters}`);
  console.log(`  Words:    ${words}`);
  console.log(`  Lexicon entries: ${lexKeys.size}`);
  if (missingStrongs.size) {
    console.log(
      `  ⚠ ${missingStrongs.size} Strong's numbers used but not in strongs.json:`
    );
    console.log("    " + [...missingStrongs].sort().join(", "));
  }
  if (errors) {
    console.error(`\n✗ ${errors} error(s) found.`);
    process.exit(1);
  }
  console.log(`\n✓ All interlinear data is valid.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
