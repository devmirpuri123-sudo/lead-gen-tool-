import { getDb } from "@/lib/db";
import type { ProvenanceRow } from "@/lib/queries";

export interface Company {
  id: number;
  market_id: number | null;
  name: string;
  name_normalised: string;
  website: string | null;
  company_type: string | null;
  description: string | null;
  status: string;
  confidence: string;
  notes: string | null;
  external_ref: string | null;
  record_status: string | null;
  added_by: string | null;
  region: string | null;
  city: string | null;
  product_categories: string | null;
  category_match: string | null;
  own_brand: string | null;
  year_established: string | null;
  employees_band: string | null;
  est_annual_revenue_usd: number | null;
  company_size: string | null;
  outlets: string | null;
  linkedin_company_url: string | null;
  imports_flag: string | null;
  hs_codes: string | null;
  source_countries: string | null;
  competing_origin: string | null;
  known_suppliers: string | null;
  import_volume_ctnrs_yr: number | null;
  import_value_usd_yr: number | null;
  container_type: string | null;
  import_frequency: string | null;
  last_known_shipment: string | null;
  displacement_opportunity: string | null;
  import_data_source: string | null;
  discharge_port: string | null;
  preferential_access: string | null;
  compliance_certs: string | null;
  language: string | null;
  priority_products: string | null;
  est_opportunity_usd: number | null;
  lead_source_tool: string | null;
  date_pulled: string | null;
  verified_by: string | null;
  verification_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyListRow extends Company {
  market_country: string | null;
  market_tier: string | null;
  contact_count: number;
  lead_count: number;
}

export interface Contact {
  id: number;
  company_id: number | null;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  country: string | null;
  confidence: string;
  notes: string | null;
  external_ref: string | null;
  contact_function: string | null;
  decision_role: string | null;
  email_status: string | null;
  whatsapp: string | null;
  language: string | null;
  best_time_to_call: string | null;
  source_tool: string | null;
  date_pulled: string | null;
  verified_flag: string | null;
  created_at: string;
}

export interface Lead {
  id: number;
  company_id: number | null;
  contact_id: number | null;
  market_id: number | null;
  status: string;
  score: number | null;
  score_explanation: string | null;
  next_action: string | null;
  next_action_due: string | null;
  owner: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadListRow extends Lead {
  company_name: string | null;
  company_type: string | null;
  website: string | null;
  description: string | null;
  imports_flag: string | null;
  competing_origin: string | null;
  company_size: string | null;
  category_match: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  contact_phone: string | null;
  email_status: string | null;
  decision_role: string | null;
  market_country: string | null;
  market_tier: string | null;
}

const LEAD_SELECT = `
  SELECT l.*, c.name company_name, c.company_type, c.website, c.description,
         c.imports_flag, c.competing_origin, c.company_size, c.category_match,
         ct.full_name contact_name, ct.email contact_email, ct.role_title contact_role,
         ct.phone contact_phone, ct.email_status, ct.decision_role,
         m.country market_country, m.priority_tier market_tier
  FROM leads l
  LEFT JOIN companies c ON c.id = l.company_id
  LEFT JOIN contacts ct ON ct.id = l.contact_id
  LEFT JOIN markets m ON m.id = l.market_id`;

export interface Activity {
  id: number;
  lead_id: number | null;
  activity_type: string;
  description: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function listCompanies(f: { q?: string; type?: string; country?: string }): CompanyListRow[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (f.q) {
    clauses.push("(c.name_normalised LIKE @q OR m.country LIKE @q)");
    params.q = `%${f.q.toLowerCase()}%`;
  }
  if (f.type) {
    clauses.push("c.company_type = @type");
    params.type = f.type;
  }
  if (f.country) {
    clauses.push("m.country = @country");
    params.country = f.country;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT c.*, m.country market_country, m.priority_tier market_tier,
        (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) contact_count,
        (SELECT COUNT(*) FROM leads l WHERE l.company_id = c.id) lead_count
       FROM companies c LEFT JOIN markets m ON m.id = c.market_id
       ${where} ORDER BY c.name COLLATE NOCASE`
    )
    .all(params) as CompanyListRow[];
}

export function getCompany(id: number): (Company & { market_country: string | null; market_tier: string | null }) | undefined {
  return getDb()
    .prepare(
      `SELECT c.*, m.country market_country, m.priority_tier market_tier
       FROM companies c LEFT JOIN markets m ON m.id = c.market_id WHERE c.id = ?`
    )
    .get(id) as (Company & { market_country: string | null; market_tier: string | null }) | undefined;
}

export function listCompanyContacts(companyId: number): Contact[] {
  return getDb()
    .prepare(`SELECT * FROM contacts WHERE company_id = ? ORDER BY full_name COLLATE NOCASE`)
    .all(companyId) as Contact[];
}

export function listCompanyLeads(companyId: number): LeadListRow[] {
  return getDb()
    .prepare(`${LEAD_SELECT} WHERE l.company_id = ? ORDER BY l.updated_at DESC`)
    .all(companyId) as LeadListRow[];
}

export function listLeads(f: { q?: string; status?: string; owner?: string }): LeadListRow[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (f.q) {
    clauses.push("(c.name_normalised LIKE @q OR m.country LIKE @q OR ct.full_name LIKE @q)");
    params.q = `%${f.q.toLowerCase()}%`;
  }
  if (f.status) {
    clauses.push("l.status = @status");
    params.status = f.status;
  }
  if (f.owner) {
    clauses.push("l.owner = @owner");
    params.owner = f.owner;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`${LEAD_SELECT} ${where} ORDER BY l.updated_at DESC`).all(params) as LeadListRow[];
}

export function getLead(id: number): LeadListRow | undefined {
  return getDb().prepare(`${LEAD_SELECT} WHERE l.id = ?`).get(id) as LeadListRow | undefined;
}

export function listLeadActivities(leadId: number): Activity[] {
  return getDb()
    .prepare(`SELECT * FROM activities WHERE lead_id = ? ORDER BY id DESC`)
    .all(leadId) as Activity[];
}

export function getEntityProvenance(entityType: string, entityId: number): ProvenanceRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM research_sources WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC`
    )
    .all(entityType, entityId) as ProvenanceRow[];
}

export function listMarketOptions(): { id: number; country: string }[] {
  return getDb()
    .prepare(`SELECT id, country FROM markets ORDER BY country`)
    .all() as { id: number; country: string }[];
}

export function leadStatusCounts(): Record<string, number> {
  const rows = getDb()
    .prepare(`SELECT status, COUNT(*) n FROM leads GROUP BY status`)
    .all() as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export function listLeadOwners(): string[] {
  return (
    getDb().prepare(`SELECT DISTINCT owner v FROM leads WHERE owner IS NOT NULL ORDER BY v`).all() as { v: string }[]
  ).map((r) => r.v);
}

export function listImportReports(limit = 10): ProvenanceRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM research_sources WHERE entity_type = 'import_report' ORDER BY id DESC LIMIT ?`
    )
    .all(limit) as ProvenanceRow[];
}
