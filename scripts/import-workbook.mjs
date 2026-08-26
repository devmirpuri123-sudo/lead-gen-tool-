/**
 * SACVIN GLOBAL PLASTICS LEAD ENGINE — workbook importer (Phase 1)
 *
 * Reads data/source/Countries_by_Continent.xlsx (READ-ONLY — never modified)
 * and loads:
 *   - markets            one row per country (195 expected)
 *   - scoring_config     weights, tier cut-offs, diaspora mapping (from the Scoring Guide sheet)
 *   - research_sources   field-level provenance for every imported/calculated value,
 *                        plus workbook-level caveats and scope notes
 *
 * Scoring rule (differs deliberately from the workbook): a weighted score is
 * only computed when ALL THREE manual scores (Market Size, Access Ease,
 * Competition) are present and valid (1-5). Partial input stays "Not scored".
 *
 * Re-runnable: clears previously imported/calculated rows first. Rows recorded
 * with method 'manual' or 'researched' are never deleted.
 */
import Database from "better-sqlite3";
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, "data", "source", "Countries_by_Continent.xlsx");
const SOURCE_NAME = "Countries_by_Continent.xlsx";
const DB_PATH = path.join(ROOT, "data", "app.db");
const SCHEMA_PATH = path.join(ROOT, "src", "lib", "db", "schema.sql");

const MAIN_SHEET = "Countries by Continent";
const GUIDE_SHEET = "Scoring Guide";
const SUMMARY_SHEET = "Summary";

const UNVERIFIED = "Unverified — requires human review";
const EST_CONF = "Estimate — refresh before external use";
const DIASPORA_CONF = "Estimate — order of magnitude only; country-level prioritisation input, never a personal targeting attribute";
const IMPORTED_CONF = "Imported — unverified";

// Column letter -> field mapping for the main sheet.
// method: how the value existed in the workbook (raw entry vs formula result).
const COLUMNS = {
  A: { field: "source_row_ref", method: "imported", conf: IMPORTED_CONF, header: "S. No." },
  B: { field: "country", method: "imported", conf: IMPORTED_CONF, header: "Country" },
  C: { field: "continent", method: "imported", conf: IMPORTED_CONF, header: "Continent" },
  D: { field: "sub_region", method: "imported", conf: IMPORTED_CONF, header: "Sub-Region" },
  E: { field: "population", method: "imported", conf: EST_CONF, header: "Population (2025 est.)", numeric: true },
  F: { field: "population_band", method: "calculated", conf: EST_CONF, header: "Population Band" },
  G: { field: "gdp_nominal_usd", method: "imported", conf: EST_CONF, header: "GDP Nominal, USD (2024)", numeric: true },
  H: { field: "gdp_per_capita_usd", method: "calculated", conf: EST_CONF, header: "GDP per Capita, USD", numeric: true },
  I: { field: "income_tier", method: "calculated", conf: EST_CONF, header: "Income Tier" },
  J: { field: "diaspora_flag", method: "imported", conf: DIASPORA_CONF, header: "African Diaspora (Yes/No)" },
  K: { field: "est_african_descent_population_text", method: "imported", conf: DIASPORA_CONF, header: "Est. African-Descent Population" },
  L: { field: "diaspora_profile", method: "imported", conf: DIASPORA_CONF, header: "Diaspora Profile" },
  M: { field: "diaspora_priority", method: "imported", conf: DIASPORA_CONF, header: "Diaspora Priority" },
  N: { field: "landlocked", method: "imported", conf: IMPORTED_CONF, header: "Landlocked" },
  O: { field: "ecowas_status", method: "imported", conf: IMPORTED_CONF, header: "ECOWAS Status" },
  P: { field: "afcfta_status", method: "imported", conf: IMPORTED_CONF, header: "AfCFTA" },
  Q: { field: "trade_bloc", method: "imported", conf: IMPORTED_CONF, header: "Trade Bloc / Market Access" },
  R: { field: "business_language", method: "imported", conf: IMPORTED_CONF, header: "Business Language" },
  S: { field: "notes", method: "imported", conf: IMPORTED_CONF, header: "Notes" },
  T: { field: "existing_buyer", method: "imported", conf: IMPORTED_CONF, header: "Existing Buyer? (Y/N)" },
  U: { field: "import_duty_pct_text", method: "imported", conf: IMPORTED_CONF, header: "Import Duty % (HS 3923/3924)" },
  V: { field: "est_annual_import_value_usd", method: "imported", conf: IMPORTED_CONF, header: "Est. Annual Import Value (USD)", numeric: true },
  W: { field: "local_competition", method: "imported", conf: IMPORTED_CONF, header: "Local Competition (H/M/L)" },
  X: { field: "distributor_status", method: "imported", conf: IMPORTED_CONF, header: "Distributor Status" },
  Y: { field: "assigned_owner", method: "calculated", conf: IMPORTED_CONF, header: "Assigned" },
  Z: { field: "market_size_score", method: "imported", conf: IMPORTED_CONF, header: "Market Size (1-5)", numeric: true },
  AA: { field: "access_ease_score", method: "imported", conf: IMPORTED_CONF, header: "Access Ease (1-5)", numeric: true },
  AB: { field: "diaspora_fit_score", method: "calculated", conf: DIASPORA_CONF, header: "Diaspora Fit (1-5)", numeric: true },
  AC: { field: "competition_score", method: "imported", conf: IMPORTED_CONF, header: "Competition (1-5)", numeric: true },
  // AD (Weighted Score) and AE (Priority Tier) are recomputed by this system
  // under the stricter all-three-scores rule; workbook cached values are kept
  // in provenance for audit.
};

function cellRaw(sheet, addr) {
  const c = sheet[addr];
  if (!c) return null;
  if (c.v === undefined || c.v === null) return null;
  if (typeof c.v === "string" && c.v.trim() === "") return null;
  return c.v;
}

function norm(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim().replace(/\s+/g, " ");
    return t === "" ? null : t;
  }
  return v;
}

/** Parse free-text diaspora population like "~0.25 m", "~50,000",
 *  "~3.3 m Afro-Arab + migrants". Returns null for "Negligible",
 *  "Source continent" and anything unparseable. */
function parseDiasporaPopulation(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();
  if (/^(negligible|source continent)/i.test(t)) return null;
  // Ranges like "~56-112 m" are ambiguous — keep the text, store no number.
  if (/\d\s*[-–]\s*\d/.test(t)) return null;
  const m = t.match(/^~?\s*([\d.,]+)\s*(m\b|m\+|million)?/i);
  if (!m || !m[1]) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  return m[2] ? num * 1_000_000 : num;
}

function isValidScore(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5;
}

// ---------------------------------------------------------------------------
console.log(`Reading ${SOURCE_FILE} (read-only)…`);
const buf = fs.readFileSync(SOURCE_FILE); // read into memory; file itself is never written
const wb = XLSX.read(buf, { type: "buffer" });

for (const s of [MAIN_SHEET, GUIDE_SHEET, SUMMARY_SHEET]) {
  if (!wb.SheetNames.includes(s)) {
    console.error(`FATAL: expected worksheet "${s}" not found. Found: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
}
const main = wb.Sheets[MAIN_SHEET];
const guide = wb.Sheets[GUIDE_SHEET];
const summary = wb.Sheets[SUMMARY_SHEET];

// --- scoring config from the Scoring Guide sheet ---------------------------
const weights = {
  market_size: cellRaw(guide, "B5"),
  access_ease: cellRaw(guide, "B6"),
  diaspora_fit: cellRaw(guide, "B7"),
  competition: cellRaw(guide, "B8"),
};
const cutoffs = {
  tier1: cellRaw(guide, "B11"),
  tier2: cellRaw(guide, "B12"),
  tier3: cellRaw(guide, "B13"),
};
for (const [k, v] of Object.entries({ ...weights, ...cutoffs })) {
  if (typeof v !== "number") {
    console.error(`FATAL: Scoring Guide value "${k}" is not a number (got ${JSON.stringify(v)}). Aborting — will not guess.`);
    process.exit(1);
  }
}
const weightSum = weights.market_size + weights.access_ease + weights.diaspora_fit + weights.competition;
if (Math.abs(weightSum - 1) > 1e-9) {
  console.error(`FATAL: scoring weights total ${weightSum}, expected 1.0. Aborting.`);
  process.exit(1);
}
const DIASPORA_MAP = { High: 5, Home: 4, Medium: 3, Low: 1 };

function computeTier(score) {
  if (score === null) return "Not scored";
  if (score >= cutoffs.tier1) return "Tier 1 - Priority";
  if (score >= cutoffs.tier2) return "Tier 2 - Develop";
  if (score >= cutoffs.tier3) return "Tier 3 - Monitor";
  return "Tier 4 - Deprioritise";
}

// --- open database ---------------------------------------------------------
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

const importedAt = new Date().toISOString();

const insertMarket = db.prepare(`
  INSERT INTO markets (
    country, country_normalised, continent, sub_region, population, population_band,
    gdp_nominal_usd, gdp_per_capita_usd, income_tier, diaspora_flag,
    est_african_descent_population_text, est_african_descent_population_num,
    diaspora_profile, diaspora_priority, landlocked, ecowas_status, afcfta_status,
    trade_bloc, business_language, notes, existing_buyer, import_duty_pct_text,
    est_annual_import_value_usd, local_competition, distributor_status, assigned_owner,
    market_size_score, access_ease_score, diaspora_fit_score, competition_score,
    weighted_score, priority_tier, confidence, source_row_ref, created_at, updated_at
  ) VALUES (
    @country, @country_normalised, @continent, @sub_region, @population, @population_band,
    @gdp_nominal_usd, @gdp_per_capita_usd, @income_tier, @diaspora_flag,
    @est_african_descent_population_text, @est_african_descent_population_num,
    @diaspora_profile, @diaspora_priority, @landlocked, @ecowas_status, @afcfta_status,
    @trade_bloc, @business_language, @notes, @existing_buyer, @import_duty_pct_text,
    @est_annual_import_value_usd, @local_competition, @distributor_status, @assigned_owner,
    @market_size_score, @access_ease_score, @diaspora_fit_score, @competition_score,
    @weighted_score, @priority_tier, @confidence, @source_row_ref, @now, @now
  )
`);

const insertProvenance = db.prepare(`
  INSERT INTO research_sources (
    entity_type, entity_id, field_name, original_value, normalised_value,
    source_file, worksheet, source_ref, method, confidence, notes, imported_at
  ) VALUES (
    @entity_type, @entity_id, @field_name, @original_value, @normalised_value,
    @source_file, @worksheet, @source_ref, @method, @confidence, @notes, @imported_at
  )
`);

const insertConfig = db.prepare(`
  INSERT INTO scoring_config (config_key, config_value, description, source, updated_at)
  VALUES (@key, @value, @description, @source, @now)
  ON CONFLICT(config_key) DO UPDATE SET
    config_value = excluded.config_value,
    description = excluded.description,
    source = excluded.source,
    updated_at = excluded.updated_at
`);

const warnings = [];
let marketCount = 0;
let provenanceCount = 0;
let diasporaFitMismatches = 0;

const runImport = db.transaction(() => {
  // Clear previous imported data only. Manual/researched provenance survives.
  db.prepare(`DELETE FROM research_sources WHERE method IN ('imported','calculated') AND entity_type IN ('market','workbook','scoring_config')`).run();
  db.prepare(`DELETE FROM markets`).run();

  // --- scoring config ---
  const cfgRows = [
    ["weight_market_size", weights.market_size, "Weight for Market Size (1-5) score", `${GUIDE_SHEET}!B5`],
    ["weight_access_ease", weights.access_ease, "Weight for Access Ease (1-5) score", `${GUIDE_SHEET}!B6`],
    ["weight_diaspora_fit", weights.diaspora_fit, "Weight for Diaspora Fit (1-5) score", `${GUIDE_SHEET}!B7`],
    ["weight_competition", weights.competition, "Weight for Competition (1-5) score", `${GUIDE_SHEET}!B8`],
    ["tier1_cutoff", cutoffs.tier1, "Weighted score >= this => Tier 1 - Priority", `${GUIDE_SHEET}!B11`],
    ["tier2_cutoff", cutoffs.tier2, "Weighted score >= this => Tier 2 - Develop", `${GUIDE_SHEET}!B12`],
    ["tier3_cutoff", cutoffs.tier3, "Weighted score >= this => Tier 3 - Monitor", `${GUIDE_SHEET}!B13`],
    ["tier4_label", "Tier 4 - Deprioritise", "Label for weighted score below tier3 cut-off (kept per approval, 2026-08-26)", "Workbook Priority Tier formula"],
    ["diaspora_fit_map", JSON.stringify(DIASPORA_MAP), "Diaspora Priority -> Diaspora Fit score mapping", "Workbook Diaspora Fit formula (col AB)"],
    ["require_all_scores", "true", "Weighted score requires ALL of market size, access ease and competition (differs from workbook, which scores on partial input)", "Approved decision, 2026-08-26"],
  ];
  for (const [key, value, description, source] of cfgRows) {
    insertConfig.run({ key, value: String(value), description, source, now: importedAt });
    insertProvenance.run({
      entity_type: "scoring_config", entity_id: null, field_name: key,
      original_value: String(value), normalised_value: String(value),
      source_file: SOURCE_NAME, worksheet: source.startsWith(GUIDE_SHEET) ? GUIDE_SHEET : null,
      source_ref: source, method: "imported", confidence: "Confirmed against workbook",
      notes: null, imported_at: importedAt,
    });
    provenanceCount++;
  }

  // --- markets ---
  const range = XLSX.utils.decode_range(main["!ref"]);
  for (let r = 2; r <= range.e.r + 1; r++) {
    const raw = {};
    for (const [letter, spec] of Object.entries(COLUMNS)) {
      raw[spec.field] = { value: cellRaw(main, `${letter}${r}`), letter, spec };
    }
    const country = norm(raw.country.value);
    if (!country) continue; // skip fully blank rows

    const m = {};
    for (const [field, { value, spec }] of Object.entries(raw)) {
      m[field] = spec.numeric ? (typeof value === "number" ? value : null) : norm(value);
      if (spec.numeric && value !== null && typeof value !== "number") {
        warnings.push(`Row ${r} (${country}): "${spec.header}" is not numeric (${JSON.stringify(value)}); stored as NULL.`);
      }
    }
    m.source_row_ref = raw.source_row_ref.value !== null ? String(raw.source_row_ref.value) : null;
    m.country_normalised = country.toLowerCase();
    m.est_african_descent_population_num = parseDiasporaPopulation(m.est_african_descent_population_text);

    // Cross-check diaspora fit: recompute from mapping, compare with workbook.
    const expectedFit = m.diaspora_priority ? DIASPORA_MAP[m.diaspora_priority] ?? null : null;
    if (m.diaspora_priority && expectedFit === null) {
      warnings.push(`Row ${r} (${country}): unexpected Diaspora Priority "${m.diaspora_priority}" — Diaspora Fit left NULL.`);
      m.diaspora_fit_score = null;
    } else if (expectedFit !== m.diaspora_fit_score) {
      diasporaFitMismatches++;
      warnings.push(`Row ${r} (${country}): workbook Diaspora Fit ${m.diaspora_fit_score} != mapped ${expectedFit}; using mapped value.`);
      m.diaspora_fit_score = expectedFit;
    }

    // Score validation (1-5) — invalid values are nulled with a warning.
    for (const f of ["market_size_score", "access_ease_score", "competition_score"]) {
      if (m[f] !== null && !isValidScore(m[f])) {
        warnings.push(`Row ${r} (${country}): invalid ${f} ${m[f]} (must be 1-5); stored as NULL.`);
        m[f] = null;
      }
    }

    // Weighted score: STRICT rule — all three manual scores required.
    const haveAll = [m.market_size_score, m.access_ease_score, m.competition_score].every((v) => v !== null);
    if (haveAll) {
      const fit = m.diaspora_fit_score ?? 0;
      m.weighted_score = Math.round(
        (m.market_size_score * weights.market_size +
          m.access_ease_score * weights.access_ease +
          fit * weights.diaspora_fit +
          m.competition_score * weights.competition) * 100
      ) / 100;
    } else {
      m.weighted_score = null;
    }
    m.priority_tier = computeTier(m.weighted_score);
    m.confidence = "Estimate — imported planning data, refresh before external use";
    m.now = importedAt;

    const info = insertMarket.run(m);
    const marketId = info.lastInsertRowid;
    marketCount++;

    // Field-level provenance for every non-empty workbook value.
    for (const [field, { value, letter, spec }] of Object.entries(raw)) {
      if (value === null) continue;
      insertProvenance.run({
        entity_type: "market", entity_id: marketId, field_name: field,
        original_value: String(value),
        normalised_value: m[field] === null || m[field] === undefined ? null : String(m[field]),
        source_file: SOURCE_NAME, worksheet: MAIN_SHEET, source_ref: `${letter}${r}`,
        method: spec.method, confidence: spec.conf, notes: null, imported_at: importedAt,
      });
      provenanceCount++;
    }
    // Parsed diaspora number is our own calculation — record it as such.
    if (m.est_african_descent_population_num !== null) {
      insertProvenance.run({
        entity_type: "market", entity_id: marketId, field_name: "est_african_descent_population_num",
        original_value: String(m.est_african_descent_population_text),
        normalised_value: String(m.est_african_descent_population_num),
        source_file: SOURCE_NAME, worksheet: MAIN_SHEET, source_ref: `K${r}`,
        method: "calculated", confidence: DIASPORA_CONF,
        notes: "Parsed by importer from free-text estimate", imported_at: importedAt,
      });
      provenanceCount++;
    }
    // Workbook's own cached Weighted Score / Priority Tier, kept for audit.
    const wbScore = cellRaw(main, `AD${r}`);
    const wbTier = cellRaw(main, `AE${r}`);
    if (wbScore !== null || wbTier !== null) {
      insertProvenance.run({
        entity_type: "market", entity_id: marketId, field_name: "workbook_weighted_score_and_tier",
        original_value: JSON.stringify({ weighted_score: wbScore, priority_tier: wbTier }),
        normalised_value: JSON.stringify({ weighted_score: m.weighted_score, priority_tier: m.priority_tier }),
        source_file: SOURCE_NAME, worksheet: MAIN_SHEET, source_ref: `AD${r}:AE${r}`,
        method: "calculated", confidence: IMPORTED_CONF,
        notes: "Workbook cached value; system recomputes under the all-three-scores rule",
        imported_at: importedAt,
      });
      provenanceCount++;
    }
  }

  // --- workbook-level caveats (Scoring Guide rows 40-46, Summary rows 13-16) ---
  for (let r = 40; r <= 46; r++) {
    const text = norm(cellRaw(guide, `A${r}`));
    if (!text) continue;
    insertProvenance.run({
      entity_type: "workbook", entity_id: null, field_name: "caveat",
      original_value: text, normalised_value: text,
      source_file: SOURCE_NAME, worksheet: GUIDE_SHEET, source_ref: `A${r}`,
      method: "imported", confidence: "Author caveat — treat as guidance", notes: null, imported_at: importedAt,
    });
    provenanceCount++;
  }
  for (let r = 13; r <= 16; r++) {
    const text = norm(cellRaw(summary, `A${r}`));
    if (!text) continue;
    insertProvenance.run({
      entity_type: "workbook", entity_id: null, field_name: "scope",
      original_value: text, normalised_value: text,
      source_file: SOURCE_NAME, worksheet: SUMMARY_SHEET, source_ref: `A${r}`,
      method: "imported", confidence: "Author scope note", notes: null, imported_at: importedAt,
    });
    provenanceCount++;
  }
});

runImport();

const tierCounts = db.prepare(`SELECT priority_tier, COUNT(*) n FROM markets GROUP BY priority_tier ORDER BY n DESC`).all();
const continentCounts = db.prepare(`SELECT continent, COUNT(*) n FROM markets GROUP BY continent ORDER BY n DESC`).all();

console.log(JSON.stringify({
  imported_at: importedAt,
  source_file: SOURCE_NAME,
  markets_imported: marketCount,
  provenance_rows: provenanceCount,
  diaspora_fit_mismatches: diasporaFitMismatches,
  tier_counts: tierCounts,
  continent_counts: continentCounts,
  warnings_count: warnings.length,
  warnings: warnings.slice(0, 20),
}, null, 2));
db.close();
