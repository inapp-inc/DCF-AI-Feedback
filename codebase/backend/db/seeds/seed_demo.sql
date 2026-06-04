INSERT OR IGNORE INTO demo_users (user_id, username, password_hash, role, office_id) VALUES
  ('u_admin_1',  'admin_demo',      'demo_hash_admin',  'admin',              'BOS-NORTH'),
  ('u_sup_1',    'supervisor_demo', 'demo_hash_sup',    'supervisor',         'BOS-NORTH'),
  ('u_legal_1',  'legal_demo',      'demo_hash_legal',  'legal_reviewer',     'BOS-NORTH'),
  ('u_mr_1',     'mr_demo',         'demo_hash_mr',     'mandated_reporter',  'BOS-NORTH'),
  ('u_vol_1',    'vol_demo',        'demo_hash_vol',    'volunteer',          'BOS-NORTH'),
  ('u_att_1',    'att_demo',        'demo_hash_att',    'attorney',           'BOS-NORTH'),
  ('u_fp_1',     'fp_demo',         'demo_hash_fp',     'foster_parent',      'BOS-NORTH');

INSERT OR REPLACE INTO form_templates (template_id, name, user_group, version, schema_json) VALUES
  ('tpl_mr_v1', 'Post-51A Survey', 'mandated_reporter', 1, '{"nextStepsLabel":"Next Steps","questions":[{"id":"reporter_category","type":"dropdown","label":"Reporter category","required":true,"options":["Healthcare professional","Educator","Law enforcement","Other"]},{"id":"hotline_wait","type":"likert","label":"Hotline wait time (1-5)","required":true},{"id":"professionalism","type":"likert","label":"Screener professionalism (1-5)","required":true},{"id":"next_steps_clarity","type":"likert","label":"Clarity of next steps (1-5)","required":true},{"id":"notification_timely","type":"likert","label":"Outcome notification timeliness (1-5)","required":true},{"id":"filing_reference","type":"text","label":"Filing reference","required":false},{"id":"comment","type":"text","label":"Optional comment (max 500 chars)","required":false}]}'),
  ('tpl_vol_v1', 'Volunteer Event Survey', 'volunteer', 1, '{"nextStepsLabel":"Next Steps","questions":[{"id":"training_quality","type":"likert","label":"Training content quality (1-5)","required":true},{"id":"facilitator","type":"likert","label":"Facilitator effectiveness (1-5)","required":true},{"id":"resource_gaps","type":"text","label":"Resource gaps observed","required":false},{"id":"priority_flag","type":"dropdown","label":"Flag as high priority?","options":["No","Yes"],"required":false}]}'),
  ('tpl_att_v1', 'Legal Milestone Form', 'attorney', 1, '{"nextStepsLabel":"Next Steps","questions":[{"id":"timeliness","type":"likert","label":"Document production timeliness (1-5)","required":true},{"id":"completeness","type":"likert","label":"Case record completeness (1-5)","required":true},{"id":"late_docs","type":"multi_select","label":"Late or incomplete document types","options":["Service plan","Court report","Correspondence","Other"]},{"id":"attestation","type":"attestation","label":"I attest this submission is accurate and complies with agency policy (ATT-04)","required":true}]}'),
  ('tpl_fp_v1', 'Placement Day 60 Survey', 'foster_parent', 1, '{"nextStepsLabel":"Next Steps","questions":[{"id":"visit_quality","type":"likert","label":"Caseworker visit quality (1-5)","required":true},{"id":"responsiveness","type":"likert","label":"Staff responsiveness (1-5)","required":true},{"id":"stipend_timely","type":"likert","label":"Stipend timeliness (1-5)","required":true},{"id":"placement_id","type":"text","label":"Placement ID","required":false}]}'),
  ('tpl_cls_fp_v1', 'Closure Survey Foster Parent', 'foster_parent', 1, '{"nextStepsLabel":"Next Steps","questions":[{"id":"overall_satisfaction","type":"likert","label":"Overall satisfaction (1-5)","required":true},{"id":"narrative","type":"text","label":"Closure narrative (max 1000 chars)","required":false}]}'),
  ('tpl_cls_att_v1', 'Closure Form Attorney', 'attorney', 1, '{"nextStepsLabel":"Next Steps","questions":[{"id":"process_adherence","type":"likert","label":"Process adherence (1-5)","required":true},{"id":"attestation","type":"attestation","label":"Legal attestation (ATT-04)","required":true}]}');

INSERT OR REPLACE INTO admin_config (config_key, config_value) VALUES
  ('trigger_window_mr', '5-7 business days'),
  ('trigger_window_vol', 'within 48 hours'),
  ('trigger_window_att', 'on milestone date'),
  ('trigger_window_fp', 'day30/day60/day90'),
  ('urgency_threshold', '0.8'),
  ('ai_disclosure_required', 'true'),
  ('ui_next_steps_label', 'Next Steps'),
  ('landing_switch_options', 'ifamilynet,admin'),
  ('reminder_days', '3');

INSERT OR REPLACE INTO dcf_notification_records (record_id, filing_ref, notification_sent, documented_at) VALUES
  ('nr1', '51A-2026-04412', 1, '2026-03-14T09:41:00Z');

INSERT OR IGNORE INTO trigger_jobs (job_id, event_id, trigger_type, user_group, template_id, trigger_ref, fire_at, status, fired_at) VALUES
  ('job_demo_mr', 'evt-seed-mr', 'fifty_one_a', 'mandated_reporter', 'tpl_mr_v1', '51A-2026-04412', datetime('now', '-1 minute'), 'scheduled', NULL);

-- Remove legacy seeded stub signals (Open Signals should reflect real inference/scheduler data only).
DELETE FROM risk_signals WHERE signal_id LIKE 'risk_demo_%' OR summary LIKE 'Demo:%';
