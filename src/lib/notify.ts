import { config } from "./config";

// No-backend email notification via FormSubmit (https://formsubmit.co).
// Same approach as the "doni job" project: a POST to the ajax endpoint emails
// the admin. The first message triggers a one-time activation email FormSubmit
// sends to that address — click the link once and all future sends go through.

function endpoint(): string {
  const target = config.notifyEmail;
  // Allow passing a full endpoint (e.g. a hashed FormSubmit alias) to hide the email.
  if (target.startsWith("http")) return target;
  return `https://formsubmit.co/ajax/${encodeURIComponent(target)}`;
}

export async function notifyAdmin(params: {
  subject: string;
  message: string;
  fromName?: string;
  replyUrl?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: params.subject,
        _captcha: "false",
        _template: "table",
        from: params.fromName || "Member",
        message: params.message,
        reply_url: params.replyUrl || window.location.origin,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { success?: string | boolean };
    return res.ok && (json.success === "true" || json.success === true);
  } catch {
    // Best-effort: the in-app inbox still has the message even if email fails.
    return false;
  }
}
