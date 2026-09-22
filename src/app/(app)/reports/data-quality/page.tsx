import Link from "next/link";
import { dataQualityReport, duplicateReport } from "@/lib/reportQueries";
import { statusBadgeClass } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

function QualityTable({ title, rows }: { title: string; rows: { label: string; count: number; hint: string }[] }) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="font-semibold mb-2">{title}</h2>
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-2">
            <span className={`shrink-0 tabular-nums font-semibold w-10 text-right ${r.count > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {r.count}
            </span>
            <span>
              <span className="text-slate-700">{r.label}</span>
              {r.count > 0 && <span className="text-slate-400"> — {r.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DataQualityPage() {
  const q = dataQualityReport();
  const d = duplicateReport();
  const dupTotal = d.nameGroups.length + d.domainGroups.length + d.sharedEmails.length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/reports" className="text-sm text-slate-500 hover:underline">← Reports</Link>
        <h1 className="text-2xl font-semibold mt-1">Data quality &amp; duplicates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Amber numbers are open research work — each line says what to do. Green zeros are done.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <QualityTable title="Markets" rows={q.markets} />
        <QualityTable title="Companies" rows={q.companies} />
        <QualityTable title="Contacts" rows={q.contacts} />
        <QualityTable title="Leads" rows={q.leads} />
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-2">Stale leads — no activity for 30+ days ({q.staleLeads.length})</h2>
        {q.staleLeads.length === 0 ? (
          <p className="text-sm text-slate-400">No active lead has gone quiet. (Closed, Not a fit, Do not contact and Nurture leads are not counted.)</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {q.staleLeads.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{l.company_name ?? `Lead #${l.id}`}</Link>
                <span className={`text-xs border rounded-full px-2 py-0.5 ${statusBadgeClass(l.status)}`}>{l.status}</span>
                <span className="text-xs text-slate-400">
                  owner {l.owner ?? "—"} · last activity {l.last_activity?.slice(0, 10) ?? "never"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-2">Possible duplicates ({dupTotal === 0 ? "none found" : dupTotal + " groups"})</h2>
        {dupTotal === 0 ? (
          <p className="text-sm text-slate-400">
            No companies share a similar name or website domain, and no email appears on more than one
            contact. (Exact duplicates are blocked at entry; this report catches near-misses and
            overridden warnings.)
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            {d.nameGroups.length > 0 && (
              <div>
                <p className="font-medium text-slate-700 mb-1">Similar company names (ignoring suffixes like Ltd/Trading/Group):</p>
                <ul className="space-y-1 pl-4 list-disc">
                  {d.nameGroups.map((g) => (
                    <li key={g.key}>
                      {g.companies.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && " · "}
                          <Link href={`/companies/${c.id}`} className="underline">{c.name}</Link>
                          {c.market_country && <span className="text-slate-400"> ({c.market_country})</span>}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.domainGroups.length > 0 && (
              <div>
                <p className="font-medium text-slate-700 mb-1">Companies sharing a website domain:</p>
                <ul className="space-y-1 pl-4 list-disc">
                  {d.domainGroups.map((g) => (
                    <li key={g.domain}>
                      <span className="font-mono text-xs">{g.domain}</span>:{" "}
                      {g.companies.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && " · "}
                          <Link href={`/companies/${c.id}`} className="underline">{c.name}</Link>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.sharedEmails.length > 0 && (
              <div>
                <p className="font-medium text-slate-700 mb-1">Email addresses on more than one contact:</p>
                <ul className="space-y-1 pl-4 list-disc">
                  {d.sharedEmails.map((g) => (
                    <li key={g.email}>
                      <span className="font-mono text-xs">{g.email}</span>:{" "}
                      {g.contacts.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && " · "}
                          {c.full_name}
                          {c.company_name && <span className="text-slate-400"> ({c.company_name})</span>}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-400">
              Review each group: merge the duplicates by moving contacts/leads to one company and
              discarding the other, or confirm they really are different businesses.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
