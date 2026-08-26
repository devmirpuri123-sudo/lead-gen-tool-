import { getDb } from "@/lib/db";

export interface Market {
  id: number;
  country: string;
  continent: string | null;
  sub_region: string | null;
  population: number | null;
  population_band: string | null;
  gdp_nominal_usd: number | null;
  gdp_per_capita_usd: number | null;
  income_tier: string | null;
  diaspora_flag: string | null;
  est_african_descent_population_text: string | null;
  est_african_descent_population_num: number | null;
  diaspora_profile: string | null;
  diaspora_priority: string | null;
  landlocked: string | null;
  ecowas_status: string | null;
  afcfta_status: string | null;
  trade_bloc: string | null;
  business_language: string | null;
  notes: string | null;
  existing_buyer: string | null;
  import_duty_pct_text: string | null;
  est_annual_import_value_usd: number | null;
  local_competition: string | null;
  distributor_status: string | null;
  assigned_owner: string | null;
  market_size_score: number | null;
  access_ease_score: number | null;
  diaspora_fit_score: number | null;
  competition_score: number | null;
  weighted_score: number | null;
  priority_tier: string;
  confidence: string;
  last_reviewed_at: string | null;
  source_row_ref: string | null;
}

export interface MarketFilters {
  q?: string;
  continent?: string;
  tier?: string;
  income?: string;
  owner?: string;
}

export function listMarkets(f: MarketFilters): Market[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (f.q) {
    clauses.push("(country_normalised LIKE @q OR sub_region LIKE @q OR trade_bloc LIKE @q)");
    params.q = `%${f.q.toLowerCase()}%`;
  }
  if (f.continent) {
    clauses.push("continent = @continent");
    params.continent = f.continent;
  }
  if (f.tier) {
    clauses.push("priority_tier = @tier");
    params.tier = f.tier;
  }
  if (f.income) {
    clauses.push("income_tier = @income");
    params.income = f.income;
  }
  if (f.owner) {
    clauses.push("assigned_owner = @owner");
    params.owner = f.owner;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT * FROM markets ${where}
       ORDER BY (weighted_score IS NULL), weighted_score DESC, country ASC`
    )
    .all(params) as Market[];
}

export function getMarket(id: number): Market | undefined {
  return getDb().prepare(`SELECT * FROM markets WHERE id = ?`).get(id) as Market | undefined;
}

export interface ProvenanceRow {
  id: number;
  field_name: string | null;
  original_value: string | null;
  normalised_value: string | null;
  source_file: string | null;
  worksheet: string | null;
  source_ref: string | null;
  method: string;
  confidence: string | null;
  notes: string | null;
  imported_at: string;
}

export function getMarketProvenance(marketId: number): ProvenanceRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM research_sources
       WHERE entity_type = 'market' AND entity_id = ?
       ORDER BY field_name`
    )
    .all(marketId) as ProvenanceRow[];
}

export function getWorkbookNotes(): { field_name: string; original_value: string; worksheet: string; source_ref: string }[] {
  return getDb()
    .prepare(
      `SELECT field_name, original_value, worksheet, source_ref
       FROM research_sources WHERE entity_type = 'workbook' ORDER BY id`
    )
    .all() as { field_name: string; original_value: string; worksheet: string; source_ref: string }[];
}

export function getScoringConfig(): { config_key: string; config_value: string; description: string | null; source: string | null }[] {
  return getDb()
    .prepare(`SELECT config_key, config_value, description, source FROM scoring_config ORDER BY id`)
    .all() as { config_key: string; config_value: string; description: string | null; source: string | null }[];
}

export function getFilterOptions() {
  const db = getDb();
  const col = (sql: string) => (db.prepare(sql).all() as { v: string }[]).map((r) => r.v);
  return {
    continents: col(`SELECT DISTINCT continent v FROM markets WHERE continent IS NOT NULL ORDER BY continent`),
    tiers: col(`SELECT DISTINCT priority_tier v FROM markets ORDER BY priority_tier`),
    incomes: col(`SELECT DISTINCT income_tier v FROM markets WHERE income_tier IS NOT NULL ORDER BY income_tier`),
    owners: col(`SELECT DISTINCT assigned_owner v FROM markets WHERE assigned_owner IS NOT NULL ORDER BY assigned_owner`),
  };
}

export function getDashboardStats() {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    markets: one(`SELECT COUNT(*) n FROM markets`),
    scored: one(`SELECT COUNT(*) n FROM markets WHERE weighted_score IS NOT NULL`),
    companies: one(`SELECT COUNT(*) n FROM companies`),
    contacts: one(`SELECT COUNT(*) n FROM contacts`),
    leads: one(`SELECT COUNT(*) n FROM leads`),
    drafts: one(`SELECT COUNT(*) n FROM outreach_drafts`),
    provenance: one(`SELECT COUNT(*) n FROM research_sources`),
    byContinent: db
      .prepare(
        `SELECT continent, COUNT(*) n, SUM(population) pop, SUM(gdp_nominal_usd) gdp
         FROM markets GROUP BY continent ORDER BY n DESC`
      )
      .all() as { continent: string; n: number; pop: number; gdp: number }[],
    byTier: db
      .prepare(`SELECT priority_tier, COUNT(*) n FROM markets GROUP BY priority_tier ORDER BY n DESC`)
      .all() as { priority_tier: string; n: number }[],
    lastImport: (
      db.prepare(`SELECT MAX(imported_at) t FROM research_sources WHERE method IN ('imported','calculated')`).get() as { t: string | null }
    ).t,
  };
}
