import Link from "next/link";
import { listMarkets, getScorerNames } from "@/lib/queries";
import { suggestScores } from "@/lib/scoreSuggestions";
import { acceptSuggestedScoresBulk } from "@/lib/actions";
import { tierBadgeClass } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BulkSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const continent = typeof sp.continent === "string" ? sp.continent : "";
  const onlyUnscored = sp.unscored !== "0";
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const people = getScorerNames();

  const all = listMarkets(continent ? { continent } : {});
  const continents = Array.from(
    new Set(listMarkets({}).map((m) => m.continent).filter((c): c is string => !!c))
  ).sort();

  const rows = all
    .map((m) => ({ market: m, ...suggestScores(m) }))
    .filter((r) => (onlyUnscored ? r.market.priority_tier === "Not scored" : true));
  const ready = rows.filter((r) => r.complete);
  const blocked = rows.filter((r) => !r.complete);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/scoring" className="text-sm text-slate-500 hover:underline">← Scoring workspace</Link>
        <h1 className="text-2xl font-semibold mt-1">Score many markets at once</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every market whose scores can be worked out from the facts on file. Review the numbers,
          untick anything you disagree with, put your name to it once, and the whole batch is scored.
          Each score stays editable on its own market page afterwards.
        </p>
      </div>

      {saved && <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-3 py-2">{saved}</p>}
      {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>}

      <form method="get" className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-3 items-end text-sm">
        <label className="block">
          <span className="text-slate-600 text-xs">Continent</span>
          <select name="continent" defaultValue={continent} className="mt-1 border border-slate-300 rounded px-2 py-1.5">
            <option value="">All continents</option>
            {continents.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="unscored" value="1" defaultChecked={onlyUnscored} />
          <span>Only markets that are not scored yet</span>
        </label>
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1.5">Apply filter</button>
      </form>

      <form action={acceptSuggestedScoresBulk} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            Ready to score: {ready.length} market{ready.length === 1 ? "" : "s"}
          </h2>
          <p className="text-xs text-slate-400">
            Order: Market Size / Access Ease / Competition
          </p>
        </div>

        {ready.length === 0 ? (
          <p className="text-sm text-slate-500">
            No markets in this filter have all three criteria available. The list below shows what each
            one still needs.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                    <th className="py-1.5 px-2 font-medium w-8"></th>
                    <th className="py-1.5 px-2 font-medium">Country</th>
                    <th className="py-1.5 px-2 font-medium">Suggested</th>
                    <th className="py-1.5 px-2 font-medium">Current tier</th>
                    <th className="py-1.5 px-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {ready.map(({ market, suggestions }) => (
                    <tr key={market.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="py-1.5 px-2">
                        <input type="checkbox" name="market_ids" value={market.id} defaultChecked />
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        <Link href={`/markets/${market.id}#score`} className="hover:underline">
                          {market.country}
                        </Link>
                      </td>
                      <td className="py-1.5 px-2 font-mono whitespace-nowrap">
                        {suggestions.map((s) => s.score).join(" / ")}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        <span className={`text-xs border rounded px-1.5 py-0.5 ${tierBadgeClass(market.priority_tier)}`}>
                          {market.priority_tier}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-xs text-slate-500">
                        {suggestions.map((s) => `${s.label}: ${s.basis}`).join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm pt-1">
              <label className="block">
                <span className="text-slate-600 text-xs">Your name (required)</span>
                <input
                  name="accepted_by"
                  list="bulk-scorers"
                  maxLength={60}
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                  placeholder="Who is accepting these scores?"
                />
                <datalist id="bulk-scorers">
                  {people.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="text-slate-600 text-xs">Note (optional)</span>
                <input
                  name="note"
                  maxLength={500}
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                  placeholder="e.g. first pass from trade data, Sept 2026"
                />
              </label>
            </div>
            <button type="submit" className="bg-sky-700 text-white rounded px-4 py-2 hover:bg-sky-800">
              Accept scores for the ticked markets
            </button>
            <p className="text-xs text-slate-400">
              Recorded in each market's provenance as a calculated score accepted by you, with the
              reasoning that produced it.
            </p>
          </>
        )}
      </form>

      {blocked.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-1">
            Needs research first: {blocked.length} market{blocked.length === 1 ? "" : "s"}
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            These cannot be suggested yet. Rather than guess, the system names exactly what is missing.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="py-1.5 px-2 font-medium">Country</th>
                  <th className="py-1.5 px-2 font-medium">Suggested so far</th>
                  <th className="py-1.5 px-2 font-medium">Still needed</th>
                </tr>
              </thead>
              <tbody>
                {blocked.map(({ market, suggestions }) => (
                  <tr key={market.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <Link href={`/markets/${market.id}#score`} className="hover:underline">
                        {market.country}
                      </Link>
                    </td>
                    <td className="py-1.5 px-2 font-mono whitespace-nowrap">
                      {suggestions.map((s) => s.score ?? "—").join(" / ")}
                    </td>
                    <td className="py-1.5 px-2 text-xs text-amber-700">
                      {suggestions.filter((s) => s.missing).map((s) => s.missing).join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
