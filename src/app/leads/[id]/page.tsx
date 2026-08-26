import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead, listLeadActivities, listCompanyContacts } from "@/lib/crmQueries";
import { getScorerNames } from "@/lib/queries";
import { scoreLead } from "@/lib/leadScoring";
import { updateLeadStatus, addLeadNote } from "@/lib/crmActions";
import { LEAD_STATUSES, STATUS_STAGES, statusBadgeClass } from "@/lib/pipeline";
import { tierBadgeClass } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const lead = getLead(Number(id));
  if (!lead) notFound();
  const activities = listLeadActivities(lead.id);
  const contacts = lead.company_id ? listCompanyContacts(lead.company_id) : [];
  const people = getScorerNames();
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  const score = scoreLead({
    company_name: lead.company_name ?? `Lead #${lead.id}`,
    company_type: lead.company_type,
    website: lead.website,
    description: lead.description,
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    market_country: lead.market_country,
    market_tier: lead.market_tier,
    status: lead.status,
  });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/leads" className="text-sm text-slate-500 hover:underline">← Leads</Link>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-2xl font-semibold">
            Lead #{lead.id}
            {lead.company_name && (
              <>
                {" — "}
                <Link href={`/companies/${lead.company_id}`} className="hover:underline">{lead.company_name}</Link>
              </>
            )}
          </h1>
          <span className={`text-xs border rounded-full px-2 py-0.5 ${statusBadgeClass(lead.status)}`}>{lead.status}</span>
          {lead.market_tier && (
            <span className={`text-xs border rounded-full px-2 py-0.5 ${tierBadgeClass(lead.market_tier)}`}>
              {lead.market_country}: {lead.market_tier}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Contact: {lead.contact_name ?? "Unknown — requires research"} · Owner: {lead.owner ?? "—"} · Created {lead.created_at.slice(0, 10)}
        </p>
      </div>

      {saved && <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-3 py-2">{saved}</p>}
      {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>}

      <section className="bg-white rounded-lg border border-slate-200 p-4 overflow-x-auto">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Pipeline position</p>
        <div className="flex gap-1.5 min-w-[900px]">
          {STATUS_STAGES.flatMap((g) => g.statuses).map((s) => (
            <span
              key={s}
              className={`text-[11px] border rounded px-1.5 py-1 whitespace-nowrap ${
                s === lead.status ? statusBadgeClass(s) + " font-semibold ring-2 ring-slate-400" : "bg-white text-slate-400 border-slate-200"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-1">Lead score: {score.score}/100</h2>
          <div className="flex gap-1 my-2">
            {score.components.map((c) => (
              <div key={c.label} className="h-2 rounded-full bg-slate-100 overflow-hidden" style={{ flexGrow: c.max }}>
                <div className="h-full bg-emerald-500" style={{ width: `${(c.points / c.max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            {score.explanation.map((p, i) => (
              <p key={i} className={i === 0 ? "font-medium" : ""}>{p}</p>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="font-semibold mb-2">Update status</h2>
            <form action={updateLeadStatus} className="space-y-3 text-sm">
              <input type="hidden" name="lead_id" value={lead.id} />
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-slate-600">Status</span>
                  <select name="status" defaultValue={lead.status} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5">
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-600">Owner</span>
                  <input name="owner" list="people" defaultValue={lead.owner ?? ""} maxLength={60} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
                  <datalist id="people">
                    {people.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </label>
              </div>
              <label className="block">
                <span className="text-slate-600">Note (what happened?)</span>
                <input name="note" maxLength={500} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" placeholder="e.g. replied to our email on 12 May" />
              </label>
              <div className="flex items-end gap-3">
                <label className="block grow max-w-xs">
                  <span className="text-slate-600">Your name (required)</span>
                  <input name="entered_by" list="people" maxLength={60} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
                </label>
                <button type="submit" className="bg-slate-900 text-white rounded px-4 py-2">Save</button>
              </div>
              <p className="text-xs text-slate-400">
                Every status change is logged with who and when. "Do not contact" permanently excludes
                this lead from outreach drafting.
              </p>
            </form>
          </section>

          <section className="bg-white rounded-lg border border-slate-200 p-4 text-sm">
            <h2 className="font-semibold mb-2">Linked contact</h2>
            {lead.contact_name ? (
              <p>
                {lead.contact_name}
                {lead.contact_email ? ` · ${lead.contact_email}` : " · email Unknown — requires research"}
              </p>
            ) : contacts.length > 0 ? (
              <p className="text-slate-500">
                No contact linked to this lead yet. This company has {contacts.length} contact{contacts.length === 1 ? "" : "s"} —
                link one when creating the next lead, or manage contacts on the{" "}
                <Link href={`/companies/${lead.company_id}`} className="underline">company page</Link>.
              </p>
            ) : (
              <p className="italic text-amber-600">
                Unknown — requires research. Add a contact on the{" "}
                <Link href={`/companies/${lead.company_id}`} className="underline not-italic">company page</Link>.
              </p>
            )}
          </section>
        </div>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-2">Activity log</h2>
        <form action={addLeadNote} className="flex flex-wrap items-end gap-2 text-sm mb-4">
          <input type="hidden" name="lead_id" value={lead.id} />
          <label className="block grow max-w-md">
            <span className="text-slate-600">Add a note</span>
            <input name="note" maxLength={1000} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
          </label>
          <label className="block">
            <span className="text-slate-600">Your name</span>
            <input name="entered_by" list="people" maxLength={60} className="mt-1 border border-slate-300 rounded px-2 py-1.5 w-40" />
          </label>
          <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1.5">Add note</button>
        </form>
        <ul className="space-y-2 text-sm">
          {activities.map((a) => (
            <li key={a.id} className="flex gap-3">
              <span className="shrink-0 text-xs text-slate-400 w-20 pt-0.5">{a.created_at.slice(0, 10)}</span>
              <span className={`shrink-0 text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 h-fit mt-0.5 ${a.activity_type === "status_change" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"}`}>
                {a.activity_type.replace("_", " ")}
              </span>
              <span className="text-slate-700">{a.description}</span>
            </li>
          ))}
          {activities.length === 0 && <li className="text-slate-400">No activity yet.</li>}
        </ul>
      </section>
    </div>
  );
}
