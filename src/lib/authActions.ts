"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  SESSION_COOKIE,
  authenticate,
  createSession,
  destroyAllSessionsFor,
  destroySession,
  hashPassword,
  looksLikeEmail,
  needsFirstAdmin,
  normaliseEmail,
  passwordProblem,
  requireAdmin,
  setupTokenMatches,
  setupTokenRequired,
  requireUser,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function done(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(message)}`);
}

async function startSession(userId: number) {
  const token = createSession(userId, (await headers()).get("user-agent"));
  (await cookies()).set(SESSION_COOKIE, token, await sessionCookieOptions());
}

export async function signIn(formData: FormData) {
  const email = normaliseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) fail("/login", "Please enter both your email and your password.");

  const result = authenticate(email, password);
  if (!result.ok) fail("/login", result.message);

  await startSession(result.userId);
  redirect("/");
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

/** One-time: creates the first administrator. Refuses once any account exists. */
export async function completeSetup(formData: FormData) {
  if (!needsFirstAdmin()) fail("/login", "Setup has already been completed. Please sign in.");

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = normaliseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!name) fail("/setup", "Please enter your full name — it is recorded against every score and note you enter.");
  if (!looksLikeEmail(email)) fail("/setup", "Please enter a valid email address.");
  if (setupTokenRequired() && !setupTokenMatches(String(formData.get("setup_token") ?? ""))) {
    fail("/setup", "That setup code is not correct. It is the SETUP_TOKEN value from the hosting settings.");
  }
  if (password !== confirm) fail("/setup", "The two passwords do not match.");
  const problem = passwordProblem(password, email);
  if (problem) fail("/setup", problem);

  const info = getDb()
    .prepare(
      `INSERT INTO users (email, name, password_hash, role, is_active, created_by)
       VALUES (?, ?, ?, 'admin', 1, 'first-run setup')`
    )
    .run(email, name, hashPassword(password));

  await startSession(Number(info.lastInsertRowid));
  redirect("/");
}

export async function addTeamMember(formData: FormData) {
  const admin = await requireAdmin();
  const back = "/settings/team";

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = normaliseEmail(formData.get("email"));
  const role = formData.get("role") === "admin" ? "admin" : "member";
  const password = String(formData.get("password") ?? "");

  if (!name) fail(back, "Please enter the person's full name.");
  if (!looksLikeEmail(email)) fail(back, "Please enter a valid email address.");
  const problem = passwordProblem(password, email);
  if (problem) fail(back, problem);

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) fail(back, `${email} already has an account.`);

  db.prepare(
    `INSERT INTO users (email, name, password_hash, role, is_active, must_change_password, created_by)
     VALUES (?, ?, ?, ?, 1, 1, ?)`
  ).run(email, name, hashPassword(password), role, admin.email);

  revalidatePath(back);
  done(back, `${name} can now sign in. Send them the starting password by a separate channel — they will be asked to change it immediately.`);
}

export async function setMemberAccess(formData: FormData) {
  const admin = await requireAdmin();
  const back = "/settings/team";
  const id = Number(formData.get("user_id"));
  const activate = formData.get("action") === "activate";

  if (!Number.isInteger(id)) fail(back, "That team member could not be found.");
  if (id === admin.id) fail(back, "You cannot deactivate your own account. Ask another administrator to do it.");

  const db = getDb();
  const target = db.prepare(`SELECT id, name, role, is_active FROM users WHERE id = ?`).get(id) as
    | { id: number; name: string; role: string; is_active: number }
    | undefined;
  if (!target) fail(back, "That team member could not be found.");

  if (!activate) {
    const admins = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1`).get() as { n: number };
    if (target.role === "admin" && admins.n <= 1) {
      fail(back, "That is the only active administrator. Promote someone else first, or you will lock everyone out.");
    }
  }

  db.prepare(`UPDATE users SET is_active = ? WHERE id = ?`).run(activate ? 1 : 0, id);
  if (!activate) destroyAllSessionsFor(id); // ends any browser they are already signed in on

  revalidatePath(back);
  done(back, activate ? `${target.name} can sign in again.` : `${target.name} has been signed out and can no longer sign in.`);
}

export async function resetMemberPassword(formData: FormData) {
  await requireAdmin();
  const back = "/settings/team";
  const id = Number(formData.get("user_id"));
  const password = String(formData.get("password") ?? "");

  const db = getDb();
  const target = db.prepare(`SELECT id, name, email FROM users WHERE id = ?`).get(id) as
    | { id: number; name: string; email: string }
    | undefined;
  if (!target) fail(back, "That team member could not be found.");

  const problem = passwordProblem(password, target.email);
  if (problem) fail(back, problem);

  db.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?`
  ).run(hashPassword(password), id);
  destroyAllSessionsFor(id);

  revalidatePath(back);
  done(back, `${target.name}'s password has been reset and they have been signed out. Send them the new password by a separate channel.`);
}

export async function changeOwnPassword(formData: FormData) {
  const user = await requireUser();
  const back = "/account/password";

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const db = getDb();
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(user.id) as
    | { password_hash: string }
    | undefined;
  if (!row || !verifyPassword(current, row.password_hash)) fail(back, "Your current password is not correct.");
  if (next !== confirm) fail(back, "The two new passwords do not match.");
  if (next === current) fail(back, `Please choose a different password from your current one.`);
  const problem = passwordProblem(next, user.email);
  if (problem) fail(back, problem);

  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(
    hashPassword(next),
    user.id
  );

  // Every other browser is signed out, then this one is signed back in.
  destroyAllSessionsFor(user.id);
  await startSession(user.id);

  done("/", "Your password has been changed. Any other device you were signed in on has been signed out.");
}

export async function promoteMember(formData: FormData) {
  const admin = await requireAdmin();
  const back = "/settings/team";
  const id = Number(formData.get("user_id"));
  const role = formData.get("role") === "admin" ? "admin" : "member";

  const db = getDb();
  const target = db.prepare(`SELECT id, name, role FROM users WHERE id = ?`).get(id) as
    | { id: number; name: string; role: string }
    | undefined;
  if (!target) fail(back, "That team member could not be found.");
  if (id === admin.id && role !== "admin") {
    fail(back, "You cannot remove your own administrator access. Ask another administrator to do it.");
  }

  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
  revalidatePath(back);
  done(back, `${target.name} is now ${role === "admin" ? "an administrator" : "a standard team member"}.`);
}
