-- CG-19: client master email v2 requires a unique, human-readable support Ticket ID.
-- Additive for FOUNDATION_PUBLIC and CENTER_PORTAL; no new support master.
-- Ticket numbers are references only, NEVER access credentials. Private receipt
-- and signed-in realm/center checks remain the sole lookup authorization.
CREATE SEQUENCE cg19_support_ticket_number_seq AS bigint START WITH 1;
ALTER TABLE cg19_support_case
  ADD COLUMN ticket_number text NOT NULL DEFAULT
    ('CGF-SUP-' || lpad(nextval('cg19_support_ticket_number_seq')::text,9,'0'));
ALTER SEQUENCE cg19_support_ticket_number_seq
  OWNED BY cg19_support_case.ticket_number;
ALTER TABLE cg19_support_case
  ADD CONSTRAINT uq_cg19_support_ticket_number UNIQUE(ticket_number),
  ADD CONSTRAINT ck_cg19_support_ticket_number
    CHECK(ticket_number ~ '^CGF-SUP-[0-9]{9,}$');
CREATE FUNCTION cg19_support_ticket_number_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.ticket_number IS DISTINCT FROM OLD.ticket_number THEN
   RAISE EXCEPTION 'Support ticket number is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg19_support_ticket_number_immutable
  BEFORE UPDATE ON cg19_support_case FOR EACH ROW
  EXECUTE FUNCTION cg19_support_ticket_number_guard();
COMMENT ON COLUMN cg19_support_case.ticket_number IS
  'Client-facing stable Ticket ID. Not a token for viewing private case details.';
