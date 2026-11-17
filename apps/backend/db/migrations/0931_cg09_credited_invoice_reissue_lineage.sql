-- CG09 V1: corrected invoice uses the ORIGINAL staged invoice wizard and its
-- CG03 review/CG19 private PDF; a narrow immutable link preserves the credit
-- note and old invoice instead of creating a second invoice system.
CREATE TABLE finance_invoice_reissue_link(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 original_invoice_id uuid NOT NULL,
 replacement_invoice_id uuid NOT NULL,
 original_credit_note_id uuid NOT NULL,
 recorded_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),
 UNIQUE(root_realm_id,replacement_invoice_id),
 FOREIGN KEY(original_invoice_id,root_realm_id)
   REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(replacement_invoice_id,root_realm_id)
   REFERENCES finance_invoice(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(original_credit_note_id,root_realm_id)
   REFERENCES finance_invoice_credit_note(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,root_realm_id)
   REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(original_invoice_id<>replacement_invoice_id)
);
CREATE INDEX ix_cg09_reissue_original
 ON finance_invoice_reissue_link(root_realm_id,original_invoice_id,created_at DESC);

CREATE FUNCTION cg09_guard_reissue_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original record; replacement record; credit record;
BEGIN
 SELECT id,status,branch_id INTO original FROM finance_invoice
  WHERE root_realm_id=NEW.root_realm_id AND id=NEW.original_invoice_id
  FOR UPDATE;
 SELECT id,status,branch_id,created_by INTO replacement FROM finance_invoice
  WHERE root_realm_id=NEW.root_realm_id AND id=NEW.replacement_invoice_id
  FOR SHARE;
 SELECT id,invoice_id INTO credit FROM finance_invoice_credit_note
  WHERE id=NEW.original_credit_note_id AND root_realm_id=NEW.root_realm_id
  FOR SHARE;
 IF original.id IS NULL OR replacement.id IS NULL OR credit.id IS NULL
  OR original.status<>'ISSUED' OR replacement.status<>'SUBMITTED'
  OR credit.invoice_id IS DISTINCT FROM NEW.original_invoice_id
  OR replacement.branch_id IS DISTINCT FROM original.branch_id
  OR replacement.created_by IS DISTINCT FROM NEW.recorded_by THEN
  RAISE EXCEPTION 'Replacement must be a current staged invoice for a credited source'
    USING ERRCODE='P0933';
 END IF;
 IF EXISTS (
  SELECT 1 FROM finance_invoice_reissue_link l
   JOIN finance_invoice other ON other.id=l.replacement_invoice_id
     AND other.root_realm_id=l.root_realm_id
  WHERE l.root_realm_id=NEW.root_realm_id
    AND l.original_invoice_id=NEW.original_invoice_id
    AND other.status<>'REJECTED'
 ) THEN
  RAISE EXCEPTION 'An active replacement already exists for this credit note'
   USING ERRCODE='P0933';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_reissue_source_guard BEFORE INSERT
 ON finance_invoice_reissue_link FOR EACH ROW EXECUTE FUNCTION cg09_guard_reissue_link();
CREATE TRIGGER cg09_reissue_immutable BEFORE UPDATE OR DELETE
 ON finance_invoice_reissue_link FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
