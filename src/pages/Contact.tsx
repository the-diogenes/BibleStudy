import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { config } from "../lib/config";
import { notifyAdmin } from "../lib/notify";
import {
  addThreadMessage,
  createThread,
  myThreads,
  threadMessages,
} from "../lib/db";
import type { FeedbackMessage, FeedbackThread } from "../types";
import { timeAgo } from "../lib/time";
import Spinner from "../components/Spinner";
import { ArrowLeft } from "../components/icons";

export default function Contact() {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<FeedbackThread | null>(null);

  // New-message form
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    if (!profile) return;
    setLoading(true);
    setThreads(await myThreads(profile.id).catch(() => []));
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function startThread(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !subject.trim() || !body.trim()) return;
    setSending(true);
    setErr(null);
    try {
      await createThread(profile.id, subject.trim(), body.trim());
      void notifyAdmin({
        subject: `[${config.groupName}] ${subject.trim()}`,
        message: body.trim(),
        fromName: profile.display_name || profile.username || "Member",
      });
      setSubject("");
      setBody("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      await refresh();
    } catch (e) {
      setErr((e as Error).message || "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (active) {
    return <Conversation thread={active} onBack={() => { setActive(null); void refresh(); }} />;
  }

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-2xl font-semibold">Contact &amp; feedback</h1>
      <p className="text-sm text-stone-500">
        Send a message to the group admin — questions, feedback, prayer, or anything else. You'll
        get replies right here.
      </p>

      <form onSubmit={startThread} className="card space-y-3 p-4">
        <input
          className="input"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="input min-h-[7rem]"
          placeholder="Write your message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={sending || !subject.trim() || !body.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
          {sent && <span className="text-sm text-emerald-600">Sent! The admin was notified.</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </form>

      <section>
        <h2 className="mb-2 font-serif text-lg font-semibold">Your messages</h2>
        {loading ? (
          <Spinner />
        ) : threads.length === 0 ? (
          <p className="text-sm text-stone-500">No messages yet.</p>
        ) : (
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t)}
                  className="card flex w-full items-center justify-between px-4 py-3 text-left hover:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.subject}</span>
                    <span className="block text-xs text-stone-400">{timeAgo(t.updated_at)}</span>
                  </span>
                  <span
                    className={`chip ${
                      t.status === "open"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-stone-200 text-stone-500"
                    }`}
                  >
                    {t.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Conversation({ thread, onBack }: { thread: FeedbackThread; onBack: () => void }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    setMessages(await threadMessages(thread.id).catch(() => []));
  }

  useEffect(() => {
    void load();
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel(`feedback:${thread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback_messages", filter: `thread_id=eq.${thread.id}` },
        () => void load()
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !body.trim()) return;
    setBusy(true);
    setErr(null);
    const text = body.trim();
    setBody("");
    try {
      await addThreadMessage(thread.id, profile.id, "member", text);
      void notifyAdmin({
        subject: `[${config.groupName}] Re: ${thread.subject}`,
        message: text,
        fromName: profile.display_name || profile.username || "Member",
      });
      await load();
    } catch (e) {
      setBody(text);
      setErr((e as Error).message || "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-stone-500">
        <ArrowLeft className="h-4 w-4" /> All messages
      </button>
      <h1 className="font-serif text-xl font-semibold">{thread.subject}</h1>

      <div className="mt-3 flex-1 space-y-3 overflow-y-auto pb-2">
        {messages.map((m) => {
          const mine = m.sender_role === "member";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-ink text-parchment" : "card"
                }`}
              >
                {!mine && (
                  <p className="mb-0.5 text-xs font-semibold text-stone-400">Admin</p>
                )}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[0.65rem] ${mine ? "text-stone-400" : "text-stone-400"}`}>
                  {timeAgo(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          className="input"
          placeholder="Write a reply…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="btn-primary" disabled={busy || !body.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
