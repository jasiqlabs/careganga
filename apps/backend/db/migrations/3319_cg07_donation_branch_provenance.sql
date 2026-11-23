-- CG07 multi-branch integrity: original donation finance, original donor proof,
-- and any later CG09/CG19 refund must remain attributed to the original branch.
-- A caller may not retarget an existing donation to another real same-root branch.
-- General contributions remain Foundation-wide (null original branch).
-- Campaign contributions must inherit the ACTUAL campaign branch on insertion,
-- not a caller-provided "reporting branch" or unrelated branch from this root.
CREATE FUNCTION cg07_donation_branch_provenance() RETURNS trigger LANGUAGE plpgsql AS $cg07$
DECLARE original_campaign_branch uuid;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.branch_ref IS DISTINCT FROM OLD.branch_ref OR
     NEW.donation_kind IS DISTINCT FROM OLD.donation_kind OR
     NEW.campaign_id IS DISTINCT FROM OLD.campaign_id OR
     NEW.root_realm_id IS DISTINCT FROM OLD.root_realm_id THEN
   RAISE EXCEPTION 'Original donation source and branch are immutable';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.donation_kind='GENERAL' THEN
  IF NEW.campaign_id IS NOT NULL OR NEW.branch_ref IS NOT NULL THEN
   RAISE EXCEPTION 'Foundation-wide donation cannot be assigned to a branch';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.donation_kind<>'CAMPAIGN' OR NEW.campaign_id IS NULL THEN
  RAISE EXCEPTION 'Campaign donation requires a real campaign source';
 END IF;
 SELECT c.branch_ref INTO original_campaign_branch
 FROM campaign c
 WHERE c.root_realm_id=NEW.root_realm_id AND c.id=NEW.campaign_id
 FOR SHARE;
 IF NOT FOUND OR NEW.branch_ref IS DISTINCT FROM original_campaign_branch THEN
  RAISE EXCEPTION 'Campaign donation must inherit the original current campaign branch';
 END IF;
 RETURN NEW;
END;$cg07$;
CREATE TRIGGER cg07_donation_branch_no_retarget
 BEFORE INSERT OR UPDATE ON donation
 FOR EACH ROW EXECUTE FUNCTION cg07_donation_branch_provenance();
