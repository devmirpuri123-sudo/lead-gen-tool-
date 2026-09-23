import Link from "next/link";
import { weeklyReport } from "@/lib/reportQueries";
import { statusBadgeClass } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const endParam = typeof sp.end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.end) ? sp.end : today;
  const end = endParam > today ? today : endParam;
  const start = shiftDate(end, -6);
  const r = weeklyReport(start, end);

  const stat = (label: string, value: number | string, warn = false) => (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className={`text-2xl font-semibold tabular-nums ${warn && Number(value) > 0 ? "text-rose-600" : ""}`}>{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/reports" className="text-sm text-slate-500 hover:underline">← Reports</Link>
          <h1 className="text-2xl font-semibold mt-1">Weekly report</h1>
          <p className="text-sm text-slate-500 mt-1">
            {r.start} to {r.end} (7 days). Everything below comes straight from the activity log and
            database — print this page or screenshot it for the team.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/reports/weekly?end=${shiftDate(end, -7)}`} className="border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100">← Previous week</Link>
          {end < today && (
            <Link href={`/reports/weekly?end=${shiftDate(end, 7)}`} className="border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100">Next week →</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stat("New leads", r.newLeads.length)}
        {stat("Status movements", r.totalStatusMoves)}
        {stat("Outreach sent (manual)", r.outreachSent.reduce((a, b) => a + b.count, 0))}
        {stat("Replies / engaged", r.replies)}
        {stat("Markets scored", r.marketsScored.length)}
        {stat("Overdue follow-ups", r.overdueReminders.length, true)}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Overdue follow-ups (as of today)</h2>
          {r.overdueReminders.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing overdue — well done.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.overdueReminders.map((o, i) => (
                <li key={i}>
                  <span className="text-rose-600 tabular-nums">{o.due_at.slice(0, 10)}</span>{" "}
                  <Link href={`/leads/${o.lead_id}`} className="font-medium hover:underline">{o.company_name ?? `Lead #${o.lead_id}`}</Link>
                  <span className="text-slate-500"> — {o.description}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Status movements this week</h2>
          {r.statusMoves.length === 0 ? (
            <p className="text-sm text-slate-400">No leads changed status this week.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.statusMoves.map((m) => (
                <li key={m.status} className="flex items-center gap-2">
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${statusBadgeClass(m.status)}`}>{m.status}</span>
                  <span className="tabular-nums">{m.count} lead{m.count === 1 ? "" : "s"} moved here</span>
                </li>
              ))}
            </ul>
          )}
          {r.outreachSent.length > 0 && (
            <p className="text-sm text-slate-600 mt-3">
              Outreach: {r.outreachSent.map((o) => `${o.count} ${o.type.toLowerCase()}`).join(", ")}.
            </p>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">New leads ({r.newLeads.length})</h2>
          {r.newLeads.length === 0 ? (
            <p className="text-sm text-slate-400">
              No new leads this week. {r.companiesAdded} companies and {r.contactsAdded} contacts were added.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5 text-sm">
                {r.newLeads.slice(0, 15).map((l) => (
                  <li key={l.id} className="flex items-center gap-2">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{l.company_name ?? `Lead #${l.id}`}</Link>
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${statusBadgeClass(l.status)}`}>{l.status}</span>
                    <span className="text-xs text-slate-400">{l.owner ?? "unassigned"} · {l.created_at.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-2">
                {r.newLeads.length > 15 && `…and ${r.newLeads.length - 15} more. `}
                Also added this week: {r.companiesAdded} companies, {r.contactsAdded} contacts.
              </p>
            </>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Markets scored this week ({r.marketsScored.length})</h2>
          {r.marketsScored.length === 0 ? (
            <p className="text-sm text-slate-400">
              No markets were scored this week{r.configChanges > 0 ? `, but the scoring configuration changed ${r.configChanges} time${r.configChanges === 1 ? "" : "s"}` : ""}.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.marketsScored.map((m) => (
                <li key={m.country}>
                  <span className="font-medium">{m.country}</span>{" "}
                  <span className="tabular-nums">{m.weighted_score?.toFixed(2) ?? "—"}</span>{" "}
                  <span className="text-slate-500">({m.priority_tier}, by {m.scored_by ?? "?"})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-2">Activity by person</h2>
        {r.activityByPerson.length === 0 ? (
          <p className="text-sm text-slate-400">No recorded activity this week.</p>
        ) : (
          <table className="text-sm">
            <tbody>
              {r.activityByPerson.map((p) => (
                <tr key={p.person}>
                  <td className="pr-6 py-1 font-medium">{p.person}</td>
                  <td className="py-1 tabular-nums">{p.count} recorded action{p.count === 1 ? "" : "s"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Counted from the who/when audit trail (scores entered, statuses changed, drafts handled,
          notes, reminders).
        </p>
      </section>
    </div>
  );
}
