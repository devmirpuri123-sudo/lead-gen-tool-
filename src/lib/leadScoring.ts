/** Transparent lead scoring (0–100). Nothing is guessed: every point comes
 *  from data actually recorded, and every missing input is named. */

export interface LeadScoringInput {
  company_name: string;
  company_type: string | null;
  website: string | null;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  market_country: string | null;
  market_tier: string | null; // priority_tier of the linked market
  status: string;
}

const TYPE_POINTS: Record<string, number> = {
  distributor: 30,
  wholesaler: 28,
  importer: 25,
  retailer: 15,
  other: 5,
};

const TIER_POINTS: Record<string, number> = {
  "Tier 1 - Priority": 40,
  "Tier 2 - Develop": 30,
  "Tier 3 - Monitor": 20,
  "Tier 4 - Deprioritise": 10,
};

export interface LeadScore {
  score: number;
  max: 100;
  components: { label: string; points: number; max: number; note: string }[];
  explanation: string[];
}

export function scoreLead(x: LeadScoringInput): LeadScore {
  const components: LeadScore["components"] = [];

  // 1. Market attractiveness (0–40) — from the market's priority tier.
  let marketPts = 0;
  let marketNote: string;
  if (!x.market_country) {
    marketNote = "No market linked to this lead yet — link the company to a country to earn up to 40 points.";
  } else if (x.market_tier && TIER_POINTS[x.market_tier] !== undefined) {
    marketPts = TIER_POINTS[x.market_tier];
    marketNote = `${x.market_country} is "${x.market_tier}".`;
  } else {
    marketNote = `${x.market_country} is not scored yet (Unknown — requires research on the Scoring workspace); 0 of 40 points until it is.`;
  }
  components.push({ label: "Market attractiveness", points: marketPts, max: 40, note: marketNote });

  // 2. Partner-type fit (0–30) — how closely the company matches our targets.
  let typePts = 0;
  let typeNote: string;
  const t = x.company_type?.toLowerCase() ?? null;
  if (t && TYPE_POINTS[t] !== undefined) {
    typePts = TYPE_POINTS[t];
    typeNote =
      t === "distributor" || t === "wholesaler" || t === "importer"
        ? `"${t}" is a core target partner type.`
        : t === "retailer"
          ? `"retailer" is a secondary target — useful but smaller volumes.`
          : `type "other" — confirm what this company actually does.`;
  } else {
    typeNote = "Company type is Unknown — requires research; 0 of 30 points until it is confirmed.";
  }
  components.push({ label: "Partner-type fit", points: typePts, max: 30, note: typeNote });

  // 3. Research completeness (0–30) — only what is actually on file counts.
  const missing: string[] = [];
  let compPts = 0;
  if (x.website) compPts += 8; else missing.push("website");
  if (x.contact_name) compPts += 8; else missing.push("a named contact person");
  if (x.contact_email) compPts += 8; else missing.push("a contact email");
  if (x.description) compPts += 6; else missing.push("a company description");
  const compNote =
    missing.length === 0
      ? "Website, named contact, email and description are all on file."
      : `Missing: ${missing.join(", ")} (Unknown — requires research).`;
  components.push({ label: "Research completeness", points: compPts, max: 30, note: compNote });

  const score = marketPts + typePts + compPts;

  const explanation: string[] = [
    `${x.company_name} scores ${score} out of 100: ${components
      .map((c) => `${c.label} ${c.points}/${c.max}`)
      .join(" + ")}.`,
    ...components.map((c) => `${c.label} (${c.points}/${c.max}): ${c.note}`),
  ];
  if (score >= 70) {
    explanation.push("70+ is a strong lead — prioritise research completion and outreach approval.");
  } else if (score >= 40) {
    explanation.push("40–69 is a middling lead — usually the fastest gains come from completing the missing research above.");
  } else {
    explanation.push("Below 40 usually means key facts are still unknown — research first, judge later. A low score from missing data is not a verdict on the company.");
  }
  if (x.status === "Do not contact") {
    explanation.push("This lead is marked Do not contact — the score is informational only; no outreach may be drafted for it.");
  }
  return { score, max: 100, components, explanation };
}
