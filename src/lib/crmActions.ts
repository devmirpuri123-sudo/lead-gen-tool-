"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { parseCsv, cleanCell } from "@/lib/csv";
import { checkDuplicate, normalizeName, type ExistingCompany } from "@/lib/dedupe";
import { LEAD_STATUSES, COMPANY_TYPES, EMAIL_RE } from "@/lib/pipeline";

const SOURCE_APP = "Lead Engine app";
const MANUAL_CONF = "Manually entered — human judgement";
const IMPORT_CONF = "Imported — unverified, requires human review";

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function requireName(formData: FormData, back: string, field = "entered_by"): string {
  const who = String(formData.get(field) ?? "").trim().slice(0, 60);
  if (!who) fail(back, "Please enter your name — every entry is recorded with who made it and when.");
  return who;
}

function str(formData: FormData, key: string, max = 500): string | null {
  const v = String(formData.get(key) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  return v === "" ? null : v;
}

function provStmt() {
  return getDb().prepare(
    `INSERT INTO research_sources (entity_type, entity_id, field_name, original_value, normalised_value, source_file, worksheet, source_ref, method, confidence, notes, imported_at)
     VALUES (@entity_type, @entity_id, @field, @orig, @val, @source_file, NULL, @source_ref, @method, @confidence, @notes, @now)`
  );
}

function existingCompanies(): ExistingCompany[] {
  return getDb()
    .prepare(`SELECT id, name, name_normalised, website FROM companies`)
    .all() as ExistingCompany[];
}

function marketIdForCountry(country: string | null): number | null {
  if (!country) return null;
  const row = getDb()
    .prepare(`SELECT id FROM markets WHERE country_normalised = ?`)
    .get(country.toLowerCase().trim()) as { id: number } | undefined;
  return row?.id ?? null;
}

function validateWebsite(website: string | null, back: string): string | null {
  if (!website) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}([/?#].*)?$/i.test(website.replace(/^https?:\/\//i, ""))) {
    fail(back, `"${website}" does not look like a website address. Enter it like example.com or https://example.com.`);
  }
  return website;
}

const COMPANY_FIELDS = ["name", "website", "company_type", "description", "notes"] as const;

// ---------------------------------------------------------------------------
export async function createCompany(formData: FormData) {
  const back = "/companies/new";
  const db = getDb();
  const who = requireName(formData, back);
  const name = str(formData, "name", 200);
  if (!name) fail(back, "Company name is required.");
  const website = validateWebsite(str(formData, "website", 200), back);
  const companyType = str(formData, "company_type", 40);
  if (companyType && !COMPANY_TYPES.includes(companyType as never)) fail(back, "Unknown company type.");
  const country = str(formData, "country", 100);
  const marketId = marketIdForCountry(country);
  if (country && marketId === null) {
    fail(back, `"${country}" does not match any market country. Pick one from the list, or leave it blank.`);
  }
  const description = str(formData, "description", 1000);
  const notes = str(formData, "notes", 1000);
  const override = formData.get("allow_duplicate") === "on";

  const verdict = checkDuplicate(name, website, existingCompanies());
  if (verdict.level === "duplicate" && !override) {
    fail(
      back,
      `Possible duplicate blocked: "${verdict.matchName}" already exists with the ${verdict.reason}. Open that company instead, or tick "Create anyway" if this really is a different company.`
    );
  }

  const now = new Date().toISOString();
  let companyId = 0;
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO companies (market_id, name, name_normalised, website, company_type, description, status, confidence, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?)`
      )
      .run(marketId, name, normalizeName(name), website, companyType, description, MANUAL_CONF, notes, now, now);
    companyId = Number(info.lastInsertRowid);
    const prov = provStmt();
    const values: Record<string, string | null> = {
      name,
      website,
      company_type: companyType,
      description,
      notes,
      country,
    };
    for (const [field, val] of Object.entries(values)) {
      if (val === null) continue;
      prov.run({
        entity_type: "company", entity_id: companyId, field, orig: null, val,
        source_file: SOURCE_APP, source_ref: null, method: "manual", confidence: MANUAL_CONF,
        notes: `Entered by ${who}${verdict.level !== "none" && override ? " (duplicate warning overridden)" : ""}`,
        now,
      });
    }
    if (formData.get("create_lead") === "on") {
      createLeadRow(companyId, null, marketId, "New", who, now);
    }
  });
  tx();
  revalidateCrm(companyId);
  redirect(`/companies/${companyId}?saved=${encodeURIComponent("Company created." + (verdict.level === "possible" ? ` Note: ${verdict.reason}.` : ""))}`);
}

export async function updateCompany(formData: FormData) {
  const id = Number(formData.get("company_id"));
  const back = `/companies/${id}`;
  const db = getDb();
  const current = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!current) redirect("/companies");
  const who = requireName(formData, back);

  const name = str(formData, "name", 200);
  if (!name) fail(back, "Company name is required.");
  const website = validateWebsite(str(formData, "website", 200), back);
  const companyType = str(formData, "company_type", 40);
  if (companyType && !COMPANY_TYPES.includes(companyType as never)) fail(back, "Unknown company type.");
  const country = str(formData, "country", 100);
  const marketId = marketIdForCountry(country);
  if (country && marketId === null) fail(back, `"${country}" does not match any market country.`);
  const description = str(formData, "description", 1000);
  const notes = str(formData, "notes", 1000);

  const now = new Date().toISOString();
  const next: Record<string, string | null> = { name, website, company_type: companyType, description, notes };
  const tx = db.transaction(() => {
    const prov = provStmt();
    for (const field of COMPANY_FIELDS) {
      const before = (current[field] as string | null) ?? null;
      const after = next[field];
      if (before === after) continue;
      prov.run({
        entity_type: "company", entity_id: id, field, orig: before, val: after,
        source_file: SOURCE_APP, source_ref: null, method: "manual", confidence: MANUAL_CONF,
        notes: `Changed by ${who}`, now,
      });
    }
    if ((current.market_id as number | null) !== marketId) {
      prov.run({
        entity_type: "company", entity_id: id, field: "country", orig: null, val: country,
        source_file: SOURCE_APP, source_ref: null, method: "manual", confidence: MANUAL_CONF,
        notes: `Changed by ${who}`, now,
      });
    }
    db.prepare(
      `UPDATE companies SET name = ?, name_normalised = ?, website = ?, company_type = ?, description = ?, notes = ?, market_id = ?, updated_at = ? WHERE id = ?`
    ).run(name, normalizeName(name), website, companyType, description, notes, marketId, now, id);
    // Keep leads pointing at the company's market.
    db.prepare(`UPDATE leads SET market_id = ?, updated_at = ? WHERE company_id = ?`).run(marketId, now, id);
  });
  tx();
  revalidateCrm(id);
  redirect(`${back}?saved=${encodeURIComponent("Company updated.")}`);
}

// ---------------------------------------------------------------------------
export async function createContact(formData: FormData) {
  const companyId = Number(formData.get("company_id"));
  const back = `/companies/${companyId}`;
  const db = getDb();
  const company = db.prepare(`SELECT id, name FROM companies WHERE id = ?`).get(companyId) as { id: number; name: string } | undefined;
  if (!company) redirect("/companies");
  const who = requireName(formData, back);

  const fullName = str(formData, "full_name", 120);
  if (!fullName) fail(back, "Contact name is required.");
  const email = str(formData, "email", 200);
  if (email && !EMAIL_RE.test(email)) fail(back, `"${email}" is not a valid email address.`);
  const role = str(formData, "role_title", 120);
  const phone = str(formData, "phone", 60);
  const linkedin = str(formData, "linkedin_url", 300);
  if (linkedin && !/linkedin\.com\//i.test(linkedin)) {
    fail(back, "The LinkedIn field should be a linkedin.com profile address (found manually — never scraped).");
  }
  const notes = str(formData, "notes", 1000);

  if (email) {
    const dupe = db
      .prepare(`SELECT id, full_name FROM contacts WHERE company_id = ? AND lower(email) = lower(?)`)
      .get(companyId, email) as { id: number; full_name: string } | undefined;
    if (dupe) fail(back, `Duplicate blocked: ${dupe.full_name} at this company already has the email ${email}.`);
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO contacts (company_id, full_name, role_title, email, phone, linkedin_url, country, confidence, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
      )
      .run(companyId, fullName, role, email, phone, linkedin, MANUAL_CONF, notes, now, now);
    const contactId = Number(info.lastInsertRowid);
    const prov = provStmt();
    const values: Record<string, string | null> = { full_name: fullName, role_title: role, email, phone, linkedin_url: linkedin, notes };
    for (const [field, val] of Object.entries(values)) {
      if (val === null) continue;
      prov.run({
        entity_type: "contact", entity_id: contactId, field, orig: null, val,
        source_file: SOURCE_APP, source_ref: null, method: "manual", confidence: MANUAL_CONF,
        notes: `Entered by ${who}`, now,
      });
    }
  });
  tx();
  revalidateCrm(companyId);
  redirect(`${back}?saved=${encodeURIComponent("Contact added.")}`);
}

// ---------------------------------------------------------------------------
function createLeadRow(
  companyId: number,
  contactId: number | null,
  marketId: number | null,
  status: string,
  who: string,
  now: string
): number {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO leads (company_id, contact_id, market_id, status, owner, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(companyId, contactId, marketId, status, who, now, now);
  const leadId = Number(info.lastInsertRowid);
  db.prepare(
    `INSERT INTO activities (lead_id, activity_type, description, created_at)
     VALUES (?, 'status_change', ?, ?)`
  ).run(leadId, `Lead created with status "${status}" by ${who}`, now);
  return leadId;
}

export async function createLead(formData: FormData) {
  const companyId = Number(formData.get("company_id"));
  const back = `/companies/${companyId}`;
  const db = getDb();
  const company = db.prepare(`SELECT id, market_id FROM companies WHERE id = ?`).get(companyId) as { id: number; market_id: number | null } | undefined;
  if (!company) redirect("/companies");
  const who = requireName(formData, back);
  const contactIdRaw = str(formData, "contact_id", 20);
  let contactId: number | null = null;
  if (contactIdRaw) {
    const c = db.prepare(`SELECT id FROM contacts WHERE id = ? AND company_id = ?`).get(Number(contactIdRaw), companyId);
    if (!c) fail(back, "That contact does not belong to this company.");
    contactId = Number(contactIdRaw);
  }
  const open = db
    .prepare(`SELECT id FROM leads WHERE company_id = ? AND status NOT IN ('Closed','Not a fit','Do not contact')`)
    .get(companyId) as { id: number } | undefined;
  if (open && formData.get("allow_second_lead") !== "on") {
    fail(back, `This company already has an open lead (#${open.id}). Work that lead, or tick "Create another lead anyway".`);
  }
  const now = new Date().toISOString();
  const leadId = createLeadRow(companyId, contactId, company.market_id, "New", who, now);
  revalidateCrm(companyId);
  redirect(`/leads/${leadId}?saved=${encodeURIComponent("Lead created.")}`);
}

export async function updateLeadStatus(formData: FormData) {
  const leadId = Number(formData.get("lead_id"));
  const back = `/leads/${leadId}`;
  const db = getDb();
  const lead = db.prepare(`SELECT id, status, company_id FROM leads WHERE id = ?`).get(leadId) as { id: number; status: string; company_id: number | null } | undefined;
  if (!lead) redirect("/leads");
  const who = requireName(formData, back);
  const status = String(formData.get("status") ?? "");
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) fail(back, "Unknown status.");
  const note = str(formData, "note", 500);
  const owner = str(formData, "owner", 60);
  if (status === lead.status && !note && owner === null) {
    fail(back, "Nothing changed — pick a different status, add a note, or set an owner.");
  }
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`UPDATE leads SET status = ?, owner = COALESCE(?, owner), updated_at = ? WHERE id = ?`).run(status, owner, now, leadId);
    const desc =
      status !== lead.status
        ? `Status changed from "${lead.status}" to "${status}" by ${who}${note ? ` — ${note}` : ""}`
        : `Note by ${who}${owner ? ` (owner set to ${owner})` : ""}${note ? ` — ${note}` : ""}`;
    db.prepare(`INSERT INTO activities (lead_id, activity_type, description, created_at) VALUES (?, ?, ?, ?)`).run(
      leadId,
      status !== lead.status ? "status_change" : "note",
      desc,
      now
    );
  });
  tx();
  revalidateCrm(lead.company_id);
  redirect(`${back}?saved=${encodeURIComponent(status !== lead.status ? `Status changed to "${status}".` : "Saved.")}`);
}

export async function addLeadNote(formData: FormData) {
  const leadId = Number(formData.get("lead_id"));
  const back = `/leads/${leadId}`;
  const db = getDb();
  const lead = db.prepare(`SELECT id, company_id FROM leads WHERE id = ?`).get(leadId) as { id: number; company_id: number | null } | undefined;
  if (!lead) redirect("/leads");
  const who = requireName(formData, back);
  const note = str(formData, "note", 1000);
  if (!note) fail(back, "Write the note first.");
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO activities (lead_id, activity_type, description, created_at) VALUES (?, 'note', ?, ?)`).run(
    leadId,
    `Note by ${who} — ${note}`,
    now
  );
  revalidateCrm(lead.company_id);
  redirect(`${back}?saved=${encodeURIComponent("Note added.")}`);
}

// ---------------------------------------------------------------------------
const CSV_COLUMNS = [
  "company_name", "country", "website", "company_type", "description", "company_notes",
  "contact_name", "contact_role", "contact_email", "contact_phone", "contact_linkedin",
] as const;

export async function importCompaniesCsv(formData: FormData) {
  const back = "/companies/import";
  const db = getDb();
  const who = requireName(formData, back);
  const makeLeads = formData.get("create_leads") === "on";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail(back, "Choose a CSV file first.");
  if (file.size > 2_000_000) fail(back, "That file is over 2 MB — split it into smaller files.");
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) fail(back, "The file has no data rows — the first row must be column headers.");

  const header = rows[0].map((h) => (h ?? "").trim().toLowerCase().replace(/\s+/g, "_"));
  const colIndex: Partial<Record<(typeof CSV_COLUMNS)[number], number>> = {};
  for (const col of CSV_COLUMNS) {
    const idx = header.indexOf(col);
    if (idx >= 0) colIndex[col] = idx;
  }
  if (colIndex.company_name === undefined) {
    fail(back, `The file must have a "company_name" column. Found columns: ${header.join(", ")}.`);
  }
  const unknownCols = header.filter((h) => h && !(CSV_COLUMNS as readonly string[]).includes(h));

  const now = new Date().toISOString();
  const existing = existingCompanies();
  const seenInFile = new Map<string, number>(); // normalised name -> row number
  const report = {
    file: file.name,
    imported_by: who,
    imported_at: now,
    total_rows: rows.length - 1,
    companies_created: 0,
    contacts_created: 0,
    leads_created: 0,
    skipped: [] as string[],
    flagged: [] as string[],
    unknown_columns: unknownCols,
  };

  const prov = provStmt();
  const tx = db.transaction(() => {
    for (let i = 1; i < rows.length; i++) {
      const rowNum = i + 1; // 1-based incl. header, matches what users see in Excel
      const cell = (col: (typeof CSV_COLUMNS)[number]) =>
        colIndex[col] === undefined ? null : cleanCell(rows[i][colIndex[col]!]);

      const name = cell("company_name");
      if (!name) {
        report.skipped.push(`Row ${rowNum}: no company name — skipped.`);
        continue;
      }
      const norm = normalizeName(name);
      const dupRow = seenInFile.get(norm);
      if (dupRow !== undefined) {
        report.skipped.push(`Row ${rowNum}: "${name}" duplicates row ${dupRow} in this file — skipped.`);
        continue;
      }
      const website = cell("website");
      const verdict = checkDuplicate(name, website, existing);
      if (verdict.level === "duplicate") {
        report.skipped.push(`Row ${rowNum}: "${name}" already exists in the database (${verdict.reason}, matches "${verdict.matchName}") — skipped.`);
        continue;
      }

      const country = cell("country");
      const marketId = marketIdForCountry(country);
      if (country && marketId === null) {
        report.flagged.push(`Row ${rowNum}: country "${country}" did not match any market — company imported without a market link. Fix the country on the company page.`);
      }
      let companyType = cell("company_type")?.toLowerCase() ?? null;
      if (companyType && !COMPANY_TYPES.includes(companyType as never)) {
        report.flagged.push(`Row ${rowNum}: company type "${companyType}" is not one of ${COMPANY_TYPES.join("/")} — stored as Unknown.`);
        companyType = null;
      }
      if (verdict.level === "possible") {
        report.flagged.push(`Row ${rowNum}: "${name}" is a possible duplicate of "${verdict.matchName}" (${verdict.reason}) — imported; please review.`);
      }

      const description = cell("description");
      const companyNotes = cell("company_notes");
      const info = db
        .prepare(
          `INSERT INTO companies (market_id, name, name_normalised, website, company_type, description, status, confidence, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'Imported', ?, ?, ?, ?)`
        )
        .run(marketId, name, norm, website, companyType, description, IMPORT_CONF, companyNotes, now, now);
      const companyId = Number(info.lastInsertRowid);
      report.companies_created++;
      seenInFile.set(norm, rowNum);
      existing.push({ id: companyId, name, name_normalised: norm, website });

      const companyValues: Record<string, string | null> = {
        name, country, website, company_type: companyType, description, notes: companyNotes,
      };
      for (const [field, val] of Object.entries(companyValues)) {
        if (val === null) continue;
        prov.run({
          entity_type: "company", entity_id: companyId, field, orig: val, val,
          source_file: file.name, source_ref: `row ${rowNum}`, method: "imported",
          confidence: IMPORT_CONF, notes: `CSV import by ${who}`, now,
        });
      }

      let contactId: number | null = null;
      const contactName = cell("contact_name");
      if (contactName) {
        let email = cell("contact_email");
        if (email && !EMAIL_RE.test(email)) {
          report.flagged.push(`Row ${rowNum}: contact email "${email}" is invalid — contact imported without an email.`);
          email = null;
        }
        let linkedin = cell("contact_linkedin");
        if (linkedin && !/linkedin\.com\//i.test(linkedin)) {
          report.flagged.push(`Row ${rowNum}: contact_linkedin "${linkedin}" is not a linkedin.com address — left blank.`);
          linkedin = null;
        }
        const cInfo = db
          .prepare(
            `INSERT INTO contacts (company_id, full_name, role_title, email, phone, linkedin_url, confidence, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
          )
          .run(companyId, contactName, cell("contact_role"), email, cell("contact_phone"), linkedin, IMPORT_CONF, now, now);
        contactId = Number(cInfo.lastInsertRowid);
        report.contacts_created++;
        const contactValues: Record<string, string | null> = {
          full_name: contactName, role_title: cell("contact_role"), email, phone: cell("contact_phone"), linkedin_url: linkedin,
        };
        for (const [field, val] of Object.entries(contactValues)) {
          if (val === null) continue;
          prov.run({
            entity_type: "contact", entity_id: contactId, field, orig: val, val,
            source_file: file.name, source_ref: `row ${rowNum}`, method: "imported",
            confidence: IMPORT_CONF, notes: `CSV import by ${who}`, now,
          });
        }
      }

      if (makeLeads) {
        createLeadRow(companyId, contactId, marketId, "Imported", who, now);
        report.leads_created++;
      }
    }

    // Persist the report itself so it can be reviewed later.
    prov.run({
      entity_type: "import_report", entity_id: null, field: "csv_import_report",
      orig: JSON.stringify(report), val: null,
      source_file: file.name, source_ref: null, method: "imported",
      confidence: IMPORT_CONF, notes: `CSV import by ${who}`, now,
    });
  });
  tx();

  revalidateCrm(null);
  redirect(
    `${back}?saved=${encodeURIComponent(
      `Imported ${report.companies_created} companies, ${report.contacts_created} contacts, ${report.leads_created} leads from ${file.name}. Skipped ${report.skipped.length}, flagged ${report.flagged.length} — details below.`
    )}`
  );
}

function revalidateCrm(companyId: number | null) {
  for (const p of ["/", "/companies", "/leads", "/companies/import"]) revalidatePath(p);
  if (companyId) revalidatePath(`/companies/${companyId}`);
}
