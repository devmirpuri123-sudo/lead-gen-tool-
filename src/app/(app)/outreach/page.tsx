import Link from "next/link";
import { listDrafts, listOpenReminders, outreachQueue } from "@/lib/outreachQueries";
import { completeReminder } from "@/lib/outreachActions";
import { statusBadgeClass } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const today = new Date().toISOString().slice(0, 10);

  const inReview = listDrafts("draft");
  const approved = listDrafts("approved");
  const sent = listDrafts("sent_manually").slice(0, 10);
  const reminders = listOpenReminders();
  const overdue = reminders.filter((r) => r.due_at.slice(0, 10) <= today);
  const upcoming = reminders.filter((r) => r.due_at.slice(0, 10) > today).slice(0, 10);
  const queue = outreachQueue(today).slice(0, 15);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Outreach workspace</h1>
        <p className="text-sm text-slate-500 mt-1">
          Drafts are written by the system from templates, but a human reviews, approves and sends
          every single one from their own account.
        </p>
      </div>

      <section className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm">
        <strong className="text-emerald-400">The rules, always:</strong> nothing is ever sent
        automatically · LinkedIn actions are done by you, manually, from your own profile · leads
        marked "Do not contact" get no drafts, no approvals, no sends — the system blocks them ·
        every action is recorded with who did it and when.
      </section>

      {saved && <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-3 py-2">{saved}</p>}
      {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">
            Follow-ups due <span className="text-rose-600">({overdue.length} overdue)</span>
          </h2>
          {overdue.length === 0 && upcoming.length === 0 && (
            <p className="text-sm text-slate-400">No open reminders. Reminders are created when you mark a draft sent, or manually on a lead's page.</p>
          )}
          <ul className="space-y-2 text-sm">
            {[...overdue, ...upcoming].map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <span className={`shrink-0 text-xs rounded px-1.5 py-0.5 mt-0.5 tabular-nums ${r.due_at.slice(0, 10) <= today ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                  {r.due_at.slice(0, 10)}
                </span>
                <span className="grow">
                  <Link href={`/leads/${r.lead_id}`} className="font-medium hover:underline">{r.company_name ?? `Lead #${r.lead_id}`}</Link>
                  <span className="text-slate-500"> — {r.description}</span>
                </span>
                <form action={completeReminder} className="shrink-0 flex items-center gap-1">
                  <input type="hidden" name="activity_id" value={r.id} />
                  <input type="hidden" name="back" value="/outreach" />
                  <input name="entered_by" placeholder="Your name" className="border border-slate-300 rounded px-1.5 py-0.5 text-xs w-24" />
                  <button type="submit" className="text-xs border border-slate-300 rounded px-2 py-0.5 hover:bg-slate-100">Done</button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Drafts awaiting review ({inReview.length}) &amp; approved to send ({approved.length})</h2>
          {inReview.length + approved.length === 0 && (
            <p className="text-sm text-slate-400">
              No open drafts. Generate one from a lead's page (leads marked Do not contact are excluded).
            </p>
          )}
          <ul className="space-y-2 text-sm">
            {approved.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="shrink-0 text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5">approved — send manually</span>
                <Link href={`/outreach/${d.id}`} className="font-medium hover:underline">#{d.id} {d.channel}</Link>
                <span className="text-slate-500">→ {d.company_name ?? "?"} ({d.market_country ?? "no market"})</span>
              </li>
            ))}
            {inReview.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="shrink-0 text-xs bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5">needs review</span>
                <Link href={`/outreach/${d.id}`} className="font-medium hover:underline">#{d.id} {d.channel}</Link>
                <span className="text-slate-500">→ {d.company_name ?? "?"} ({d.market_country ?? "no market"})</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-1">What to do next, per lead</h2>
        <p className="text-xs text-slate-400 mb-3">
          Recommendations are rule-based and explained — urgent items first. Closed / Not a fit /
          Do not contact leads are excluded.
        </p>
        {queue.length === 0 ? (
          <p className="text-sm text-slate-400">No active leads yet — create some from the Companies page or CSV import.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queue.map(({ lead, next }) => (
              <li key={lead.id} className="py-2 flex flex-wrap items-start gap-2 text-sm">
                <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${next.urgent ? "bg-rose-500" : "bg-slate-300"}`} />
                <span className="font-medium w-52 shrink-0">
                  <Link href={`/leads/${lead.id}`} className="hover:underline">{lead.company_name ?? `Lead #${lead.id}`}</Link>
                  <span className={`ml-2 text-xs border rounded-full px-1.5 py-0.5 ${statusBadgeClass(lead.status)}`}>{lead.status}</span>
                </span>
                <span className="grow min-w-[300px]">
                  <span className="font-medium">{next.action}.</span>{" "}
                  <span className="text-slate-500">{next.reason}</span>
                  {next.href && (
                    <>
                      {" "}
                      <Link href={next.href} className="text-emerald-700 underline whitespace-nowrap">Go →</Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sent.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Recently sent (manually)</h2>
          <ul className="space-y-1 text-sm text-slate-600">
            {sent.map((d) => (
              <li key={d.id}>
                <Link href={`/outreach/${d.id}`} className="hover:underline">#{d.id} {d.channel}</Link> → {d.company_name} · sent by {d.sent_by} on {d.sent_at?.slice(0, 10)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
