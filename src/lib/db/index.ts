import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "app.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "db", "schema.sql");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  migrate(db);
  return db;
}

// Additive migrations for databases created before a column existed.
function migrate(db: Database.Database) {
  const cols = (db.prepare(`PRAGMA table_info(markets)`).all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("scored_by")) db.exec(`ALTER TABLE markets ADD COLUMN scored_by TEXT`);
  if (!cols.includes("scored_at")) db.exec(`ALTER TABLE markets ADD COLUMN scored_at TEXT`);
  const draftCols = (db.prepare(`PRAGMA table_info(outreach_drafts)`).all() as { name: string }[]).map((c) => c.name);
  for (const col of ["template_key", "created_by", "approved_by", "approved_at", "sent_by", "sent_at"]) {
    if (!draftCols.includes(col)) db.exec(`ALTER TABLE outreach_drafts ADD COLUMN ${col} TEXT`);
  }
  // Enrichment fields (SACVIN Export Lead Enrichment workbook).
  const companyCols = (db.prepare(`PRAGMA table_info(companies)`).all() as { name: string }[]).map((c) => c.name);
  const companyReal = ["est_annual_revenue_usd", "import_volume_ctnrs_yr", "import_value_usd_yr", "est_opportunity_usd"];
  const companyText = [
    "external_ref", "record_status", "added_by", "region", "city", "product_categories",
    "category_match", "own_brand", "year_established", "employees_band", "company_size",
    "outlets", "linkedin_company_url", "imports_flag", "hs_codes", "source_countries",
    "competing_origin", "known_suppliers", "container_type", "import_frequency",
    "last_known_shipment", "displacement_opportunity", "import_data_source", "discharge_port",
    "preferential_access", "compliance_certs", "language", "priority_products",
    "lead_source_tool", "date_pulled", "verified_by", "verification_date",
  ];
  for (const col of companyText) if (!companyCols.includes(col)) db.exec(`ALTER TABLE companies ADD COLUMN ${col} TEXT`);
  for (const col of companyReal) if (!companyCols.includes(col)) db.exec(`ALTER TABLE companies ADD COLUMN ${col} REAL`);
  const contactCols = (db.prepare(`PRAGMA table_info(contacts)`).all() as { name: string }[]).map((c) => c.name);
  for (const col of ["external_ref", "contact_function", "decision_role", "email_status", "whatsapp", "language", "best_time_to_call", "source_tool", "date_pulled", "verified_flag"]) {
    if (!contactCols.includes(col)) db.exec(`ALTER TABLE contacts ADD COLUMN ${col} TEXT`);
  }
}

export const UNKNOWN_LABEL = "Unknown — requires research";
export const UNVERIFIED_LABEL = "Unverified — requires human review";
