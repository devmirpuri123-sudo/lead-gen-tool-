import { getDb } from "@/lib/db";
import { listLeads } from "@/lib/crmQueries";
import { scoreLead } from "@/lib/leadScoring";

/** Row builders for exports. Each returns plain objects whose keys become the
 *  header row. Blank cells mean "Unknown — requires research" — we export the
 *  data as stored, without inventing anything. */

export type ExportEntity = "markets" | "companies" | "contacts" | "leads";

export function exportRows(entity: ExportEntity): Record<string, string | number | null>[] {
  const db = getDb();
  switch (entity) {
    case "markets":
      return db
        .prepare(
          `SELECT country, continent, sub_region, population, population_band,
                  gdp_nominal_usd, gdp_per_capita_usd, income_tier,
                  diaspora_flag, est_african_descent_population_text, diaspora_profile, diaspora_priority,
                  landlocked, ecowas_status, afcfta_status, trade_bloc, business_language, notes,
                  existing_buyer, import_duty_pct_text, est_annual_import_value_usd,
                  local_competition, distributor_status, assigned_owner,
                  market_size_score, access_ease_score, diaspora_fit_score, competition_score,
                  weighted_score, priority_tier, scored_by, scored_at, confidence, last_reviewed_at
           FROM markets ORDER BY country`
        )
        .all() as Record<string, string | number | null>[];
    case "companies":
      return db
        .prepare(
          `SELECT c.name, c.company_type, m.country market_country, c.website, c.description,
                  c.status, c.notes, c.confidence,
                  (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) contact_count,
                  (SELECT COUNT(*) FROM leads l WHERE l.company_id = c.id) lead_count,
                  c.created_at, c.updated_at
           FROM companies c LEFT JOIN markets m ON m.id = c.market_id ORDER BY c.name COLLATE NOCASE`
        )
        .all() as Record<string, string | number | null>[];
    case "contacts":
      return db
        .prepare(
          `SELECT ct.full_name, ct.role_title, ct.email, ct.phone, ct.linkedin_url,
                  c.name company_name, m.country market_country, ct.confidence, ct.notes, ct.created_at
           FROM contacts ct
           LEFT JOIN companies c ON c.id = ct.company_id
           LEFT JOIN markets m ON m.id = c.market_id
           ORDER BY ct.full_name COLLATE NOCASE`
        )
        .all() as Record<string, string | number | null>[];
    case "leads":
      return listLeads({}).map((l) => {
        const s = scoreLead({
          company_name: l.company_name ?? `Lead #${l.id}`,
          company_type: l.company_type,
          website: l.website,
          description: l.description,
          contact_name: l.contact_name,
          contact_email: l.contact_email,
          market_country: l.market_country,
          market_tier: l.market_tier,
          status: l.status,
        });
        return {
          lead_id: l.id,
          company: l.company_name,
          market_country: l.market_country,
          market_tier: l.market_tier,
          contact: l.contact_name,
          contact_email: l.contact_email,
          status: l.status,
          owner: l.owner,
          lead_score_0_100: s.score,
          score_breakdown: s.components.map((c) => `${c.label} ${c.points}/${c.max}`).join("; "),
          created_at: l.created_at,
          updated_at: l.updated_at,
        };
      });
  }
}

export function toCsv(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
}
