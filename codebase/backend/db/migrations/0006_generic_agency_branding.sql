-- Replace Massachusetts DCF-specific demo labels with generic agency terms.

UPDATE form_templates
SET name = 'Post-intake Survey'
WHERE template_id = 'tpl_mr_v1'
  AND name = 'Post-51A Survey';

UPDATE form_templates
SET schema_json = REPLACE(
  REPLACE(
    REPLACE(schema_json, 'your 51A was filed', 'your intake report was filed'),
    'Your 51A filing reference number',
    'Your intake filing reference number'
  ),
  ' DCF ',
  ' the agency '
)
WHERE schema_json LIKE '%51A%' OR schema_json LIKE '%DCF%';

UPDATE form_templates
SET schema_json = REPLACE(schema_json, 'was DCF in', 'was the agency in')
WHERE schema_json LIKE '%was DCF in%';

UPDATE form_templates
SET schema_json = REPLACE(schema_json, 'did DCF staff', 'did agency staff')
WHERE schema_json LIKE '%did DCF staff%';

UPDATE form_templates
SET schema_json = REPLACE(schema_json, 'with DCF support', 'with agency support')
WHERE schema_json LIKE '%with DCF support%';

UPDATE form_templates
SET schema_json = REPLACE(schema_json, 'did DCF adhere', 'did the agency adhere')
WHERE schema_json LIKE '%did DCF adhere%';

UPDATE admin_config
SET config_value = 'workflow,admin'
WHERE config_key = 'landing_switch_options';

UPDATE dcf_notification_records
SET filing_ref = 'INT-2026-04412'
WHERE filing_ref = '51A-2026-04412';

UPDATE trigger_jobs
SET trigger_ref = 'INT-2026-04412'
WHERE trigger_ref = '51A-2026-04412';

UPDATE form_instances
SET trigger_ref = 'INT-2026-04412'
WHERE trigger_ref = '51A-2026-04412';

UPDATE demo_users
SET office_id = 'REGION-NORTH'
WHERE office_id = 'BOS-NORTH';

UPDATE form_instances
SET office_id = 'North Region'
WHERE office_id = 'Boston North';

UPDATE submissions
SET office_id = 'North Region'
WHERE office_id = 'Boston North';

UPDATE supervisor_queue
SET office_id = 'North Region'
WHERE office_id = 'Boston North';
