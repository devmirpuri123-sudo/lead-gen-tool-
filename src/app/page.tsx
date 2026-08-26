import Link from "next/link";
import { getDashboardStats, getScoringConfig, getWorkbookNotes } from "@/lib/queries";
import { leadStatusCounts } from "@/lib/crmQueries";
import { activitySummary, overdueReminderCount, marketTierCounts } from "@/lib/reportQueries";
import { STATUS_STAGES, statusBadgeClass } from "@/lib/pipeline";
import { fmtCompact, fmtUsd, tierBadgeClass } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  status_change: "status changes",
  note: "notes & draft actions",
  reminder: "reminders set",
  email_sent_manually: "emails sent manually",
  linkedin_manual: "LinkedIn messages sent manually",
};

export default function DashboardPage() {
  const stats = getDashboardStats();
  const config = getScoringConfig();
  const notes = getWorkbookNotes();
  const statusCounts = leadStatusCounts();
  const recentActivity = activitySummary(7);
  const overdue = overdueReminderCount();
  const tiers = marketTierCounts();

  const counters: [string, number, string][] = [
    ["Markets", stats.markets, "countries imported"],
    ["Markets scored", stats.scored, "have all three manual scores"],
    ["Companies", stats.companies, "Phase 3"],
    ["Contacts", stats.contacts, "Phase 3"],
    ["Leads", stats.leads, "Phase 3"],
    ["Outreach drafts", stats.drafts, "Phase 4"],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Market data imported from Countries_by_Continent.xlsx with full provenance
          ({stats.provenance.toLocaleString("en-GB")} source records).
          {stats.lastImport && <> Last import: {new Date(stats.lastImport).toUTCString()}.</>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {counters.map(([label, n, sub]) => (
          <div key={label} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-2xl font-semibold tabular-nums">{n.toLocaleString("en-GB")}</div>
            <div className="text-sm text-slate-600">{label}</div>
            <div className="text-xs text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      {overdue > 0 && (
        <section className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-900">
          <strong>{overdue} follow-up{overdue === 1 ? " is" : "s are"} overdue.</strong>{" "}
          <Link href="/outreach" className="underline font-medium">Open the Outreach workspace →</Link>
        </section>
      )}
      {stats.scored === 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          <strong>Next research task:</strong> no country has a weighted score yet — the three manual
          scores (Market Size, Access Ease, Competition) are deliberately blank in the source workbook
          and must come from real trade data.{" "}
          <Link href="/scoring" className="underline font-medium">Open the Scoring workspace →</Link>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-3">Lead pipeline</h2>
          {stats.leads === 0 ? (
            <p className="text-sm text-slate-400">
              No leads yet — add companies (manually or by CSV import) to start the pipeline.
            </p>
          ) : (
            <div className="space-y-2">
              {STATUS_STAGES.map((g) => {
                const stageTotal = g.statuses.reduce((a, s) => a + (statusCounts[s] ?? 0), 0);
                return (
                  <div key={g.stage} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-slate-400">{g.stage}</span>
                    <span className="w-8 text-right tabular-nums font-semibold">{stageTotal}</span>
                    <span className="flex flex-wrap gap-1">
                      {g.statuses
                        .filter((s) => (statusCounts[s] ?? 0) > 0)
                        .map((s) => (
                          <Link key={s} href={`/leads?status=${encodeURIComponent(s)}`} className={`text-xs border rounded-full px-2 py-0.5 ${statusBadgeClass(s)}`}>
                            {s} · {statusCounts[s]}
                          </Link>
                        ))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-3">Last 7 days &amp; market tiers</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No recorded activity in the last 7 days.</p>
          ) : (
            <ul className="text-sm space-y-1 mb-3">
              {recentActivity.map((a) => (
                <li key={a.type} className="flex gap-2">
                  <span className="tabular-nums font-semibold w-8 text-right">{a.count}</span>
                  <span className="text-slate-600">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1.5">
            {tiers.map((t) => (
              <Link key={t.priority_tier} href={`/markets?tier=${encodeURIComponent(t.priority_tier)}`} className={`text-xs border rounded-full px-2 py-0.5 ${tierBadgeClass(t.priority_tier)}`}>
                {t.priority_tier} · {t.n}
              </Link>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Full details: <Link href="/reports/weekly" className="underline">Weekly report</Link> ·{" "}
            <Link href="/reports/data-quality" className="underline">Data quality &amp; duplicates</Link> ·{" "}
            <Link href="/reports" className="underline">Exports</Link>
          </p>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-3">Markets by continent</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1.5 pr-2 font-medium">Continent</th>
                <th className="py-1.5 pr-2 font-medium text-right">Countries</th>
                <th className="py-1.5 pr-2 font-medium text-right">Population</th>
                <th className="py-1.5 font-medium text-right">GDP (nominal)</th>
              </tr>
            </thead>
            <tbody>
              {stats.byContinent.map((r) => (
                <tr key={r.continent} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-2">{r.continent}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.n}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{fmtCompact(r.pop)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtUsd(r.gdp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-2">
            Population and GDP are rounded planning estimates (UN WPP / IMF WEO basis) — refresh before external use.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-3">Scoring model (imported from the workbook)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1.5 pr-2 font-medium">Setting</th>
                <th className="py-1.5 pr-2 font-medium">Value</th>
                <th className="py-1.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {config.map((c) => (
                <tr key={c.config_key} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="py-1.5 pr-2 font-mono text-xs">{c.config_key}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{c.config_value}</td>
                  <td className="py-1.5 text-xs text-slate-500">{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-1">Source caveats &amp; scope notes</h2>
        <p className="text-xs text-slate-400 mb-3">
          Imported verbatim from the workbook. These qualify every figure above — the data is a planning
          dataset, not verified fact.
        </p>
        <ul className="space-y-2 text-sm text-slate-700">
          {notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 mt-0.5 text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                {n.field_name}
              </span>
              <span>{n.original_value}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
