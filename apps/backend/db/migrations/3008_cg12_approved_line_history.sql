-- Original CG03 approval quantities are immutable readable evidence, separate from the current hold projection.
CREATE TABLE material_request_line_decision(
 root_realm_id uuid NOT NULL,case_id uuid NOT NULL,decision_id uuid NOT NULL,request_id uuid NOT NULL,
 line_id uuid NOT NULL,item_id uuid NOT NULL,approved_qty numeric(18,3) NOT NULL CHECK(approved_qty>=0),
 PRIMARY KEY(root_realm_id,decision_id,line_id),
 FOREIGN KEY(decision_id,case_id,root_realm_id) REFERENCES cg03_case_decision(id,case_id,realm_id),
 FOREIGN KEY(root_realm_id,line_id,item_id,request_id) REFERENCES material_request_line(root_realm_id,id,item_id,request_id)
);
CREATE FUNCTION cg12_line_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $cg12$
BEGIN
 PERFORM 1 FROM cg03_case c JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id
 JOIN material_request_line l ON l.root_realm_id=c.realm_id AND l.request_id=c.material_request_id
 WHERE c.realm_id=NEW.root_realm_id AND c.id=NEW.case_id AND c.case_kind='MATERIAL_REQUEST_REVIEW'
 AND c.material_request_id=NEW.request_id AND d.id=NEW.decision_id AND d.action='APPROVE'
 AND d.actor_id<>c.proposer_id AND d.fresh_password_verified_at IS NOT NULL
 AND l.id=NEW.line_id AND l.item_id=NEW.item_id AND l.approved_qty=NEW.approved_qty
 FOR SHARE OF c,d,l;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original material approval quantity changed'; END IF; RETURN NEW;
END; $cg12$;
CREATE TRIGGER cg12_line_decision_source BEFORE INSERT ON material_request_line_decision FOR EACH ROW EXECUTE FUNCTION cg12_line_decision_guard();
CREATE TRIGGER cg12_line_decision_immutable BEFORE UPDATE OR DELETE ON material_request_line_decision FOR EACH ROW EXECUTE FUNCTION cg12_inventory_audit_immutable();
