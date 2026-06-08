export type Role = "admin" | "member";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  username?: string | null;
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

export interface Meeting {
  id: string;
  title: string;
  starts_at: string | null;
  location: string | null;
  book: string | null;
  chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
  notes: string | null;
  created_at: string;
}

export type RsvpStatus = "yes" | "no" | "maybe";

export interface MeetingRsvp {
  meeting_id: string;
  user_id: string;
  status: RsvpStatus;
  updated_at: string;
}

export interface Highlight {
  user_id: string;
  book: string;
  chapter: number;
  verse: number;
  color: string;
  created_at: string;
}

export type FeedbackStatus = "open" | "closed";

export interface FeedbackThread {
  id: string;
  user_id: string;
  subject: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  // joined
  author_name?: string;
}

export interface FeedbackMessage {
  id: string;
  thread_id: string;
  author: string;
  sender_role: "member" | "admin";
  body: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  book: string;
  chapter: number;
  verse: number | null;
  label: string | null;
  created_at: string;
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
