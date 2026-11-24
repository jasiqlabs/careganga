-- CG-SAL-004: original verified support receipt, own employee entitlement, one resend per ticket.
ALTER TABLE cg19_payroll_event_outbox ADD COLUMN support_case_ref uuid;
ALTER TABLE cg19_payroll_event_outbox ADD FOREIGN KEY(support_case_ref,realm_id) REFERENCES cg19_support_case(id,realm_id);
ALTER TABLE cg19_payroll_event_outbox DROP CONSTRAINT cg19_payroll_event_outbox_event_kind_check;
ALTER TABLE cg19_payroll_event_outbox ADD CONSTRAINT cg19_payroll_event_outbox_event_kind_check CHECK(event_kind IN('GENERATED','PAID','FAILED','DELAYED','RESEND'));
DO $fn$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='cg19_payroll_event_outbox'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%doc_ref IS NULL%' LOOP
 EXECUTE format('ALTER TABLE cg19_payroll_event_outbox DROP CONSTRAINT %I',c.conname);
 END LOOP;
END; $fn$;
ALTER TABLE cg19_payroll_event_outbox ADD CONSTRAINT cg19_payroll_document_event CHECK(doc_ref IS NULL OR (state='CAPTURED' AND event_kind IN('GENERATED','RESEND')));
ALTER TABLE cg19_payroll_event_outbox ADD CONSTRAINT cg19_payroll_support_event CHECK((event_kind='RESEND' AND support_case_ref IS NOT NULL AND source_key=support_case_ref AND recipient_ref IS NOT NULL) OR (event_kind<>'RESEND' AND support_case_ref IS NULL));
DO $migration$
DECLARE rec record;previous text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cg19_message_template_kind_check','kind=''CG-SAL-004'''),
 ('cg19_message_template_check','origin=''SYSTEM'' AND approved_by IS NULL AND kind=''CG-SAL-004''')
 ) v(constraint_name,extra)
 LOOP
 SELECT substring(pg_get_constraintdef(c.oid) FROM 7) INTO previous FROM pg_constraint c WHERE c.conrelid='cg19_message_template'::regclass AND c.conname=rec.constraint_name AND c.contype='c';
 IF previous IS NULL THEN RAISE EXCEPTION 'Original CG19 constraint missing: %',rec.constraint_name; END IF;
 EXECUTE format('ALTER TABLE cg19_message_template DROP CONSTRAINT %I',rec.constraint_name);
 EXECUTE format('ALTER TABLE cg19_message_template ADD CONSTRAINT %I CHECK ((%s) OR (%s))',rec.constraint_name,previous,rec.extra);
 END LOOP;
END; $migration$;
CREATE OR REPLACE FUNCTION cg19_payroll_event_matches(root uuid,event uuid,recipient uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(SELECT 1 FROM cg19_payroll_event_outbox o JOIN payroll_line l ON l.root_realm_id=o.realm_id AND l.id=o.line_ref
 JOIN payroll_run r ON r.root_realm_id=l.root_realm_id AND r.id=l.run_id AND r.status='APPROVED_FROZEN'
 JOIN cg03_case c ON c.realm_id=r.root_realm_id AND c.id=r.approval_case_ref AND c.status='OWNER_COMPLETED' AND c.case_kind='PAYROLL_RUN_RELEASE'
 JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id AND d.id=r.approved_decision_ref AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>c.proposer_id AND d.actor_id<>r.creator
 JOIN hr_employee e ON e.root_realm_id=l.root_realm_id AND e.id=l.employee_ref
 JOIN account a ON a.realm_id=e.root_realm_id AND a.id=e.account_ref AND a.status='ACTIVE'
 LEFT JOIN payroll_batch_item i ON i.root_realm_id=l.root_realm_id AND i.line_ref=l.id
 LEFT JOIN LATERAL(SELECT coalesce(sum(x.paid_minor),0) paid,coalesce(bool_or(x.reversed OR (x.voucher_status='POSTED' AND x.paid_minor<>x.amount_minor)),false) invalid FROM payroll_attempt_outcome x WHERE x.root_realm_id=i.root_realm_id AND x.item_ref=i.id)p ON true
 WHERE o.realm_id=root AND o.id=event AND o.recipient_ref=recipient AND e.account_ref=recipient AND e.status IN('ACTIVE','PROBATION')
 AND (SELECT count(*) FROM hr_employment_assignment h JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref AND b.status='ACTIVE'
 WHERE h.root_realm_id=e.root_realm_id AND h.employee_id=e.id AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date))=1
 AND ((o.event_kind='GENERATED' AND o.source_key=l.id)
 OR (o.event_kind='RESEND' AND o.support_case_ref=o.source_key AND EXISTS(SELECT 1 FROM cg19_support_case sc WHERE sc.realm_id=o.realm_id AND sc.id=o.support_case_ref AND sc.source_channel='FOUNDATION_PUBLIC' AND sc.status<>'CLOSED' AND sc.receipt_expires_at>now()))
 OR (o.event_kind='PAID' AND o.source_key=l.id AND l.net_minor>0 AND p.paid=l.net_minor AND NOT p.invalid)
 OR (o.event_kind='FAILED' AND p.paid<l.net_minor AND EXISTS(SELECT 1 FROM payroll_attempt_outcome x WHERE x.root_realm_id=o.realm_id AND x.item_ref=i.id AND x.id=o.source_key AND x.attempt_status='FAILED_VERIFIED'))
 OR (o.event_kind='DELAYED' AND o.source_key=l.id AND l.entitlement_state='RELEASE_ELIGIBLE' AND p.paid<l.net_minor AND r.tentative_payment_date IS NOT NULL AND r.tentative_payment_date<(now() AT TIME ZONE 'Asia/Kolkata')::date)))
$fn$;
CREATE OR REPLACE FUNCTION cg19_payroll_event_copy(k text) RETURNS TABLE(code text,subject text,body text) LANGUAGE sql IMMUTABLE AS $fn$
 SELECT v.code,v.subject,v.body FROM (VALUES
 ('GENERATED','CG-SAL-001','Private CareGanga payroll statement available','Your approved confidential salary statement is available. Sign in to the CareGanga employee portal or Internal Android app and open My Pay. Approval alone does not confirm disbursement.'),
 ('PAID','CG-SAL-002','Private CareGanga payroll payment update','Your salary payment was independently verified in the original finance records. Sign in to My Pay for the current confidential statement and payment status.'),
 ('FAILED','CG-SAL-003','Private CareGanga payroll status update','Your salary payment remains outstanding or has a verified failed transfer. Sign in to My Pay for the current status. Contact HR and Payroll through the official support channel.'),
 ('RESEND','CG-SAL-004','Requested private CareGanga document available','Your verified support request for a confidential salary statement has been processed. Sign in to My Pay to view the current private document. This notice does not confirm payment.'),
 ('DELAYED','CG-SAL-003','Private CareGanga payroll status update','Your salary payment remains outstanding or has a verified failed transfer. Sign in to My Pay for the current status. Contact HR and Payroll through the official support channel.')
 ) v(kind,code,subject,body) WHERE v.kind=k
$fn$;
CREATE OR REPLACE FUNCTION cg19_salary_notice_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE k text;doc uuid;line uuid;
BEGIN
 IF TG_OP='UPDATE' AND (OLD.source_kind='CG11_PAYROLL_EVENT' OR NEW.source_kind='CG11_PAYROLL_EVENT') AND
 (to_jsonb(NEW)-ARRAY['state','attempt_count','claim_token','claimed_until','due_at','provider_message_ref','provider_kind','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','attempt_count','claim_token','claimed_until','due_at','provider_message_ref','provider_kind','updated_at']) THEN RAISE EXCEPTION 'Original salary notice identity immutable'; END IF;
 IF TG_OP='INSERT' AND NEW.source_kind='CG11_PAYROLL_EVENT' THEN
 SELECT event_kind,doc_ref,line_ref INTO k,doc,line FROM cg19_payroll_event_outbox WHERE realm_id=NEW.realm_id AND id=NEW.payroll_event_ref AND state='CAPTURED';
 IF NOT FOUND OR NEW.purpose<>'TRANSACTIONAL' OR NOT cg19_payroll_event_matches(NEW.realm_id,NEW.payroll_event_ref,NEW.recipient_id) OR
 (k IN('GENERATED','RESEND') AND NOT EXISTS(SELECT 1 FROM cg19_payroll_payslip p WHERE p.root_realm_id=NEW.realm_id AND p.id=doc AND p.line_ref=line AND p.status='ISSUED')) OR
 NOT EXISTS(SELECT 1 FROM cg19_message_template t CROSS JOIN cg19_payroll_event_copy(k) fixed WHERE t.realm_id=NEW.realm_id AND t.id=NEW.template_id AND t.version=NEW.template_version AND t.kind=fixed.code AND t.channel=NEW.channel AND t.status='APPROVED' AND t.subject=fixed.subject AND t.body=fixed.body AND t.subject=NEW.subject_snapshot AND t.body=NEW.body_snapshot)
 THEN RAISE EXCEPTION 'Original salary notice source required'; END IF;
 END IF;
 RETURN NEW;
END; $fn$;
