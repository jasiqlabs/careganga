-- CG-MB-008/009: original finance report artifact must retain the precise
-- root-vs-delegated branch access used when its bytes were rendered.
-- A later narrower permission must NOT reveal an older A+B download/notice.
-- Metadata only, no journal copy, patient data, shadow role, or legacy BWC.
ALTER TABLE cg20_report_run
 ADD COLUMN original_scope_all boolean,
 ADD COLUMN original_scope_branch_refs uuid[],
 ADD CONSTRAINT cg20_report_run_original_scope_proof CHECK(
  (original_scope_all IS NULL AND original_scope_branch_refs IS NULL)
  OR (original_scope_all IS NOT NULL AND
   original_scope_branch_refs IS NOT NULL AND
   cardinality(original_scope_branch_refs)<=200 AND
   (original_scope_all OR cardinality(original_scope_branch_refs)>0))
 );
-- Source rows for a non-finance report have no branch proof; finance READY
-- cannot be issued without one. Scope proof belongs to original run only.
ALTER TABLE cg20_report_run
 ADD CONSTRAINT cg20_finance_ready_scope_guard CHECK (
  state<>'READY' OR source_key NOT LIKE 'FINANCE_%'
  OR (original_scope_all IS NOT NULL AND original_scope_branch_refs IS NOT NULL)
 );
CREATE FUNCTION cg20_report_run_scope_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg20$
BEGIN
 IF TG_OP='UPDATE' AND OLD.original_scope_all IS NOT NULL AND
   (NEW.original_scope_all IS DISTINCT FROM OLD.original_scope_all OR
    NEW.original_scope_branch_refs IS DISTINCT FROM OLD.original_scope_branch_refs)
 THEN
  RAISE EXCEPTION 'Original scheduled report branch scope is immutable';
 END IF;
 RETURN NEW;
END;$cg20$;
CREATE TRIGGER cg20_report_run_scope_no_retarget
 BEFORE UPDATE ON cg20_report_run FOR EACH ROW
 EXECUTE FUNCTION cg20_report_run_scope_immutable();
