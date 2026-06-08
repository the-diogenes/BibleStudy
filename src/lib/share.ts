// Build absolute, shareable links to passages/lessons and helpers for the
// various share targets. Mobile uses the native share sheet (which exposes
// Instagram, Messenger, Messages, etc.); desktop falls back to explicit links.

/** Turn an in-app route (no leading slash) into an absolute URL incl. base path. */
export function absoluteUrl(routePath: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const origin = window.location.origin;
  const path = routePath.replace(/^\//, "");
  return `${origin}${base}${path}`.replace(/([^:]\/)\/+/g, "$1");
}

export interface ShareTargetLinks {
  sms: string;
  messenger: string;
  whatsapp: string;
  email: string;
  facebook: string;
  twitter: string;
}

/** Pre-built share links for desktop / fallback menus. */
export function shareLinks(url: string, text: string): ShareTargetLinks {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const tu = encodeURIComponent(`${text} ${url}`);
  return {
    // SMS body separator differs by platform; "?&body=" is the most compatible.
    sms: `sms:?&body=${tu}`,
    // Messenger deep link (works in the app on mobile; on desktop opens m.me).
    messenger: `fb-messenger://share/?link=${u}`,
    whatsapp: `https://wa.me/?text=${tu}`,
    email: `mailto:?subject=${encodeURIComponent("Bible study")}&body=${tu}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`,
    twitter: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
  };
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function nativeShare(data: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> {
  try {
    await navigator.share(data);
    return true;
  } catch {
    // User cancelled or share failed; let the caller fall back to the menu.
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
