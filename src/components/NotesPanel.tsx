import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { addNote, deleteNote, getMembersMap, listNotesForRef } from "../lib/db";
import { refKey, type PassageRef } from "../lib/refs";
import type { Note, NoteVisibility } from "../types";
import { timeAgo } from "../lib/time";
import Spinner from "./Spinner";

export default function NotesPanel({ passage }: { passage: PassageRef }) {
  const { profile, status } = useAuth();
  const ref = refKey(passage);
  const [notes, setNotes] = useState<Note[]>([]);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("private");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [n, m] = await Promise.all([listNotesForRef(ref), getMembersMap()]);
    setNotes(n);
    setMembers(m);
    setLoading(false);
  }, [ref]);

  useEffect(() => {
    if (status === "member") void load();
    else setLoading(false);
  }, [status, load]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel(`notes:${ref}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `ref=eq.${ref}` },
        () => listNotesForRef(ref).then(setNotes).catch(() => {})
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [ref]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !body.trim()) return;
    setBusy(true);
    try {
      await addNote(passage, profile.id, body.trim(), visibility);
      setBody("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await deleteNote(id);
    await load();
  }

  if (status !== "member") {
    return <p className="text-sm text-stone-500">Sign in as a member to keep notes.</p>;
  }
  if (loading) return <Spinner />;

  return (
    <div>
      {notes.length === 0 ? (
        <p className="mb-4 text-sm text-stone-500">No notes on this passage yet.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="card p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-stone-600">
                    {members.get(n.author) || "Member"}
                  </span>
                  <span
                    className={`chip ${
                      n.visibility === "group"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {n.visibility === "group" ? "Group" : "Private"}
                  </span>
                </span>
                <span>{timeAgo(n.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-stone-800">{n.body}</p>
              {profile?.id === n.author && (
                <button
                  className="mt-2 text-xs text-stone-400 hover:text-red-600"
                  onClick={() => remove(n.id)}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="card p-3">
        <textarea
          className="input min-h-[4rem]"
          placeholder="Write a note in the margin..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-stone-500">
            <select
              className="rounded border border-stone-300 px-2 py-1 text-xs"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as NoteVisibility)}
            >
              <option value="private">Private (only me)</option>
              <option value="group">Group (shared)</option>
            </select>
          </label>
          <button className="btn-primary" disabled={busy || !body.trim()}>
            {busy ? "Saving..." : "Save note"}
          </button>
        </div>
      </form>
    </div>
  );
}
