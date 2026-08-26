import { getDb } from "@/lib/db";
import { listLeads, type LeadListRow } from "@/lib/crmQueries";
import { recommendNextAction, type NextAction } from "@/lib/nextAction";

export interface Draft {
  id: number;
  lead_id: number | null;
  channel: string;
  subject: string | null;
  body: string | null;
  status: string;
  template_key: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftListRow extends Draft {
  company_name: string | null;
  contact_name: string | null;
  market_country: string | null;
  lead_status: string | null;
}

const DRAFT_JOIN = `
  SELECT d.*, c.name company_name, ct.full_name contact_name, m.country market_country, l.status lead_status
  FROM outreach_drafts d
  LEFT JOIN leads l ON l.id = d.lead_id
  LEFT JOIN companies c ON c.id = l.company_id
  LEFT JOIN contacts ct ON ct.id = l.contact_id
  LEFT JOIN markets m ON m.id = l.market_id`;

export function listDrafts(status?: string): DraftListRow[] {
  const db = getDb();
  if (status) {
    return db.prepare(`${DRAFT_JOIN} WHERE d.status = ? ORDER BY d.updated_at DESC`).all(status) as DraftListRow[];
  }
  return db.prepare(`${DRAFT_JOIN} ORDER BY d.updated_at DESC`).all() as DraftListRow[];
}

export function getDraft(id: number): DraftListRow | undefined {
  return getDb().prepare(`${DRAFT_JOIN} WHERE d.id = ?`).get(id) as DraftListRow | undefined;
}

export function listLeadDrafts(leadId: number): Draft[] {
  return getDb()
    .prepare(`SELECT * FROM outreach_drafts WHERE lead_id = ? ORDER BY id DESC`)
    .all(leadId) as Draft[];
}

export interface Reminder {
  id: number;
  lead_id: number | null;
  description: string | null;
  due_at: string;
  completed_at: string | null;
  created_at: string;
  company_name?: string | null;
  lead_status?: string | null;
}

export function listOpenReminders(): Reminder[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.lead_id, a.description, a.due_at, a.completed_at, a.created_at,
              c.name company_name, l.status lead_status
       FROM activities a
       LEFT JOIN leads l ON l.id = a.lead_id
       LEFT JOIN companies c ON c.id = l.company_id
       WHERE a.due_at IS NOT NULL AND a.completed_at IS NULL
       ORDER BY a.due_at ASC`
    )
    .all() as Reminder[];
}

export function listLeadReminders(leadId: number): Reminder[] {
  return getDb()
    .prepare(
      `SELECT id, lead_id, description, due_at, completed_at, created_at
       FROM activities
       WHERE lead_id = ? AND due_at IS NOT NULL
       ORDER BY (completed_at IS NOT NULL), due_at ASC`
    )
    .all(leadId) as Reminder[];
}

/** Assemble the context the next-action engine needs for one lead. */
export function nextActionForLead(lead: LeadListRow, todayIso: string): NextAction {
  const db = getDb();
  const drafts = db
    .prepare(`SELECT status FROM outreach_drafts WHERE lead_id = ?`)
    .all(lead.id) as { status: string }[];
  const reminders = db
    .prepare(
      `SELECT description, due_at FROM activities
       WHERE lead_id = ? AND due_at IS NOT NULL AND completed_at IS NULL ORDER BY due_at ASC`
    )
    .all(lead.id) as { description: string | null; due_at: string }[];
  const overdue = reminders.find((r) => r.due_at.slice(0, 10) <= todayIso.slice(0, 10)) ?? null;
  return recommendNextAction({
    lead,
    hasDraftInReview: drafts.some((d) => d.status === "draft"),
    hasApprovedDraft: drafts.some((d) => d.status === "approved"),
    overdueReminder: overdue,
    nextReminder: reminders[0] ?? null,
  });
}

/** Leads that are actionable for outreach right now, with recommendations. */
export function outreachQueue(todayIso: string): { lead: LeadListRow; next: NextAction }[] {
  return listLeads({})
    .filter((l) => !["Do not contact", "Closed", "Not a fit"].includes(l.status))
    .map((lead) => ({ lead, next: nextActionForLead(lead, todayIso) }))
    .sort((a, b) => Number(b.next.urgent) - Number(a.next.urgent));
}
