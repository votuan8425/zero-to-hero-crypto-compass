/**
 * Admin identity for ZERO TO HERO.
 *
 * Only one admin account exists: the owner, identified by the Gmail
 * yuntuan1309@gmail.com (username "yuntuan1309"). Admin-only features
 * (writing the Tham khảo allocation) check this, never a role stored
 * in user-editable data.
 */
export const ADMIN_EMAIL = "yuntuan1309@gmail.com";
export const ADMIN_USERNAME = "yuntuan1309";

/** Synthetic email domain for username-only accounts (never a real mailbox). */
export const SYNTH_DOMAIN = "zth.local";

export type AuthUserLike =
  | {
      email?: string | null;
      user_metadata?: Record<string, unknown> | null;
    }
  | null
  | undefined;

/** True when the signed-in user is the admin, by email or by stored username. */
export function isAdminUser(user: AuthUserLike): boolean {
  if (!user) return false;
  if (typeof user.email === "string" && user.email.toLowerCase() === ADMIN_EMAIL) return true;
  const meta = user.user_metadata;
  if (meta && typeof meta["username"] === "string") {
    return (meta["username"] as string).toLowerCase() === ADMIN_USERNAME;
  }
  return false;
}
