// The group signs in with a USERNAME + password. Supabase Auth is email-based,
// so we map each username to a stable synthetic email under a reserved domain.
// (No real email is needed; password is the credential.)
export const USERNAME_EMAIL_DOMAIN = "biblestudy.app";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  return email.replace(new RegExp(`@${USERNAME_EMAIL_DOMAIN}$`, "i"), "");
}

export function isUsernameEmail(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${USERNAME_EMAIL_DOMAIN}`);
}
