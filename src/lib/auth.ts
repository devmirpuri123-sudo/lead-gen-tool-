/**
 * SACVIN GLOBAL PLASTICS LEAD ENGINE — access control.
 *
 * The engine holds named individuals' work contact details, most of them in the
 * EU. That is personal data, so the tool is gated: every page, every server
 * action and the export endpoint require a valid session belonging to an active
 * user. There is no anonymous read path.
 *
 * Passwords are stored as scrypt hashes and never in a form that can be read
 * back. Session cookies are random 256-bit tokens; the database stores only a
 * SHA-256 of the token, so a copy of the database does not hand anyone a live
 * session.
 */
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

export const SESSION_COOKIE = "sacvin_session";
export const MIN_PASSWORD_LENGTH = 12;

const SESSION_DAYS = 14;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export type Role = "admin" | "member";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};

// --- passwords ---------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  let actual: Buffer;
  try {
    actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Returns a human-readable reason the password is unacceptable, or null if it is fine. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters. A short phrase you will remember is fine.`;
  }
  if (password.length > 200) return "Password is too long (maximum 200 characters).";
  if (new Set(password).size < 5) return "Password is too repetitive. Use a longer phrase with more variety.";
  if (email && password.toLowerCase().trim() === email.toLowerCase().trim()) {
    return "Password must not be the same as the email address.";
  }
  return null;
}

export function normaliseEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// --- sessions ----------------------------------------------------------------

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Creates a session row and returns the raw token to put in the cookie. */
export function createSession(userId: number, userAgent?: string | null): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)`
  ).run(hashToken(token), userId, expiresAt, (userAgent ?? "").slice(0, 200) || null);
  db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
  return token;
}

export function destroySession(token: string): void {
  getDb().prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
}

/** Signs a user out everywhere — used when a password changes or access is revoked. */
export function destroyAllSessionsFor(userId: number): void {
  getDb().prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}

/**
 * The "secure" flag is decided by how the request actually arrived, not by
 * NODE_ENV. A hosted deployment is served over HTTPS and gets a secure-only
 * cookie; a production build run over plain HTTP on the office network does
 * not, because a browser silently discards a secure cookie on a plain-HTTP
 * address and the sign-in would appear to do nothing at all.
 */
export async function sessionCookieOptions() {
  const forwardedProto = (await headers()).get("x-forwarded-proto");
  const isHttps = (forwardedProto ?? "").split(",")[0].trim().toLowerCase() === "https";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}

// --- who is asking -----------------------------------------------------------

type SessionRow = {
  id: number;
  email: string;
  name: string;
  role: Role;
  is_active: number;
  must_change_password: number;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.is_active, u.must_change_password
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
    )
    .get(tokenHash) as SessionRow | undefined;

  if (!row || !row.is_active) return null;

  // Sliding expiry: an active user stays signed in, an idle one is timed out.
  // Only written once an hour so ordinary browsing is not a write per request.
  db.prepare(
    `UPDATE sessions
        SET last_seen_at = datetime('now'), expires_at = ?
      WHERE token_hash = ? AND last_seen_at < datetime('now', '-1 hour')`
  ).run(new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString(), tokenHash);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    mustChangePassword: row.must_change_password === 1,
  };
}

/** True before the very first account exists — the app then offers one-time setup. */
export function needsFirstAdmin(): boolean {
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number };
  return row.n === 0;
}

/**
 * Optional lock on the first-run setup page.
 *
 * Between a first deploy and the moment the first account is created, /setup is
 * open to whoever reaches the address. The window is short and the database is
 * empty, but the data that follows is named people's contact details, so a
 * SETUP_TOKEN environment variable can be set to close it. Unset, setup stays
 * open and the page says so plainly.
 */
export function setupTokenRequired(): boolean {
  return Boolean(process.env.SETUP_TOKEN?.trim());
}

export function setupTokenMatches(supplied: string): boolean {
  const expected = process.env.SETUP_TOKEN?.trim();
  if (!expected) return true;
  const a = Buffer.from(String(supplied ?? ""), "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The gate. Call at the top of every page, server action and route handler that
 * touches company, contact or lead data. Redirects instead of returning null so
 * a forgotten check cannot silently fall through to an anonymous read.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(needsFirstAdmin() ? "/setup" : "/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/?error=" + encodeURIComponent("That area is restricted to administrators."));
  }
  return user;
}

// --- signing in --------------------------------------------------------------

type UserRow = {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  is_active: number;
  failed_attempts: number;
  locked_until: string | null;
};

export type AuthResult = { ok: true; userId: number } | { ok: false; message: string };

// Deliberately identical for "no such account", "wrong password" and
// "deactivated", so the login form cannot be used to discover who has an account.
const GENERIC_FAILURE = "Email or password not recognised.";

export function authenticate(emailRaw: string, password: string): AuthResult {
  const db = getDb();
  const email = normaliseEmail(emailRaw);
  const user = db
    .prepare(
      `SELECT id, email, name, password_hash, role, is_active, failed_attempts, locked_until
         FROM users WHERE email = ?`
    )
    .get(email) as UserRow | undefined;

  if (!user) {
    // Spend comparable time so a missing account is not detectable by timing.
    verifyPassword(password, hashPassword("this-account-does-not-exist"));
    return { ok: false, message: GENERIC_FAILURE };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.max(1, Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60_000));
    return {
      ok: false,
      message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  if (!verifyPassword(password, user.password_hash)) {
    const attempts = user.failed_attempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
    db.prepare(`UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?`).run(
      lockedUntil ? 0 : attempts,
      lockedUntil,
      user.id
    );
    return { ok: false, message: GENERIC_FAILURE };
  }

  if (!user.is_active) return { ok: false, message: GENERIC_FAILURE };

  db.prepare(
    `UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?`
  ).run(user.id);
  return { ok: true, userId: user.id };
}
