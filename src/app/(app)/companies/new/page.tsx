import Link from "next/link";
import { createCompany } from "@/lib/crmActions";
import { listMarketOptions } from "@/lib/crmQueries";
import { getScorerNames } from "@/lib/queries";
import { COMPANY_TYPES } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const markets = listMarketOptions();
  const people = getScorerNames();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/companies" className="text-sm text-slate-500 hover:underline">← Companies</Link>
        <h1 className="text-2xl font-semibold mt-1">Add a company</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter only what you actually know from research — anything left blank is shown as
          "Unknown — requires research", never guessed. Duplicates are detected on save.
        </p>
      </div>

      {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>}

      <form action={createCompany} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 text-sm">
        <label className="block">
          <span className="text-slate-600">Company name (required)</span>
          <input name="name" required maxLength={200} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-slate-600">Country / market</span>
            <input name="country" list="market-countries" className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" placeholder="Start typing a country…" />
            <datalist id="market-countries">
              {markets.map((m) => (
                <option key={m.id} value={m.country} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-slate-600">Company type</span>
            <select name="company_type" defaultValue="" className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5">
              <option value="">Unknown — requires research</option>
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-slate-600">Website</span>
          <input name="website" maxLength={200} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" placeholder="example.com" />
        </label>
        <label className="block">
          <span className="text-slate-600">What the company does (from their site or a directory — cite it in notes)</span>
          <textarea name="description" maxLength={1000} rows={3} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="text-slate-600">Notes / sources</span>
          <textarea name="notes" maxLength={1000} rows={2} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" placeholder="Where did this information come from?" />
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
          <div className="space-y-1.5">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="create_lead" defaultChecked />
              <span>Also create a lead for this company</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allow_duplicate" />
              <span className="text-slate-500">Create anyway (override a duplicate warning)</span>
            </label>
          </div>
        </div>
        <button type="submit" className="bg-slate-900 text-white rounded px-4 py-2">Save company</button>
      </form>
    </div>
  );
}
