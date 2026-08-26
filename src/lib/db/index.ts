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
}

export const UNKNOWN_LABEL = "Unknown — requires research";
export const UNVERIFIED_LABEL = "Unverified — requires human review";
