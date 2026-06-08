// The group signs in with a USERNAME + password. Supabase Auth is email-based,
// so we map each username to a stable synthetic email under a reserved domain.
// (No real email is needed; password is the credential.)
export const USERNAME_EMAIL_DOMAIN = "biblestudy.app";

// Reduce any typed username to a safe email local-part: lowercase, no spaces,
// only letters/numbers/dot/dash/underscore, and no leading/trailing punctuation.
// This guarantees the synthetic email is always valid so sign-up never fails
// with "Unable to validate email address: invalid format".
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  return email.replace(new RegExp(`@${USERNAME_EMAIL_DOMAIN}$`, "i"), "");
}

export function isUsernameEmail(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${USERNAME_EMAIL_DOMAIN}`);
}
