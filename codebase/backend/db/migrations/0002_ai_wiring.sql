ALTER TABLE ai_inferences ADD COLUMN confidence REAL;
ALTER TABLE ai_inferences ADD COLUMN latency_ms INTEGER;
ALTER TABLE ai_inferences ADD COLUMN fallback_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_inferences ADD COLUMN model TEXT;
ALTER TABLE ai_inferences ADD COLUMN error_message TEXT;

ALTER TABLE supervisor_queue ADD COLUMN queue_kind TEXT NOT NULL DEFAULT 'supervisor';

INSERT INTO admin_config (config_key, config_value, updated_at)
VALUES
  ('llm_provider', 'huggingface', datetime('now')),
  ('hf_model', 'Qwen/Qwen2.5-7B-Instruct:featherless-ai', datetime('now')),
  ('hf_api_base', 'https://router.huggingface.co/v1', datetime('now')),
  ('llm_request_timeout_ms', '600000', datetime('now')),
  ('hf_token_source', 'HF_API_TOKEN', datetime('now'))
ON CONFLICT(config_key) DO NOTHING;
