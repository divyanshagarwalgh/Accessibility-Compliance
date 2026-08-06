-- Accessibility & Compliance Suite — initial schema
-- D1 (SQLite). Applied by Webflow Cloud from wrangler.json `migrations_dir`.
--
-- Conventions:
--   * ids are opaque text (nanoid/uuid) generated in the app, not autoincrement —
--     scan ids appear in public URLs (/a11y/report/[scanId]) and must not be enumerable.
--   * timestamps are INTEGER unix epoch milliseconds (UTC). SQLite has no date type and
--     integers sort, compare and index correctly.
--   * JSON columns are TEXT holding a JSON document, validated by CHECK(json_valid(...)).
--   * status/severity vocabularies are constrained by CHECK so a typo fails at write time.
--
-- NOTE: live scan status is served from KV, never from this database. These rows are the
-- durable record; KV is the hot path for 2-second client polling.

-- ---------------------------------------------------------------------------
-- scans — one row per scan request
-- ---------------------------------------------------------------------------
CREATE TABLE scans (
  id                TEXT PRIMARY KEY,
  url               TEXT NOT NULL,
  -- Normalised origin+path, used to group repeat scans of the same page.
  url_normalised    TEXT NOT NULL,
  domain            TEXT NOT NULL,

  status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','running','done','failed')),
  -- Machine-readable failure reason. Mirrors the prototype's three error states plus
  -- the cases the brief requires us to test explicitly.
  error_code        TEXT
                      CHECK (error_code IS NULL OR error_code IN (
                        'fetch_403','fetch_404','fetch_5xx','dns_failure','tls_failure',
                        'robots_disallowed','render_timeout','render_crash',
                        'not_html','too_large','rate_limited','internal_error'
                      )),
  error_detail      TEXT,

  -- 0-100. NULL until the scan completes. Formula is published on the methodology page.
  score             INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  issue_count       INTEGER NOT NULL DEFAULT 0,
  rule_count        INTEGER NOT NULL DEFAULT 0,

  requested_at      INTEGER NOT NULL,
  started_at        INTEGER,
  completed_at      INTEGER,

  -- Email that unlocked the full report. NULL while the report is still gated.
  email             TEXT,

  -- Provenance. Every report states which engine and ruleset produced it, so an old
  -- report stays interpretable after we upgrade axe-core.
  engine_version    TEXT NOT NULL DEFAULT 'axe-core@unknown',
  ruleset_version   TEXT NOT NULL DEFAULT 'wcag22aa',

  -- Honesty accounting, surfaced verbatim in the report's coverage slab.
  criteria_tested   INTEGER,
  criteria_total    INTEGER,

  -- R2 key for the raw axe-core JSON. Kept out of D1 to protect row size.
  raw_result_key    TEXT,

  -- Coarse abuse controls. Hashed, never the raw IP.
  requester_ip_hash TEXT,
  source_tool       TEXT,

  monitor_id        TEXT REFERENCES monitors(id) ON DELETE SET NULL
);

CREATE INDEX idx_scans_status       ON scans(status, requested_at);
CREATE INDEX idx_scans_domain       ON scans(domain, requested_at DESC);
CREATE INDEX idx_scans_url_norm     ON scans(url_normalised, requested_at DESC);
CREATE INDEX idx_scans_monitor      ON scans(monitor_id, requested_at DESC);
CREATE INDEX idx_scans_email        ON scans(email) WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- issues — one row per (scan, rule). Node-level detail lives in `selectors`.
-- ---------------------------------------------------------------------------
CREATE TABLE issues (
  id                TEXT PRIMARY KEY,
  scan_id           TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,

  -- Our stable rule id (e.g. 'contrast'), not the raw axe id, so the mapping layer can
  -- change without invalidating stored reports.
  rule_id           TEXT NOT NULL,
  axe_rule_id       TEXT,

  wcag_sc           TEXT NOT NULL,
  level             TEXT NOT NULL CHECK (level IN ('A','AA','AAA')),
  severity          TEXT NOT NULL CHECK (severity IN ('Critical','Serious','Moderate','Minor')),

  node_count        INTEGER NOT NULL DEFAULT 0,

  -- JSON array of affected nodes: [{selector, html, text, fgHex, bgHex, ratio, ...}]
  selectors         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(selectors)),

  -- Plain-English explanation shown to the user.
  why               TEXT NOT NULL,

  -- JSON array of ordered Webflow Designer steps. THE differentiator.
  webflow_steps     TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(webflow_steps)),
  -- FALSE when we have no Webflow-specific guidance yet and are showing generic axe
  -- output. Surfaced in the UI so the gap is visible rather than hidden.
  has_webflow_steps INTEGER NOT NULL DEFAULT 0 CHECK (has_webflow_steps IN (0,1)),

  -- TRUE when the failing node sits inside a Collection List, so the fix belongs on the
  -- CMS field rather than the element.
  is_cms_bound      INTEGER NOT NULL DEFAULT 0 CHECK (is_cms_bound IN (0,1)),
  cms_hint          TEXT,

  -- User triage, per the issue-detail sidebar.
  state             TEXT NOT NULL DEFAULT 'open'
                      CHECK (state IN ('open','fixed','snoozed')),

  created_at        INTEGER NOT NULL
);

CREATE INDEX idx_issues_scan      ON issues(scan_id, severity);
CREATE INDEX idx_issues_rule      ON issues(rule_id);
CREATE UNIQUE INDEX idx_issues_scan_rule ON issues(scan_id, rule_id);

-- ---------------------------------------------------------------------------
-- pages — per-URL results for multi-page scans
-- ---------------------------------------------------------------------------
CREATE TABLE pages (
  id            TEXT PRIMARY KEY,
  scan_id       TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  score         INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  issue_count   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','running','done','failed','skipped')),
  error_code    TEXT,
  scanned_at    INTEGER
);

CREATE INDEX idx_pages_scan ON pages(scan_id);
CREATE UNIQUE INDEX idx_pages_scan_url ON pages(scan_id, url);

-- ---------------------------------------------------------------------------
-- leads — email capture, synced to Brevo
-- ---------------------------------------------------------------------------
CREATE TABLE leads (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  scan_id       TEXT REFERENCES scans(id) ON DELETE SET NULL,
  -- Which module produced the lead: 'scanner' | 'vpat' | 'statement' | 'alt-text' | ...
  -- Never 'contrast' — the contrast checker is ungated by design.
  source_tool   TEXT NOT NULL,
  domain        TEXT,
  score         INTEGER,
  -- Opt-in from the gate's "monthly re-scan" checkbox.
  wants_rescan  INTEGER NOT NULL DEFAULT 0 CHECK (wants_rescan IN (0,1)),
  brevo_synced  INTEGER NOT NULL DEFAULT 0 CHECK (brevo_synced IN (0,1)),
  brevo_error   TEXT,
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_leads_email   ON leads(email);
CREATE INDEX idx_leads_unsynced ON leads(brevo_synced, created_at) WHERE brevo_synced = 0;

-- ---------------------------------------------------------------------------
-- monitors — scheduled re-scans
-- ---------------------------------------------------------------------------
CREATE TABLE monitors (
  id            TEXT PRIMARY KEY,
  site_url      TEXT NOT NULL,
  owner_email   TEXT NOT NULL,
  -- 'weekly' | 'daily' | 'on-publish'
  schedule      TEXT NOT NULL DEFAULT 'weekly',
  -- JSON: {scoreDropPoints: 5, newCritical: true, anyRegression: true}
  thresholds    TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(thresholds)),
  -- JSON array of additional alert recipients.
  recipients    TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(recipients)),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  last_run_at   INTEGER,
  next_run_at   INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_monitors_due   ON monitors(is_active, next_run_at);
CREATE INDEX idx_monitors_owner ON monitors(owner_email);

-- ---------------------------------------------------------------------------
-- monitor_runs — one row per scheduled execution
-- ---------------------------------------------------------------------------
CREATE TABLE monitor_runs (
  id            TEXT PRIMARY KEY,
  monitor_id    TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  scan_id       TEXT REFERENCES scans(id) ON DELETE SET NULL,
  run_at        INTEGER NOT NULL,
  score         INTEGER,
  -- Signed change vs the previous run. Drives the +4 / -14 deltas in the dashboard.
  delta         INTEGER,
  -- JSON array of rules that previously passed and now fail.
  regressions   TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(regressions)),
  alert_sent    INTEGER NOT NULL DEFAULT 0 CHECK (alert_sent IN (0,1))
);

CREATE INDEX idx_monitor_runs ON monitor_runs(monitor_id, run_at DESC);

-- ---------------------------------------------------------------------------
-- documents — generated statements and VPATs
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('statement','vpat')),
  scan_id       TEXT REFERENCES scans(id) ON DELETE SET NULL,
  -- JSON: the full document model (fields, rows, known limitations).
  payload       TEXT NOT NULL CHECK (json_valid(payload)),
  -- R2 key for an exported .docx/.pdf, once generated.
  export_key    TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX idx_documents_scan ON documents(scan_id, type);
