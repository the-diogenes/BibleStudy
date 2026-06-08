import { requireSupabase, supabase } from "./supabase";
import type {
  Bookmark,
  FeedbackMessage,
  FeedbackThread,
  Group,
  GroupMember,
  GroupMembership,
  GroupRole,
  Highlight,
  Lesson,
  LessonProgress,
  Meeting,
  MeetingRsvp,
  Note,
  NoteVisibility,
  Post,
  Profile,
  RsvpStatus,
  Study,
  Thread,
} from "../types";
import type { PassageRef } from "./refs";
import { refKey } from "./refs";

// ───────────────────────── Groups ─────────────────────────
export async function listMyGroups(userId: string): Promise<GroupMembership[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("group_members")
    .select("role, groups(*)")
    .eq("user_id", userId);
  if (error) throw error;
  // Supabase types the embedded relation loosely; normalize to a single Group.
  const rows = (data as unknown as { role: GroupRole; groups: Group | Group[] | null }[]) || [];
  return rows
    .map((r) => ({ role: r.role, group: Array.isArray(r.groups) ? r.groups[0] : r.groups }))
    .filter((r): r is GroupMembership => Boolean(r.group))
    .sort((a, b) => a.group.name.localeCompare(b.group.name));
}

export async function createGroup(name: string): Promise<Group> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("create_group", { p_name: name }).single();
  if (error) throw error;
  return data as Group;
}

export async function lookupGroup(
  code: string
): Promise<{ id: string; name: string; member_count: number } | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("lookup_group", { p_code: code });
  if (error) throw error;
  const row = ((data as { id: string; name: string; member_count: number }[]) || [])[0];
  return row || null;
}

export async function joinGroup(code: string): Promise<Group> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("join_group", { p_code: code }).single();
  if (error) throw error;
  return data as Group;
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("rename_group", { p_group: groupId, p_name: name });
  if (error) throw error;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("delete_group", { p_group: groupId });
  if (error) throw error;
}

export async function setGroupMemberRole(
  groupId: string,
  userId: string,
  role: GroupRole
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("set_group_member_role", {
    p_group: groupId,
    p_user: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("remove_group_member", { p_group: groupId, p_user: userId });
  if (error) throw error;
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const sb = requireSupabase();
  const [{ data: rows, error }, names] = await Promise.all([
    sb.from("group_members").select("user_id, role").eq("group_id", groupId),
    getMembersMap(),
  ]);
  if (error) throw error;
  return ((rows as { user_id: string; role: GroupRole }[]) || []).map((r) => ({
    user_id: r.user_id,
    role: r.role,
    name: names.get(r.user_id) || "Member",
  }));
}

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
export async function getThreadByRef(groupId: string, ref: string): Promise<Thread | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from("threads")
    .select("*")
    .eq("group_id", groupId)
    .eq("ref", ref)
    .maybeSingle();
  return (data as Thread) || null;
}

export async function ensureThread(
  groupId: string,
  r: PassageRef,
  userId: string,
  title?: string
): Promise<Thread> {
  const sb = requireSupabase();
  const ref = refKey(r);
  const existing = await getThreadByRef(groupId, ref);
  if (existing) return existing;
  const { data, error } = await sb
    .from("threads")
    .insert({
      group_id: groupId,
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
    const again = await getThreadByRef(groupId, ref);
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
  groupId: string,
  threadId: string,
  author: string,
  body: string,
  parentId: string | null = null
): Promise<Post> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("posts")
    .insert({ group_id: groupId, thread_id: threadId, author, body, parent_id: parentId })
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

export async function recentThreads(groupId: string, limit = 30): Promise<Thread[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("threads")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Thread[]) || [];
}

// ───────────────────────── Notes ─────────────────────────
export async function listNotesForRef(groupId: string, ref: string): Promise<Note[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("group_id", groupId)
    .eq("ref", ref)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Note[]) || [];
}

export async function addNote(
  groupId: string,
  r: PassageRef,
  author: string,
  body: string,
  visibility: NoteVisibility
): Promise<Note> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("notes")
    .insert({
      group_id: groupId,
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

export async function listMyNotes(groupId: string, authorId: string): Promise<Note[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("group_id", groupId)
    .eq("author", authorId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Note[]) || [];
}

export async function listGroupNotes(groupId: string, limit = 50): Promise<Note[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("group_id", groupId)
    .eq("visibility", "group")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Note[]) || [];
}

// ───────────────────────── Curriculum ─────────────────────────
export async function listStudies(groupId: string): Promise<Study[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("studies")
    .select("*")
    .eq("group_id", groupId)
    .order("position");
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
export async function createStudy(
  groupId: string,
  title: string,
  description: string
): Promise<Study> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("studies")
    .insert({ group_id: groupId, title, description })
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

// ───────────────────────── App settings ─────────────────────────
export async function getRequireInvite(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from("app_settings")
    .select("require_invite")
    .eq("id", 1)
    .maybeSingle();
  return Boolean((data as { require_invite?: boolean } | null)?.require_invite);
}

export async function setRequireInvite(value: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("app_settings").update({ require_invite: value }).eq("id", 1);
  if (error) throw error;
}

// ───────────────────────── Members (admin roster) ─────────────────────────
export async function listMembers(): Promise<Profile[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .order("display_name");
  if (error) throw error;
  return (data as Profile[]) || [];
}

export async function setMemberRole(id: string, role: "member" | "admin"): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function adminSetPassword(target: string, newPassword: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_set_password", { target, new_password: newPassword });
  if (error) throw error;
}

// ───────────────────────── Meetings & RSVPs ─────────────────────────
export async function nextMeeting(groupId: string): Promise<Meeting | null> {
  const sb = requireSupabase();
  const nowIso = new Date().toISOString();
  const { data } = await sb
    .from("meetings")
    .select("*")
    .eq("group_id", groupId)
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(1);
  const list = (data as Meeting[]) || [];
  if (list.length) return list[0];
  // No upcoming meeting scheduled: fall back to the most recently created.
  const { data: recent } = await sb
    .from("meetings")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1);
  return ((recent as Meeting[]) || [])[0] || null;
}

export async function listMeetings(groupId: string): Promise<Meeting[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("meetings")
    .select("*")
    .eq("group_id", groupId)
    .order("starts_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as Meeting[]) || [];
}

export async function createMeeting(input: Omit<Meeting, "id" | "created_at">): Promise<Meeting> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("meetings").insert(input).select("*").single();
  if (error) throw error;
  return data as Meeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("meetings").delete().eq("id", id);
  if (error) throw error;
}

export interface RsvpSummary {
  yes: number;
  no: number;
  maybe: number;
  mine: RsvpStatus | null;
}

export async function getRsvps(meetingId: string, userId: string): Promise<RsvpSummary> {
  const sb = requireSupabase();
  const summary: RsvpSummary = { yes: 0, no: 0, maybe: 0, mine: null };
  const { data } = await sb
    .from("meeting_rsvps")
    .select("user_id, status")
    .eq("meeting_id", meetingId);
  (data as Pick<MeetingRsvp, "user_id" | "status">[] | null)?.forEach((r) => {
    summary[r.status] += 1;
    if (r.user_id === userId) summary.mine = r.status;
  });
  return summary;
}

export async function setRsvp(
  meetingId: string,
  userId: string,
  status: RsvpStatus
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("meeting_rsvps").upsert(
    { meeting_id: meetingId, user_id: userId, status, updated_at: new Date().toISOString() },
    { onConflict: "meeting_id,user_id" }
  );
  if (error) throw error;
}

// ───────────────────────── Highlights ─────────────────────────
export async function getChapterHighlights(
  userId: string,
  book: string,
  chapter: number
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!supabase) return map;
  const { data } = await supabase
    .from("highlights")
    .select("verse, color")
    .eq("user_id", userId)
    .eq("book", book)
    .eq("chapter", chapter);
  (data as Pick<Highlight, "verse" | "color">[] | null)?.forEach((h) => map.set(h.verse, h.color));
  return map;
}

export async function setHighlight(
  userId: string,
  book: string,
  chapter: number,
  verse: number,
  color: string
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("highlights").upsert(
    { user_id: userId, book, chapter, verse, color },
    { onConflict: "user_id,book,chapter,verse" }
  );
  if (error) throw error;
}

export async function clearHighlight(
  userId: string,
  book: string,
  chapter: number,
  verse: number
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("highlights")
    .delete()
    .eq("user_id", userId)
    .eq("book", book)
    .eq("chapter", chapter)
    .eq("verse", verse);
  if (error) throw error;
}

// ───────────────────────── Bookmarks ─────────────────────────
export async function listBookmarks(userId: string): Promise<Bookmark[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Bookmark[]) || [];
}

export async function addBookmark(
  userId: string,
  book: string,
  chapter: number,
  verse: number | null,
  label: string | null
): Promise<Bookmark> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookmarks")
    .insert({ user_id: userId, book, chapter, verse, label })
    .select("*")
    .single();
  if (error) throw error;
  return data as Bookmark;
}

export async function getChapterBookmarks(
  userId: string,
  book: string,
  chapter: number
): Promise<Bookmark[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .eq("book", book)
    .eq("chapter", chapter);
  return (data as Bookmark[]) || [];
}

export async function deleteBookmark(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("bookmarks").delete().eq("id", id);
  if (error) throw error;
}

// ───────────────────────── Reading progress ─────────────────────────
export async function markChapterRead(
  userId: string,
  book: string,
  chapter: number
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("reads")
    .upsert(
      { user_id: userId, book, chapter, read_at: new Date().toISOString() },
      { onConflict: "user_id,book,chapter" }
    );
}

export async function unmarkChapterRead(
  userId: string,
  book: string,
  chapter: number
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("reads")
    .delete()
    .eq("user_id", userId)
    .eq("book", book)
    .eq("chapter", chapter);
  if (error) throw error;
}

export async function getLastRead(
  userId: string
): Promise<{ book: string; chapter: number } | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("reads")
    .select("book, chapter, read_at")
    .eq("user_id", userId)
    .order("read_at", { ascending: false })
    .limit(1);
  const row = ((data as { book: string; chapter: number }[]) || [])[0];
  return row ? { book: row.book, chapter: row.chapter } : null;
}

export async function getBookReads(userId: string, book: string): Promise<Set<number>> {
  const set = new Set<number>();
  if (!supabase) return set;
  const { data } = await supabase
    .from("reads")
    .select("chapter")
    .eq("user_id", userId)
    .eq("book", book);
  (data as { chapter: number }[] | null)?.forEach((r) => set.add(r.chapter));
  return set;
}

// ───────────────────────── Feedback / contact inbox ─────────────────────────
export async function myThreads(userId: string): Promise<FeedbackThread[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("feedback_threads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as FeedbackThread[]) || [];
}

export async function allThreads(): Promise<FeedbackThread[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("feedback_threads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as FeedbackThread[]) || [];
}

export async function createThread(
  userId: string,
  subject: string,
  body: string
): Promise<FeedbackThread> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("feedback_threads")
    .insert({ user_id: userId, subject })
    .select("*")
    .single();
  if (error) throw error;
  const thread = data as FeedbackThread;
  await addThreadMessage(thread.id, userId, "member", body);
  return thread;
}

export async function threadMessages(threadId: string): Promise<FeedbackMessage[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("feedback_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as FeedbackMessage[]) || [];
}

export async function addThreadMessage(
  threadId: string,
  author: string,
  senderRole: "member" | "admin",
  body: string
): Promise<FeedbackMessage> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("feedback_messages")
    .insert({ thread_id: threadId, author, sender_role: senderRole, body })
    .select("*")
    .single();
  if (error) throw error;
  await sb
    .from("feedback_threads")
    .update({ updated_at: new Date().toISOString(), status: "open" })
    .eq("id", threadId);
  return data as FeedbackMessage;
}

export async function setThreadStatus(threadId: string, status: "open" | "closed"): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("feedback_threads").update({ status }).eq("id", threadId);
  if (error) throw error;
}
