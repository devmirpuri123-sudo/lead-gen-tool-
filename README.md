# SACVIN GLOBAL PLASTICS LEAD ENGINE

Internal semi-automated lead-generation system for **SACVIN Nigeria Limited** and
**Veeglow Engineering Solutions** — identify, research, score, manage and warm
potential wholesalers, distributors, retailers, importers and trade partners for
plastics products worldwide.

**Ground rules baked into the system:**

- Nothing is ever sent automatically. All outreach drafts are human-reviewed and
  sent manually. There is no LinkedIn automation of any kind.
- Imported data is planning-grade. Every value carries provenance (original
  value, normalised value, source file, worksheet, cell, import date, method,
  confidence). Missing facts are labelled **"Unknown — requires research"**,
  uncertain ones **"Unverified — requires human review"** — never invented.
- Diaspora data is a country-level market-prioritisation input only. It is never
  used as a personal targeting attribute.

## How to run it (plain English)

You need Node.js 20+ installed. Then, from this folder:

```bash
npm install              # one-time: download the app's building blocks
npm run import:workbook  # load data/source/Countries_by_Continent.xlsx into the database
npm run dev              # start the app, then open http://localhost:3000
```

The database is a single file, `data/app.db`. It is not stored in git — the
import command rebuilds it from the source workbook at any time. The original
workbook in `data/source/` is read-only and is never modified.

## What exists so far (Phase 1)

- **Eight database tables**: markets, companies, contacts, leads,
  outreach_drafts, activities, research_sources (doubles as field-level
  provenance), scoring_config. See `src/lib/db/schema.sql`.
- **Workbook importer** (`scripts/import-workbook.mjs`): imports all 195
  markets, the scoring weights/cut-offs/diaspora mapping from the Scoring Guide
  sheet, and the workbook's own caveats — ~4,200 provenance records in total.
- **Dashboard** (`/`): counts, markets by continent, the scoring model, and the
  source caveats.
- **Markets page** (`/markets`): all 195 markets with search and filters
  (continent, tier, income tier, owner).
- **Market detail** (`/markets/[id]`): every field grouped by topic, amber
  research inputs shown as "Unknown — requires research", the full provenance
  table, a plain-English "Why this score?" explanation, and the score-entry
  form (Phase 2).
- **Scoring workspace** (`/scoring`): progress bar, the workbook's own 1–5
  scale definitions, a "score the next market" queue (High diaspora-priority
  first, then largest population), and per-market scoring status.
- **Scoring configuration** (`/settings/scoring`): adjust the four weights
  (must total 100%) and the three tier cut-offs (must descend). Saving
  recalculates all 195 markets instantly and logs the change history.

### Who/when audit trail (Phase 2)

Every manually entered score and every configuration change requires a name and
is written to the provenance log (`research_sources`) with the previous value,
the new value, who made the change, and when. Re-running the workbook import
never wipes manual work: manually entered scores and manually changed
configuration values survive, and a workbook cell that has been filled in wins
over an older app entry only for that cell.

### Scoring rules (approved 2026-08-26)

- Weights: Market Size 30%, Access Ease 25%, Diaspora Fit 20%, Competition 25%
  (imported from the Scoring Guide sheet, editable in `scoring_config`).
- Tiers: ≥4.00 Tier 1 - Priority · ≥3.00 Tier 2 - Develop · ≥2.00 Tier 3 -
  Monitor · below 2.00 **Tier 4 - Deprioritise** (kept from the workbook).
- Diaspora Fit is auto-mapped from Diaspora Priority: High=5, Home=4, Medium=3, Low=1.
- **Stricter than the workbook:** a weighted score is only computed when all
  three manual scores (Market Size, Access Ease, Competition) are present and
  valid (1–5). Partial input stays "Not scored".

## Roadmap

- **Phase 2** — ✅ done: scoring workspace, validation, weighted scores and
  tiers, plain-English explanations, scoring configuration, who/when audit.
- **Phase 3** — companies, contacts and leads: CSV import, duplicate detection,
  the 16-status pipeline, lead scoring.
- **Phase 4** — outreach workspace: human-reviewed email/LinkedIn drafts (never
  auto-sent), follow-up reminders, next-action recommendations.
- **Phase 5** — reporting: weekly report, data-quality and duplicate reports,
  XLSX/CSV export.

## Technical notes

Next.js 15 (App Router, TypeScript) · SQLite via better-sqlite3 · Tailwind CSS 4.
Rebuild for production with `npm run build && npm run start`.

---

## MCP servers (pre-existing repo config)

This repo ships a project-scoped MCP config in [`.mcp.json`](.mcp.json) for the
`magic` (`@21st-dev/magic`) UI-generation server. It is optional and unused by
the app itself. Setup: get a key at https://21st.dev/mcp, export
`MAGIC_API_KEY`, then approve the server in Claude Code. `.env` and
`.claude/settings.local.json` are gitignored.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) validates `.mcp.json` on
every push to `main` and every pull request (file parses, each server declares a
`command` or `url`, credential-shaped env keys hold `${VAR}` references rather
than literal secrets, no non-ASCII env values). Run locally:

```bash
python3 .github/scripts/validate_mcp_config.py
```
