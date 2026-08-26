import { getDb } from "@/lib/db";

export interface ScoringConfig {
  weights: { market_size: number; access_ease: number; diaspora_fit: number; competition: number };
  cutoffs: { tier1: number; tier2: number; tier3: number };
  tier4Label: string;
  diasporaMap: Record<string, number>;
  scales: { market_size?: string; access_ease?: string; diaspora_fit?: string; competition?: string };
}

export interface ScoreInputs {
  market_size_score: number | null;
  access_ease_score: number | null;
  diaspora_fit_score: number | null;
  competition_score: number | null;
}

export function loadScoringConfig(): ScoringConfig {
  const rows = getDb()
    .prepare(`SELECT config_key, config_value FROM scoring_config`)
    .all() as { config_key: string; config_value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.config_key, r.config_value]));
  const num = (k: string, fallback: number) => {
    const v = parseFloat(map[k]);
    return Number.isFinite(v) ? v : fallback;
  };
  let diasporaMap: Record<string, number> = { High: 5, Home: 4, Medium: 3, Low: 1 };
  try {
    if (map["diaspora_fit_map"]) diasporaMap = JSON.parse(map["diaspora_fit_map"]);
  } catch {
    // keep default mapping
  }
  return {
    weights: {
      market_size: num("weight_market_size", 0.3),
      access_ease: num("weight_access_ease", 0.25),
      diaspora_fit: num("weight_diaspora_fit", 0.2),
      competition: num("weight_competition", 0.25),
    },
    cutoffs: {
      tier1: num("tier1_cutoff", 4),
      tier2: num("tier2_cutoff", 3),
      tier3: num("tier3_cutoff", 2),
    },
    tier4Label: map["tier4_label"] || "Tier 4 - Deprioritise",
    diasporaMap,
    scales: {
      market_size: map["scale_market_size"],
      access_ease: map["scale_access_ease"],
      diaspora_fit: map["scale_diaspora_fit"],
      competition: map["scale_competition"],
    },
  };
}

/** All-three-scores rule: Market Size, Access Ease and Competition must all be
 *  present before a weighted score is computed. Diaspora Fit is auto-mapped;
 *  if it is somehow missing it contributes 0 and the explanation says so. */
export function computeScore(m: ScoreInputs, cfg: ScoringConfig): { weighted: number | null; tier: string } {
  const haveAll =
    m.market_size_score !== null && m.access_ease_score !== null && m.competition_score !== null;
  if (!haveAll) return { weighted: null, tier: "Not scored" };
  const fit = m.diaspora_fit_score ?? 0;
  const weighted =
    Math.round(
      (m.market_size_score! * cfg.weights.market_size +
        m.access_ease_score! * cfg.weights.access_ease +
        fit * cfg.weights.diaspora_fit +
        m.competition_score! * cfg.weights.competition) *
        100
    ) / 100;
  return { weighted, tier: tierFor(weighted, cfg) };
}

export function tierFor(weighted: number, cfg: ScoringConfig): string {
  if (weighted >= cfg.cutoffs.tier1) return "Tier 1 - Priority";
  if (weighted >= cfg.cutoffs.tier2) return "Tier 2 - Develop";
  if (weighted >= cfg.cutoffs.tier3) return "Tier 3 - Monitor";
  return cfg.tier4Label;
}

const pct = (w: number) => `${Math.round(w * 1000) / 10}%`;

interface ExplainInput extends ScoreInputs {
  country: string;
  diaspora_priority: string | null;
  scored_by?: string | null;
  scored_at?: string | null;
}

/** Plain-English explanation of why a market has its score and tier —
 *  or exactly what is missing if it has none. */
export function explainScore(m: ExplainInput, cfg: ScoringConfig): string[] {
  const missing: string[] = [];
  if (m.market_size_score === null) missing.push("Market Size");
  if (m.access_ease_score === null) missing.push("Access Ease");
  if (m.competition_score === null) missing.push("Competition");

  const fitNote =
    m.diaspora_fit_score !== null && m.diaspora_priority
      ? `Diaspora Fit is already ${m.diaspora_fit_score}, set automatically because this country's diaspora priority is "${m.diaspora_priority}" (High=5, Home=4, Medium=3, Low=1).`
      : `Diaspora Fit could not be set automatically because Diaspora Priority is missing; it will count as 0 until resolved.`;

  if (missing.length > 0) {
    return [
      `${m.country} is Not scored because ${missing.length === 3 ? "none of the three manual scores have" : missing.join(" and ") + (missing.length === 1 ? " has" : " have")} not been entered yet. All three manual scores (Market Size, Access Ease, Competition) are required before a weighted score is calculated — partial input is never scored, so an incomplete assessment can't masquerade as a low one.`,
      fitNote,
    ];
  }

  const parts = [
    { label: "Market Size", score: m.market_size_score!, weight: cfg.weights.market_size },
    { label: "Access Ease", score: m.access_ease_score!, weight: cfg.weights.access_ease },
    { label: "Diaspora Fit", score: m.diaspora_fit_score ?? 0, weight: cfg.weights.diaspora_fit },
    { label: "Competition", score: m.competition_score!, weight: cfg.weights.competition },
  ].map((p) => ({ ...p, contribution: Math.round(p.score * p.weight * 100) / 100 }));

  const { weighted, tier } = computeScore(m, cfg);
  const calc = parts
    .map((p) => `${p.label} ${p.score} × ${pct(p.weight)} = ${p.contribution.toFixed(2)}`)
    .join(", plus ");

  const byContribution = [...parts].sort((a, b) => b.contribution - a.contribution);
  const strongest = byContribution[0];
  const byScore = [...parts].sort((a, b) => a.score - b.score);
  const weakest = byScore[0];

  let tierReason: string;
  if (weighted! >= cfg.cutoffs.tier1) {
    tierReason = `That total of ${weighted!.toFixed(2)} meets the Tier 1 cut-off of ${cfg.cutoffs.tier1.toFixed(2)}, so ${m.country} is "${tier}" — a market to pursue first.`;
  } else if (weighted! >= cfg.cutoffs.tier2) {
    tierReason = `That total of ${weighted!.toFixed(2)} reaches the Tier 2 cut-off of ${cfg.cutoffs.tier2.toFixed(2)} but falls short of Tier 1 (${cfg.cutoffs.tier1.toFixed(2)}), so ${m.country} is "${tier}" — worth developing after the priority markets.`;
  } else if (weighted! >= cfg.cutoffs.tier3) {
    tierReason = `That total of ${weighted!.toFixed(2)} reaches the Tier 3 cut-off of ${cfg.cutoffs.tier3.toFixed(2)} but falls short of Tier 2 (${cfg.cutoffs.tier2.toFixed(2)}), so ${m.country} is "${tier}" — keep an eye on it, but don't invest heavily yet.`;
  } else {
    tierReason = `That total of ${weighted!.toFixed(2)} is below the Tier 3 cut-off of ${cfg.cutoffs.tier3.toFixed(2)}, so ${m.country} is "${tier}" — assessed and set aside for now.`;
  }

  const paragraphs = [
    `${m.country} scores ${weighted!.toFixed(2)} out of 5. The calculation: ${calc}. Together: ${weighted!.toFixed(2)}.`,
    tierReason,
    `The biggest contributor is ${strongest.label} (adds ${strongest.contribution.toFixed(2)} of the total); the weakest input is ${weakest.label} at ${weakest.score}/5${weakest.label === strongest.label ? "" : ", which is holding the score down"}.`,
    fitNote,
  ];
  if (m.scored_by && m.scored_at) {
    paragraphs.push(
      `Manual scores entered by ${m.scored_by} on ${m.scored_at.slice(0, 10)}. Every entry is recorded in this market's provenance log below.`
    );
  }
  return paragraphs;
}

/** Recompute weighted score and tier for every market (used after the scoring
 *  configuration changes). Returns how many markets changed tier. */
export function recomputeAllMarkets(cfg: ScoringConfig): number {
  const db = getDb();
  const markets = db
    .prepare(
      `SELECT id, market_size_score, access_ease_score, diaspora_fit_score, competition_score, weighted_score, priority_tier FROM markets`
    )
    .all() as (ScoreInputs & { id: number; weighted_score: number | null; priority_tier: string })[];
  const update = db.prepare(
    `UPDATE markets SET weighted_score = ?, priority_tier = ?, updated_at = datetime('now') WHERE id = ?`
  );
  let tierChanges = 0;
  const run = db.transaction(() => {
    for (const m of markets) {
      const { weighted, tier } = computeScore(m, cfg);
      if (tier !== m.priority_tier) tierChanges++;
      update.run(weighted, tier, m.id);
    }
  });
  run();
  return tierChanges;
}
