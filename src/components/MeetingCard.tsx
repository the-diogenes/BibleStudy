import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import { getRsvps, nextMeeting, setRsvp, type RsvpSummary } from "../lib/db";
import type { Meeting, RsvpStatus } from "../types";

const RSVP_LABEL: Record<RsvpStatus, string> = { yes: "Going", maybe: "Maybe", no: "Can't" };

function formatWhen(iso: string | null): string {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MeetingCard() {
  const { profile } = useAuth();
  const { activeGroupId } = useGroups();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [rsvp, setRsvpSummary] = useState<RsvpSummary | null>(null);

  useEffect(() => {
    if (!activeGroupId) {
      setMeeting(null);
      return;
    }
    let active = true;
    nextMeeting(activeGroupId)
      .then(async (m) => {
        if (!active) return;
        setMeeting(m);
        if (m && profile) setRsvpSummary(await getRsvps(m.id, profile.id));
      })
      .catch(() => active && setMeeting(null));
    return () => {
      active = false;
    };
  }, [profile, activeGroupId]);

  if (!meeting) return null;

  async function choose(status: RsvpStatus) {
    if (!meeting || !profile) return;
    setRsvpSummary((prev) => ({ ...(prev || { yes: 0, no: 0, maybe: 0, mine: null }), mine: status }));
    try {
      await setRsvp(meeting.id, profile.id, status);
      setRsvpSummary(await getRsvps(meeting.id, profile.id));
    } catch {
      /* ignore */
    }
  }

  const hasPassage = meeting.book && meeting.chapter;

  return (
    <section className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Next meeting</p>
      <h2 className="mt-1 font-serif text-lg font-semibold">{meeting.title}</h2>
      <p className="mt-0.5 text-sm text-stone-500">{formatWhen(meeting.starts_at)}</p>
      {meeting.location && <p className="text-sm text-stone-500">{meeting.location}</p>}
      {meeting.notes && <p className="mt-2 text-sm text-stone-600">{meeting.notes}</p>}

      {hasPassage && (
        <Link
          to={`/read/${meeting.book}/${meeting.chapter}`}
          className="mt-2 inline-block text-sm font-medium text-stone-600 underline"
        >
          Read the passage
        </Link>
      )}

      <div className="mt-3 flex gap-2">
        {(["yes", "maybe", "no"] as RsvpStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => choose(s)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition ${
              rsvp?.mine === s
                ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                : "border-stone-300 text-stone-500 hover:bg-stone-50"
            }`}
          >
            {RSVP_LABEL[s]}
            {rsvp && rsvp[s] > 0 && <span className="ml-1 text-xs opacity-70">{rsvp[s]}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
