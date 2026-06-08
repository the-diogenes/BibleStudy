import { useEffect, useRef, useState } from "react";
import {
  absoluteUrl,
  canNativeShare,
  copyToClipboard,
  nativeShare,
  shareLinks,
} from "../lib/share";
import { CheckIcon, CopyIcon, ShareIcon } from "./icons";

interface Props {
  /** In-app route to share, e.g. "passage/JHN/3/16" (no leading slash needed). */
  routePath: string;
  /** Short label of what's being shared, e.g. "John 3:16". */
  title: string;
  /** Optional longer text (e.g. the verse) prepended to the link in messages. */
  text?: string;
  className?: string;
  /** Icon-only trigger (for tight rows). */
  compact?: boolean;
}

export default function ShareButton({ routePath, title, text, className = "", compact }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const url = absoluteUrl(routePath);
  const message = text ? `${title} — ${text}` : title;
  const links = shareLinks(url, message);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function onTrigger(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // On mobile, go straight to the native sheet (Instagram, Messenger, Messages…).
    if (canNativeShare()) {
      const ok = await nativeShare({ title, text: message, url });
      if (ok) return;
    }
    setOpen((v) => !v);
  }

  async function onCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  const item = "flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-100 rounded-md w-full text-left";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={onTrigger}
        aria-label="Share"
        className={
          compact
            ? "rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-ink"
            : "btn-ghost px-3 py-1.5 text-sm"
        }
      >
        <ShareIcon className="h-4 w-4" />
        {!compact && <span>Share</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
          <button onClick={onCopy} className={item}>
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 text-emerald-600" /> Copied!
              </>
            ) : (
              <>
                <CopyIcon className="h-4 w-4" /> Copy link
              </>
            )}
          </button>
          <a className={item} href={links.sms}>
            Text message
          </a>
          <a className={item} href={links.messenger} target="_blank" rel="noreferrer">
            Messenger
          </a>
          <a className={item} href={links.whatsapp} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a className={item} href={links.email}>
            Email
          </a>
          <a className={item} href={links.facebook} target="_blank" rel="noreferrer">
            Facebook
          </a>
          <a className={item} href={links.twitter} target="_blank" rel="noreferrer">
            X / Twitter
          </a>
        </div>
      )}
    </div>
  );
}
