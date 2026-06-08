import { useState } from "react";

type Tab = "greek" | "hebrew";

interface Letter {
  glyph: string;
  name: string;
  translit: string;
  sound: string;
}

const GREEK: Letter[] = [
  { glyph: "Α α", name: "Alpha", translit: "a", sound: "a as in father" },
  { glyph: "Β β", name: "Beta", translit: "b", sound: "b as in bible" },
  { glyph: "Γ γ", name: "Gamma", translit: "g", sound: "g as in go" },
  { glyph: "Δ δ", name: "Delta", translit: "d", sound: "d as in do" },
  { glyph: "Ε ε", name: "Epsilon", translit: "e", sound: "e as in met (short)" },
  { glyph: "Ζ ζ", name: "Zeta", translit: "z", sound: "dz as in adze" },
  { glyph: "Η η", name: "Eta", translit: "ē", sound: "e as in obey (long)" },
  { glyph: "Θ θ", name: "Theta", translit: "th", sound: "th as in thin" },
  { glyph: "Ι ι", name: "Iota", translit: "i", sound: "i as in machine" },
  { glyph: "Κ κ", name: "Kappa", translit: "k", sound: "k as in kit" },
  { glyph: "Λ λ", name: "Lambda", translit: "l", sound: "l as in law" },
  { glyph: "Μ μ", name: "Mu", translit: "m", sound: "m as in man" },
  { glyph: "Ν ν", name: "Nu", translit: "n", sound: "n as in new" },
  { glyph: "Ξ ξ", name: "Xi", translit: "x", sound: "x as in axe (ks)" },
  { glyph: "Ο ο", name: "Omicron", translit: "o", sound: "o as in not (short)" },
  { glyph: "Π π", name: "Pi", translit: "p", sound: "p as in pet" },
  { glyph: "Ρ ρ", name: "Rho", translit: "r", sound: "r (trilled); rh when first" },
  { glyph: "Σ σ/ς", name: "Sigma", translit: "s", sound: "s as in sit (ς at word end)" },
  { glyph: "Τ τ", name: "Tau", translit: "t", sound: "t as in top" },
  { glyph: "Υ υ", name: "Upsilon", translit: "y / u", sound: "u as in French tu" },
  { glyph: "Φ φ", name: "Phi", translit: "ph", sound: "ph as in phone (f)" },
  { glyph: "Χ χ", name: "Chi", translit: "ch", sound: "ch as in Bach (hard k/h)" },
  { glyph: "Ψ ψ", name: "Psi", translit: "ps", sound: "ps as in lapse" },
  { glyph: "Ω ω", name: "Omega", translit: "ō", sound: "o as in tone (long)" },
];

const GREEK_NOTES: { label: string; text: string }[] = [
  { label: "αι", text: "ai — as in aisle" },
  { label: "ει", text: "ei — as in eight" },
  { label: "οι", text: "oi — as in oil" },
  { label: "αυ", text: "au — as in kraut" },
  { label: "ευ", text: "eu — eh-oo, run together" },
  { label: "ου", text: "ou — as in soup" },
  { label: "υι", text: "ui — wee" },
  { label: "  ̔ (rough)", text: "h-sound added before the vowel (e.g. ὁ = ho)" },
  { label: "  ̓ (smooth)", text: "no added sound" },
  { label: "γγ / γκ / γχ", text: "the first γ is pronounced 'ng' (e.g. ἄγγελος = angelos)" },
];

const HEBREW: Letter[] = [
  { glyph: "א", name: "Aleph", translit: "ʾ", sound: "silent / glottal stop" },
  { glyph: "ב", name: "Bet", translit: "b / v", sound: "b, or v without dagesh" },
  { glyph: "ג", name: "Gimel", translit: "g", sound: "g as in go" },
  { glyph: "ד", name: "Dalet", translit: "d", sound: "d as in do" },
  { glyph: "ה", name: "He", translit: "h", sound: "h as in hat" },
  { glyph: "ו", name: "Vav", translit: "w / v", sound: "v (also marks o/u vowels)" },
  { glyph: "ז", name: "Zayin", translit: "z", sound: "z as in zoo" },
  { glyph: "ח", name: "Chet", translit: "ch", sound: "ch as in Bach (guttural)" },
  { glyph: "ט", name: "Tet", translit: "t", sound: "t as in top" },
  { glyph: "י", name: "Yod", translit: "y", sound: "y as in yes" },
  { glyph: "כ ך", name: "Kaf", translit: "k / kh", sound: "k, or kh without dagesh (ך final)" },
  { glyph: "ל", name: "Lamed", translit: "l", sound: "l as in law" },
  { glyph: "מ ם", name: "Mem", translit: "m", sound: "m as in man (ם final)" },
  { glyph: "נ ן", name: "Nun", translit: "n", sound: "n as in new (ן final)" },
  { glyph: "ס", name: "Samekh", translit: "s", sound: "s as in sit" },
  { glyph: "ע", name: "Ayin", translit: "ʿ", sound: "silent / guttural" },
  { glyph: "פ ף", name: "Pe", translit: "p / f", sound: "p, or f without dagesh (ף final)" },
  { glyph: "צ ץ", name: "Tsadi", translit: "ts", sound: "ts as in cats (ץ final)" },
  { glyph: "ק", name: "Qof", translit: "q", sound: "k (deeper, back of throat)" },
  { glyph: "ר", name: "Resh", translit: "r", sound: "r as in run" },
  { glyph: "שׁ שׂ", name: "Shin / Sin", translit: "sh / s", sound: "sh (שׁ) or s (שׂ)" },
  { glyph: "ת", name: "Tav", translit: "t", sound: "t as in top" },
];

function LetterTable({ letters, rtl }: { letters: Letter[]; rtl?: boolean }) {
  return (
    <ul className="divide-y divide-stone-100">
      {letters.map((l) => (
        <li key={l.name} className="flex items-center gap-4 py-2.5">
          <span
            className={`w-16 shrink-0 font-serif text-2xl ${rtl ? "text-right" : ""}`}
            dir={rtl ? "rtl" : "ltr"}
          >
            {l.glyph}
          </span>
          <span className="w-24 shrink-0">
            <span className="block text-sm font-medium">{l.name}</span>
            <span className="block text-xs italic text-stone-500">{l.translit}</span>
          </span>
          <span className="flex-1 text-sm text-stone-600">{l.sound}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Reference() {
  const [tab, setTab] = useState<Tab>("greek");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Alphabet &amp; pronunciation</h1>
        <p className="mt-1 text-sm text-stone-500">
          A quick guide to reading the original languages. Pronunciations are approximate
          (Erasmian/standard academic) — enough to sound out a word.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-stone-100 p-1 text-sm">
        {(["greek", "hebrew"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 font-medium capitalize transition ${
              tab === t ? "bg-white text-ink shadow-sm" : "text-stone-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "greek" ? (
        <>
          <section className="card p-4">
            <LetterTable letters={GREEK} />
          </section>
          <section className="card p-4">
            <h2 className="mb-2 font-serif text-lg font-semibold">Diphthongs &amp; marks</h2>
            <ul className="divide-y divide-stone-100">
              {GREEK_NOTES.map((n) => (
                <li key={n.label} className="flex items-center gap-4 py-2">
                  <span className="w-20 shrink-0 font-serif text-lg">{n.label}</span>
                  <span className="flex-1 text-sm text-stone-600">{n.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <>
          <section className="card p-4">
            <p className="mb-3 text-xs text-stone-500">
              Hebrew reads right-to-left. Five letters have a different final form (shown second).
            </p>
            <LetterTable letters={HEBREW} rtl />
          </section>
          <section className="card p-4 text-sm text-stone-600">
            <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Vowels (niqqud)</h2>
            <p>
              Biblical Hebrew adds vowels as small dots and dashes below or above the consonants
              (e.g. בָּרָא = baw-raw'). The consonants carry the meaning; the points guide the
              reading.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
