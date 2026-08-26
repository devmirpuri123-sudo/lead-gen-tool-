import Link from "next/link";
import { importCompaniesCsv } from "@/lib/crmActions";
import { listImportReports } from "@/lib/crmQueries";
import { getScorerNames } from "@/lib/queries";

export const dynamic = "force-dynamic";

const COLUMNS: [string, string][] = [
  ["company_name", "Required. The company's name."],
  ["country", "Must match a market country exactly (e.g. Ghana, United Kingdom). Unmatched countries are flagged."],
  ["website", "e.g. example.com"],
  ["company_type", "distributor, wholesaler, importer, retailer or other"],
  ["description", "What the company does, from a real source"],
  ["company_notes", "Where the information came from"],
  ["contact_name", "Optional person at the company"],
  ["contact_role", "Their job title"],
  ["contact_email", "Validated; invalid emails are dropped and flagged"],
  ["contact_phone", "As found"],
  ["contact_linkedin", "A linkedin.com address, found manually — never scraped"],
];

interface ImportReport {
  file: string;
  imported_by: string;
  imported_at: string;
  total_rows: number;
  companies_created: number;
  contacts_created: number;
  leads_created: number;
  skipped: string[];
  flagged: string[];
  unknown_columns: string[];
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const people = getScorerNames();
  const reports: ImportReport[] = listImportReports()
    .map((r) => {
      try {
        return JSON.parse(r.original_value ?? "") as ImportReport;
      } catch {
        return null;
      }
    })
    .filter((r): r is ImportReport => r !== null);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/companies" className="text-sm text-slate-500 hover:underline">← Companies</Link>
        <h1 className="text-2xl font-semibold mt-1">Import companies from CSV</h1>
        <p className="text-sm text-slate-500 mt-1">
          Rows are cleaned (trimmed, blanks become "Unknown — requires research"), checked for
          duplicates against the file and the database, and every imported value is recorded with the
          file name and row number it came from.
        </p>
      </div>

      {saved && <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-3 py-2">{saved}</p>}
      {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>}

      <form action={importCompaniesCsv} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 text-sm">
        <label className="block">
          <span className="text-slate-600">CSV file (first row must be column headers)</span>
          <input type="file" name="file" accept=".csv,text/csv" required className="mt-1 block w-full text-sm" />
        </label>
        <div className="grid sm:grid-cols-2 gap-3 items-end">
          <label className="block">
            <span className="text-slate-600">Your name (required)</span>
            <input name="entered_by" list="people" maxLength={60} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            <datalist id="people">
              {people.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="create_leads" defaultChecked />
            <span>Create a lead (status "Imported") for each new company</span>
          </label>
        </div>
        <button type="submit" className="bg-slate-900 text-white rounded px-4 py-2">Import</button>
      </form>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-2">Expected columns</h2>
        <p className="text-xs text-slate-400 mb-2">
          Column names are matched case-insensitively; spaces become underscores. Only
          <code className="mx-1">company_name</code> is required — include whichever others you have.
          Unrecognised columns are ignored and reported.
        </p>
        <table className="w-full text-xs">
          <tbody>
            {COLUMNS.map(([name, desc]) => (
              <tr key={name} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-3 font-mono whitespace-nowrap">{name}</td>
                <td className="py-1 text-slate-500">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {reports.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold mb-2">Past imports</h2>
          <div className="space-y-4">
            {reports.map((r, i) => (
              <div key={i} className="border border-slate-200 rounded p-3 text-sm">
                <p className="font-medium">
                  {r.file} <span className="text-slate-400 font-normal">· {r.imported_at.slice(0, 10)} · by {r.imported_by}</span>
                </p>
                <p className="text-slate-600 mt-1">
                  {r.total_rows} rows → {r.companies_created} companies, {r.contacts_created} contacts, {r.leads_created} leads.
                  {r.unknown_columns.length > 0 && <> Ignored columns: {r.unknown_columns.join(", ")}.</>}
                </p>
                {r.skipped.length > 0 && (
                  <ul className="mt-2 text-xs text-rose-700 list-disc pl-4 space-y-0.5">
                    {r.skipped.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                )}
                {r.flagged.length > 0 && (
                  <ul className="mt-2 text-xs text-amber-700 list-disc pl-4 space-y-0.5">
                    {r.flagged.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
