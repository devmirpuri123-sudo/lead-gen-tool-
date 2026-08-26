"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { getDb } from "@/lib/db";
import { checkDuplicate, normalizeName, type ExistingCompany } from "@/lib/dedupe";
import { COMPANY_TYPES, EMAIL_RE } from "@/lib/pipeline";

const IMPORT_CONF = "Imported — unverified, requires human review";

/** The three worked-example rows the workbook ships with (its READ ME says to
 *  delete them). They are fictional and must never enter the database. */
const SHIPPED_EXAMPLES = new Set([
  "SAC/LEAD/0001|kenmart distributors ltd",
  "SAC/LEAD/0002|gulf home trading llc",
  "SAC/LEAD/0003|suva homeware imports pte",
]);
const SHIPPED_EXAMPLE_CONTACTS = new Set(["SAC/CON/0001", "SAC/CON/0002", "SAC/CON/0003", "SAC/CON/0004"]);

/** LEAD MASTER header (row 2) -> companies column. */
const COMPANY_MAP: Record<string, { col: string; numeric?: boolean }> = {
  "lead id": { col: "external_ref" },
  "added by": { col: "added_by" },
  "record status": { col: "record_status" },
  "company name *": { col: "name" },
  "website *": { col: "website" },
  "region": { col: "region" },
  "city": { col: "city" },
  "business type *": { col: "company_type" },
  "product categories handled": { col: "product_categories" },
  "category match *": { col: "category_match" },
  "own brand / private label": { col: "own_brand" },
  "year established": { col: "year_established" },
  "employees": { col: "employees_band" },
  "est. annual revenue (usd)": { col: "est_annual_revenue_usd", numeric: true },
  "company size *": { col: "company_size" },
  "outlets / branches": { col: "outlets" },
  "linkedin company url": { col: "linkedin_company_url" },
  "what they do (one line)": { col: "description" },
  "imports? *": { col: "imports_flag" },
  "hs codes handled": { col: "hs_codes" },
  "current source countries": { col: "source_countries" },
  "competing origin sourced? *": { col: "competing_origin" },
  "known current suppliers": { col: "known_suppliers" },
  "est. import volume (ctnrs/yr)": { col: "import_volume_ctnrs_yr", numeric: true },
  "est. import value (usd/yr)": { col: "import_value_usd_yr", numeric: true },
  "typical container type": { col: "container_type" },
  "import frequency": { col: "import_frequency" },
  "last known shipment": { col: "last_known_shipment" },
  "displacement opportunity": { col: "displacement_opportunity" },
  "import data source": { col: "import_data_source" },
  "nearest discharge port": { col: "discharge_port" },
  "preferential access": { col: "preferential_access" },
  "compliance / certification": { col: "compliance_certs" },
  "language": { col: "language" },
  "priority sacvin products": { col: "priority_products" },
  "est. opportunity (usd/yr)": { col: "est_opportunity_usd", numeric: true },
  "lead source tool": { col: "lead_source_tool" },
  "date pulled": { col: "date_pulled" },
  "verified by": { col: "verified_by" },
  "verification date": { col: "verification_date" },
  "notes": { col: "notes" },
};

/** LEAD MASTER group-5 headers -> primary contact fields. */
const PRIMARY_CONTACT_MAP: Record<string, string> = {
  "contact name *": "full_name",
  "job title *": "role_title",
  "decision role": "decision_role",
  "email *": "email",
  "email status": "email_status",
  "phone *": "phone",
  "whatsapp": "whatsapp",
  "linkedin profile url": "linkedin_url",
  "contact source tool": "source_tool",
};

/** CONTACTS sheet header (row 4) -> contacts column. */
const CONTACT_MAP: Record<string, string> = {
  "contact id": "external_ref",
  "full name": "full_name",
  "job title": "role_title",
  "function": "contact_function",
  "decision role": "decision_role",
  "email": "email",
  "email status": "email_status",
  "phone": "phone",
  "whatsapp": "whatsapp",
  "linkedin profile url": "linkedin_url",
  "language": "language",
  "best time to call": "best_time_to_call",
  "source tool": "source_tool",
  "date pulled": "date_pulled",
  "verified?": "verified_flag",
  "notes": "notes",
};

function fail(message: string): never {
  redirect(`/companies/import?error=${encodeURIComponent(message)}`);
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim().replace(/\s+/g, " ");
  return s === "" ? null : s;
}

function cleanNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = clean(v);
  if (!s) return null;
  const n = parseFloat(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

interface Report {
  file: string;
  imported_by: string;
  imported_at: string;
  total_rows: number;
  companies_created: number;
  contacts_created: number;
  leads_created: number;
  scoring_config_imported: boolean;
  skipped: string[];
  flagged: string[];
  unknown_columns: string[];
}

export async function importEnrichmentXlsx(formData: FormData) {
  const db = getDb();
  const who = String(formData.get("entered_by") ?? "").trim().slice(0, 60);
  if (!who) fail("Please enter your name — every import is recorded with who ran it and when.");
  const makeLeads = formData.get("create_leads") === "on";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail("Choose the Excel workbook first.");
  if (file.size > 10_000_000) fail("That file is over 10 MB — check it is the right workbook.");

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
  } catch {
    fail("That file could not be read as an Excel workbook (.xlsx).");
  }
  const leadSheet = wb.Sheets["LEAD MASTER"];
  if (!leadSheet) fail(`No "LEAD MASTER" worksheet found — is this the SACVIN Export Lead Enrichment workbook? Sheets present: ${wb.SheetNames.join(", ")}.`);
  const contactSheet = wb.Sheets["CONTACTS"] ?? null;
  const scoringSheet = wb.Sheets["SCORING"] ?? null;

  const cell = (sheet: XLSX.WorkSheet, addr: string) => {
    const c = sheet[addr];
    return c && c.v !== undefined && c.v !== null ? c.v : null;
  };

  // Header row 2 of LEAD MASTER, by column letter.
  const range = XLSX.utils.decode_range(leadSheet["!ref"] ?? "A1:A1");
  const headers = new Map<number, string>(); // col index -> lowercased header
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = clean(cell(leadSheet, XLSX.utils.encode_cell({ r: 1, c })));
    if (h) headers.set(c, h.toLowerCase());
  }
  const known = new Set([...Object.keys(COMPANY_MAP), ...Object.keys(PRIMARY_CONTACT_MAP), "country *", "date added", "data completeness", "duplicate flag", "fit score", "tier", "next step"]);
  const unknownCols = [...headers.values()].filter((h) => !known.has(h));
  if (![...headers.values()].includes("company name *")) {
    fail(`Row 2 of LEAD MASTER should hold the column names ("Company Name *" etc.) — they were not found. Has the sheet layout been changed?`);
  }

  const now = new Date().toISOString();
  const existing = db.prepare(`SELECT id, name, name_normalised, website FROM companies`).all() as ExistingCompany[];
  const existingRefs = new Set(
    (db.prepare(`SELECT external_ref v FROM companies WHERE external_ref IS NOT NULL`).all() as { v: string }[]).map((r) => r.v)
  );
  const report: Report = {
    file: file.name, imported_by: who, imported_at: now, total_rows: 0,
    companies_created: 0, contacts_created: 0, leads_created: 0,
    scoring_config_imported: false, skipped: [], flagged: [], unknown_columns: unknownCols,
  };

  const prov = db.prepare(
    `INSERT INTO research_sources (entity_type, entity_id, field_name, original_value, normalised_value, source_file, worksheet, source_ref, method, confidence, notes, imported_at)
     VALUES (@entity_type, @entity_id, @field, @orig, @val, @source_file, @worksheet, @source_ref, 'imported', @confidence, @notes, @now)`
  );
  const leadIdToCompany = new Map<string, { companyId: number; contactId: number | null; marketId: number | null }>();

  const tx = db.transaction(() => {
    // --- ICP scoring config from the SCORING sheet (skip manually changed keys) ---
    if (scoringSheet) {
      const readMap = (rows: [number, number][], keyRow: number[] = []) => {
        void keyRow;
        const map: Record<string, number> = {};
        for (const [start, end] of rows) {
          for (let r = start; r <= end; r++) {
            const k = clean(cell(scoringSheet, `B${r}`));
            const v = cleanNum(cell(scoringSheet, `C${r}`));
            if (k && v !== null) map[k.toLowerCase()] = v;
          }
        }
        return map;
      };
      const cfgRows: [string, string, string][] = [
        ["icp_business_type_points", JSON.stringify(readMap([[6, 15]])), "SCORING!B6:C15"],
        ["icp_imports_points", JSON.stringify(readMap([[18, 20]])), "SCORING!B18:C20"],
        ["icp_competing_origin_points", JSON.stringify(readMap([[23, 26]])), "SCORING!B23:C26"],
        ["icp_company_size_points", JSON.stringify(readMap([[29, 32]])), "SCORING!B29:C32"],
        ["icp_category_match_points", JSON.stringify(readMap([[35, 37]])), "SCORING!B35:C37"],
        ["icp_contact_quality_points", JSON.stringify({
          verified_decision_maker: cleanNum(cell(scoringSheet, "C40")) ?? 10,
          verified_other: cleanNum(cell(scoringSheet, "C41")) ?? 7,
          unverified: cleanNum(cell(scoringSheet, "C42")) ?? 4,
        }), "SCORING!C40:C42"],
        ["icp_tier_thresholds", JSON.stringify({
          A: cleanNum(cell(scoringSheet, "C46")) ?? 75,
          B: cleanNum(cell(scoringSheet, "C47")) ?? 60,
          C: cleanNum(cell(scoringSheet, "C48")) ?? 40,
        }), "SCORING!C46:C48"],
      ];
      const manual = new Set(
        (db.prepare(`SELECT config_key FROM scoring_config WHERE source LIKE 'Lead Engine app%'`).all() as { config_key: string }[]).map((r) => r.config_key)
      );
      const upsert = db.prepare(
        `INSERT INTO scoring_config (config_key, config_value, description, source, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, source = excluded.source, updated_at = excluded.updated_at`
      );
      for (const [key, value, source] of cfgRows) {
        if (manual.has(key)) { report.flagged.push(`Scoring setting "${key}" kept its manually changed value; workbook value not applied.`); continue; }
        upsert.run(key, value, "ICP fit-score model (Export Lead Enrichment workbook)", `${file.name} ${source}`, now);
      }
      report.scoring_config_imported = true;
    }

    // --- LEAD MASTER rows (data starts row 3) ---
    for (let r = 2; r <= range.e.r; r++) {
      const get = (headerName: string) => {
        for (const [c, h] of headers) if (h === headerName) return cell(leadSheet, XLSX.utils.encode_cell({ r, c }));
        return null;
      };
      const name = clean(get("company name *"));
      if (!name) continue;
      report.total_rows++;
      const rowNum = r + 1;
      const leadRef = clean(get("lead id"));

      if (leadRef && SHIPPED_EXAMPLES.has(`${leadRef}|${name.toLowerCase()}`)) {
        report.skipped.push(`Row ${rowNum}: "${name}" is one of the workbook's shipped worked examples (its READ ME says to delete them) — skipped.`);
        continue;
      }
      if (leadRef && existingRefs.has(leadRef)) {
        report.skipped.push(`Row ${rowNum}: Lead ID ${leadRef} ("${name}") is already in the database — skipped.`);
        continue;
      }
      const website = clean(get("website *"));
      const verdict = checkDuplicate(name, website, existing);
      if (verdict.level === "duplicate") {
        report.skipped.push(`Row ${rowNum}: "${name}" already exists in the database (${verdict.reason}, matches "${verdict.matchName}") — skipped.`);
        continue;
      }
      if (verdict.level === "possible") {
        report.flagged.push(`Row ${rowNum}: "${name}" is a possible duplicate of "${verdict.matchName}" (${verdict.reason}) — imported; please review.`);
      }

      const country = clean(get("country *"));
      let marketId: number | null = null;
      if (country) {
        const m = db.prepare(`SELECT id FROM markets WHERE country_normalised = ?`).get(country.toLowerCase()) as { id: number } | undefined;
        if (m) marketId = m.id;
        else {
          // Try common short forms via LIKE (e.g. "UAE" fails; report it).
          report.flagged.push(`Row ${rowNum}: country "${country}" did not match a market — imported without a market link. Fix the country on the company page (markets use full names, e.g. "United Arab Emirates").`);
        }
      }

      const values: Record<string, string | number | null> = {};
      for (const [header, spec] of Object.entries(COMPANY_MAP)) {
        const raw = get(header);
        values[spec.col] = spec.numeric ? cleanNum(raw) : clean(raw);
      }
      let companyType = typeof values.company_type === "string" ? values.company_type.toLowerCase() : null;
      if (companyType && !(COMPANY_TYPES as readonly string[]).includes(companyType)) {
        report.flagged.push(`Row ${rowNum}: business type "${companyType}" is not in the standard list — stored as given; check it.`);
      }
      values.company_type = companyType;

      const info = db
        .prepare(
          `INSERT INTO companies (market_id, name, name_normalised, website, company_type, description, status, confidence, notes,
             external_ref, record_status, added_by, region, city, product_categories, category_match, own_brand, year_established,
             employees_band, est_annual_revenue_usd, company_size, outlets, linkedin_company_url, imports_flag, hs_codes,
             source_countries, competing_origin, known_suppliers, import_volume_ctnrs_yr, import_value_usd_yr, container_type,
             import_frequency, last_known_shipment, displacement_opportunity, import_data_source, discharge_port,
             preferential_access, compliance_certs, language, priority_products, est_opportunity_usd, lead_source_tool,
             date_pulled, verified_by, verification_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'Imported', ?, ?,
             ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?)`
        )
        .run(
          marketId, name, normalizeName(name), website, values.company_type, values.description, IMPORT_CONF, values.notes,
          values.external_ref, values.record_status, values.added_by, values.region, values.city, values.product_categories,
          values.category_match, values.own_brand, values.year_established,
          values.employees_band, values.est_annual_revenue_usd, values.company_size, values.outlets, values.linkedin_company_url,
          values.imports_flag, values.hs_codes,
          values.source_countries, values.competing_origin, values.known_suppliers, values.import_volume_ctnrs_yr,
          values.import_value_usd_yr, values.container_type,
          values.import_frequency, values.last_known_shipment, values.displacement_opportunity, values.import_data_source,
          values.discharge_port,
          values.preferential_access, values.compliance_certs, values.language, values.priority_products,
          values.est_opportunity_usd, values.lead_source_tool,
          values.date_pulled, values.verified_by, values.verification_date, now, now
        );
      const companyId = Number(info.lastInsertRowid);
      report.companies_created++;
      existing.push({ id: companyId, name, name_normalised: normalizeName(name), website });
      if (values.external_ref) existingRefs.add(String(values.external_ref));

      for (const [field, val] of Object.entries({ ...values, name, website, country })) {
        if (val === null || val === undefined) continue;
        prov.run({
          entity_type: "company", entity_id: companyId, field, orig: String(val), val: String(val),
          source_file: file.name, worksheet: "LEAD MASTER", source_ref: `row ${rowNum}`,
          confidence: IMPORT_CONF, notes: `Enrichment import by ${who}`, now,
        });
      }

      // Primary contact (group 5)
      let contactId: number | null = null;
      const contactName = clean(get("contact name *"));
      if (contactName) {
        const cvals: Record<string, string | null> = {};
        for (const [header, col] of Object.entries(PRIMARY_CONTACT_MAP)) cvals[col] = clean(get(header));
        if (cvals.email && !EMAIL_RE.test(cvals.email)) {
          report.flagged.push(`Row ${rowNum}: contact email "${cvals.email}" is invalid — contact imported without an email.`);
          cvals.email = null;
          cvals.email_status = null;
        }
        const cinfo = db
          .prepare(
            `INSERT INTO contacts (company_id, full_name, role_title, email, phone, linkedin_url, confidence,
               decision_role, email_status, whatsapp, source_tool, date_pulled, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(companyId, contactName, cvals.role_title, cvals.email, cvals.phone, cvals.linkedin_url, IMPORT_CONF,
            cvals.decision_role, cvals.email_status, cvals.whatsapp, cvals.source_tool, clean(get("date pulled")), now, now);
        contactId = Number(cinfo.lastInsertRowid);
        report.contacts_created++;
        for (const [field, val] of Object.entries({ full_name: contactName, ...cvals })) {
          if (val === null) continue;
          prov.run({
            entity_type: "contact", entity_id: contactId, field, orig: String(val), val: String(val),
            source_file: file.name, worksheet: "LEAD MASTER", source_ref: `row ${rowNum}`,
            confidence: IMPORT_CONF, notes: `Enrichment import by ${who}`, now,
          });
        }
      }

      if (leadRef) leadIdToCompany.set(leadRef, { companyId, contactId, marketId });

      if (makeLeads) {
        const nextStep = clean(get("next step"));
        const linfo = db
          .prepare(
            `INSERT INTO leads (company_id, contact_id, market_id, status, owner, next_action, created_at, updated_at)
             VALUES (?, ?, ?, 'Imported', ?, ?, ?, ?)`
          )
          .run(companyId, contactId, marketId, values.added_by ?? who, nextStep, now, now);
        db.prepare(`INSERT INTO activities (lead_id, activity_type, description, created_at) VALUES (?, 'status_change', ?, ?)`).run(
          Number(linfo.lastInsertRowid), `Lead created with status "Imported" from ${file.name} by ${who}`, now
        );
        report.leads_created++;
        // The workbook's own cached fit score/tier, kept for audit; the app recomputes live.
        const wbScore = clean(get("fit score"));
        const wbTier = clean(get("tier"));
        if (wbScore || wbTier) {
          prov.run({
            entity_type: "company", entity_id: companyId, field: "workbook_fit_score_and_tier",
            orig: JSON.stringify({ fit_score: wbScore, tier: wbTier }), val: null,
            source_file: file.name, worksheet: "LEAD MASTER", source_ref: `row ${rowNum}`,
            confidence: IMPORT_CONF, notes: "Workbook cached value; the app recomputes the ICP score live", now,
          });
        }
      }
    }

    // --- CONTACTS sheet (header row 4, data from row 5) ---
    if (contactSheet) {
      const crange = XLSX.utils.decode_range(contactSheet["!ref"] ?? "A1:A1");
      const cheaders = new Map<number, string>();
      for (let c = crange.s.c; c <= crange.e.c; c++) {
        const h = clean(cell(contactSheet, XLSX.utils.encode_cell({ r: 3, c })));
        if (h) cheaders.set(c, h.toLowerCase());
      }
      for (let r = 4; r <= crange.e.r; r++) {
        const get = (headerName: string) => {
          for (const [c, h] of cheaders) if (h === headerName) return cell(contactSheet, XLSX.utils.encode_cell({ r, c }));
          return null;
        };
        const fullName = clean(get("full name"));
        if (!fullName) continue;
        const rowNum = r + 1;
        const ref = clean(get("contact id"));
        if (ref && SHIPPED_EXAMPLE_CONTACTS.has(ref) && ["David Kamau", "Fatima Al Balushi"].some((n) => fullName.startsWith(n.split(" ")[0]))) {
          report.skipped.push(`CONTACTS row ${rowNum}: "${fullName}" (${ref}) is a shipped worked example — skipped.`);
          continue;
        }
        const leadRef = clean(get("lead id"));
        const target = leadRef ? leadIdToCompany.get(leadRef) : undefined;
        let companyId = target?.companyId ?? null;
        if (!companyId && leadRef) {
          const c = db.prepare(`SELECT id FROM companies WHERE external_ref = ?`).get(leadRef) as { id: number } | undefined;
          companyId = c?.id ?? null;
        }
        if (!companyId) {
          report.skipped.push(`CONTACTS row ${rowNum}: "${fullName}" — Lead ID "${leadRef ?? "(blank)"}" matches no imported company; skipped.`);
          continue;
        }
        const cvals: Record<string, string | null> = {};
        for (const [header, col] of Object.entries(CONTACT_MAP)) cvals[col] = clean(get(header));
        if (cvals.email && !EMAIL_RE.test(cvals.email)) {
          report.flagged.push(`CONTACTS row ${rowNum}: email "${cvals.email}" is invalid — contact imported without an email.`);
          cvals.email = null;
          cvals.email_status = null;
        }
        if (cvals.email) {
          const dupe = db.prepare(`SELECT id FROM contacts WHERE company_id = ? AND lower(email) = lower(?)`).get(companyId, cvals.email);
          if (dupe) {
            report.skipped.push(`CONTACTS row ${rowNum}: "${fullName}" duplicates an existing contact email at the same company — skipped.`);
            continue;
          }
        }
        const cinfo = db
          .prepare(
            `INSERT INTO contacts (company_id, full_name, role_title, email, phone, linkedin_url, confidence, notes,
               external_ref, contact_function, decision_role, email_status, whatsapp, language, best_time_to_call,
               source_tool, date_pulled, verified_flag, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(companyId, fullName, cvals.role_title, cvals.email, cvals.phone, cvals.linkedin_url, IMPORT_CONF, cvals.notes,
            cvals.external_ref, cvals.contact_function, cvals.decision_role, cvals.email_status, cvals.whatsapp,
            cvals.language, cvals.best_time_to_call, cvals.source_tool, cvals.date_pulled, cvals.verified_flag, now, now);
        report.contacts_created++;
        for (const [field, val] of Object.entries({ full_name: fullName, ...cvals })) {
          if (val === null) continue;
          prov.run({
            entity_type: "contact", entity_id: Number(cinfo.lastInsertRowid), field, orig: String(val), val: String(val),
            source_file: file.name, worksheet: "CONTACTS", source_ref: `row ${rowNum}`,
            confidence: IMPORT_CONF, notes: `Enrichment import by ${who}`, now,
          });
        }
      }
    }

    prov.run({
      entity_type: "import_report", entity_id: null, field: "csv_import_report",
      orig: JSON.stringify(report), val: null,
      source_file: file.name, worksheet: null, source_ref: null,
      confidence: IMPORT_CONF, notes: `Enrichment workbook import by ${who}`, now,
    });
  });
  tx();

  for (const p of ["/", "/companies", "/leads", "/companies/import"]) revalidatePath(p);
  redirect(
    `/companies/import?saved=${encodeURIComponent(
      `Imported ${report.companies_created} companies, ${report.contacts_created} contacts, ${report.leads_created} leads from ${file.name}` +
        (report.scoring_config_imported ? " (ICP scoring model loaded from the SCORING sheet)" : "") +
        `. Skipped ${report.skipped.length}, flagged ${report.flagged.length} — details below.`
    )}`
  );
}
