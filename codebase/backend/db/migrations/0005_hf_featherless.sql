-- Pin default HF model to the live Inference Provider (Featherless AI).
UPDATE admin_config
SET config_value = 'Qwen/Qwen2.5-7B-Instruct:featherless-ai',
    updated_at = datetime('now')
WHERE config_key = 'hf_model'
  AND (
    config_value = 'Qwen/Qwen2.5-7B-Instruct'
    OR config_value = 'Qwen/Qwen2.5-7B-Instruct:together'
  );

INSERT INTO admin_config (config_key, config_value, updated_at)
VALUES ('hf_model', 'Qwen/Qwen2.5-7B-Instruct:featherless-ai', datetime('now'))
ON CONFLICT(config_key) DO NOTHING;
