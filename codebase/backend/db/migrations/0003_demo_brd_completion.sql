-- Demo BRD completion: scheduler, notifications, AI extensions, attestation

CREATE TABLE IF NOT EXISTS trigger_jobs (
  job_id TEXT PRIMARY KEY,
  event_id TEXT,
  trigger_type TEXT NOT NULL,
  user_group TEXT NOT NULL,
  template_id TEXT,
  trigger_ref TEXT,
  fire_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  form_instance_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fired_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_log (
  notification_id TEXT PRIMARY KEY,
  form_instance_id TEXT,
  channel TEXT NOT NULL,
  recipient TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  notification_type TEXT NOT NULL DEFAULT 'dispatch',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submission_responses (
  response_id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  acknowledgement_text TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id)
);

CREATE TABLE IF NOT EXISTS ai_entities (
  entity_id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  entity_type TEXT,
  entity_value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id)
);

CREATE TABLE IF NOT EXISTS generated_reports (
  report_id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  title TEXT,
  body TEXT,
  reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS risk_signals (
  signal_id TEXT PRIMARY KEY,
  signal_type TEXT NOT NULL,
  resource_id TEXT,
  score REAL,
  summary TEXT,
  severity TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dcf_notification_records (
  record_id TEXT PRIMARY KEY,
  filing_ref TEXT NOT NULL UNIQUE,
  notification_sent INTEGER NOT NULL DEFAULT 1,
  documented_at TEXT
);

ALTER TABLE submissions ADD COLUMN attested INTEGER;
ALTER TABLE submissions ADD COLUMN attestation_version TEXT;
ALTER TABLE submissions ADD COLUMN demo_demographic TEXT;
ALTER TABLE submissions ADD COLUMN office_id TEXT;

ALTER TABLE form_instances ADD COLUMN office_id TEXT;

CREATE INDEX IF NOT EXISTS idx_trigger_jobs_fire_at ON trigger_jobs(fire_at, status);
CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(created_at);
CREATE INDEX IF NOT EXISTS idx_trigger_jobs_event ON trigger_jobs(event_id);
