-- Forward-only expansion; prior migration checksums remain unchanged.
ALTER TABLE cg20_report_definition DROP CONSTRAINT cg20_report_definition_source_key_check;
ALTER TABLE cg20_report_definition ADD CONSTRAINT cg20_report_definition_source_key_check CHECK(source_key IN ('FINANCE_POSTED_LEDGER','FINANCE_POSTED_SUMMARY','FINANCE_POSTED_TREND','FINANCE_POSTED_GROUPED','APPOINTMENT_STATUS','APPOINTMENT_STATUS_GROUPED','APPOINTMENT_DOCTOR_SUMMARY','PLATFORM_AUDIT_ACTIVITY','DIAGNOSTICS_CATALOG_SUMMARY','PROJECT_STATUS_REPORT'));
ALTER TABLE cg20_report_run DROP CONSTRAINT cg20_report_run_source_key_check;
ALTER TABLE cg20_report_run ADD CONSTRAINT cg20_report_run_source_key_check CHECK(source_key IN ('FINANCE_POSTED_LEDGER','FINANCE_POSTED_SUMMARY','FINANCE_POSTED_TREND','FINANCE_POSTED_GROUPED','APPOINTMENT_STATUS','APPOINTMENT_STATUS_GROUPED','APPOINTMENT_DOCTOR_SUMMARY','PLATFORM_AUDIT_ACTIVITY','DIAGNOSTICS_CATALOG_SUMMARY','PROJECT_STATUS_REPORT'));
ALTER TABLE cg20_report_run ADD COLUMN original_project_digest char(64);
ALTER TABLE cg20_report_run ADD CONSTRAINT cg20_project_digest_check CHECK(
 original_project_digest IS NULL OR (source_key='PROJECT_STATUS_REPORT' AND original_project_digest ~ '^[a-f0-9]{64}$'));
ALTER TABLE cg20_report_run ADD CONSTRAINT cg20_project_ready_proof_check CHECK(
 source_key<>'PROJECT_STATUS_REPORT' OR state<>'READY' OR original_project_digest IS NOT NULL);
