import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/lib/authActions";

/**
 * Everything inside this route group is behind the login. The check runs on the
 * server for every request, so there is no anonymous path to any page here.
 * Server actions and the export route carry their own checks as well — this
 * layout protects the pages, not the operations.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/account/password");

  return (
    <>
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
          <Link href="/" className="font-semibold tracking-wide">
            SACVIN <span className="text-emerald-400">Global Plastics</span> Lead Engine
          </Link>
          <nav className="flex gap-5 text-sm text-slate-300">
            <Link href="/" className="hover:text-white">Dashboard</Link>
            <Link href="/markets" className="hover:text-white">Markets</Link>
            <Link href="/scoring" className="hover:text-white">Scoring</Link>
            <Link href="/settings/scoring" className="hover:text-white">Configuration</Link>
            <Link href="/companies" className="hover:text-white">Companies</Link>
            <Link href="/leads" className="hover:text-white">Leads</Link>
            <Link href="/outreach" className="hover:text-white">Outreach</Link>
            <Link href="/reports" className="hover:text-white">Reports</Link>
            {user.role === "admin" && (
              <Link href="/settings/team" className="hover:text-white">Team</Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-300">
            <Link href="/account/password" className="hover:text-white" title={user.email}>
              {user.name}
              {user.role === "admin" && <span className="text-slate-500"> · admin</span>}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-400 border-t border-slate-200 mt-8">
        Internal tool — SACVIN Nigeria Limited &amp; Veeglow Engineering Solutions. Data is planning-grade:
        estimates and imported figures must be verified before external use. No messages are ever sent
        automatically; all outreach is human-reviewed and sent manually. Contact records hold named
        individuals&apos; work details — treat them as personal data and do not forward them outside the team.
      </footer>
    </>
  );
}
