-- SACVIN GLOBAL PLASTICS LEAD ENGINE — database schema (Phase 1)
-- Eight core tables. SQLite dialect.

CREATE TABLE IF NOT EXISTS markets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country TEXT NOT NULL UNIQUE,
  country_normalised TEXT NOT NULL,
  continent TEXT,
  sub_region TEXT,
  population REAL,
  population_band TEXT,
  gdp_nominal_usd REAL,
  gdp_per_capita_usd REAL,
  income_tier TEXT,
  -- Diaspora data is a country-level market-prioritisation input ONLY.
  -- It must never be used as a personal targeting attribute.
  diaspora_flag TEXT,
  est_african_descent_population_text TEXT,
  est_african_descent_population_num REAL,
  diaspora_profile TEXT,
  diaspora_priority TEXT,
  landlocked TEXT,
  ecowas_status TEXT,
  afcfta_status TEXT,
  trade_bloc TEXT,
  business_language TEXT,
  notes TEXT,
  -- Amber research inputs: NULL means "Unknown — requires research".
  existing_buyer TEXT,
  import_duty_pct_text TEXT,
  est_annual_import_value_usd REAL,
  local_competition TEXT,
  distributor_status TEXT,
  assigned_owner TEXT,
  -- Manual 1-5 scores. Weighted score requires ALL of market_size,
  -- access_ease and competition to be present; otherwise "Not scored".
  market_size_score REAL,
  access_ease_score REAL,
  diaspora_fit_score REAL,
  competition_score REAL,
  weighted_score REAL,
  priority_tier TEXT NOT NULL DEFAULT 'Not scored',
  scored_by TEXT,
  scored_at TEXT,
  confidence TEXT NOT NULL DEFAULT 'Unverified — requires human review',
  last_reviewed_at TEXT,
  source_row_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id INTEGER REFERENCES markets(id),
  name TEXT NOT NULL,
  name_normalised TEXT NOT NULL,
  website TEXT,
  company_type TEXT, -- business type: importer / distributor / wholesaler / retail chain / …
  description TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  confidence TEXT NOT NULL DEFAULT 'Unverified — requires human review',
  notes TEXT,
  -- Enrichment fields (SACVIN Export Lead Enrichment workbook, LEAD MASTER).
  -- NULL always means "Unknown — requires research".
  external_ref TEXT,             -- workbook Lead ID, e.g. SAC/LEAD/0001
  record_status TEXT,            -- New / Enriching / Enriched / Verified / Qualified / …
  added_by TEXT,
  region TEXT,
  city TEXT,
  product_categories TEXT,
  category_match TEXT,           -- Core / Partial / None
  own_brand TEXT,
  year_established TEXT,
  employees_band TEXT,
  est_annual_revenue_usd REAL,
  company_size TEXT,             -- Large / Medium / Small / Unknown
  outlets TEXT,
  linkedin_company_url TEXT,
  imports_flag TEXT,             -- Yes / No / Unknown
  hs_codes TEXT,
  source_countries TEXT,
  competing_origin TEXT,         -- Yes / Partly / No / Unknown
  known_suppliers TEXT,
  import_volume_ctnrs_yr REAL,
  import_value_usd_yr REAL,
  container_type TEXT,
  import_frequency TEXT,
  last_known_shipment TEXT,
  displacement_opportunity TEXT, -- High / Medium / Low / Unknown
  import_data_source TEXT,
  discharge_port TEXT,
  preferential_access TEXT,
  compliance_certs TEXT,
  language TEXT,
  priority_products TEXT,
  est_opportunity_usd REAL,
  lead_source_tool TEXT,
  date_pulled TEXT,
  verified_by TEXT,
  verification_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id),
  full_name TEXT NOT NULL,
  role_title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT, -- manually researched only; no scraping
  country TEXT,
  confidence TEXT NOT NULL DEFAULT 'Unverified — requires human review',
  notes TEXT,
  -- Enrichment fields (workbook CONTACTS / LEAD MASTER group 5).
  external_ref TEXT,      -- workbook Contact ID, e.g. SAC/CON/0001
  contact_function TEXT,  -- MD / CEO, Category buyer, …
  decision_role TEXT,     -- Decision maker / Influencer / Gatekeeper / Unknown
  email_status TEXT,      -- Valid / Risky / catch-all / Invalid / Not verified
  whatsapp TEXT,
  language TEXT,
  best_time_to_call TEXT,
  source_tool TEXT,       -- Apollo / LinkedIn Sales Navigator / …
  date_pulled TEXT,
  verified_flag TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id),
  contact_id INTEGER REFERENCES contacts(id),
  market_id INTEGER REFERENCES markets(id),
  status TEXT NOT NULL DEFAULT 'New'
    CHECK (status IN ('New','Imported','Needs research','Reviewed','Cold',
      'Approved for outreach','Contacted','Engaged','Replied','Warm',
      'Qualified','Meeting booked','Nurture','Not a fit','Do not contact','Closed')),
  score REAL,
  score_explanation TEXT,
  next_action TEXT,
  next_action_due TEXT,
  owner TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outreach_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','linkedin')),
  subject TEXT,
  body TEXT,
  -- Drafts are never sent automatically. 'sent_manually' is recorded by a
  -- human after they send it themselves.
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','sent_manually','discarded')),
  requires_human_review INTEGER NOT NULL DEFAULT 1 CHECK (requires_human_review = 1),
  template_key TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  sent_by TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id),
  activity_type TEXT NOT NULL, -- note / email_sent_manually / linkedin_manual / call / reminder / status_change
  description TEXT,
  due_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Research sources double as field-level provenance: one row per fact,
-- recording where it came from and how it was obtained.
CREATE TABLE IF NOT EXISTS research_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- market / company / contact / lead / workbook / scoring_config
  entity_id INTEGER,
  field_name TEXT,
  original_value TEXT,
  normalised_value TEXT,
  source_file TEXT,
  worksheet TEXT,
  source_ref TEXT, -- cell/row reference or URL
  method TEXT NOT NULL CHECK (method IN ('imported','calculated','manual','researched')),
  confidence TEXT,
  notes TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scoring_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  source TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_markets_continent ON markets(continent);
CREATE INDEX IF NOT EXISTS idx_markets_tier ON markets(priority_tier);
CREATE INDEX IF NOT EXISTS idx_companies_market ON companies(market_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_research_entity ON research_sources(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_research_field ON research_sources(entity_type, entity_id, field_name);
