import Link from "next/link";
import { listMarkets, getFilterOptions, type MarketFilters } from "@/lib/queries";
import { fmtCompact, fmtUsd, tierBadgeClass } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filters: MarketFilters = {
    q: first(sp.q),
    continent: first(sp.continent),
    tier: first(sp.tier),
    income: first(sp.income),
    owner: first(sp.owner),
  };
  const markets = listMarkets(filters);
  const options = getFilterOptions();
  const scored = markets.filter((m) => m.weighted_score !== null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Markets</h1>
          <p className="text-sm text-slate-500 mt-1">
            {markets.length} of 195 markets shown · {scored} scored ·{" "}
            {markets.length - scored} awaiting the three manual scores (Phase 2)
          </p>
        </div>
      </div>

      <form method="GET" className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-2 items-center text-sm">
        <input
          type="text"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search country, sub-region, trade bloc…"
          className="border border-slate-300 rounded px-2 py-1.5 w-64"
        />
        <select name="continent" defaultValue={filters.continent ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All continents</option>
          {options.continents.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="tier" defaultValue={filters.tier ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All tiers</option>
          {options.tiers.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="income" defaultValue={filters.income ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All income tiers</option>
          {options.incomes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="owner" defaultValue={filters.owner ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All owners</option>
          {options.owners.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1.5">Filter</button>
        <Link href="/markets" className="text-slate-500 underline">Clear</Link>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="py-2 px-3 font-medium">Country</th>
              <th className="py-2 px-3 font-medium">Continent</th>
              <th className="py-2 px-3 font-medium">Sub-region</th>
              <th className="py-2 px-3 font-medium text-right">Population</th>
              <th className="py-2 px-3 font-medium text-right">GDP</th>
              <th className="py-2 px-3 font-medium">Income tier</th>
              <th className="py-2 px-3 font-medium">Diaspora priority</th>
              <th className="py-2 px-3 font-medium">Trade bloc</th>
              <th className="py-2 px-3 font-medium">Owner</th>
              <th className="py-2 px-3 font-medium text-right">Score</th>
              <th className="py-2 px-3 font-medium">Priority tier</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="py-1.5 px-3">
                  <Link href={`/markets/${m.id}`} className="font-medium text-slate-900 hover:underline">
                    {m.country}
                  </Link>
                </td>
                <td className="py-1.5 px-3">{m.continent}</td>
                <td className="py-1.5 px-3">{m.sub_region}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{fmtCompact(m.population)}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">{fmtUsd(m.gdp_nominal_usd)}</td>
                <td className="py-1.5 px-3">{m.income_tier ?? "—"}</td>
                <td className="py-1.5 px-3">{m.diaspora_priority ?? "—"}</td>
                <td className="py-1.5 px-3">{m.trade_bloc ?? "—"}</td>
                <td className="py-1.5 px-3">{m.assigned_owner ?? "—"}</td>
                <td className="py-1.5 px-3 text-right tabular-nums">
                  {m.weighted_score !== null ? m.weighted_score.toFixed(2) : "—"}
                </td>
                <td className="py-1.5 px-3">
                  <span className={`inline-block text-xs border rounded-full px-2 py-0.5 ${tierBadgeClass(m.priority_tier)}`}>
                    {m.priority_tier}
                  </span>
                </td>
              </tr>
            ))}
            {markets.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-400">
                  No markets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Population and GDP are rounded planning estimates. Diaspora priority is a country-level
        market-prioritisation input only — it is never used to target individuals. Click a country
        for full detail and field-level provenance.
      </p>
    </div>
  );
}
