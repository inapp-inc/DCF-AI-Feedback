PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS demo_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  office_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES demo_users(user_id)
);

CREATE TABLE IF NOT EXISTS form_templates (
  template_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_group TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  schema_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trigger_events (
  trigger_event_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  trigger_type TEXT NOT NULL,
  user_group TEXT NOT NULL,
  trigger_ref TEXT,
  payload_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_instances (
  form_instance_id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  trigger_event_id TEXT,
  user_group TEXT NOT NULL,
  trigger_ref TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES form_templates(template_id),
  FOREIGN KEY (trigger_event_id) REFERENCES trigger_events(trigger_event_id)
);

CREATE TABLE IF NOT EXISTS dynamic_links (
  link_id TEXT PRIMARY KEY,
  form_instance_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (form_instance_id) REFERENCES form_instances(form_instance_id)
);

CREATE TABLE IF NOT EXISTS survey_dispatches (
  dispatch_id TEXT PRIMARY KEY,
  form_instance_id TEXT NOT NULL,
  custom_link TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'both',
  sent_by TEXT,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (form_instance_id) REFERENCES form_instances(form_instance_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  submission_id TEXT PRIMARY KEY,
  form_instance_id TEXT NOT NULL,
  user_group TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  answers_json TEXT NOT NULL,
  ai_opt_out INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (form_instance_id) REFERENCES form_instances(form_instance_id)
);

CREATE TABLE IF NOT EXISTS ai_inferences (
  inference_id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'huggingface',
  topic TEXT,
  sentiment_score REAL,
  urgency TEXT,
  explainability_summary TEXT,
  recommended_route TEXT,
  privilege_tagged INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id)
);

CREATE TABLE IF NOT EXISTS supervisor_queue (
  queue_item_id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  user_group TEXT NOT NULL,
  office_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  reason TEXT,
  assignee TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id)
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  metric_day TEXT NOT NULL,
  user_group TEXT NOT NULL,
  office_id TEXT,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  avg_sentiment REAL,
  high_urgency_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_day, user_group, office_id)
);

CREATE TABLE IF NOT EXISTS admin_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS export_jobs (
  export_id TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  filters_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  file_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_event_id TEXT PRIMARY KEY,
  actor TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_instances_user_group ON form_instances(user_group);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_links_token ON dynamic_links(token);
CREATE INDEX IF NOT EXISTS idx_survey_dispatches_instance ON survey_dispatches(form_instance_id);
CREATE INDEX IF NOT EXISTS idx_submissions_instance ON submissions(form_instance_id);
CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON supervisor_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);
