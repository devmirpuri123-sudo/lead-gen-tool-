import Link from "next/link";
import { listLeads, leadStatusCounts, listLeadOwners } from "@/lib/crmQueries";
import { scoreLead, scoringInputFromLead, icpTierBadgeClass } from "@/lib/leadScoring";
import { LEAD_STATUSES, STATUS_STAGES, statusBadgeClass } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filters = { q: first(sp.q), status: first(sp.status), owner: first(sp.owner) };
  const leads = listLeads(filters);
  const counts = leadStatusCounts();
  const owners = listLeadOwners();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-slate-500 mt-1">
          {total} leads in the pipeline. Leads are created from a company's page — nothing is invented.
        </p>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-[900px]">
          {STATUS_STAGES.map((g) => (
            <div key={g.stage} className="flex-1">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">{g.stage}</p>
              <div className="space-y-1">
                {g.statuses.map((s) => (
                  <Link
                    key={s}
                    href={`/leads?status=${encodeURIComponent(s)}`}
                    className={`flex justify-between items-center text-xs border rounded px-2 py-1 ${statusBadgeClass(s)} hover:opacity-80`}
                  >
                    <span>{s}</span>
                    <span className="tabular-nums font-semibold">{counts[s] ?? 0}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <form method="GET" className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-2 items-center text-sm">
        <input type="text" name="q" defaultValue={filters.q ?? ""} placeholder="Search company, country, contact…" className="border border-slate-300 rounded px-2 py-1.5 w-64" />
        <select name="status" defaultValue={filters.status ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="owner" defaultValue={filters.owner ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1.5">Filter</button>
        <Link href="/leads" className="text-slate-500 underline">Clear</Link>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="py-2 px-3 font-medium">Lead</th>
              <th className="py-2 px-3 font-medium">Company</th>
              <th className="py-2 px-3 font-medium">Market</th>
              <th className="py-2 px-3 font-medium">Contact</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium text-right">Score</th>
              <th className="py-2 px-3 font-medium">Owner</th>
              <th className="py-2 px-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const s = scoreLead(scoringInputFromLead(l));
              return (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-1.5 px-3">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:underline">#{l.id}</Link>
                  </td>
                  <td className="py-1.5 px-3">{l.company_name ?? "—"}</td>
                  <td className="py-1.5 px-3">{l.market_country ?? <span className="italic text-amber-600">Unknown</span>}</td>
                  <td className="py-1.5 px-3">{l.contact_name ?? <span className="italic text-amber-600">Unknown</span>}</td>
                  <td className="py-1.5 px-3">
                    <span className={`inline-block text-xs border rounded-full px-2 py-0.5 ${statusBadgeClass(l.status)}`}>{l.status}</span>
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums">
                    <span className={`inline-block text-xs border rounded-full px-1.5 py-0.5 mr-1.5 ${icpTierBadgeClass(s.tier)}`}>{s.tier}</span>
                    {s.score}/100
                  </td>
                  <td className="py-1.5 px-3">{l.owner ?? "—"}</td>
                  <td className="py-1.5 px-3 text-xs text-slate-500">{l.updated_at.slice(0, 10)}</td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400">
                  No leads match. Create leads from a <Link href="/companies" className="underline">company page</Link> or the CSV import.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
