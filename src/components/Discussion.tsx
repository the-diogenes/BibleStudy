import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import { supabase } from "../lib/supabase";
import {
  addPost,
  deletePost,
  ensureThread,
  getThreadByRef,
  getMembersMap,
  getReactions,
  listPosts,
  toggleReaction,
  type ReactionSummary,
} from "../lib/db";
import { refKey, type PassageRef } from "../lib/refs";
import type { Post, Thread } from "../types";
import { timeAgo } from "../lib/time";
import Spinner from "./Spinner";

export default function Discussion({ passage }: { passage: PassageRef }) {
  const { profile, status } = useAuth();
  const { activeGroupId } = useGroups();
  const ref = refKey(passage);
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [reactions, setReactions] = useState<Map<string, ReactionSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeGroupId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [t, m] = await Promise.all([getThreadByRef(activeGroupId, ref), getMembersMap()]);
    setMembers(m);
    setThread(t);
    setPosts(t ? await listPosts(t.id) : []);
    setLoading(false);
  }, [ref, activeGroupId]);

  useEffect(() => {
    if (status === "member") void load();
    else setLoading(false);
  }, [status, load]);

  // Realtime: refetch posts when the thread changes.
  useEffect(() => {
    const client = supabase;
    if (!client || !thread) return;
    const channel = client
      .channel(`posts:${thread.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `thread_id=eq.${thread.id}` },
        () => listPosts(thread.id).then(setPosts).catch(() => {})
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [thread]);

  useEffect(() => {
    if (!profile || posts.length === 0) {
      setReactions(new Map());
      return;
    }
    getReactions(posts.map((p) => p.id), profile.id)
      .then(setReactions)
      .catch(() => {});
  }, [posts, profile]);

  async function react(postId: string, mine: boolean) {
    if (!profile) return;
    await toggleReaction(postId, profile.id, mine);
    setReactions(await getReactions(posts.map((p) => p.id), profile.id));
  }

  const tree = useMemo(() => buildTree(posts), [posts]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !body.trim() || !activeGroupId) return;
    setBusy(true);
    try {
      const t = thread ?? (await ensureThread(activeGroupId, passage, profile.id));
      if (!thread) setThread(t);
      await addPost(t.group_id, t.id, profile.id, body.trim(), replyTo);
      setBody("");
      setReplyTo(null);
      setPosts(await listPosts(t.id));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await deletePost(id);
    if (thread) setPosts(await listPosts(thread.id));
  }

  if (status !== "member") {
    return <p className="text-sm text-stone-500">Sign in as a member to join the discussion.</p>;
  }
  if (loading) return <Spinner />;

  return (
    <div>
      {tree.length === 0 ? (
        <p className="mb-4 text-sm text-stone-500">
          No discussion yet. Start the conversation about this passage.
        </p>
      ) : (
        <ul className="mb-4 space-y-3">
          {tree.map((node) => (
            <PostNode
              key={node.post.id}
              node={node}
              members={members}
              reactions={reactions}
              onReact={react}
              meId={profile?.id}
              onReply={setReplyTo}
              onDelete={remove}
              depth={0}
            />
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="card p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
            Replying to a comment
            <button type="button" className="underline" onClick={() => setReplyTo(null)}>
              cancel
            </button>
          </div>
        )}
        <textarea
          className="input min-h-[4.5rem]"
          placeholder="Share an observation, question, or insight..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button className="btn-primary" disabled={busy || !body.trim()}>
            {busy ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface TreeNode {
  post: Post;
  children: TreeNode[];
}

function buildTree(posts: Post[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  posts.forEach((p) => byId.set(p.id, { post: p, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    const pid = node.post.parent_id;
    if (pid && byId.has(pid)) byId.get(pid)!.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function PostNode({
  node,
  members,
  reactions,
  onReact,
  meId,
  onReply,
  onDelete,
  depth,
}: {
  node: TreeNode;
  members: Map<string, string>;
  reactions: Map<string, ReactionSummary>;
  onReact: (id: string, mine: boolean) => void;
  meId?: string;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  depth: number;
}) {
  const { post } = node;
  const name = members.get(post.author) || "Member";
  const reaction = reactions.get(post.id) || { count: 0, mine: false };
  return (
    <li className={depth > 0 ? "ml-4 border-l border-stone-200 pl-3" : ""}>
      <div className="card p-3">
        <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
          <span className="font-medium text-stone-600">{name}</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-stone-800">{post.body}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-stone-400">
          <button
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition ${
              reaction.mine ? "bg-amber-100 text-amber-800" : "hover:text-ink"
            }`}
            onClick={() => onReact(post.id, reaction.mine)}
            title="Amen"
          >
            🙏 {reaction.count > 0 && <span>{reaction.count}</span>}
          </button>
          <button className="hover:text-ink" onClick={() => onReply(post.id)}>
            Reply
          </button>
          {meId === post.author && (
            <button className="hover:text-red-600" onClick={() => onDelete(post.id)}>
              Delete
            </button>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {node.children.map((c) => (
            <PostNode
              key={c.post.id}
              node={c}
              members={members}
              reactions={reactions}
              onReact={onReact}
              meId={meId}
              onReply={onReply}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
