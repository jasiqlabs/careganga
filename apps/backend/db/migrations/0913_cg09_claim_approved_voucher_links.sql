-- CG-09 / US-003: idempotent claim submission and one original voucher
-- for each payable and payout. Claims never create independent ledger tables.
CREATE TABLE expense_claim_command(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 claim_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK(action IN('SUBMIT','RECONCILE','LINK_PAYABLE','LINK_PAYMENT')),
 request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 result_status text NOT NULL,
 case_id uuid,
 voucher_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_realm_id,actor_ref,request_key),
 FOREIGN KEY(claim_id,root_realm_id) REFERENCES expense_claim(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(case_id,root_realm_id) REFERENCES cg03_case(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(voucher_id,root_realm_id) REFERENCES finance_voucher(id,root_realm_id) ON DELETE RESTRICT
);
CREATE TRIGGER cg09_expense_claim_command_immutable BEFORE UPDATE OR DELETE ON expense_claim_command
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();
CREATE INDEX ix_cg09_claim_command_source ON expense_claim_command(root_realm_id,claim_id,created_at DESC);

CREATE TABLE expense_claim_voucher_link(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 claim_id uuid NOT NULL,
 voucher_id uuid NOT NULL,
 link_kind text NOT NULL CHECK(link_kind IN('PAYABLE','PAYOUT')),
 ledger_journal_id uuid NOT NULL,
 actor_ref uuid NOT NULL,
 request_key uuid NOT NULL,
 linked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_realm_id,claim_id,link_kind),
 UNIQUE(root_realm_id,voucher_id),
 UNIQUE(root_realm_id,ledger_journal_id),
 FOREIGN KEY(claim_id,root_realm_id) REFERENCES expense_claim(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(voucher_id,root_realm_id) REFERENCES finance_voucher(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(ledger_journal_id,root_realm_id) REFERENCES journal(id,root_realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(actor_ref,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg09_claim_finance_links ON expense_claim_voucher_link(root_realm_id,claim_id,link_kind);
CREATE TRIGGER cg09_claim_link_immutable BEFORE UPDATE OR DELETE ON expense_claim_voucher_link
 FOR EACH ROW EXECUTE FUNCTION cg09_immutable_record();

-- The matching primary journal is immutable. The original submitted expense,
-- not the later payout, is the only debit to an expense-category account.
CREATE FUNCTION cg09_claim_voucher_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE claim_record record; voucher_record record; other_record record; debit_kind text;
BEGIN
 SELECT status,amount_minor,requested_by INTO claim_record FROM expense_claim
 WHERE id=NEW.claim_id AND root_realm_id=NEW.root_realm_id FOR SHARE;
 IF NOT FOUND OR claim_record.status<>'APPROVED' THEN
  RAISE EXCEPTION 'Only approved claims may link posted vouchers' USING ERRCODE='P0920';
 END IF;
 SELECT v.id,v.root_realm_id,v.status,v.voucher_type,v.total_minor,
    v.debit_account_id,v.credit_account_id,v.created_by,
    p.journal_id INTO voucher_record
 FROM finance_voucher v JOIN finance_voucher_posting p
   ON p.voucher_id=v.id AND p.root_realm_id=v.root_realm_id
 WHERE v.id=NEW.voucher_id AND v.root_realm_id=NEW.root_realm_id
 FOR SHARE OF v,p;
 IF NOT FOUND OR voucher_record.status<>'POSTED' OR voucher_record.total_minor<>claim_record.amount_minor OR
    voucher_record.journal_id IS DISTINCT FROM NEW.ledger_journal_id THEN
  RAISE EXCEPTION 'An original equal posted voucher is required' USING ERRCODE='P0920';
 END IF;
 IF NEW.link_kind='PAYABLE' THEN
  SELECT g.category INTO debit_kind FROM finance_account a JOIN account_group g
    ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
   WHERE a.id=voucher_record.debit_account_id AND a.root_realm_id=NEW.root_realm_id;
  SELECT g.category AS category INTO other_record FROM finance_account a JOIN account_group g
    ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
   WHERE a.id=voucher_record.credit_account_id AND a.root_realm_id=NEW.root_realm_id;
  IF voucher_record.voucher_type<>'EXPENSE' OR debit_kind<>'EXPENSE' OR other_record.category<>'LIABILITY' THEN
   RAISE EXCEPTION 'Payable must be one posted expense to liability' USING ERRCODE='P0920';
  END IF;
 ELSE
  SELECT credit_account_id INTO other_record FROM finance_voucher
   WHERE id=(SELECT voucher_id FROM expense_claim_voucher_link
             WHERE root_realm_id=NEW.root_realm_id AND claim_id=NEW.claim_id
              AND link_kind='PAYABLE');
  IF NOT FOUND OR voucher_record.voucher_type<>'PAYMENT' OR
     voucher_record.debit_account_id IS DISTINCT FROM other_record.credit_account_id THEN
   RAISE EXCEPTION 'Payout must settle the original payable liability' USING ERRCODE='P0920';
  END IF;
  PERFORM 1 FROM finance_voucher_payment_verification
    WHERE root_realm_id=NEW.root_realm_id AND voucher_id=NEW.voucher_id
      AND status='VERIFIED' FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Payout requires independently verified real payment proof' USING ERRCODE='P0920';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cg09_claim_voucher_link_guard BEFORE INSERT ON expense_claim_voucher_link
 FOR EACH ROW EXECUTE FUNCTION cg09_claim_voucher_link_guard();
