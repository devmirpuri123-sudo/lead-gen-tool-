import { getDb } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, requireAdmin } from "@/lib/auth";
import { addTeamMember, promoteMember, resetMemberPassword, setMemberAccess } from "@/lib/authActions";

export const dynamic = "force-dynamic";

type Member = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "member";
  is_active: number;
  must_change_password: number;
  created_at: string;
  created_by: string | null;
  last_login_at: string | null;
};

const input =
  "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;

  const members = getDb()
    .prepare(
      `SELECT id, email, name, role, is_active, must_change_password, created_at, created_by, last_login_at
         FROM users ORDER BY is_active DESC, name COLLATE NOCASE`
    )
    .all() as Member[];

  const activeAdmins = members.filter((m) => m.role === "admin" && m.is_active).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Team access</h1>
        <p className="text-sm text-slate-500 mt-1">
          Everyone listed here can read and edit every company, contact and lead in the engine. Those
          records include named individuals&apos; work email addresses, most of them in the EU, so add
          people deliberately and remove them the day they stop needing access.
        </p>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      {ok && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>
      )}

      <section className="rounded border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Add a team member</h2>
        <p className="text-xs text-slate-500 mt-1">
          You choose a starting password and pass it to them yourself — by a phone call or a message,
          not in the same email as the web address. They are forced to replace it the moment they sign in.
        </p>
        <form action={addTeamMember} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Full name</span>
            <input type="text" name="name" required maxLength={80} className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email address</span>
            <input type="email" name="email" required className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Starting password</span>
            <input
              type="text"
              name="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className={input}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Access level</span>
            <select name="role" defaultValue="member" className={input}>
              <option value="member">Team member — can use everything</option>
              <option value="admin">Administrator — can also manage this page</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Add team member
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border border-slate-200 bg-white">
        <h2 className="font-semibold text-slate-900 px-5 pt-5">
          People with access ({members.filter((m) => m.is_active).length} active)
        </h2>
        <div className="mt-3 divide-y divide-slate-200">
          {members.map((m) => {
            const lastAdmin = m.role === "admin" && m.is_active === 1 && activeAdmins <= 1;
            return (
              <div key={m.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium text-slate-900">{m.name}</span>
                  <span className="text-sm text-slate-500">{m.email}</span>
                  <span
                    className={
                      "rounded px-2 py-0.5 text-xs " +
                      (m.role === "admin" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700")
                    }
                  >
                    {m.role === "admin" ? "Administrator" : "Team member"}
                  </span>
                  {!m.is_active && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">No access</span>
                  )}
                  {m.must_change_password === 1 && m.is_active === 1 && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Has not set their own password yet
                    </span>
                  )}
                  {m.id === admin.id && <span className="text-xs text-slate-400">(you)</span>}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Added {m.created_at.slice(0, 10)}
                  {m.created_by ? ` by ${m.created_by}` : ""} ·{" "}
                  {m.last_login_at ? `last signed in ${m.last_login_at.slice(0, 10)}` : "never signed in"}
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <form action={resetMemberPassword} className="flex items-end gap-2">
                    <input type="hidden" name="user_id" value={m.id} />
                    <label className="block">
                      <span className="text-xs text-slate-600">Reset password to</span>
                      <input
                        type="text"
                        name="password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        className="mt-1 w-56 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  </form>

                  {m.id !== admin.id && (
                    <form action={promoteMember}>
                      <input type="hidden" name="user_id" value={m.id} />
                      <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                      <button
                        type="submit"
                        disabled={lastAdmin}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
                      >
                        {m.role === "admin" ? "Remove administrator access" : "Make administrator"}
                      </button>
                    </form>
                  )}

                  {m.id !== admin.id && (
                    <form action={setMemberAccess}>
                      <input type="hidden" name="user_id" value={m.id} />
                      <input type="hidden" name="action" value={m.is_active ? "deactivate" : "activate"} />
                      <button
                        type="submit"
                        disabled={Boolean(m.is_active) && lastAdmin}
                        className={
                          "rounded px-3 py-1.5 text-sm disabled:opacity-40 " +
                          (m.is_active
                            ? "border border-red-300 text-red-700 hover:bg-red-50"
                            : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50")
                        }
                      >
                        {m.is_active ? "Remove access" : "Restore access"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Removing access signs the person out of every browser immediately. Their name stays on the scores,
        notes and approvals they entered, so the record of who did what is never lost.
      </p>
    </div>
  );
}
