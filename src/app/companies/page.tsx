import Link from "next/link";
import { listCompanies } from "@/lib/crmQueries";
import { COMPANY_TYPES } from "@/lib/pipeline";
import { tierBadgeClass } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filters = { q: first(sp.q), type: first(sp.type), country: first(sp.country) };
  const companies = listCompanies(filters);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-slate-500 mt-1">
            Potential wholesalers, distributors, retailers and importers. {companies.length} on file.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/companies/import" className="border border-slate-300 rounded px-4 py-2 text-sm hover:bg-slate-100">
            Import CSV
          </Link>
          <Link href="/companies/new" className="bg-slate-900 text-white rounded px-4 py-2 text-sm">
            Add company
          </Link>
        </div>
      </div>

      <form method="GET" className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-2 items-center text-sm">
        <input type="text" name="q" defaultValue={filters.q ?? ""} placeholder="Search name or country…" className="border border-slate-300 rounded px-2 py-1.5 w-64" />
        <select name="type" defaultValue={filters.type ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All types</option>
          {COMPANY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1.5">Filter</button>
        <Link href="/companies" className="text-slate-500 underline">Clear</Link>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="py-2 px-3 font-medium">Company</th>
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium">Market</th>
              <th className="py-2 px-3 font-medium">Market tier</th>
              <th className="py-2 px-3 font-medium">Website</th>
              <th className="py-2 px-3 font-medium text-right">Contacts</th>
              <th className="py-2 px-3 font-medium text-right">Leads</th>
              <th className="py-2 px-3 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="py-1.5 px-3">
                  <Link href={`/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                </td>
                <td className="py-1.5 px-3">{c.company_type ?? <span className="italic text-amber-600">Unknown — requires research</span>}</td>
                <td className="py-1.5 px-3">{c.market_country ?? <span className="italic text-amber-600">Unknown</span>}</td>
                <td className="py-1.5 px-3">
                  {c.market_tier ? (
                    <span className={`inline-block text-xs border rounded-full px-2 py-0.5 ${tierBadgeClass(c.market_tier)}`}>{c.market_tier}</span>
                  ) : "—"}
                </td>
                <td className="py-1.5 px-3">{c.website ?? <span className="italic text-amber-600">Unknown</span>}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{c.contact_count}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{c.lead_count}</td>
                <td className="py-1.5 px-3 text-xs text-slate-500">{c.confidence.split(" — ")[0]}</td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400">
                  No companies yet. Add one manually or import a CSV — nothing is ever invented for you.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
