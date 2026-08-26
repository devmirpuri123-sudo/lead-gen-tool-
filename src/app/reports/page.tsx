import Link from "next/link";

export const dynamic = "force-dynamic";

const REPORTS = [
  {
    href: "/reports/weekly",
    title: "Weekly report",
    desc: "What happened this week: new leads, status movements, outreach sent, replies, markets scored, and overdue follow-ups.",
  },
  {
    href: "/reports/data-quality",
    title: "Data quality & duplicates",
    desc: "What is still Unknown — requires research, stale leads going quiet, and possible duplicate companies and contacts.",
  },
];

const EXPORTS = ["markets", "companies", "contacts", "leads"] as const;

export default function ReportsPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">
          Everything here is generated from the database at the moment you open it — nothing is
          estimated or invented.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-400">
            <p className="font-semibold">{r.title}</p>
            <p className="text-sm text-slate-500 mt-1">{r.desc}</p>
          </Link>
        ))}
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-1">Export data</h2>
        <p className="text-xs text-slate-400 mb-3">
          Downloads reflect the data exactly as stored: blank cells mean "Unknown — requires
          research". Lead exports include the live 0–100 score and its breakdown.
        </p>
        <table className="w-full text-sm">
          <tbody>
            {EXPORTS.map((e) => (
              <tr key={e} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-medium capitalize">{e}</td>
                <td className="py-2 text-right space-x-3">
                  <a href={`/api/export/${e}?format=csv`} className="text-emerald-700 underline">Download CSV</a>
                  <a href={`/api/export/${e}?format=xlsx`} className="text-emerald-700 underline">Download Excel (XLSX)</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
