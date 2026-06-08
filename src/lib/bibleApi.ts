import { cacheGet, cacheSet } from "./cache";

// Free Use Bible API (https://bible.helloao.org) - no key, no limits,
// public-domain / freely-licensed translations only.
const API = "https://bible.helloao.org/api";

export interface Translation {
  id: string;
  name: string;
  englishName: string;
  shortName: string;
  language: string;
  textDirection: "ltr" | "rtl";
}

export interface BookSummary {
  id: string;
  name: string;
  commonName: string;
  order: number;
  numberOfChapters: number;
}

export type VerseContentPart = string | { text?: string; [key: string]: unknown };

export interface ChapterContentItem {
  type: "heading" | "verse" | "line_break" | string;
  number?: number;
  content?: VerseContentPart[];
}

export interface Chapter {
  number: number;
  content: ChapterContentItem[];
  nextChapterApiLink: string | null;
  previousChapterApiLink: string | null;
  numberOfVerses: number;
}

async function getJson<T>(path: string, cacheKey?: string, ttlMs?: number): Promise<T> {
  if (cacheKey) {
    const cached = cacheGet<T>(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Bible API error ${res.status} for ${path}`);
  const data = (await res.json()) as T;
  if (cacheKey) cacheSet(cacheKey, data, ttlMs);
  return data;
}

export async function getTranslations(): Promise<Translation[]> {
  const data = await getJson<{ translations: Translation[] }>(
    "/available_translations.json",
    "translations",
    1000 * 60 * 60 * 24 * 7
  );
  return data.translations.filter((t) => t.language === "eng");
}

export async function getBooks(translation: string): Promise<BookSummary[]> {
  const data = await getJson<{ books: BookSummary[] }>(
    `/${translation}/books.json`,
    `books:${translation}`
  );
  return data.books;
}

export async function getChapter(
  translation: string,
  book: string,
  chapter: number
): Promise<Chapter> {
  const data = await getJson<{ chapter: Chapter }>(
    `/${translation}/${book}/${chapter}.json`,
    `chapter:${translation}:${book}:${chapter}`
  );
  return data.chapter;
}

export interface Commentary {
  id: string;
  name: string;
  englishName: string;
  language: string;
}

export async function getCommentaries(): Promise<Commentary[]> {
  const data = await getJson<{ commentaries: Commentary[] }>(
    "/available_commentaries.json",
    "commentaries",
    1000 * 60 * 60 * 24 * 7
  );
  return data.commentaries.filter((c) => c.language === "eng");
}

export interface CommentaryChapter {
  number: number;
  introduction?: string;
  content: ChapterContentItem[];
}

export async function getCommentaryChapter(
  id: string,
  book: string,
  chapter: number
): Promise<CommentaryChapter> {
  const data = await getJson<{ chapter: CommentaryChapter }>(
    `/c/${id}/${book}/${chapter}.json`,
    `commentary:${id}:${book}:${chapter}`
  );
  return data.chapter;
}

/** Flatten a verse's content parts into plain text. */
export function verseText(parts: VerseContentPart[] | undefined): string {
  if (!parts) return "";
  return parts
    .map((p) => (typeof p === "string" ? p : typeof p.text === "string" ? p.text : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull a single verse's text out of a chapter (used by passage/thread pages). */
export function findVerseText(chapter: Chapter, verse: number): string {
  const item = chapter.content.find((c) => c.type === "verse" && c.number === verse);
  return item ? verseText(item.content) : "";
}
