import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany, listCompanyContacts, listCompanyLeads, listMarketOptions, getEntityProvenance } from "@/lib/crmQueries";
import { getScorerNames } from "@/lib/queries";
import { updateCompany, createContact, createLead } from "@/lib/crmActions";
import { COMPANY_TYPES, statusBadgeClass } from "@/lib/pipeline";
import { tierBadgeClass, fmtUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: string | number | null }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="py-1 border-b border-slate-100 last:border-0 flex justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${empty ? "italic text-amber-600" : "text-slate-900"}`}>
        {empty ? "Unknown — requires research" : String(value)}
      </span>
    </div>
  );
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex gap-2 items-start text-sm">
      <span className={`mt-0.5 inline-block w-4 h-4 rounded-full text-center text-[10px] leading-4 text-white ${ok ? "bg-emerald-500" : "bg-amber-400"}`}>
        {ok ? "✓" : "!"}
      </span>
      <span>
        <span className={ok ? "text-slate-700" : "text-amber-700"}>{label}</span>
        {!ok && <span className="text-slate-400"> — {hint}</span>}
      </span>
    </li>
  );
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const company = getCompany(Number(id));
  if (!company) notFound();
  const contacts = listCompanyContacts(company.id);
  const leads = listCompanyLeads(company.id);
  const markets = listMarketOptions();
  const people = getScorerNames();
  const provenance = getEntityProvenance("company", company.id);
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  const hasEmail = contacts.some((c) => c.email);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/companies" className="text-sm text-slate-500 hover:underline">← Companies</Link>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          {company.market_tier && (
            <span className={`text-xs border rounded-full px-2 py-0.5 ${tierBadgeClass(company.market_tier)}`}>
              {company.market_country}: {company.market_tier}
            </span>
          )}
        </div>
        <p className="text-xs text-amber-700 mt-1">{company.confidence}</p>
      </div>

      {saved && <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-3 py-2">{saved}</p>}
      {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Company details (edit and save)</h2>
          <form action={updateCompany} className="space-y-3 text-sm">
            <input type="hidden" name="company_id" value={company.id} />
            <label className="block">
              <span className="text-slate-600">Name</span>
              <input name="name" required defaultValue={company.name} maxLength={200} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-600">Country / market</span>
                <input name="country" list="market-countries" defaultValue={company.market_country ?? ""} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
                <datalist id="market-countries">
                  {markets.map((m) => (
                    <option key={m.id} value={m.country} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="text-slate-600">Type</span>
                <select name="company_type" defaultValue={company.company_type ?? ""} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5">
                  <option value="">Unknown — requires research</option>
                  {COMPANY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-slate-600">Website</span>
              <input name="website" defaultValue={company.website ?? ""} maxLength={200} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" placeholder="example.com" />
            </label>
            <label className="block">
              <span className="text-slate-600">Description</span>
              <textarea name="description" defaultValue={company.description ?? ""} maxLength={1000} rows={3} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="text-slate-600">Notes / sources</span>
              <textarea name="notes" defaultValue={company.notes ?? ""} maxLength={1000} rows={2} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <div className="flex items-end gap-3">
              <label className="block grow max-w-xs">
                <span className="text-slate-600">Your name (required)</span>
                <input name="entered_by" list="people" maxLength={60} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
                <datalist id="people">
                  {people.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              <button type="submit" className="bg-slate-900 text-white rounded px-4 py-2">Save changes</button>
            </div>
          </form>
        </section>

        <div className="space-y-4">
          <section className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="font-semibold mb-2">Research checklist</h2>
            <p className="text-xs text-slate-400 mb-2">
              What is verified vs. still Unknown — requires research. Completing these raises the lead score.
            </p>
            <ul className="space-y-1.5">
              <Check ok={!!company.market_country} label="Country / market linked" hint="which country is this company in?" />
              <Check ok={!!company.company_type} label="Business type confirmed" hint="importer, distributor, wholesaler, retail chain…?" />
              <Check ok={!!company.website} label="Website found" hint="find and verify their site" />
              <Check ok={!!company.category_match} label="Category match assessed" hint="Core / Partial / None vs SACVIN's range" />
              <Check ok={!!company.company_size} label="Company size estimated" hint="Large / Medium / Small, with the basis noted" />
              <Check ok={!!company.imports_flag} label="Imports? established" hint="do they already import — licence, finance, habit?" />
              <Check ok={!!company.competing_origin} label="Competing-origin sourcing checked" hint="China/India/Thailand/Turkey/Vietnam — the displacement story" />
              <Check ok={contacts.length > 0} label="At least one named contact" hint="who do we talk to?" />
              <Check ok={hasEmail} label="A contact email on file" hint="from a real source — never guessed" />
              <Check ok={!!company.notes || !!company.import_data_source} label="Sources noted" hint="record where the information came from" />
            </ul>
          </section>

          <section className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="font-semibold mb-2">Leads ({leads.length})</h2>
            {leads.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {leads.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:underline">Lead #{l.id}</Link>
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${statusBadgeClass(l.status)}`}>{l.status}</span>
                    <span className="text-slate-400 text-xs">owner: {l.owner ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
            <form action={createLead} className="flex flex-wrap items-end gap-2 text-sm">
              <input type="hidden" name="company_id" value={company.id} />
              <label className="block">
                <span className="text-slate-600">Contact (optional)</span>
                <select name="contact_id" defaultValue="" className="mt-1 border border-slate-300 rounded px-2 py-1.5">
                  <option value="">No specific contact yet</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-slate-600">Your name</span>
                <input name="entered_by" list="people" maxLength={60} className="mt-1 border border-slate-300 rounded px-2 py-1.5 w-40" />
              </label>
              {leads.some((l) => !["Closed", "Not a fit", "Do not contact"].includes(l.status)) && (
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="allow_second_lead" />
                  Create another lead anyway
                </label>
              )}
              <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1.5">Create lead</button>
            </form>
          </section>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Company profile (enrichment)</h2>
          <Info label="Workbook Lead ID" value={company.external_ref} />
          <Info label="Record status" value={company.record_status} />
          <Info label="Region / City" value={[company.region, company.city].filter(Boolean).join(" · ") || null} />
          <Info label="Product categories" value={company.product_categories} />
          <Info label="Category match" value={company.category_match} />
          <Info label="Own brand / private label" value={company.own_brand} />
          <Info label="Year established" value={company.year_established} />
          <Info label="Employees" value={company.employees_band} />
          <Info label="Est. annual revenue (USD)" value={company.est_annual_revenue_usd !== null ? fmtUsd(company.est_annual_revenue_usd) : null} />
          <Info label="Company size" value={company.company_size} />
          <Info label="Outlets / branches" value={company.outlets} />
          <Info label="LinkedIn (company)" value={company.linkedin_company_url} />
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Import intelligence</h2>
          <Info label="Imports?" value={company.imports_flag} />
          <Info label="HS codes handled" value={company.hs_codes} />
          <Info label="Current source countries" value={company.source_countries} />
          <Info label="Competing origin sourced?" value={company.competing_origin} />
          <Info label="Known current suppliers" value={company.known_suppliers} />
          <Info label="Est. import volume (containers/yr)" value={company.import_volume_ctnrs_yr} />
          <Info label="Est. import value (USD/yr)" value={company.import_value_usd_yr !== null ? fmtUsd(company.import_value_usd_yr) : null} />
          <Info label="Typical container type" value={company.container_type} />
          <Info label="Import frequency" value={company.import_frequency} />
          <Info label="Last known shipment" value={company.last_known_shipment} />
          <Info label="Displacement opportunity" value={company.displacement_opportunity} />
          <Info label="Import data source" value={company.import_data_source} />
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Commercial fit &amp; data quality</h2>
          <Info label="Nearest discharge port" value={company.discharge_port} />
          <Info label="Preferential access" value={company.preferential_access} />
          <Info label="Compliance / certification" value={company.compliance_certs} />
          <Info label="Business language" value={company.language} />
          <Info label="Priority SACVIN products" value={company.priority_products} />
          <Info label="Est. opportunity (USD/yr)" value={company.est_opportunity_usd !== null ? fmtUsd(company.est_opportunity_usd) : null} />
          <Info label="Lead source tool" value={company.lead_source_tool} />
          <Info label="Date pulled" value={company.date_pulled} />
          <Info label="Added by" value={company.added_by} />
          <Info label="Verified by / when" value={company.verified_by ? `${company.verified_by} · ${company.verification_date ?? "date unknown"}` : null} />
          <p className="text-xs text-slate-400 mt-2">
            These fields come from the Export Lead Enrichment workbook (or future in-app research).
            Data pulled more than six months ago should be re-verified before use.
          </p>
        </section>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-2">Contacts ({contacts.length})</h2>
        {contacts.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-3 font-medium">Name</th>
                  <th className="py-1.5 pr-3 font-medium">Role</th>
                  <th className="py-1.5 pr-3 font-medium">Decision role</th>
                  <th className="py-1.5 pr-3 font-medium">Email</th>
                  <th className="py-1.5 pr-3 font-medium">Email status</th>
                  <th className="py-1.5 pr-3 font-medium">Phone / WhatsApp</th>
                  <th className="py-1.5 pr-3 font-medium">LinkedIn (manual only)</th>
                  <th className="py-1.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{c.full_name}</td>
                    <td className="py-1.5 pr-3">{c.role_title ?? <span className="italic text-amber-600">Unknown</span>}</td>
                    <td className="py-1.5 pr-3">{c.decision_role ?? "—"}</td>
                    <td className="py-1.5 pr-3">{c.email ?? <span className="italic text-amber-600">Unknown — requires research</span>}</td>
                    <td className="py-1.5 pr-3">
                      {c.email_status ? (
                        <span className={`text-xs rounded px-1.5 py-0.5 ${c.email_status.toLowerCase() === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {c.email_status}
                        </span>
                      ) : c.email ? (
                        <span className="text-xs text-amber-600 italic">not verified</span>
                      ) : "—"}
                    </td>
                    <td className="py-1.5 pr-3">{[c.phone, c.whatsapp].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="py-1.5 pr-3">{c.linkedin_url ?? "—"}</td>
                    <td className="py-1.5 text-xs text-slate-500">{c.source_tool ?? c.confidence.split(" — ")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600 font-medium">Add a contact</summary>
          <form action={createContact} className="mt-3 grid sm:grid-cols-2 gap-3">
            <input type="hidden" name="company_id" value={company.id} />
            <label className="block">
              <span className="text-slate-600">Full name (required)</span>
              <input name="full_name" required maxLength={120} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="text-slate-600">Role / title</span>
              <input name="role_title" maxLength={120} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="text-slate-600">Email (only if actually found)</span>
              <input name="email" maxLength={200} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="text-slate-600">Phone</span>
              <input name="phone" maxLength={60} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="text-slate-600">LinkedIn profile (found manually)</span>
              <input name="linkedin_url" maxLength={300} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" placeholder="linkedin.com/in/…" />
            </label>
            <label className="block">
              <span className="text-slate-600">Notes / source</span>
              <input name="notes" maxLength={1000} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="text-slate-600">Your name (required)</span>
              <input name="entered_by" list="people" maxLength={60} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <div className="flex items-end">
              <button type="submit" className="bg-slate-900 text-white rounded px-4 py-2">Add contact</button>
            </div>
          </form>
        </details>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-1">Provenance</h2>
        <p className="text-xs text-slate-400 mb-3">Every recorded fact about this company: what, from where, by whom, when.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="py-1.5 px-2 font-medium">Field</th>
                <th className="py-1.5 px-2 font-medium">From</th>
                <th className="py-1.5 px-2 font-medium">To / value</th>
                <th className="py-1.5 px-2 font-medium">Source</th>
                <th className="py-1.5 px-2 font-medium">Method</th>
                <th className="py-1.5 px-2 font-medium">Who / when</th>
              </tr>
            </thead>
            <tbody>
              {provenance.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="py-1.5 px-2 font-mono">{p.field_name}</td>
                  <td className="py-1.5 px-2 max-w-[180px] break-words">{p.original_value ?? "—"}</td>
                  <td className="py-1.5 px-2 max-w-[180px] break-words">{p.normalised_value ?? "—"}</td>
                  <td className="py-1.5 px-2">{p.source_file}{p.source_ref ? ` · ${p.source_ref}` : ""}</td>
                  <td className="py-1.5 px-2">{p.method}</td>
                  <td className="py-1.5 px-2 text-slate-500">{p.notes} · {p.imported_at?.slice(0, 10)}</td>
                </tr>
              ))}
              {provenance.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-slate-400">No provenance recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
