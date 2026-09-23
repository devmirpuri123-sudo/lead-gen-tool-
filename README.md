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

The first page you see asks you to create an account — see **Access** below.

The database is a single file, `data/app.db`. It is not stored in git — the
import command rebuilds it from the source workbook at any time. The original
workbook in `data/source/` is read-only and is never modified.

## Hosting it for the team

A private address like `http://192.168.1.47:3000` only exists inside one WiFi
network and can never be reached from outside it. To give the team real access,
see **[DEPLOYMENT.md](DEPLOYMENT.md)** — a step-by-step guide written for a
non-technical reader.

In short: the app ships with a `Dockerfile`, keeps its database wherever
`DATABASE_PATH` points (put that on a mounted disk so it survives restarts), and
loads the 195 markets from the source workbook automatically the first time it
starts against an empty database.

## Access

The engine holds named individuals' work contact details, most of them in the
EU. That is personal data, so nothing is readable without signing in.

- **Every page, every server action and the export endpoint require a valid
  session.** There is no anonymous read path.
- **First run**: with no accounts in the database, the app shows a one-time
  setup page that creates the first administrator. Set a `SETUP_TOKEN`
  environment variable to require a code on that page — recommended for a
  hosted deployment, where the address is reachable before you have claimed it.
- **Passwords** are stored as scrypt hashes and cannot be read back by anyone,
  including an administrator. A reset is the only route. Minimum 12 characters;
  eight failed attempts locks an account for 15 minutes.
- **Sessions** are random 256-bit tokens in an HttpOnly cookie; the database
  stores only a SHA-256 of the token, so a copy of the database yields no live
  sessions. They expire after 14 days of inactivity.
- **Administrators** add and remove people at `/settings/team`. Removing access
  signs that person out of every browser immediately. Their name stays on the
  scores, notes and approvals they entered — the audit trail is never rewritten.
- The app can never remove its own last active administrator.

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

- **Companies** (`/companies`): list with search/filters, manual entry form
  (`/companies/new`), CSV import (`/companies/import`), and a detail page with
  editable fields, contacts, leads, a research checklist and provenance.
- **Leads** (`/leads`): the 16-status pipeline board, filterable list with live
  0–100 lead scores, and a detail page (`/leads/[id]`) with the pipeline
  position, a fully explained score, status changes, notes and an activity log.

### Companies, contacts & leads (Phase 3)

- Manual entry only records what you actually researched; blank fields display
  as "Unknown — requires research" and are never guessed.
- Duplicate detection: an identical name or website domain blocks creation
  (override checkbox available); similar names ignoring suffixes like
  Ltd/Trading/Group are flagged as possible duplicates. CSV imports skip exact
  duplicates (in-file and against the database) and flag possible ones.
- CSV import (`/companies/import`) cleans rows, validates emails, matches
  countries against the market list, reports every skipped/flagged row, stores
  the report for later review, and records file + row number provenance for
  every value. Optionally creates an "Imported" lead per company.
- Lead scoring is transparent: Market attractiveness (0–40, from the market's
  priority tier) + Partner-type fit (0–30) + Research completeness (0–30),
  with a plain-English explanation naming every missing input. A low score
  from missing data is labelled as such, not treated as a verdict.
- Every status change and note is logged in the activity trail with who/when.
  "Do not contact" is respected: the score panel says outreach may not be
  drafted for such leads.

- **Outreach workspace** (`/outreach`): follow-up reminders (overdue first),
  drafts awaiting review / approved awaiting manual send, per-lead next-action
  recommendations, and a recently-sent log.
- **Draft review** (`/outreach/[id]`): edit, approve, mark sent manually,
  revert to draft, or discard — with the full who/when audit line.

- **Reports** (`/reports`): weekly report (new leads, status movements,
  outreach sent, replies, markets scored, overdue follow-ups, activity by
  person — with previous/next week navigation), data-quality &amp; duplicates
  report (open research work per table, stale leads, similar names, shared
  domains, shared emails), and one-click CSV/XLSX exports of markets,
  companies, contacts and leads (lead exports include the live score and its
  breakdown). The dashboard shows the pipeline by stage, the last 7 days of
  activity, market tiers, and an overdue-follow-ups alert.

### Automatic score suggestions (Phase 7)

Scoring 195 markets by hand is the slowest job in the system, so the app now
works the scores out for you and asks a person to accept them.

- **Suggested scores** appear on every market page beside the manual form. Each
  criterion shows a proposed 1–5, the plain-English reason, and the exact facts
  used — e.g. *"Market Size 5 — recorded household-plastics imports of $1.2bn a
  year"*, *"Access Ease 4 — coastal, 6.5% import duty, EU Single Market"*.
- **Nothing is ever scored automatically.** A named person clicks *Accept
  suggested scores*; until then the market stays as it was, and every accepted
  score remains editable by hand afterwards.
- **It refuses to guess.** Where a fact is missing the suggestion is withheld and
  the panel names what to research instead. Market Size falls back to population
  and GDP as a stand-in when no import figure exists, and says so.
- **Score many at once** (`/scoring/suggestions`): every market whose three
  criteria can be worked out, in one table, with tick-boxes and a single name
  field. A continent of markets is scored in one click instead of one afternoon.
- **The audit trail stays honest.** Accepted suggestions are written to
  provenance as `calculated`, sourced to "Lead Engine app — suggested score",
  with the reasoning and the accepting person's name — never mistakable for
  hand research. The provenance table now shows that reasoning column.

The suggestions are only as good as the facts behind them, so researched trade
data is loaded separately:

```bash
npm run import:research     # fills import value, duty and local competition
```

`data/research/europe-market-research.csv` carries HS 3924/3923 import values,
import duty rates and local-competition ratings for 43 European markets, each
row citing its source. Existing values are never overwritten (pass
`--overwrite` to replace them), and every value lands in provenance as
`researched` / *Unverified — requires human review*.

### Export Lead Enrichment integration (Phase 6)

The app is aligned with the team's field workbook,
`data/source/SACVIN_Export_Lead_Enrichment.xlsx` (stored read-only, never
modified):

- **Enriched data model**: companies carry the workbook's LEAD MASTER fields —
  import intelligence (Imports?, HS codes, source countries, suppliers,
  volumes/values, frequency, displacement opportunity, data source), commercial
  fit (discharge port, preferential access, compliance, language, priority
  SACVIN products, est. opportunity), and source & data quality (lead source
  tool, date pulled, verified by/when, workbook Lead ID). Contacts carry
  decision role, email status, WhatsApp, function, source tool and more.
- **Workbook upload**: `/companies/import` accepts the .xlsx directly — LEAD
  MASTER and CONTACTS are read by header name, the three shipped worked-example
  rows are recognised and skipped, duplicates are skipped and reported, and
  every value gets sheet + row provenance.
- **ICP fit score**: lead scoring now implements the workbook's own model
  (Business type 25 · Already importing 20 · Competing origin 20 · Company
  size 15 · Category match 10 · Contact quality 10; tiers A ≥75 / B ≥60 /
  C ≥40 / D). Point tables and thresholds are imported from the SCORING sheet
  into `scoring_config` and are editable; "Unknown" inputs get the model's
  explicit Unknown points and are named in the plain-English explanation,
  along with the workbook's 12-field data-completeness measure. The market
  weighted score (Tier 1–4) remains a separate, visible signal — it is not
  blended into the ICP score.

### Outreach (Phase 4) — human-reviewed, never automated

- Drafts are generated offline from fixed templates (email intro, email
  follow-up, LinkedIn connection note, LinkedIn message) using only facts on
  file. Unknown facts appear as loud [BRACKETED PLACEHOLDERS].
- A draft with unresolved placeholders cannot be approved — the server lists
  what still needs resolving. Only an approved draft can be marked sent.
- The system sends nothing. "Mark sent" records that a human sent the text
  themselves (email from their mailbox, LinkedIn from their own profile), and
  optionally sets a 7-day follow-up reminder and moves the lead to Contacted.
- **Do not contact is absolute**: the UI hides drafting for such leads and the
  server independently refuses to generate, approve or mark-send for them.
- Follow-up reminders have due dates, show overdue-first on the workspace and
  the lead page, and are completed with a name recorded.
- Next-action recommendations are rule-based and explained for every lead —
  research gaps first, then market scoring, draft review, sending, follow-ups
  and stage-appropriate advice.

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
- **Phase 3** — ✅ done: companies, contacts and leads, CSV import, duplicate
  detection, the 16-status pipeline, transparent lead scoring, research
  checklists.
- **Phase 4** — ✅ done: outreach workspace, template drafts with placeholder
  gating, approve/mark-sent-manually workflow, reminders, next-action engine,
  absolute Do-not-contact guardrails.
- **Phase 5** — ✅ done: upgraded dashboard, weekly report, data-quality and
  duplicate reports, XLSX/CSV export.

- **Phase 6** — ✅ done: Export Lead Enrichment workbook integration — enriched
  company/contact model, direct .xlsx upload, and the workbook's ICP fit-score
  model replacing the placeholder lead score.

- **Phase 7** — ✅ done: automatic score suggestions with plain-English
  reasoning, one-click acceptance per market, a bulk scoring screen, and a
  researched trade-data loader.

All MVP phases are complete. Natural next steps (when wanted): draft template
editing in-app, researched trade data for markets outside Europe, and a
backup/restore command for the database file.

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
