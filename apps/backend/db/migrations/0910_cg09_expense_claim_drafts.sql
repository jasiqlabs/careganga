-- CG-09 / US-003: Foundation-requestor expense claim drafts only.
-- A draft is not a bill, approval, payable, journal entry or verified payment.
CREATE TABLE expense_claim (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 requested_by uuid NOT NULL,
 category_label text NOT NULL CHECK(char_length(btrim(category_label)) BETWEEN 2 AND 80),
 purpose text NOT NULL CHECK(char_length(btrim(purpose)) BETWEEN 3 AND 500),
 expense_date date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999999999),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status='DRAFT'),
 version integer NOT NULL DEFAULT 1 CHECK(version=1),
 create_request_key uuid NOT NULL,
 create_digest char(64) NOT NULL CHECK(create_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,root_realm_id),
 UNIQUE(root_realm_id,requested_by,create_request_key),
 FOREIGN KEY(requested_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_claim_requester_created ON
 expense_claim(root_realm_id,requested_by,created_at DESC,id DESC);
-- The later CG-19 / CG-03 controlled submission stage will replace this
-- temporary draft-only guard. No bypass to paid or posted states is permitted.
CREATE TRIGGER cg09_claim_draft_immutable BEFORE UPDATE OR DELETE ON expense_claim
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

ALTER TABLE finance_event DROP CONSTRAINT finance_event_entity_kind_check;
ALTER TABLE finance_event ADD CONSTRAINT finance_event_entity_kind_check
 CHECK(entity_kind IN('YEAR','GROUP','ACCOUNT','JOURNAL','VOUCHER','CLAIM'));
