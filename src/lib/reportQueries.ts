import { getDb } from "@/lib/db";
import { LEAD_STATUSES } from "@/lib/pipeline";
import { coreName, domainOf } from "@/lib/dedupe";

/** ---------- Weekly report ---------- */

export interface WeeklyReport {
  start: string; // inclusive YYYY-MM-DD
  end: string; // inclusive YYYY-MM-DD
  newLeads: { id: number; company_name: string | null; status: string; owner: string | null; created_at: string }[];
  statusMoves: { status: string; count: number }[];
  totalStatusMoves: number;
  outreachSent: { type: string; count: number }[];
  replies: number;
  companiesAdded: number;
  contactsAdded: number;
  marketsScored: { country: string; weighted_score: number | null; priority_tier: string; scored_by: string | null }[];
  configChanges: number;
  overdueReminders: { lead_id: number | null; company_name: string | null; description: string | null; due_at: string }[];
  activityByPerson: { person: string; count: number }[];
}

export function weeklyReport(startDate: string, endDate: string): WeeklyReport {
  const db = getDb();
  // created_at/imported_at are ISO timestamps; compare on the date prefix.
  const startTs = startDate;
  const endTs = endDate + "~"; // '~' sorts after any time suffix

  const newLeads = db
    .prepare(
      `SELECT l.id, c.name company_name, l.status, l.owner, l.created_at
       FROM leads l LEFT JOIN companies c ON c.id = l.company_id
       WHERE l.created_at >= ? AND l.created_at <= ? ORDER BY l.created_at DESC`
    )
    .all(startTs, endTs) as WeeklyReport["newLeads"];

  const statusMoves = LEAD_STATUSES.map((s) => ({
    status: s,
    count: (
      db
        .prepare(
          `SELECT COUNT(*) n FROM activities
           WHERE activity_type = 'status_change' AND created_at >= ? AND created_at <= ?
             AND description LIKE '%to "' || ? || '"%'`
        )
        .get(startTs, endTs, s) as { n: number }
    ).n,
  })).filter((r) => r.count > 0);

  const outreachSent = (
    db
      .prepare(
        `SELECT activity_type type, COUNT(*) count FROM activities
         WHERE activity_type IN ('email_sent_manually','linkedin_manual')
           AND created_at >= ? AND created_at <= ? GROUP BY activity_type`
      )
      .all(startTs, endTs) as { type: string; count: number }[]
  ).map((r) => ({
    type: r.type === "email_sent_manually" ? "Emails sent manually" : "LinkedIn messages sent manually",
    count: r.count,
  }));

  const replies = (
    db
      .prepare(
        `SELECT COUNT(*) n FROM activities
         WHERE activity_type = 'status_change' AND created_at >= ? AND created_at <= ?
           AND (description LIKE '%to "Replied"%' OR description LIKE '%to "Engaged"%')`
      )
      .get(startTs, endTs) as { n: number }
  ).n;

  const count = (sql: string) => (db.prepare(sql).get(startTs, endTs) as { n: number }).n;
  const companiesAdded = count(`SELECT COUNT(*) n FROM companies WHERE created_at >= ? AND created_at <= ?`);
  const contactsAdded = count(`SELECT COUNT(*) n FROM contacts WHERE created_at >= ? AND created_at <= ?`);
  const configChanges = count(
    `SELECT COUNT(*) n FROM research_sources WHERE entity_type = 'scoring_config' AND method = 'manual' AND imported_at >= ? AND imported_at <= ?`
  );

  const marketsScored = db
    .prepare(
      `SELECT country, weighted_score, priority_tier, scored_by FROM markets
       WHERE scored_at >= ? AND scored_at <= ? ORDER BY weighted_score DESC`
    )
    .all(startTs, endTs) as WeeklyReport["marketsScored"];

  const today = new Date().toISOString().slice(0, 10);
  const overdueReminders = db
    .prepare(
      `SELECT a.lead_id, c.name company_name, a.description, a.due_at
       FROM activities a
       LEFT JOIN leads l ON l.id = a.lead_id
       LEFT JOIN companies c ON c.id = l.company_id
       WHERE a.due_at IS NOT NULL AND a.completed_at IS NULL AND a.due_at <= ?
       ORDER BY a.due_at ASC`
    )
    .all(today) as WeeklyReport["overdueReminders"];

  // Attribution: pull "by NAME" out of activity descriptions in the window.
  const descs = db
    .prepare(`SELECT description FROM activities WHERE created_at >= ? AND created_at <= ? AND description LIKE '%by %'`)
    .all(startTs, endTs) as { description: string }[];
  const byPerson = new Map<string, number>();
  for (const { description } of descs) {
    const m = description.match(/\bby ([^—–(]+?)(?: —| \(|$)/);
    if (m) byPerson.set(m[1].trim(), (byPerson.get(m[1].trim()) ?? 0) + 1);
  }
  const activityByPerson = [...byPerson.entries()]
    .map(([person, count]) => ({ person, count }))
    .sort((a, b) => b.count - a.count);

  return {
    start: startDate,
    end: endDate,
    newLeads,
    statusMoves,
    totalStatusMoves: statusMoves.reduce((a, b) => a + b.count, 0),
    outreachSent,
    replies,
    companiesAdded,
    contactsAdded,
    marketsScored,
    configChanges,
    overdueReminders,
    activityByPerson,
  };
}

/** ---------- Data quality ---------- */

export interface DataQualityReport {
  markets: { label: string; count: number; hint: string }[];
  companies: { label: string; count: number; hint: string }[];
  contacts: { label: string; count: number; hint: string }[];
  leads: { label: string; count: number; hint: string }[];
  staleLeads: { id: number; company_name: string | null; status: string; owner: string | null; last_activity: string | null }[];
}

export function dataQualityReport(): DataQualityReport {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

  const markets = [
    { label: "Markets not scored", count: one(`SELECT COUNT(*) n FROM markets WHERE weighted_score IS NULL`), hint: "Enter Market Size, Access Ease and Competition on the Scoring workspace." },
    { label: "Markets partially scored", count: one(`SELECT COUNT(*) n FROM markets WHERE weighted_score IS NULL AND (market_size_score IS NOT NULL OR access_ease_score IS NOT NULL OR competition_score IS NOT NULL)`), hint: "Some of the three scores entered but not all — these stay Not scored until complete." },
    { label: "Markets missing import duty", count: one(`SELECT COUNT(*) n FROM markets WHERE import_duty_pct_text IS NULL`), hint: "Populate from national tariff schedules (HS 3923/3924)." },
    { label: "Markets missing import value", count: one(`SELECT COUNT(*) n FROM markets WHERE est_annual_import_value_usd IS NULL`), hint: "Populate from your GlobalWits trade data." },
    { label: "Markets missing GDP", count: one(`SELECT COUNT(*) n FROM markets WHERE gdp_nominal_usd IS NULL`), hint: "Vatican City publishes no GDP — expected to stay 1." },
  ];
  const companies = [
    { label: "Companies without a market/country", count: one(`SELECT COUNT(*) n FROM companies WHERE market_id IS NULL`), hint: "Link each company to a country on its page." },
    { label: "Companies with unknown type", count: one(`SELECT COUNT(*) n FROM companies WHERE company_type IS NULL`), hint: "Confirm distributor / wholesaler / importer / retailer." },
    { label: "Companies without a website", count: one(`SELECT COUNT(*) n FROM companies WHERE website IS NULL`), hint: "Find and verify their site." },
    { label: "Companies without any contact", count: one(`SELECT COUNT(*) n FROM companies WHERE NOT EXISTS (SELECT 1 FROM contacts ct WHERE ct.company_id = companies.id)`), hint: "Outreach needs a real person." },
    { label: "Imported companies never reviewed", count: one(`SELECT COUNT(*) n FROM companies WHERE status = 'Imported'`), hint: "Open each imported company, verify it, and update its details." },
  ];
  const contacts = [
    { label: "Contacts without an email", count: one(`SELECT COUNT(*) n FROM contacts WHERE email IS NULL`), hint: "Only add an email actually found — never guessed." },
    { label: "Contacts without a role/title", count: one(`SELECT COUNT(*) n FROM contacts WHERE role_title IS NULL`), hint: "Helps target the right person." },
  ];
  const leads = [
    { label: "Leads without a linked contact", count: one(`SELECT COUNT(*) n FROM leads WHERE contact_id IS NULL AND status NOT IN ('Closed','Not a fit','Do not contact')`), hint: "Link a contact so outreach has a recipient." },
    { label: "Leads marked Do not contact", count: one(`SELECT COUNT(*) n FROM leads WHERE status = 'Do not contact'`), hint: "Excluded from all outreach — listed for awareness only." },
  ];

  const staleLeads = db
    .prepare(
      `SELECT l.id, c.name company_name, l.status, l.owner,
              (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id) last_activity
       FROM leads l LEFT JOIN companies c ON c.id = l.company_id
       WHERE l.status NOT IN ('Closed','Not a fit','Do not contact','Nurture')
         AND COALESCE((SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id), l.updated_at)
             < datetime('now', '-30 days')
       ORDER BY last_activity ASC LIMIT 50`
    )
    .all() as DataQualityReport["staleLeads"];

  return { markets, companies, contacts, leads, staleLeads };
}

/** ---------- Duplicates ---------- */

export interface DuplicateReport {
  nameGroups: { key: string; companies: { id: number; name: string; market_country: string | null }[] }[];
  domainGroups: { domain: string; companies: { id: number; name: string; website: string | null }[] }[];
  sharedEmails: { email: string; contacts: { id: number; full_name: string; company_name: string | null }[] }[];
}

export function duplicateReport(): DuplicateReport {
  const db = getDb();
  const companies = db
    .prepare(
      `SELECT c.id, c.name, c.website, m.country market_country FROM companies c LEFT JOIN markets m ON m.id = c.market_id`
    )
    .all() as { id: number; name: string; website: string | null; market_country: string | null }[];

  const byCore = new Map<string, typeof companies>();
  for (const c of companies) {
    const key = coreName(c.name);
    if (!byCore.has(key)) byCore.set(key, []);
    byCore.get(key)!.push(c);
  }
  const nameGroups = [...byCore.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, companies: list.map((c) => ({ id: c.id, name: c.name, market_country: c.market_country })) }));

  const byDomain = new Map<string, typeof companies>();
  for (const c of companies) {
    const d = domainOf(c.website);
    if (!d) continue;
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(c);
  }
  const domainGroups = [...byDomain.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([domain, list]) => ({ domain, companies: list.map((c) => ({ id: c.id, name: c.name, website: c.website })) }));

  const sharedEmails = (
    db
      .prepare(
        `SELECT lower(ct.email) email FROM contacts ct WHERE ct.email IS NOT NULL
         GROUP BY lower(ct.email) HAVING COUNT(*) > 1`
      )
      .all() as { email: string }[]
  ).map(({ email }) => ({
    email,
    contacts: db
      .prepare(
        `SELECT ct.id, ct.full_name, c.name company_name FROM contacts ct
         LEFT JOIN companies c ON c.id = ct.company_id WHERE lower(ct.email) = ?`
      )
      .all(email) as { id: number; full_name: string; company_name: string | null }[],
  }));

  return { nameGroups, domainGroups, sharedEmails };
}

/** ---------- Dashboard extras ---------- */

export function activitySummary(days: number): { type: string; count: number }[] {
  return getDb()
    .prepare(
      `SELECT activity_type type, COUNT(*) count FROM activities
       WHERE created_at >= datetime('now', ?) GROUP BY activity_type ORDER BY count DESC`
    )
    .all(`-${days} days`) as { type: string; count: number }[];
}

export function overdueReminderCount(): number {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) n FROM activities WHERE due_at IS NOT NULL AND completed_at IS NULL AND due_at <= ?`)
      .get(new Date().toISOString().slice(0, 10)) as { n: number }
  ).n;
}

export function marketTierCounts(): { priority_tier: string; n: number }[] {
  return getDb()
    .prepare(`SELECT priority_tier, COUNT(*) n FROM markets GROUP BY priority_tier ORDER BY n DESC`)
    .all() as { priority_tier: string; n: number }[];
}
