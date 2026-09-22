import Link from "next/link";
import { getConfigChangeLog, getScoringProgress } from "@/lib/queries";
import { loadScoringConfig } from "@/lib/scoring";
import { updateScoringConfig } from "@/lib/actions";

export const dynamic = "force-dynamic";

const CONFIG_LABELS: Record<string, string> = {
  weight_market_size: "Market Size weight",
  weight_access_ease: "Access Ease weight",
  weight_diaspora_fit: "Diaspora Fit weight",
  weight_competition: "Competition weight",
  tier1_cutoff: "Tier 1 cut-off",
  tier2_cutoff: "Tier 2 cut-off",
  tier3_cutoff: "Tier 3 cut-off",
};

export default async function ScoringConfigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const cfg = loadScoringConfig();
  const progress = getScoringProgress();
  const log = getConfigChangeLog();
  const pct = (w: number) => Math.round(w * 1000) / 10;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Scoring configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          The weights and tier cut-offs behind every market score. Originally imported from the
          workbook's Scoring Guide sheet. Saving a change recalculates all {progress.total} markets
          immediately and records who changed what, when.
        </p>
      </div>

      {saved && (
        <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-3 py-2">{saved}</p>
      )}
      {error && (
        <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>
      )}

      <form action={updateScoringConfig} className="space-y-5">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-1">Weights</h2>
          <p className="text-xs text-slate-400 mb-3">
            How much each criterion counts. The four weights must total exactly 100%.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {(
              [
                ["weight_market_size", "Market Size", cfg.weights.market_size],
                ["weight_access_ease", "Access Ease", cfg.weights.access_ease],
                ["weight_diaspora_fit", "Diaspora Fit", cfg.weights.diaspora_fit],
                ["weight_competition", "Competition", cfg.weights.competition],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name} className="block">
                <span className="text-slate-600">{label}</span>
                <span className="mt-1 flex items-center gap-1">
                  <input
                    name={name}
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={pct(value)}
                    required
                    className="w-full border border-slate-300 rounded px-2 py-1.5"
                  />
                  <span className="text-slate-400">%</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-1">Tier cut-offs</h2>
          <p className="text-xs text-slate-400 mb-3">
            A market's weighted score (0–5) is compared against these, highest first. Below the Tier 3
            cut-off a market becomes "{cfg.tier4Label}". Markets missing any of the three manual
            scores are always "Not scored" regardless of cut-offs.
          </p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {(
              [
                ["tier1_cutoff", "Tier 1 - Priority ≥", cfg.cutoffs.tier1],
                ["tier2_cutoff", "Tier 2 - Develop ≥", cfg.cutoffs.tier2],
                ["tier3_cutoff", "Tier 3 - Monitor ≥", cfg.cutoffs.tier3],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name} className="block">
                <span className="text-slate-600">{label}</span>
                <input
                  name={name}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="5"
                  defaultValue={value}
                  required
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm grow max-w-xs">
            <span className="text-slate-600">Your name (required)</span>
            <input
              name="changed_by"
              maxLength={60}
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              placeholder="Who is changing the model?"
            />
          </label>
          <button type="submit" className="bg-slate-900 text-white rounded px-4 py-2 text-sm">
            Save and recalculate all markets
          </button>
        </section>
      </form>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-1">Change history</h2>
        {log.length === 0 ? (
          <p className="text-sm text-slate-400">
            No manual changes yet — the model still matches the imported workbook (Market Size 30%,
            Access Ease 25%, Diaspora Fit 20%, Competition 25%; cut-offs 4.00 / 3.00 / 2.00).
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1.5 pr-2 font-medium">Setting</th>
                <th className="py-1.5 pr-2 font-medium">From</th>
                <th className="py-1.5 pr-2 font-medium">To</th>
                <th className="py-1.5 pr-2 font-medium">Who / when</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-2">{CONFIG_LABELS[r.field_name ?? ""] ?? r.field_name}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.original_value ?? "—"}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.normalised_value ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-slate-500">
                    {r.notes} · {r.imported_at?.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-400 mt-2">
          The Diaspora Fit auto-mapping (High=5, Home=4, Medium=3, Low=1) is fixed in this phase.{" "}
          <Link href="/scoring" className="underline">Back to the Scoring workspace</Link>.
        </p>
      </section>
    </div>
  );
}
