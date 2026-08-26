import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarket, getMarketProvenance, getScorerNames } from "@/lib/queries";
import { loadScoringConfig, explainScore } from "@/lib/scoring";
import { saveMarketScores } from "@/lib/actions";
import { fmtNumber, fmtUsd, orUnknown, tierBadgeClass, UNKNOWN_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

function Field({ label, value, unknown }: { label: string; value: string; unknown?: boolean }) {
  const isUnknown = unknown ?? value === UNKNOWN_LABEL;
  return (
    <div className="py-1.5 border-b border-slate-100 last:border-0 flex justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${isUnknown ? "italic text-amber-600" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

export default async function MarketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const market = getMarket(Number(id));
  if (!market) notFound();
  const provenance = getMarketProvenance(market.id);
  const cfg = loadScoringConfig();
  const explanation = explainScore(market, cfg);
  const scorers = getScorerNames();
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/markets" className="text-sm text-slate-500 hover:underline">← All markets</Link>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-2xl font-semibold">{market.country}</h1>
          <span className={`text-xs border rounded-full px-2 py-0.5 ${tierBadgeClass(market.priority_tier)}`}>
            {market.priority_tier}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {market.continent} · {market.sub_region} · Assigned to {market.assigned_owner ?? "—"}
        </p>
        <p className="text-xs text-amber-700 mt-1">{market.confidence}</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Market size &amp; economy</h2>
          <Field label="Population (2025 est.)" value={fmtNumber(market.population)} />
          <Field label="Population band" value={market.population_band ?? "—"} />
          <Field label="GDP nominal (2024)" value={fmtUsd(market.gdp_nominal_usd)} />
          <Field label="GDP per capita" value={market.gdp_per_capita_usd !== null ? `$${fmtNumber(market.gdp_per_capita_usd)}` : "—"} />
          <Field label="Income tier" value={market.income_tier ?? "—"} />
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Trade &amp; access</h2>
          <Field label="Landlocked" value={market.landlocked ?? "—"} />
          <Field label="ECOWAS status" value={market.ecowas_status ?? "—"} />
          <Field label="AfCFTA" value={market.afcfta_status ?? "—"} />
          <Field label="Trade bloc / market access" value={market.trade_bloc ?? "—"} />
          <Field label="Business language" value={market.business_language ?? "—"} />
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Diaspora (country-level input only)</h2>
          <Field label="African diaspora" value={market.diaspora_flag ?? "—"} />
          <Field label="Est. African-descent population" value={market.est_african_descent_population_text ?? "—"} />
          <Field label="Diaspora profile" value={market.diaspora_profile ?? "—"} />
          <Field label="Diaspora priority" value={market.diaspora_priority ?? "—"} />
          <p className="text-xs text-slate-400 mt-2">
            Used only to prioritise countries. Never used as a personal targeting attribute.
          </p>
        </section>

        <section className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <h2 className="font-semibold mb-2">Research inputs (to be filled from real sources)</h2>
          <Field label="Existing buyer? (Y/N)" value={orUnknown(market.existing_buyer)} />
          <Field label="Import duty % (HS 3923/3924)" value={orUnknown(market.import_duty_pct_text)} />
          <Field label="Est. annual import value (USD)" value={market.est_annual_import_value_usd !== null ? fmtUsd(market.est_annual_import_value_usd) : UNKNOWN_LABEL} />
          <Field label="Local competition (H/M/L)" value={orUnknown(market.local_competition)} />
          <Field label="Distributor status" value={orUnknown(market.distributor_status)} />
          <p className="text-xs text-amber-700 mt-2">
            The workbook deliberately leaves these blank — populate from trade data and national
            tariff schedules, not estimates.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Scoring</h2>
          <Field label="Market size (1-5)" value={market.market_size_score !== null ? String(market.market_size_score) : UNKNOWN_LABEL} />
          <Field label="Access ease (1-5)" value={market.access_ease_score !== null ? String(market.access_ease_score) : UNKNOWN_LABEL} />
          <Field label="Diaspora fit (1-5, auto)" value={market.diaspora_fit_score !== null ? String(market.diaspora_fit_score) : "—"} />
          <Field label="Competition (1-5)" value={market.competition_score !== null ? String(market.competition_score) : UNKNOWN_LABEL} />
          <Field label="Weighted score" value={market.weighted_score !== null ? market.weighted_score.toFixed(2) : "Not scored"} unknown={market.weighted_score === null} />
          {market.scored_by && market.scored_at && (
            <Field label="Scored by" value={`${market.scored_by} · ${market.scored_at.slice(0, 10)}`} />
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Notes</h2>
          <p className="text-sm text-slate-700">{market.notes ?? <span className="text-slate-400">No notes in the source workbook.</span>}</p>
          <div className="mt-3">
            <Field label="Source row (S. No.)" value={market.source_row_ref ?? "—"} />
            <Field label="Last reviewed" value={market.last_reviewed_at ?? "Never — imported only"} unknown={market.last_reviewed_at === null} />
          </div>
        </section>
      </div>

      <section id="score" className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Why this score?</h2>
          <div className="space-y-2 text-sm text-slate-700">
            {explanation.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-1">Enter scores</h2>
          <p className="text-xs text-slate-400 mb-3">
            Whole numbers 1 (worst) to 5 (best), based on real research — see the scale definitions on
            the <Link href="/scoring" className="underline">Scoring workspace</Link>. Leave a box blank
            to clear that score. Every entry is recorded with your name and the date.
          </p>
          {saved && (
            <p className="mb-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-3 py-2">{saved}</p>
          )}
          {error && (
            <p className="mb-3 text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>
          )}
          <form action={saveMarketScores} className="space-y-3 text-sm">
            <input type="hidden" name="market_id" value={market.id} />
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["market_size_score", "Market Size", market.market_size_score],
                  ["access_ease_score", "Access Ease", market.access_ease_score],
                  ["competition_score", "Competition", market.competition_score],
                ] as const
              ).map(([name, label, current]) => (
                <label key={name} className="block">
                  <span className="text-slate-600">{label}</span>
                  <select
                    name={name}
                    defaultValue={current !== null ? String(current) : ""}
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                  >
                    <option value="">— not scored —</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-600">Your name (required)</span>
                <input
                  name="scored_by"
                  list="scorer-names"
                  defaultValue={market.scored_by ?? ""}
                  maxLength={60}
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                  placeholder="Who is entering these scores?"
                />
                <datalist id="scorer-names">
                  {scorers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="text-slate-600">Note / source (optional)</span>
                <input
                  name="note"
                  maxLength={500}
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                  placeholder="e.g. GlobalWits import data, tariff schedule"
                />
              </label>
            </div>
            <p className="text-xs text-slate-400">
              Diaspora Fit is set automatically from Diaspora Priority and is not entered here. The
              weighted score only appears once all three scores are filled in.
            </p>
            <button type="submit" className="bg-slate-900 text-white rounded px-4 py-2">
              Save scores
            </button>
          </form>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-1">Provenance — where every value came from</h2>
        <p className="text-xs text-slate-400 mb-3">
          One row per fact: the original workbook value, the normalised value stored here, the exact
          cell it came from, how it was obtained, and its confidence level.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="py-1.5 px-2 font-medium">Field</th>
                <th className="py-1.5 px-2 font-medium">Original value</th>
                <th className="py-1.5 px-2 font-medium">Normalised value</th>
                <th className="py-1.5 px-2 font-medium">Source</th>
                <th className="py-1.5 px-2 font-medium">Cell</th>
                <th className="py-1.5 px-2 font-medium">Method</th>
                <th className="py-1.5 px-2 font-medium">Confidence</th>
                <th className="py-1.5 px-2 font-medium">Imported</th>
              </tr>
            </thead>
            <tbody>
              {provenance.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="py-1.5 px-2 font-mono">{p.field_name}</td>
                  <td className="py-1.5 px-2 max-w-[220px] break-words">{p.original_value}</td>
                  <td className="py-1.5 px-2 max-w-[220px] break-words">{p.normalised_value ?? "—"}</td>
                  <td className="py-1.5 px-2">{p.source_file} › {p.worksheet}</td>
                  <td className="py-1.5 px-2 font-mono">{p.source_ref}</td>
                  <td className="py-1.5 px-2">{p.method}</td>
                  <td className="py-1.5 px-2 max-w-[200px] break-words text-slate-500">{p.confidence}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{p.imported_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
