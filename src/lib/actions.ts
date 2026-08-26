"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadScoringConfig, computeScore, recomputeAllMarkets } from "@/lib/scoring";

const SOURCE_APP = "Lead Engine app";

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}#score`);
}

function parseScoreField(raw: FormDataEntryValue | null): number | null | "invalid" {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 5) return "invalid";
  return n;
}

export async function saveMarketScores(formData: FormData) {
  const id = Number(formData.get("market_id"));
  const db = getDb();
  const market = db
    .prepare(
      `SELECT id, country, market_size_score, access_ease_score, diaspora_fit_score, competition_score FROM markets WHERE id = ?`
    )
    .get(id) as
    | { id: number; country: string; market_size_score: number | null; access_ease_score: number | null; diaspora_fit_score: number | null; competition_score: number | null }
    | undefined;
  if (!market) redirect("/markets");
  const back = `/markets/${market.id}`;

  const who = String(formData.get("scored_by") ?? "").trim().slice(0, 60);
  if (!who) fail(back, "Please enter your name — every score is recorded with who entered it and when.");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  const fields = [
    { key: "market_size_score", label: "Market Size" },
    { key: "access_ease_score", label: "Access Ease" },
    { key: "competition_score", label: "Competition" },
  ] as const;

  const next: Record<string, number | null> = {};
  for (const f of fields) {
    const v = parseScoreField(formData.get(f.key));
    if (v === "invalid") fail(back, `${f.label} must be a whole number from 1 to 5 (or left blank to clear it).`);
    next[f.key] = v;
  }

  const now = new Date().toISOString();
  const insertProv = db.prepare(
    `INSERT INTO research_sources (entity_type, entity_id, field_name, original_value, normalised_value, source_file, worksheet, source_ref, method, confidence, notes, imported_at)
     VALUES ('market', @id, @field, @orig, @val, @source, NULL, NULL, 'manual', 'Manually entered — human judgement', @notes, @now)`
  );

  const changed: string[] = [];
  const tx = db.transaction(() => {
    for (const f of fields) {
      const before = market[f.key];
      const after = next[f.key];
      if (before === after) continue;
      changed.push(f.label);
      insertProv.run({
        id: market.id,
        field: f.key,
        orig: before === null ? null : String(before),
        val: after === null ? null : String(after),
        source: SOURCE_APP,
        notes: `${after === null ? "Cleared" : "Entered"} by ${who}${note ? ` — ${note}` : ""}`,
        now,
      });
    }
    const merged = {
      market_size_score: next.market_size_score,
      access_ease_score: next.access_ease_score,
      diaspora_fit_score: market.diaspora_fit_score,
      competition_score: next.competition_score,
    };
    const cfg = loadScoringConfig();
    const { weighted, tier } = computeScore(merged, cfg);
    db.prepare(
      `UPDATE markets SET market_size_score = ?, access_ease_score = ?, competition_score = ?,
         weighted_score = ?, priority_tier = ?, scored_by = ?, scored_at = ?,
         last_reviewed_at = ?, updated_at = ? WHERE id = ?`
    ).run(
      merged.market_size_score,
      merged.access_ease_score,
      merged.competition_score,
      weighted,
      tier,
      who,
      now,
      now,
      now,
      market.id
    );
  });
  tx();

  for (const p of ["/", "/markets", `/markets/${market.id}`, "/scoring"]) revalidatePath(p);
  const msg = changed.length
    ? `Saved. ${changed.join(", ")} updated and the weighted score recalculated.`
    : "No score values changed — nothing to save.";
  redirect(`${back}?saved=${encodeURIComponent(msg)}#score`);
}

export async function updateScoringConfig(formData: FormData) {
  const back = "/settings/scoring";
  const db = getDb();

  const who = String(formData.get("changed_by") ?? "").trim().slice(0, 60);
  if (!who) fail(back, "Please enter your name — configuration changes are recorded with who made them and when.");

  const pctField = (key: string, label: string): number => {
    const n = Number(String(formData.get(key) ?? "").trim());
    if (!Number.isFinite(n) || n < 0 || n > 100) fail(back, `${label} must be a percentage between 0 and 100.`);
    return Math.round(n * 10) / 1000; // percent -> fraction, 0.1% precision
  };
  const cutField = (key: string, label: string): number => {
    const n = Number(String(formData.get(key) ?? "").trim());
    if (!Number.isFinite(n) || n <= 0 || n > 5) fail(back, `${label} must be a number above 0 and at most 5.`);
    return Math.round(n * 100) / 100;
  };

  const weights = {
    weight_market_size: pctField("weight_market_size", "Market Size weight"),
    weight_access_ease: pctField("weight_access_ease", "Access Ease weight"),
    weight_diaspora_fit: pctField("weight_diaspora_fit", "Diaspora Fit weight"),
    weight_competition: pctField("weight_competition", "Competition weight"),
  };
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.001) {
    fail(back, `The four weights must total exactly 100% — they currently total ${(sum * 100).toFixed(1)}%.`);
  }
  const cutoffs = {
    tier1_cutoff: cutField("tier1_cutoff", "Tier 1 cut-off"),
    tier2_cutoff: cutField("tier2_cutoff", "Tier 2 cut-off"),
    tier3_cutoff: cutField("tier3_cutoff", "Tier 3 cut-off"),
  };
  if (!(cutoffs.tier1_cutoff > cutoffs.tier2_cutoff && cutoffs.tier2_cutoff > cutoffs.tier3_cutoff)) {
    fail(back, "Cut-offs must descend: Tier 1 above Tier 2, Tier 2 above Tier 3.");
  }

  const now = new Date().toISOString();
  const current = Object.fromEntries(
    (db.prepare(`SELECT config_key, config_value FROM scoring_config`).all() as { config_key: string; config_value: string }[]).map(
      (r) => [r.config_key, r.config_value]
    )
  );
  const updates: [string, string][] = [...Object.entries(weights), ...Object.entries(cutoffs)].map(
    ([k, v]) => [k, String(v)]
  );

  const upsert = db.prepare(
    `INSERT INTO scoring_config (config_key, config_value, description, source, updated_at)
     VALUES (@key, @value, @desc, @source, @now)
     ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, source = excluded.source, updated_at = excluded.updated_at`
  );
  const insertProv = db.prepare(
    `INSERT INTO research_sources (entity_type, entity_id, field_name, original_value, normalised_value, source_file, worksheet, source_ref, method, confidence, notes, imported_at)
     VALUES ('scoring_config', NULL, @field, @orig, @val, @source, NULL, NULL, 'manual', 'Manually entered — human judgement', @notes, @now)`
  );

  const changed: string[] = [];
  const tx = db.transaction(() => {
    for (const [key, value] of updates) {
      if (current[key] === value) continue;
      changed.push(key);
      upsert.run({ key, value, desc: null, source: `${SOURCE_APP} — changed by ${who}`, now });
      insertProv.run({
        field: key,
        orig: current[key] ?? null,
        val: value,
        source: SOURCE_APP,
        notes: `Changed by ${who}`,
        now,
      });
    }
  });
  tx();

  let msg: string;
  if (changed.length === 0) {
    msg = "No values changed — nothing to save.";
  } else {
    const tierChanges = recomputeAllMarkets(loadScoringConfig());
    msg = `Saved ${changed.length} setting${changed.length === 1 ? "" : "s"} and recalculated all 195 markets — ${tierChanges} market${tierChanges === 1 ? "" : "s"} changed tier.`;
  }
  for (const p of ["/", "/markets", "/scoring", back]) revalidatePath(p);
  redirect(`${back}?saved=${encodeURIComponent(msg)}`);
}
