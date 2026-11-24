-- CG11 QA19: extend the original platform audit transport; no alternate audit master.
DO $cg11$
DECLARE original text;
BEGIN
 SELECT substring(pg_get_constraintdef(oid) FROM 7) INTO original FROM pg_constraint WHERE conrelid='platform_operation_audit'::regclass AND conname='platform_operation_audit_action_key_check';
 IF original IS NULL THEN RAISE EXCEPTION 'Original CG21 audit constraint missing'; END IF;
 ALTER TABLE platform_operation_audit DROP CONSTRAINT platform_operation_audit_action_key_check;
 EXECUTE format('ALTER TABLE platform_operation_audit ADD CONSTRAINT platform_operation_audit_action_key_check CHECK ((%s) OR action_key=''payroll.source.operation'')',original);
END; $cg11$;
ALTER TABLE platform_operation_audit ADD CONSTRAINT cg11_safe_payroll_audit CHECK(action_key<>'payroll.source.operation' OR (
 resource_ref=actor_account_id AND safe_context - ARRAY['payrollKind','payrollResult'] = '{}'::jsonb
 AND safe_context->>'payrollKind' IN('POLICY','COMPENSATION','PAYOUT','RUN','ACCESS')
 AND safe_context->>'payrollResult' IN('DRAFT_CREATED','SUBMITTED','APPROVED','RETURNED','REJECTED','READ','DENIED','CONFLICT','INVALID')
 AND outcome=CASE WHEN safe_context->>'payrollResult' IN('DENIED','CONFLICT','INVALID') THEN 'UNAVAILABLE' ELSE 'SUCCESS' END
 ) IS TRUE);
CREATE INDEX ix_cg11_payroll_audit_scope ON platform_operation_audit(foundation_realm_id,occurred_at DESC,id DESC) WHERE action_key='payroll.source.operation';
