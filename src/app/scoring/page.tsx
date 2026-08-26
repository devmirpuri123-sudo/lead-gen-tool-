import Link from "next/link";
import { listMarkets, getFilterOptions, getScoringProgress, getNextUnscoredMarketId, type MarketFilters } from "@/lib/queries";
import { loadScoringConfig } from "@/lib/scoring";
import { tierBadgeClass } from "@/lib/format";

export const dynamic = "force-dynamic";

const SCALE_LABELS: [key: "market_size" | "access_ease" | "diaspora_fit" | "competition", label: string][] = [
  ["market_size", "Market Size"],
  ["access_ease", "Access Ease"],
  ["diaspora_fit", "Diaspora Fit"],
  ["competition", "Competition"],
];

export default async function ScoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const status = first(sp.status); // "scored" | "unscored" | undefined
  const filters: MarketFilters = { continent: first(sp.continent), owner: first(sp.owner), q: first(sp.q) };

  let markets = listMarkets(filters);
  if (status === "scored") markets = markets.filter((m) => m.weighted_score !== null);
  if (status === "unscored") markets = markets.filter((m) => m.weighted_score === null);

  const progress = getScoringProgress();
  const nextId = getNextUnscoredMarketId();
  const options = getFilterOptions();
  const cfg = loadScoringConfig();
  const pctDone = progress.total ? Math.round((progress.scored / progress.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Scoring workspace</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter Market Size, Access Ease and Competition (1–5) per market. A weighted score only
            appears once all three are filled in — partial input stays "Not scored".
          </p>
        </div>
        {nextId !== null && (
          <Link
            href={`/markets/${nextId}#score`}
            className="bg-emerald-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-emerald-700"
          >
            Score the next market →
          </Link>
        )}
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            <strong>{progress.scored}</strong> of <strong>{progress.total}</strong> markets scored
            {progress.partial > 0 && (
              <span className="text-amber-700"> · {progress.partial} partially entered (still "Not scored")</span>
            )}
          </span>
          <span className="text-slate-500">{pctDone}% complete</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pctDone}%` }} />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Suggested order: High diaspora-priority markets first, then largest populations. The "Score
          the next market" button follows that order. Weights and cut-offs are on the{" "}
          <Link href="/settings/scoring" className="underline">Scoring configuration</Link> page.
        </p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-2">How to score (from the workbook's Scoring Guide)</h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {SCALE_LABELS.map(([key, label]) => (
            <div key={key}>
              <dt className="font-medium text-slate-700">{label}</dt>
              <dd className="text-slate-500">
                {cfg.scales[key] ?? "Scale definition not found in the imported workbook."}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <form method="GET" className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-2 items-center text-sm">
        <input
          type="text"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search country…"
          className="border border-slate-300 rounded px-2 py-1.5 w-56"
        />
        <select name="status" defaultValue={status ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All markets</option>
          <option value="unscored">Unscored only</option>
          <option value="scored">Scored only</option>
        </select>
        <select name="continent" defaultValue={filters.continent ?? ""} className="border border-slate-300 rounded px-2 py-1.5">
          <option value="">All continents</option>
          {options.continents.map((c) => (
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
        <Link href="/scoring" className="text-slate-500 underline">Clear</Link>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="py-2 px-3 font-medium">Country</th>
              <th className="py-2 px-3 font-medium">Continent</th>
              <th className="py-2 px-3 font-medium">Owner</th>
              <th className="py-2 px-3 font-medium">Diaspora priority</th>
              <th className="py-2 px-3 font-medium text-center">Market size</th>
              <th className="py-2 px-3 font-medium text-center">Access ease</th>
              <th className="py-2 px-3 font-medium text-center">Diaspora fit</th>
              <th className="py-2 px-3 font-medium text-center">Competition</th>
              <th className="py-2 px-3 font-medium text-right">Weighted</th>
              <th className="py-2 px-3 font-medium">Tier</th>
              <th className="py-2 px-3 font-medium">Scored by</th>
              <th className="py-2 px-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => {
              const cell = (v: number | null) =>
                v !== null ? (
                  <span className="tabular-nums">{v}</span>
                ) : (
                  <span className="text-amber-500" title="Unknown — requires research">·</span>
                );
              return (
                <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-1.5 px-3 font-medium">{m.country}</td>
                  <td className="py-1.5 px-3">{m.continent}</td>
                  <td className="py-1.5 px-3">{m.assigned_owner ?? "—"}</td>
                  <td className="py-1.5 px-3">{m.diaspora_priority ?? "—"}</td>
                  <td className="py-1.5 px-3 text-center">{cell(m.market_size_score)}</td>
                  <td className="py-1.5 px-3 text-center">{cell(m.access_ease_score)}</td>
                  <td className="py-1.5 px-3 text-center">{cell(m.diaspora_fit_score)}</td>
                  <td className="py-1.5 px-3 text-center">{cell(m.competition_score)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">
                    {m.weighted_score !== null ? m.weighted_score.toFixed(2) : "—"}
                  </td>
                  <td className="py-1.5 px-3">
                    <span className={`inline-block text-xs border rounded-full px-2 py-0.5 ${tierBadgeClass(m.priority_tier)}`}>
                      {m.priority_tier}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-xs text-slate-500">
                    {m.scored_by ? `${m.scored_by} · ${m.scored_at?.slice(0, 10)}` : "—"}
                  </td>
                  <td className="py-1.5 px-3">
                    <Link href={`/markets/${m.id}#score`} className="text-emerald-700 hover:underline whitespace-nowrap">
                      {m.weighted_score !== null ? "Edit" : "Score"} →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {markets.length === 0 && (
              <tr>
                <td colSpan={12} className="py-8 text-center text-slate-400">No markets match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
