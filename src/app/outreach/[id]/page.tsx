import Link from "next/link";
import { notFound } from "next/navigation";
import { getDraft } from "@/lib/outreachQueries";
import { getScorerNames } from "@/lib/queries";
import { findPlaceholders, getTemplate } from "@/lib/outreachTemplates";
import { updateDraft, approveDraft, revertDraft, markDraftSent, discardDraft } from "@/lib/outreachActions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, [string, string]> = {
  draft: ["Needs human review", "bg-amber-100 text-amber-800 border-amber-200"],
  approved: ["Approved — send manually", "bg-emerald-100 text-emerald-800 border-emerald-200"],
  sent_manually: ["Sent manually", "bg-sky-100 text-sky-800 border-sky-200"],
  discarded: ["Discarded", "bg-slate-100 text-slate-500 border-slate-200"],
};

export default async function DraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const draft = getDraft(Number(id));
  if (!draft) notFound();
  const people = getScorerNames();
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const placeholders = findPlaceholders(`${draft.subject ?? ""}\n${draft.body ?? ""}`);
  const template = draft.template_key ? getTemplate(draft.template_key) : undefined;
  const [statusLabel, statusClass] = STATUS_LABELS[draft.status] ?? [draft.status, "bg-slate-100 text-slate-500"];
  const dnc = draft.lead_status === "Do not contact";

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/outreach" className="text-sm text-slate-500 hover:underline">← Outreach workspace</Link>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-2xl font-semibold">
            Draft #{draft.id} — {draft.channel === "email" ? "Email" : "LinkedIn (manual)"}
          </h1>
          <span className={`text-xs border rounded-full px-2 py-0.5 ${statusClass}`}>{statusLabel}</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          For{" "}
          <Link href={`/leads/${draft.lead_id}`} className="underline">
            {draft.company_name ?? `lead #${draft.lead_id}`}
          </Link>
          {draft.contact_name ? ` · to ${draft.contact_name}` : " · no named contact yet"} ·{" "}
          {draft.market_country ?? "no market"} {template && ` · template: ${template.label}`}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Created by {draft.created_by} on {draft.created_at.slice(0, 10)}
          {draft.approved_by && <> · approved by {draft.approved_by} on {draft.approved_at?.slice(0, 10)}</>}
          {draft.sent_by && <> · sent manually by {draft.sent_by} on {draft.sent_at?.slice(0, 10)}</>}
        </p>
      </div>

      {dnc && (
        <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">
          This lead is now marked <strong>Do not contact</strong>. This draft must not be approved or
          sent — discard it.
        </p>
      )}
      {saved && <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-3 py-2">{saved}</p>}
      {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2">{error}</p>}

      {placeholders.length > 0 && draft.status === "draft" && (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded px-3 py-2">
          <strong>{placeholders.length} placeholder{placeholders.length === 1 ? "" : "s"} to resolve before this can be approved:</strong>
          <ul className="list-disc pl-5 mt-1">
            {placeholders.map((p) => (
              <li key={p} className="font-mono text-xs">{p}</li>
            ))}
          </ul>
        </div>
      )}

      {draft.status === "draft" ? (
        <form action={updateDraft} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 text-sm">
          <input type="hidden" name="draft_id" value={draft.id} />
          {draft.channel === "email" && (
            <label className="block">
              <span className="text-slate-600">Subject</span>
              <input name="subject" defaultValue={draft.subject ?? ""} maxLength={300} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
          )}
          <label className="block">
            <span className="text-slate-600">Body {draft.channel === "linkedin" && draft.template_key === "linkedin_connection" && "(LinkedIn connection notes are limited to ~300 characters)"}</span>
            <textarea name="body" defaultValue={draft.body ?? ""} rows={16} maxLength={8000} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 font-mono text-xs leading-relaxed" />
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
            <button type="submit" className="bg-slate-900 text-white rounded px-4 py-2">Save edits</button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          {draft.subject && <p className="font-medium mb-2">Subject: {draft.subject}</p>}
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800">{draft.body}</pre>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 text-sm">
        <h2 className="font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-4">
          {draft.status === "draft" && !dnc && (
            <form action={approveDraft} className="flex items-end gap-2">
              <input type="hidden" name="draft_id" value={draft.id} />
              <label className="block">
                <span className="text-slate-600 text-xs">Your name</span>
                <input name="entered_by" list="people" maxLength={60} className="mt-0.5 block border border-slate-300 rounded px-2 py-1.5 w-36" />
              </label>
              <button type="submit" className="bg-emerald-600 text-white rounded px-3 py-1.5 hover:bg-emerald-700">Approve</button>
            </form>
          )}
          {draft.status === "approved" && !dnc && (
            <>
              <form action={markDraftSent} className="flex items-end gap-2 flex-wrap">
                <input type="hidden" name="draft_id" value={draft.id} />
                <label className="block">
                  <span className="text-slate-600 text-xs">Your name</span>
                  <input name="entered_by" list="people" maxLength={60} className="mt-0.5 block border border-slate-300 rounded px-2 py-1.5 w-36" />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
                  <input type="checkbox" name="create_reminder" defaultChecked /> set 7-day follow-up reminder
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
                  <input type="checkbox" name="advance_status" defaultChecked /> move lead to Contacted
                </label>
                <button type="submit" className="bg-sky-600 text-white rounded px-3 py-1.5 hover:bg-sky-700">I sent it myself — mark sent</button>
              </form>
              <form action={revertDraft} className="flex items-end gap-2">
                <input type="hidden" name="draft_id" value={draft.id} />
                <input name="entered_by" placeholder="Your name" maxLength={60} className="border border-slate-300 rounded px-2 py-1.5 w-36" />
                <button type="submit" className="border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100">Back to draft</button>
              </form>
            </>
          )}
          {draft.status !== "sent_manually" && draft.status !== "discarded" && (
            <form action={discardDraft} className="flex items-end gap-2">
              <input type="hidden" name="draft_id" value={draft.id} />
              <input name="entered_by" placeholder="Your name" maxLength={60} className="border border-slate-300 rounded px-2 py-1.5 w-36" />
              <button type="submit" className="border border-rose-300 text-rose-700 rounded px-3 py-1.5 hover:bg-rose-50">Discard</button>
            </form>
          )}
        </div>
        <p className="text-xs text-slate-400">
          The system never sends anything. "Mark sent" only records that YOU sent this text yourself —
          email from your mailbox, LinkedIn from your own profile.
        </p>
      </div>
    </div>
  );
}
