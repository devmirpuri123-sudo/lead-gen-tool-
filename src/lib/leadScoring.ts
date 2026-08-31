/** ICP fit score — implements the model from the SACVIN Export Lead Enrichment
 *  workbook (SCORING sheet): six components, 100 points, tiers A/B/C/D.
 *
 *    Business type 25 · Already importing 20 · Competing origin 20 ·
 *    Company size 15 · Category match 10 · Contact quality 10
 *
 *  Point tables and tier thresholds live in scoring_config (imported from the
 *  workbook, editable); the values below are the workbook defaults used when
 *  no config row exists. Nothing is guessed: an "Unknown" input gets the
 *  workbook's explicit Unknown points, and the explanation names it.
 */
import { getDb } from "@/lib/db";

export const BUSINESS_TYPE_POINTS_DEFAULT: Record<string, number> = {
  "importer": 25,
  "distributor": 25,
  "wholesaler": 20,
  "retail chain": 18,
  "supermarket group": 18,
  "cash & carry": 16,
  "buying house / sourcing agent": 14,
  "e-commerce": 12,
  "agent / broker": 10,
  "manufacturer (complementary range)": 8,
  // legacy Phase-3 value kept scoreable:
  "retailer": 18,
  "other": 0,
};
export const IMPORTS_POINTS_DEFAULT: Record<string, number> = { yes: 20, no: 0, unknown: 8 };
export const COMPETING_ORIGIN_POINTS_DEFAULT: Record<string, number> = { yes: 20, partly: 14, no: 6, unknown: 8 };
export const COMPANY_SIZE_POINTS_DEFAULT: Record<string, number> = { large: 15, medium: 12, small: 6, unknown: 5 };
export const CATEGORY_MATCH_POINTS_DEFAULT: Record<string, number> = { core: 10, partial: 6, none: 0 };
export const CONTACT_QUALITY_DEFAULT = { verified_decision_maker: 10, verified_other: 7, unverified: 4 };
export const TIER_THRESHOLDS_DEFAULT = { A: 75, B: 60, C: 40 };

interface IcpConfig {
  businessType: Record<string, number>;
  imports: Record<string, number>;
  competingOrigin: Record<string, number>;
  companySize: Record<string, number>;
  categoryMatch: Record<string, number>;
  contactQuality: typeof CONTACT_QUALITY_DEFAULT;
  tiers: typeof TIER_THRESHOLDS_DEFAULT;
}

let cached: IcpConfig | null = null;

export function loadIcpConfig(): IcpConfig {
  const rows = getDb()
    .prepare(`SELECT config_key, config_value FROM scoring_config WHERE config_key LIKE 'icp_%'`)
    .all() as { config_key: string; config_value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.config_key, r.config_value]));
  const json = <T>(key: string, fallback: T): T => {
    try {
      return map[key] ? (JSON.parse(map[key]) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  cached = {
    businessType: json("icp_business_type_points", BUSINESS_TYPE_POINTS_DEFAULT),
    imports: json("icp_imports_points", IMPORTS_POINTS_DEFAULT),
    competingOrigin: json("icp_competing_origin_points", COMPETING_ORIGIN_POINTS_DEFAULT),
    companySize: json("icp_company_size_points", COMPANY_SIZE_POINTS_DEFAULT),
    categoryMatch: json("icp_category_match_points", CATEGORY_MATCH_POINTS_DEFAULT),
    contactQuality: json("icp_contact_quality_points", CONTACT_QUALITY_DEFAULT),
    tiers: json("icp_tier_thresholds", TIER_THRESHOLDS_DEFAULT),
  };
  return cached;
}

export interface LeadScoringInput {
  company_name: string;
  company_type: string | null;      // business type
  imports_flag: string | null;      // Yes / No / Unknown
  competing_origin: string | null;  // Yes / Partly / No / Unknown
  company_size: string | null;      // Large / Medium / Small / Unknown
  category_match: string | null;    // Core / Partial / None
  contact_name: string | null;
  contact_email: string | null;
  email_status: string | null;      // Valid / Risky / catch-all / Invalid / …
  decision_role: string | null;     // Decision maker / Influencer / …
  // completeness basis (the workbook's 12-field measure)
  website: string | null;
  market_country: string | null;
  contact_role: string | null;
  contact_phone: string | null;
  status: string;
}

export interface LeadScore {
  score: number;
  max: 100;
  tier: "A" | "B" | "C" | "D";
  tierLabel: string;
  completeness: number; // 0..1 across the workbook's 12 key fields
  missingFields: string[];
  components: { label: string; points: number; max: number; note: string }[];
  explanation: string[];
}

const TIER_LABELS = {
  A: "A — contact first",
  B: "B — good, work the list",
  C: "C — worth enriching further",
  D: "D — park or disqualify",
};

function lookup(map: Record<string, number>, value: string | null): number | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return map[v] ?? null;
}

export function scoreLead(x: LeadScoringInput): LeadScore {
  const cfg = loadIcpConfig();
  const components: LeadScore["components"] = [];
  const unknownLabel = "Unknown — requires research";

  const part = (
    label: string,
    max: number,
    map: Record<string, number>,
    value: string | null,
    unknownKey: string | null,
    describe: (v: string, pts: number) => string
  ) => {
    let pts = lookup(map, value);
    let note: string;
    if (pts !== null && value) {
      note = describe(value, pts);
    } else if (unknownKey && map[unknownKey] !== undefined) {
      pts = map[unknownKey];
      note = `${unknownLabel} — scored as Unknown (${pts} of ${max}) per the workbook model until confirmed.`;
    } else {
      pts = 0;
      note = `${unknownLabel} — 0 of ${max} points until it is recorded.`;
    }
    components.push({ label, points: pts, max, note });
  };

  part("Business type", 25, cfg.businessType, x.company_type, null, (v, p) =>
    p >= 20
      ? `"${v}" buys containers directly — a core target (${p}/25).`
      : `"${v}" scores ${p}/25 — check who actually places import orders.`
  );
  part("Already importing", 20, cfg.imports, x.imports_flag, "unknown", (v, p) =>
    v.toLowerCase() === "yes"
      ? "They already import — licence, finance and habit are in place (20/20)."
      : v.toLowerCase() === "no"
        ? "They do not import today (0/20) — a harder first sale."
        : `Recorded as "${v}" (${p}/20).`
  );
  part("Competing origin", 20, cfg.competingOrigin, x.competing_origin, "unknown", (v, p) =>
    v.toLowerCase() === "yes"
      ? "They source from China/India/Thailand/Turkey/Vietnam — SACVIN has a displacement story (20/20)."
      : `Competing-origin sourcing recorded as "${v}" (${p}/20).`
  );
  part("Company size", 15, cfg.companySize, x.company_size, "unknown", (v, p) => `Size "${v}" (${p}/15).`);
  part("Category match", 10, cfg.categoryMatch, x.category_match, null, (v, p) =>
    v.toLowerCase() === "core"
      ? "Core category — houseware, kitchenware, storage, bathware (10/10)."
      : `Category match "${v}" (${p}/10).`
  );

  // Contact quality — derived, as in the workbook: no email = 0.
  let contactPts = 0;
  let contactNote: string;
  const emailValid = x.email_status?.trim().toLowerCase() === "valid";
  if (!x.contact_email) {
    contactNote = `No contact email on file (${unknownLabel}) — 0 of 10.`;
  } else if (emailValid && x.decision_role?.trim().toLowerCase() === "decision maker") {
    contactPts = cfg.contactQuality.verified_decision_maker;
    contactNote = `Verified email for a decision maker (${contactPts}/10) — the best possible contact.`;
  } else if (emailValid) {
    contactPts = cfg.contactQuality.verified_other;
    contactNote = `Verified email, but not (yet) the decision maker (${contactPts}/10).`;
  } else {
    contactPts = cfg.contactQuality.unverified;
    contactNote = `Email on file but not verified${x.email_status ? ` (status: ${x.email_status})` : ""} (${contactPts}/10) — verify before sending.`;
  }
  components.push({ label: "Contact quality", points: contactPts, max: 10, note: contactNote });

  const score = components.reduce((a, c) => a + c.points, 0);
  const tier: LeadScore["tier"] =
    score >= cfg.tiers.A ? "A" : score >= cfg.tiers.B ? "B" : score >= cfg.tiers.C ? "C" : "D";

  // Data completeness — the workbook's 12-field basis.
  const basis: [string, string | null][] = [
    ["company name", x.company_name || null],
    ["website", x.website],
    ["country", x.market_country],
    ["business type", x.company_type],
    ["category match", x.category_match],
    ["company size", x.company_size],
    ["imports?", x.imports_flag],
    ["competing origin", x.competing_origin],
    ["contact name", x.contact_name],
    ["job title", x.contact_role],
    ["email", x.contact_email],
    ["phone", x.contact_phone],
  ];
  const missingFields = basis.filter(([, v]) => !v).map(([label]) => label);
  const completeness = (basis.length - missingFields.length) / basis.length;

  const explanation: string[] = [
    `${x.company_name} scores ${score} of 100 — Tier ${TIER_LABELS[tier]}. The parts: ${components
      .map((c) => `${c.label} ${c.points}/${c.max}`)
      .join(" + ")}.`,
    ...components.map((c) => `${c.label}: ${c.note}`),
    missingFields.length === 0
      ? "All 12 key enrichment fields are on file (100% complete)."
      : `Data completeness ${Math.round(completeness * 100)}% — still missing: ${missingFields.join(", ")}.`,
    "A score sorts the list; it does not qualify a buyer. A C-tier lead with the right person on the phone beats an A-tier lead nobody has called.",
  ];
  if (x.status === "Do not contact") {
    explanation.push("This lead is marked Do not contact — the score is informational only; no outreach may be drafted for it.");
  }

  return { score, max: 100, tier, tierLabel: TIER_LABELS[tier], completeness, missingFields, components, explanation };
}

export function icpTierBadgeClass(tier: string): string {
  switch (tier) {
    case "A": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "B": return "bg-sky-100 text-sky-800 border-sky-200";
    case "C": return "bg-amber-100 text-amber-800 border-amber-200";
    default: return "bg-rose-100 text-rose-800 border-rose-200";
  }
}

/** Build a scoring input from a joined lead row (crmQueries.LeadListRow). */
export function scoringInputFromLead(l: {
  id: number;
  status: string;
  company_name: string | null;
  company_type: string | null;
  website: string | null;
  imports_flag?: string | null;
  competing_origin?: string | null;
  company_size?: string | null;
  category_match?: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_role?: string | null;
  contact_phone?: string | null;
  email_status?: string | null;
  decision_role?: string | null;
  market_country: string | null;
}): LeadScoringInput {
  return {
    company_name: l.company_name ?? `Lead #${l.id}`,
    company_type: l.company_type,
    imports_flag: l.imports_flag ?? null,
    competing_origin: l.competing_origin ?? null,
    company_size: l.company_size ?? null,
    category_match: l.category_match ?? null,
    contact_name: l.contact_name,
    contact_email: l.contact_email,
    email_status: l.email_status ?? null,
    decision_role: l.decision_role ?? null,
    website: l.website,
    market_country: l.market_country,
    contact_role: l.contact_role ?? null,
    contact_phone: l.contact_phone ?? null,
    status: l.status,
  };
}
