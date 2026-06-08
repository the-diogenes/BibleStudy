// Tiny localStorage cache with TTL. Used to keep already-read chapters and the
// book/translation lists snappy and available offline (the service worker also
// caches network responses).

interface Entry<T> {
  v: T;
  exp: number;
}

const PREFIX = "bs:";

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.exp && entry.exp < Date.now()) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.v;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T, ttlMs = 1000 * 60 * 60 * 24 * 30): void {
  try {
    const entry: Entry<T> = { v: value, exp: ttlMs ? Date.now() + ttlMs : 0 };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable: ignore, network will be used.
  }
}
