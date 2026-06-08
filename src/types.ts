export type Role = "admin" | "member";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface Study {
  id: string;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
}

export type LessonStatus = "upcoming" | "active" | "done";

export interface Lesson {
  id: string;
  study_id: string;
  title: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  status: LessonStatus;
  link: string | null;
  notes: string | null;
  position: number;
  created_at: string;
}

export interface LessonProgress {
  lesson_id: string;
  user_id: string;
  completed: boolean;
  updated_at: string;
}

export interface Thread {
  id: string;
  ref: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  title: string | null;
  created_by: string;
  created_at: string;
}

export interface Post {
  id: string;
  thread_id: string;
  parent_id: string | null;
  author: string;
  body: string;
  created_at: string;
  // joined
  author_name?: string;
}

export type NoteVisibility = "private" | "group";

export interface Note {
  id: string;
  ref: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  body: string;
  visibility: NoteVisibility;
  author: string;
  created_at: string;
  updated_at: string;
  // joined
  author_name?: string;
}
