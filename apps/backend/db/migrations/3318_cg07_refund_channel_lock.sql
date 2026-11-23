-- CG07 source integrity: a previously requested refund cannot be retyped
-- from CASH to ONLINE or vice versa to bypass original evidence or reviewer.
-- Existing pre-3317 cash requests remain CASH; never auto-migrate them to online.
CREATE FUNCTION cg07_refund_channel_immutable() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NEW.settlement_method IS DISTINCT FROM OLD.settlement_method THEN
  RAISE EXCEPTION 'Original refund payout channel cannot be changed';
 END IF;
 RETURN NEW;
END;$cg07$;
CREATE TRIGGER cg07_refund_channel_no_retarget
 BEFORE UPDATE ON donation_refund_request
 FOR EACH ROW EXECUTE FUNCTION cg07_refund_channel_immutable();

CREATE FUNCTION cg07_provider_refund_channel_guard() RETURNS trigger LANGUAGE plpgsql AS $cg07$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM donation_refund_request r
  JOIN donation d ON d.root_realm_id=r.root_realm_id AND d.id=r.donation_id
  JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
  JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id
  WHERE r.root_realm_id=NEW.root_realm_id AND r.id=NEW.refund_request_id
   AND r.donation_id=NEW.donation_id
   AND r.settlement_method='ONLINE' AND r.status='REQUESTED'
   AND d.source_status='RECEIVED_POSTED' AND e.status='POSTED'
   AND j.status='POSTED' AND j.source_ref=d.id
 ) THEN
  RAISE EXCEPTION 'Signed provider refund requires an original ONLINE posted donation';
 END IF;
 RETURN NEW;
END;$cg07$;
CREATE TRIGGER cg07_provider_refund_requires_channel
 BEFORE INSERT ON donation_provider_refund
 FOR EACH ROW EXECUTE FUNCTION cg07_provider_refund_channel_guard();
