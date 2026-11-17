/**
 * Username-only accounts.
 *
 * Supabase Auth still needs an email address, so a username is mapped to
 * a synthetic address `<username>@<SYNTH_DOMAIN>` (domain của app). That
 * address is never a real mailbox, so no confirmation email can ever arrive
 * for it — the Supabase "Confirm email" setting must be OFF for these
 * accounts to sign in (see the setup notes). Existing email accounts keep
 * working: anything containing "@" is passed through unchanged, and the
 * admin username maps to the admin's real Gmail so the admin keeps the SAME
 * account and data instead of getting a second, synthetic one.
 */
import { ADMIN_EMAIL, ADMIN_USERNAME, SYNTH_DOMAIN } from "./admin";

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;

export const USERNAME_RULES_VI =
  "Tài khoản phải có 3–20 ký tự, chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang, không có khoảng trắng.";

/** Lowercase + trim. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Returns a Vietnamese error message, or null when the username is valid. */
export function validateUsername(input: string): string | null {
  const u = normalizeUsername(input);
  if (!u) return "Vui lòng nhập tài khoản.";
  if (u.includes("@"))
    return "Tài khoản không được chứa ký tự @. Hãy nhập tên tài khoản hoặc email.";
  if (!USERNAME_PATTERN.test(u)) return USERNAME_RULES_VI;
  return null;
}

/**
 * Maps what the user typed (username or email) to the email Supabase Auth
 * actually uses. Email input passes through unchanged.
 */
export function usernameToAuthEmail(input: string): string {
  const value = input.trim().toLowerCase();
  if (value.includes("@")) return value;
  const username = normalizeUsername(value);
  if (username === ADMIN_USERNAME) return ADMIN_EMAIL;
  return `${username}@${SYNTH_DOMAIN}`;
}

/** True when the address is a synthetic username address, not a real email. */
export function isSyntheticAuthEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${SYNTH_DOMAIN}`);
}

/**
 * Display name for an account: the username for synthetic accounts,
 * otherwise the part before "@" (display only — never used to log in).
 */
export function authEmailToUsername(email: string | null | undefined): string {
  if (!email) return "";
  const lower = email.toLowerCase();
  if (lower.endsWith(`@${SYNTH_DOMAIN}`)) return lower.slice(0, -`@${SYNTH_DOMAIN}`.length);
  const at = lower.indexOf("@");
  return at > 0 ? lower.slice(0, at) : lower;
}
