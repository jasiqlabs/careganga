-- B36: authorized HR may record the actual received paper copy without
-- impersonating the original employee. Preserve the actual uploader and mode.
ALTER TABLE cg19_upload_intent ADD COLUMN hr_receipt_actor_kind text;
UPDATE cg19_upload_intent SET hr_receipt_actor_kind='RECIPIENT' WHERE classification='HR_RECEIVED_COPY';
ALTER TABLE cg19_upload_intent ADD CONSTRAINT cg19_hr_receipt_actor_kind CHECK((
 (classification='HR_RECEIVED_COPY' AND hr_receipt_actor_kind IN('RECIPIENT','STAFF'))
 OR (classification<>'HR_RECEIVED_COPY' AND hr_receipt_actor_kind IS NULL)) IS TRUE);
CREATE FUNCTION cg19_hr_document_staff_receipt_matches(root uuid,doc uuid,staff uuid) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT EXISTS(
  SELECT 1 FROM cg19_generated_document d JOIN hr_document_request h
    ON h.root_realm_id=d.realm_id AND h.case_ref=d.case_id AND h.source_digest=d.source_sha256 AND h.revision=d.proposal_revision
   JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.source_branch_ref
   JOIN access_realm rlm ON rlm.id=d.realm_id AND rlm.realm_key='FOUNDATION_ROOT'
   JOIN account ac ON ac.realm_id=d.realm_id AND ac.id=staff AND ac.status='ACTIVE'
   LEFT JOIN hr_employee e ON e.root_realm_id=h.root_realm_id AND e.id=h.employee_id
  WHERE d.realm_id=root AND d.id=doc AND d.state='ISSUED' AND d.revoked_at IS NULL AND h.status='APPROVED'
   AND NOT EXISTS(SELECT 1 FROM (VALUES ('hr.documents.manage'),('documents.letters.issue')) required(action)
    WHERE NOT EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active
     WHERE ar.realm_id=root AND ar.account_id=staff AND ar.revoked_at IS NULL
     AND (r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key=required.action))))
   AND (b.manager_account_ref=staff OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active
    WHERE ar.realm_id=root AND ar.account_id=staff AND ar.revoked_at IS NULL AND
    (r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='foundation.branches.admin'))))
   AND ((h.employee_id IS NULL AND EXISTS(SELECT 1 FROM hr_employee_application ap WHERE ap.root_realm_id=h.root_realm_id AND ap.id=h.application_id AND ap.proposed_branch_ref=h.source_branch_ref))
    OR EXISTS(SELECT 1 FROM hr_employment_assignment a WHERE a.root_realm_id=h.root_realm_id AND a.employee_id=h.employee_id
     AND a.branch_ref=h.source_branch_ref AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR (e.status='EXITED' AND a.id=h.assignment_id)))
    OR EXISTS(SELECT 1 FROM account_role ar JOIN role ro ON ro.id=ar.role_id AND ro.realm_id=ar.realm_id AND ro.active AND ro.is_protected
     WHERE ar.realm_id=root AND ar.account_id=staff AND ar.revoked_at IS NULL))
 )
$fn$;
CREATE FUNCTION cg19_hr_receipt_actor_matches(root uuid,doc uuid,actor uuid,mode text) RETURNS boolean LANGUAGE sql STABLE AS $fn$
 SELECT CASE mode WHEN 'STAFF' THEN cg19_hr_document_staff_receipt_matches(root,doc,actor)
 WHEN 'RECIPIENT' THEN cg19_hr_document_notice_matches(root,doc,actor) ELSE false END
$fn$;
CREATE OR REPLACE FUNCTION cg19_hr_receipt_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.hr_receipt_document_ref,NEW.hr_receipt_actor_kind) IS DISTINCT FROM (OLD.hr_receipt_document_ref,OLD.hr_receipt_actor_kind) THEN
  RAISE EXCEPTION 'Original receipt document and uploader mode are immutable';
 END IF;
 IF TG_OP='INSERT' AND NEW.classification='HR_RECEIVED_COPY' AND
  (NOT cg19_hr_receipt_actor_matches(NEW.realm_id,NEW.hr_receipt_document_ref,NEW.requested_by,NEW.hr_receipt_actor_kind)
   OR NOT EXISTS(SELECT 1 FROM cg19_generated_document d WHERE d.realm_id=NEW.realm_id AND d.id=NEW.hr_receipt_document_ref
    AND d.case_id=NEW.case_id AND d.proposal_revision=NEW.proposal_revision))
 THEN RAISE EXCEPTION 'Current original document and authorized receipt uploader required'; END IF;
 RETURN NEW;
END; $fn$;
CREATE OR REPLACE FUNCTION cg19_hr_receipt_file_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM cg19_upload_intent i WHERE i.realm_id=NEW.realm_id AND i.id=NEW.upload_intent_id AND i.classification='HR_RECEIVED_COPY') AND
  NOT EXISTS(SELECT 1 FROM cg19_upload_intent i WHERE i.realm_id=NEW.realm_id AND i.id=NEW.upload_intent_id
   AND i.classification='HR_RECEIVED_COPY' AND i.status='VALIDATED' AND i.case_id=NEW.case_id AND i.proposal_revision=NEW.proposal_revision
   AND i.requested_by=NEW.created_by AND i.mime=NEW.original_mime AND i.expected_sha256=NEW.verified_sha256
   AND i.size_bytes=NEW.verified_size_bytes AND i.object_key=NEW.object_key AND NEW.owner_kind='CG03_CASE'
   AND NEW.scan_status='CLEAN_VERIFIED' AND cg19_hr_receipt_actor_matches(i.realm_id,i.hr_receipt_document_ref,i.requested_by,i.hr_receipt_actor_kind))
 THEN RAISE EXCEPTION 'Exact scan-verified received copy and authorized uploader required'; END IF;
 RETURN NEW;
END; $fn$;
