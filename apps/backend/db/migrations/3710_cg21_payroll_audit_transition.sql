-- Extend existing safe audit enum for exact observed payroll financial transitions.
ALTER TABLE platform_operation_audit DROP CONSTRAINT cg11_safe_payroll_audit;
ALTER TABLE platform_operation_audit ADD CONSTRAINT cg11_safe_payroll_audit CHECK(action_key<>'payroll.source.operation' OR (
 resource_ref=actor_account_id AND safe_context - ARRAY['payrollKind','payrollResult'] = '{}'::jsonb
 AND safe_context->>'payrollKind' IN('POLICY','COMPENSATION','PAYOUT','RUN','ACCESS')
 AND safe_context->>'payrollResult' IN('ACCRUED','BATCH_PREPARED','ATTEMPT_CREATED','DRAFT_CREATED','IMPORTED','CALCULATED','SUBMITTED','APPROVED','RETURNED','REJECTED','READ','DENIED','CONFLICT','INVALID')
 AND (safe_context->>'payrollResult' NOT IN('ACCRUED','BATCH_PREPARED','ATTEMPT_CREATED') OR safe_context->>'payrollKind'='RUN')
 AND outcome=CASE WHEN safe_context->>'payrollResult' IN('DENIED','CONFLICT','INVALID') THEN 'UNAVAILABLE' ELSE 'SUCCESS' END
 ) IS TRUE);
