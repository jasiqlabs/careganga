-- CG17 US006: one evidence-backed monthly provider claim for genuine
-- POSTED CG09-accrued Foundation liabilities. This is not a money transfer.
-- Patient center collections remain outside Foundation cash/bank journals.
CREATE TABLE provider_settlement(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 center_ref uuid NOT NULL,
 provider_ref uuid NOT NULL,
 period_start date NOT NULL,
 period_end date NOT NULL,
 currency char(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 approved_total_minor bigint NOT NULL
  CHECK(approved_total_minor BETWEEN 1 AND 10000000000),
 paid_minor bigint NOT NULL DEFAULT 0 CHECK(paid_minor>=0),
 state text NOT NULL DEFAULT 'PROPOSED'
  CHECK(state IN('PROPOSED','APPROVED','PARTIALLY_SETTLED','SETTLED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
 source_digest char(64) NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 destination_file_ref uuid NOT NULL,
 destination_version integer NOT NULL CHECK(destination_version>0),
 destination_masked_label text NOT NULL CHECK(char_length(destination_masked_label) BETWEEN 4 AND 60),
 proposed_by uuid NOT NULL,
 proposed_request_key uuid NOT NULL,
 proposed_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid,
 reviewed_at timestamptz,
 reviewed_request_key uuid,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,center_ref,period_start),
 UNIQUE(root_realm_id,proposed_by,proposed_request_key),
 UNIQUE(root_realm_id,reviewed_by,reviewed_request_key),
 UNIQUE(root_realm_id,id,center_ref),
 FOREIGN KEY(root_realm_id,center_ref) REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,provider_ref) REFERENCES health_provider(root_realm_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(destination_file_ref,root_realm_id)
  REFERENCES cg19_stored_file(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(proposed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewed_by,root_realm_id) REFERENCES account(id,realm_id) ON DELETE RESTRICT,
 CHECK(period_start=date_trunc('month',period_start::timestamp)::date),
 CHECK(period_end=(period_start+INTERVAL '1 month')::date),
 CHECK(paid_minor<=approved_total_minor),
 CHECK(
  (state='PROPOSED' AND reviewed_by IS NULL AND reviewed_at IS NULL
   AND reviewed_request_key IS NULL AND paid_minor=0)
  OR
  (state IN('APPROVED','PARTIALLY_SETTLED','SETTLED')
   AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
   AND reviewed_request_key IS NOT NULL AND reviewed_by<>proposed_by
   AND ((state='APPROVED' AND paid_minor=0) OR
        (state='PARTIALLY_SETTLED' AND paid_minor>0
         AND paid_minor<approved_total_minor) OR
        (state='SETTLED' AND paid_minor=approved_total_minor))))
);
CREATE TABLE provider_settlement_line(
 root_realm_id uuid NOT NULL REFERENCES access_realm(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 settlement_ref uuid NOT NULL,
 center_ref uuid NOT NULL,
 liability_ref uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 10000000000),
 original_effect_ref uuid NOT NULL,
 PRIMARY KEY(root_realm_id,id),
 UNIQUE(root_realm_id,settlement_ref,liability_ref),
 UNIQUE(root_realm_id,liability_ref),
 FOREIGN KEY(root_realm_id,settlement_ref,center_ref)
  REFERENCES provider_settlement(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,liability_ref,center_ref)
  REFERENCES foundation_liability(root_realm_id,id,center_ref) ON DELETE RESTRICT,
 FOREIGN KEY(root_realm_id,original_effect_ref)
  REFERENCES cg17_financial_effect(root_realm_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cg17_settlement_month ON provider_settlement
 (root_realm_id,center_ref,period_start DESC,state);
CREATE INDEX ix_cg17_settlement_lines ON provider_settlement_line
 (root_realm_id,settlement_ref,liability_ref);

-- Economic source and payment totals are immutable in this claim stage.
-- Only an independent reviewer can approve a genuine fixed-amount claim.
-- A later US006 verified-bank payout is a separate immutable source event.
CREATE FUNCTION cg17_settlement_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_total numeric; v_lines integer;
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Approved Foundation settlement history cannot be deleted';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'state'-'revision'-'reviewed_by'-'reviewed_at'-
    'reviewed_request_key') IS DISTINCT FROM
    (to_jsonb(OLD)-'state'-'revision'-'reviewed_by'-'reviewed_at'-
    'reviewed_request_key') OR
    OLD.state<>'PROPOSED' OR NEW.state<>'APPROVED' OR
    NEW.revision<>OLD.revision+1 OR NEW.reviewed_by IS NULL OR
    NEW.reviewed_by=OLD.proposed_by OR NEW.reviewed_at IS NULL OR
    NEW.reviewed_request_key IS NULL
   THEN RAISE EXCEPTION 'Original settlement requires independent approval';
  END IF;
  SELECT count(*),coalesce(sum(line.amount_minor),0)
  INTO v_lines,v_total
  FROM provider_settlement_line line
  JOIN foundation_liability l
   ON l.root_realm_id=line.root_realm_id AND l.id=line.liability_ref
  JOIN cg17_financial_effect effect
   ON effect.root_realm_id=l.root_realm_id
   AND effect.id=line.original_effect_ref
   AND effect.liability_ref=l.id AND effect.effect_kind='LIABILITY_ACCRUAL'
  WHERE line.root_realm_id=NEW.root_realm_id AND line.settlement_ref=NEW.id
   AND line.center_ref=NEW.center_ref
   AND line.amount_minor=l.amount_minor
   AND effect.posting_state='POSTED' AND effect.original_cg09_ref IS NOT NULL
   AND l.service_local_date>=NEW.period_start
   AND l.service_local_date<NEW.period_end;
  IF v_lines<1 OR v_total<>NEW.approved_total_minor OR
   v_lines<>(SELECT count(*) FROM provider_settlement_line
    WHERE root_realm_id=NEW.root_realm_id AND settlement_ref=NEW.id)
  THEN
   RAISE EXCEPTION 'Approved settlement must match exact posted liabilities';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg17_settlement_claim_update BEFORE UPDATE OR DELETE
 ON provider_settlement FOR EACH ROW EXECUTE FUNCTION cg17_settlement_claim_guard();

CREATE FUNCTION cg17_settlement_line_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' OR TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Original provider settlement lines are immutable';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM provider_settlement claim
  JOIN foundation_liability liability
   ON liability.root_realm_id=claim.root_realm_id
   AND liability.id=NEW.liability_ref AND liability.center_ref=claim.center_ref
  JOIN cg17_financial_effect effect
   ON effect.root_realm_id=liability.root_realm_id
   AND effect.id=NEW.original_effect_ref
   AND effect.liability_ref=liability.id
   AND effect.effect_kind='LIABILITY_ACCRUAL'
  WHERE claim.root_realm_id=NEW.root_realm_id
   AND claim.id=NEW.settlement_ref AND claim.center_ref=NEW.center_ref
   AND claim.state='PROPOSED'
   AND liability.amount_minor=NEW.amount_minor
   AND liability.service_local_date>=claim.period_start
   AND liability.service_local_date<claim.period_end
   AND effect.posting_state='POSTED'
   AND effect.original_cg09_ref IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'Settlement line requires original CG09 posted liability';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cg17_settlement_line_immutable BEFORE INSERT OR UPDATE OR DELETE
 ON provider_settlement_line FOR EACH ROW
 EXECUTE FUNCTION cg17_settlement_line_frozen();
