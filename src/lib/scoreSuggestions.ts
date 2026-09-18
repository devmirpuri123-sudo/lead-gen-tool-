import type { Market } from "@/lib/queries";

/** Automatic score suggestions.
 *
 *  These are SUGGESTIONS, never decisions. Every one is computed from facts
 *  already stored on the market record, is explained in plain English, and
 *  must be accepted by a named person before it becomes a score. Where the
 *  underlying fact is missing the engine refuses to suggest rather than
 *  guessing — the same rule the rest of the app follows.
 */

export type SuggestionKey = "market_size_score" | "access_ease_score" | "competition_score";

export interface Suggestion {
  key: SuggestionKey;
  label: string;
  /** null means "cannot suggest" — the reason is in `basis`. */
  score: number | null;
  /** One sentence a non-technical reader can check. */
  basis: string;
  /** The exact facts used, so the number can be audited. */
  evidence: string[];
  confidence: "High" | "Medium" | "Low";
  /** What to research to turn a null into a suggestion. */
  missing?: string;
}

export interface MarketSuggestions {
  suggestions: Suggestion[];
  /** True when all three can be suggested — i.e. accepting produces a real
   *  weighted score under the all-three-scores rule. */
  complete: boolean;
}

const yes = (v: string | null) => (v ?? "").trim().toLowerCase().startsWith("y");
const no = (v: string | null) => (v ?? "").trim().toLowerCase().startsWith("n");

/** First percentage mentioned in the duty text, e.g. "6.5% MFN …" -> 6.5. */
export function parseDutyPct(text: string | null): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const usd = (n: number) =>
  "$" + new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const people = (n: number) =>
  new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Market Size — workbook scale: 5 = large population with high plasticware
 *  import volume; 1 = tiny or negligible import demand.
 *
 *  Researched import value wins when present. Otherwise population and GDP
 *  stand in as a proxy for how much household plastics a market can absorb,
 *  and the suggestion says so. */
function marketSize(m: Market): Suggestion {
  const key: SuggestionKey = "market_size_score";
  const label = "Market Size";
  const value = m.est_annual_import_value_usd;

  if (value !== null && value > 0) {
    const score = value >= 500e6 ? 5 : value >= 200e6 ? 4 : value >= 50e6 ? 3 : value >= 10e6 ? 2 : 1;
    const band =
      score === 5
        ? "$500m or more a year is a top-tier import market"
        : score === 4
          ? "$200m–$500m a year is a large import market"
          : score === 3
            ? "$50m–$200m a year is a mid-sized import market"
            : score === 2
              ? "$10m–$50m a year is a small import market"
              : "under $10m a year is negligible import demand";
    return {
      key,
      label,
      score,
      basis: `Recorded household-plastics imports of ${usd(value)} a year — ${band}.`,
      evidence: [
        `Est. annual import value: ${usd(value)}`,
        m.population !== null ? `Population: ${people(m.population)}` : "Population: not recorded",
      ],
      confidence: "High",
    };
  }

  // Proxy: population size and economy size, averaged.
  const pop = m.population;
  const gdp = m.gdp_nominal_usd;
  if (pop === null && gdp === null) {
    return {
      key,
      label,
      score: null,
      basis: "Cannot suggest — this market has no import value, no population and no GDP on record.",
      evidence: [],
      confidence: "Low",
      missing: "Est. annual import value (HS 3923/3924), or population and GDP",
    };
  }
  const popPts = pop === null ? null : pop >= 50e6 ? 5 : pop >= 20e6 ? 4 : pop >= 5e6 ? 3 : pop >= 1e6 ? 2 : 1;
  const gdpPts = gdp === null ? null : gdp >= 1e12 ? 5 : gdp >= 300e9 ? 4 : gdp >= 100e9 ? 3 : gdp >= 20e9 ? 2 : 1;
  const parts = [popPts, gdpPts].filter((n): n is number => n !== null);
  const score = Math.max(1, Math.min(5, Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)));
  return {
    key,
    label,
    score,
    basis:
      `No import figure on record, so this is a proxy from the size of the market: ` +
      `${pop !== null ? `a population of ${people(pop)}` : "population unknown"}` +
      `${gdp !== null ? ` and an economy of ${usd(gdp)}` : ""}. Replace it if you find real import data.`,
    evidence: [
      pop !== null ? `Population: ${people(pop)} (${popPts}/5 on size alone)` : "Population: not recorded",
      gdp !== null ? `GDP: ${usd(gdp)} (${gdpPts}/5 on economy size alone)` : "GDP: not recorded",
      m.income_tier ? `Income tier: ${m.income_tier}` : "Income tier: not recorded",
    ],
    confidence: "Medium",
  };
}

/** Access Ease — workbook scale: 5 = duty-free (ECOWAS/AfCFTA), coastal,
 *  short transit, no NTBs; 1 = high duty, landlocked, licensing barriers,
 *  FX restrictions. Built from stored trade-bloc, landlocked and duty facts. */
function accessEase(m: Market): Suggestion {
  const key: SuggestionKey = "access_ease_score";
  const label = "Access Ease";
  const duty = parseDutyPct(m.import_duty_pct_text);
  const isEcowas = /member|yes/i.test(m.ecowas_status ?? "");
  const isAfcfta = /ratif|party|yes|signator/i.test(m.afcfta_status ?? "");
  const landlocked = yes(m.landlocked);
  const coastal = no(m.landlocked);

  if (duty === null && !isEcowas && !isAfcfta && m.landlocked === null) {
    return {
      key,
      label,
      score: null,
      basis: "Cannot suggest — no duty rate, trade-bloc status or coastline information on record.",
      evidence: [],
      confidence: "Low",
      missing: "Import duty % (HS 3923/3924), or trade bloc and landlocked status",
    };
  }

  let pts = 3;
  const evidence: string[] = [];

  if (duty !== null) {
    if (duty === 0) {
      pts += 1.5;
      evidence.push(`Import duty 0% — duty-free (+1.5)`);
    } else if (duty <= 5) {
      pts += 0.5;
      evidence.push(`Import duty ${duty}% — low (+0.5)`);
    } else if (duty <= 10) {
      evidence.push(`Import duty ${duty}% — moderate (no change)`);
    } else {
      pts -= 1;
      evidence.push(`Import duty ${duty}% — high (−1)`);
    }
  } else {
    evidence.push("Import duty not researched (no adjustment)");
  }

  if (isEcowas) {
    pts += 2;
    evidence.push(`ECOWAS: ${m.ecowas_status} — duty-free access and short transit from Nigeria (+2)`);
  } else if (isAfcfta) {
    pts += 1;
    evidence.push(`AfCFTA: ${m.afcfta_status} — preferential continental access (+1)`);
  }

  if (landlocked) {
    pts -= 1.5;
    evidence.push("Landlocked — no direct sea freight, extra cost and transit time (−1.5)");
  } else if (coastal) {
    pts += 0.5;
    evidence.push("Coastal — direct sea freight possible (+0.5)");
  }

  if (m.trade_bloc) evidence.push(`Trade bloc: ${m.trade_bloc}`);

  const score = Math.max(1, Math.min(5, Math.round(pts)));
  const headline = landlocked
    ? "landlocked, so freight is slower and dearer"
    : coastal
      ? "coastal, so direct sea freight is possible"
      : "coastline status unknown";
  const dutyPhrase =
    duty === null ? "duty not yet researched" : duty === 0 ? "duty-free" : `${duty}% import duty`;
  return {
    key,
    label,
    score,
    basis: `${m.country} is ${headline}, with ${dutyPhrase}${isEcowas ? ", and is an ECOWAS market" : isAfcfta ? ", and is an AfCFTA party" : ""}. Non-tariff requirements (certification, labelling) are not counted here — lower the score yourself if you know of any.`,
    evidence,
    confidence: duty === null ? "Medium" : "High",
  };
}

/** Competition — workbook scale: 5 = little local manufacturing, imports
 *  dominate; 1 = strong domestic plastics industry plus entrenched
 *  Chinese/Turkish supply. Driven by the researched Local competition field. */
function competition(m: Market): Suggestion {
  const key: SuggestionKey = "competition_score";
  const label = "Competition";
  const raw = (m.local_competition ?? "").trim();
  const first = raw.charAt(0).toUpperCase();

  if (!raw) {
    return {
      key,
      label,
      score: null,
      basis:
        "Cannot suggest — Local competition has not been researched for this market. Once it is recorded as High, Medium or Low, a score follows automatically.",
      evidence: [],
      confidence: "Low",
      missing: "Local competition (High / Medium / Low)",
    };
  }

  const map: Record<string, { score: number; why: string }> = {
    L: { score: 5, why: "little local manufacturing, so imports dominate — the best case for an exporter" },
    M: { score: 3, why: "some local manufacturing alongside imports — a contested but open market" },
    H: { score: 2, why: "a strong domestic plastics industry to displace" },
  };
  const hit = map[first];
  if (!hit) {
    return {
      key,
      label,
      score: null,
      basis: `Cannot suggest — Local competition is recorded as "${raw}", which is not High, Medium or Low.`,
      evidence: [`Local competition: ${raw}`],
      confidence: "Low",
      missing: "Local competition recorded as High, Medium or Low",
    };
  }
  return {
    key,
    label,
    score: hit.score,
    basis: `Local competition is recorded as ${raw} — ${hit.why}. Drop this to 1 yourself if Chinese or Turkish suppliers are also entrenched here.`,
    evidence: [`Local competition: ${raw}`],
    confidence: "Medium",
  };
}

export function suggestScores(m: Market): MarketSuggestions {
  const suggestions = [marketSize(m), accessEase(m), competition(m)];
  return { suggestions, complete: suggestions.every((s) => s.score !== null) };
}

/** One-line summary for list screens, e.g. "4 / 3 / 5". */
/** Plain-English rendering of how the suggestion was reached. */
export function confidencePhrase(s: Suggestion): string {
  if (s.score === null) return "not enough information";
  switch (s.confidence) {
    case "High":
      return "from researched figures";
    case "Medium":
      return "from a stand-in measure";
    default:
      return "low confidence";
  }
}

export function suggestionSummary(s: MarketSuggestions): string {
  return s.suggestions.map((x) => (x.score === null ? "—" : String(x.score))).join(" / ");
}
