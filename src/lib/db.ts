import { requireSupabase, supabase } from "./supabase";
import type {
  Lesson,
  LessonProgress,
  Note,
  NoteVisibility,
  Post,
  Profile,
  Study,
  Thread,
} from "../types";
import type { PassageRef } from "./refs";
import { refKey } from "./refs";

// ───────────────────────── Members ─────────────────────────
export async function getMembersMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase) return map;
  const { data } = await supabase.from("profiles").select("id, display_name");
  (data as Pick<Profile, "id" | "display_name">[] | null)?.forEach((p) =>
    map.set(p.id, p.display_name || "Member")
  );
  return map;
}

// ───────────────────────── Threads & posts ─────────────────────────
export async function getThreadByRef(ref: string): Promise<Thread | null> {
  const sb = requireSupabase();
  const { data } = await sb.from("threads").select("*").eq("ref", ref).maybeSingle();
  return (data as Thread) || null;
}

export async function ensureThread(r: PassageRef, userId: string, title?: string): Promise<Thread> {
  const sb = requireSupabase();
  const ref = refKey(r);
  const existing = await getThreadByRef(ref);
  if (existing) return existing;
  const { data, error } = await sb
    .from("threads")
    .insert({
      ref,
      book: r.book,
      chapter: r.chapter,
      verse_start: r.verseStart ?? null,
      verse_end: r.verseEnd ?? null,
      title: title ?? null,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) {
    // Possible race: another member created it first.
    const again = await getThreadByRef(ref);
    if (again) return again;
    throw error;
  }
  return data as Thread;
}

export async function listPosts(threadId: string): Promise<Post[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("posts")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Post[]) || [];
}

export async function addPost(
  threadId: string,
  author: string,
  body: string,
  parentId: string | null = null
): Promise<Post> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("posts")
    .insert({ thread_id: threadId, author, body, parent_id: parentId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Post;
}

export async function deletePost(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export interface ReactionSummary {
  count: number;
  mine: boolean;
}

export async function getReactions(
  postIds: string[],
  userId: string
): Promise<Map<string, ReactionSummary>> {
  const map = new Map<string, ReactionSummary>();
  if (!supabase || postIds.length === 0) return map;
  const { data } = await supabase
    .from("post_reactions")
    .select("post_id, user_id")
    .in("post_id", postIds);
  (data as { post_id: string; user_id: string }[] | null)?.forEach((r) => {
    const cur = map.get(r.post_id) || { count: 0, mine: false };
    cur.count += 1;
    if (r.user_id === userId) cur.mine = true;
    map.set(r.post_id, cur);
  });
  return map;
}

export async function toggleReaction(
  postId: string,
  userId: string,
  mine: boolean,
  emoji = "🙏"
): Promise<void> {
  const sb = requireSupabase();
  if (mine) {
    const { error } = await sb
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
  } else {
    const { error } = await sb
      .from("post_reactions")
      .insert({ post_id: postId, user_id: userId, emoji });
    if (error) throw error;
  }
}

export async function recentThreads(limit = 30): Promise<Thread[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("threads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Thread[]) || [];
}

// ───────────────────────── Notes ─────────────────────────
export async function listNotesForRef(ref: string): Promise<Note[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("ref", ref)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Note[]) || [];
}

export async function addNote(
  r: PassageRef,
  author: string,
  body: string,
  visibility: NoteVisibility
): Promise<Note> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("notes")
    .insert({
      ref: refKey(r),
      book: r.book,
      chapter: r.chapter,
      verse_start: r.verseStart ?? null,
      verse_end: r.verseEnd ?? null,
      body,
      visibility,
      author,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Note;
}

export async function deleteNote(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function listMyNotes(authorId: string): Promise<Note[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("author", authorId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Note[]) || [];
}

export async function listGroupNotes(limit = 50): Promise<Note[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("visibility", "group")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Note[]) || [];
}

// ───────────────────────── Curriculum ─────────────────────────
export async function listStudies(): Promise<Study[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("studies").select("*").order("position");
  if (error) throw error;
  return (data as Study[]) || [];
}

export async function listLessons(studyId: string): Promise<Lesson[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("lessons")
    .select("*")
    .eq("study_id", studyId)
    .order("position");
  if (error) throw error;
  return (data as Lesson[]) || [];
}

export async function myProgress(userId: string): Promise<Map<string, boolean>> {
  const sb = requireSupabase();
  const map = new Map<string, boolean>();
  const { data } = await sb.from("lesson_progress").select("lesson_id, completed").eq("user_id", userId);
  (data as Pick<LessonProgress, "lesson_id" | "completed">[] | null)?.forEach((p) =>
    map.set(p.lesson_id, p.completed)
  );
  return map;
}

export async function setProgress(
  lessonId: string,
  userId: string,
  completed: boolean
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("lesson_progress")
    .upsert(
      { lesson_id: lessonId, user_id: userId, completed, updated_at: new Date().toISOString() },
      { onConflict: "lesson_id,user_id" }
    );
  if (error) throw error;
}

// Admin writes
export async function createStudy(title: string, description: string): Promise<Study> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("studies")
    .insert({ title, description })
    .select("*")
    .single();
  if (error) throw error;
  return data as Study;
}

export async function deleteStudy(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("studies").delete().eq("id", id);
  if (error) throw error;
}

export async function createLesson(input: Omit<Lesson, "id" | "created_at">): Promise<Lesson> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("lessons").insert(input).select("*").single();
  if (error) throw error;
  return data as Lesson;
}

export async function updateLesson(id: string, patch: Partial<Lesson>): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("lessons").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("lessons").delete().eq("id", id);
  if (error) throw error;
}

// Invites (admin)
export async function listInvites(): Promise<{ email: string; role: string }[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("member_invites").select("email, role").order("email");
  if (error) throw error;
  return (data as { email: string; role: string }[]) || [];
}

export async function addInvite(email: string, role = "member"): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("member_invites")
    .upsert({ email: email.toLowerCase(), role }, { onConflict: "email" });
  if (error) throw error;
}

export async function removeInvite(email: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("member_invites").delete().eq("email", email);
  if (error) throw error;
}
