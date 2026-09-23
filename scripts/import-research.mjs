#!/usr/bin/env node
/**
 * Load researched market facts (import value, import duty, local competition)
 * into the markets table, with full provenance.
 *
 * These are the amber "Research inputs" the workbook deliberately leaves blank.
 * Filling them is what lets the app suggest Market Size, Access Ease and
 * Competition scores instead of asking a person to type all three by hand.
 *
 *   node scripts/import-research.mjs [file.csv] [--overwrite]
 *
 * By default an existing value is never replaced — re-running is safe and will
 * only fill gaps. Pass --overwrite to replace values that are already there.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const args = process.argv.slice(2);
const overwrite = args.includes("--overwrite");
const file = args.find((a) => !a.startsWith("--")) ?? "data/research/europe-market-research.csv";
const DB_PATH = process.env.DATABASE_PATH?.trim()
  ? path.resolve(process.env.DATABASE_PATH.trim())
  : path.join(process.cwd(), "data", "app.db");

if (!fs.existsSync(file)) {
  console.error(`Research file not found: ${file}`);
  process.exit(1);
}
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}. Run: npm run import:workbook`);
  process.exit(1);
}

/** Minimal RFC-4180 CSV parser (same rules as the app's importer). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const rows = parseCsv(fs.readFileSync(file, "utf8"));
const header = rows[0].map((h) => h.trim().toLowerCase());
const idx = (name) => header.indexOf(name);
const iCountry = idx("country");
if (iCountry === -1) {
  console.error('The CSV must have a "country" column.');
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const findMarket = db.prepare(`SELECT * FROM markets WHERE country_normalised = ?`);
const insertProv = db.prepare(
  `INSERT INTO research_sources (entity_type, entity_id, field_name, original_value, normalised_value, source_file, worksheet, source_ref, method, confidence, notes, imported_at)
   VALUES ('market', @id, @field, @orig, @val, @source, NULL, NULL, 'researched', 'Unverified — requires human review', @notes, @now)`
);

const FIELDS = [
  { col: "est_annual_import_value_usd", db: "est_annual_import_value_usd", numeric: true, sourceCol: "value_source" },
  { col: "import_duty_pct_text", db: "import_duty_pct_text", sourceCol: "duty_source" },
  { col: "local_competition", db: "local_competition", sourceCol: "competition_basis" },
];

const now = new Date().toISOString();
const sourceFile = path.basename(file);
let filled = 0, kept = 0, unmatched = [];

const tx = db.transaction(() => {
  for (const r of rows.slice(1)) {
    const country = (r[iCountry] ?? "").trim();
    if (!country) continue;
    const market = findMarket.get(country.toLowerCase());
    if (!market) { unmatched.push(country); continue; }

    const sets = [];
    const vals = [];
    for (const f of FIELDS) {
      const ci = idx(f.col);
      if (ci === -1) continue;
      const raw = (r[ci] ?? "").trim();
      if (raw === "") continue;
      const value = f.numeric ? Number(raw) : raw;
      if (f.numeric && !Number.isFinite(value)) continue;

      const before = market[f.db];
      const hasValue = before !== null && before !== undefined && String(before).trim() !== "";
      if (hasValue && !overwrite) { kept++; continue; }
      if (String(before ?? "") === String(value)) continue;

      sets.push(`${f.db} = ?`);
      vals.push(value);
      const si = f.sourceCol ? idx(f.sourceCol) : -1;
      const note = si !== -1 ? (r[si] ?? "").trim() : "";
      insertProv.run({
        id: market.id,
        field: f.db,
        orig: hasValue ? String(before) : null,
        val: String(value),
        source: sourceFile,
        notes: note || "Researched from public trade data",
        now,
      });
      filled++;
    }
    if (sets.length) {
      db.prepare(`UPDATE markets SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(...vals, now, market.id);
    }
  }
});

console.log(`Reading ${file} …`);
tx();
console.log(
  JSON.stringify(
    {
      file: sourceFile,
      values_filled: filled,
      values_kept_existing: kept,
      unmatched_countries: unmatched,
      note: overwrite
        ? "Existing values were replaced (--overwrite)."
        : "Existing values were left untouched. Re-run with --overwrite to replace them.",
    },
    null,
    2
  )
);
db.close();
