import {BadRequestException,ConflictException,ForbiddenException,Injectable} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type AccessPin={accountRef:string|null;accessVersion:string|null;roleRef:string|null;roleRevision:number|null};
type Proof={change_id:string;source_digest:string;revision:number;case_ref:string;decision_ref:string;
 kind:string;target_account_ref:string|null;expected_access_version:string|null;
 proposed_role_ref:string|null;expected_role_revision:number|null;reviewer_id:string;proposer_id:string};
const exitKind=(kind:string)=>kind==="RESIGNATION"||kind==="EXIT";
/** CG01 alone validates and changes real login/access in the same transaction as HR's
 * actual assignment change. A case status supplied by a caller is never authority. */
@Injectable()
export class HrEmploymentAccessOwnerService{
 async snapshot(tx:PoolClient,realm:string,accountRef:string|null,roleRef:string|null,exit:boolean):Promise<AccessPin>{
  if(!accountRef){
   if(roleRef)throw new BadRequestException({code:"CG10_CHANGE_ROLE_INVALID"});
   return {accountRef:null,accessVersion:null,roleRef:null,roleRevision:null};
  }
  if(!UUID.test(accountRef)||(roleRef!==null&&!UUID.test(roleRef))||(!exit&&!roleRef)||(exit&&roleRef!==null))
   throw new BadRequestException({code:"CG10_CHANGE_ROLE_INVALID"});
  const account=await tx.query<{access_version:string}>(`SELECT a.access_version::text FROM account a
   WHERE a.realm_id=$1 AND a.id=$2 AND a.status='ACTIVE' AND NOT EXISTS(
    SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id
    WHERE ar.realm_id=a.realm_id AND ar.account_id=a.id AND ar.revoked_at IS NULL AND r.is_protected)
   FOR SHARE OF a`,[realm,accountRef]);
  if(!account.rows[0])throw new ConflictException({code:"CG10_CHANGE_ACCESS_CHANGED"});
  if(exit)return {accountRef,accessVersion:account.rows[0].access_version,roleRef:null,roleRevision:null};
  const role=await tx.query<{revision:number}>(`SELECT r.revision FROM role r
   WHERE r.realm_id=$1 AND r.id=$2 AND r.active AND NOT r.is_protected AND NOT EXISTS(
    SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key IN('roles.manage','identity.security-policy.manage'))
   FOR SHARE OF r`,[realm,roleRef]);
  if(!role.rows[0])throw new ForbiddenException({code:"CG10_CHANGE_ROLE_INVALID"});
  return {accountRef,accessVersion:account.rows[0].access_version,roleRef,roleRevision:role.rows[0].revision};
 }
 async apply(tx:PoolClient,realm:string,changeRef:string){
  if(!UUID.test(changeRef))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
  const source=await tx.query<Proof>(`SELECT h.id AS change_id,h.source_digest,h.revision,h.case_ref,h.decision_ref,
    h.kind,h.target_account_ref,h.expected_access_version::text,h.proposed_role_ref,h.expected_role_revision,
    d.actor_id AS reviewer_id,c.proposer_id
   FROM hr_employment_change h JOIN hr_employee e ON e.id=h.employee_id AND e.root_realm_id=h.root_realm_id
   JOIN cg03_case c ON c.id=h.case_ref AND c.realm_id=h.root_realm_id AND c.hr_employment_change_id=h.id
    AND c.hr_employment_change_digest=h.source_digest AND c.proposal_revision=h.revision
   JOIN cg03_case_decision d ON d.id=h.decision_ref AND d.case_id=c.id AND d.realm_id=c.realm_id
   JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id AND p.version=c.process_version AND p.process_kind=c.case_kind
   JOIN cg03_process_step st ON st.process_id=c.process_id AND st.ordinal=d.step_ordinal
    AND st.protected_root_required=true AND st.capability_key='approvals.review'
   WHERE h.root_realm_id=$1 AND h.id=$2 AND h.status='APPROVED_PENDING_EFFECT' AND h.effective_date<=CURRENT_DATE
    AND e.status IN('ACTIVE','PROBATION') AND e.status_version=h.prior_employee_version
    AND e.account_ref IS NOT DISTINCT FROM h.target_account_ref
    AND c.status='PENDING_OWNER' AND c.case_kind=CASE WHEN h.kind IN('RESIGNATION','EXIT') THEN 'HR_EXIT_REVIEW' ELSE 'HR_TRANSFER_PROMOTION' END
    AND c.proposer_id=h.created_by AND d.actor_id<>h.created_by AND d.actor_id IS DISTINCT FROM h.target_account_ref
    AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=c.revision
    AND d.step_ordinal=(SELECT max(ordinal) FROM cg03_process_step WHERE process_id=c.process_id)
    AND NOT EXISTS(SELECT 1 FROM cg03_process_step earlier WHERE earlier.process_id=c.process_id
     AND earlier.ordinal<d.step_ordinal AND NOT EXISTS(SELECT 1 FROM cg03_case_decision prev
      WHERE prev.case_id=c.id AND prev.step_ordinal=earlier.ordinal AND prev.action IN('APPROVE','FORWARD')))
   FOR SHARE OF c,d,p,st`,[realm,changeRef]);
  const proof=source.rows[0];if(!proof)throw new ConflictException({code:"CG10_CHANGE_STALE"});
  const reviewer=await tx.query(`SELECT 1 FROM account a JOIN account_role ar
   ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
   JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active AND r.is_protected
   WHERE a.realm_id=$1 AND a.id=$2 AND a.status='ACTIVE' FOR SHARE OF a,ar,r`,[realm,proof.reviewer_id]);
  const proposer=await tx.query("SELECT 1 FROM account WHERE realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[realm,proof.proposer_id]);
  if(!reviewer.rowCount||!proposer.rowCount)throw new ConflictException({code:"CG10_CHANGE_ACCESS_CHANGED"});
  if(!proof.target_account_ref)return {applied:true,accessVersion:null};
  const account=await tx.query<{access_version:string}>(`SELECT a.access_version::text FROM account a
   WHERE a.realm_id=$1 AND a.id=$2 AND a.status='ACTIVE' FOR UPDATE`,[realm,proof.target_account_ref]);
  if(!account.rows[0]||account.rows[0].access_version!==proof.expected_access_version)
   throw new ConflictException({code:"CG10_CHANGE_ACCESS_CHANGED"});
  const exit=exitKind(proof.kind);
  const snapshot=await this.snapshot(tx,realm,proof.target_account_ref,proof.proposed_role_ref,exit);
  if(snapshot.accessVersion!==proof.expected_access_version||snapshot.roleRevision!==proof.expected_role_revision)
   throw new ConflictException({code:"CG10_CHANGE_ACCESS_CHANGED"});
  await tx.query("UPDATE account_role SET revoked_at=now(),revision=revision+1 WHERE realm_id=$1 AND account_id=$2 AND revoked_at IS NULL",
   [realm,proof.target_account_ref]);
  if(!exit)await tx.query("INSERT INTO account_role(realm_id,account_id,role_id,assigned_by) VALUES($1,$2,$3,$4)",
   [realm,proof.target_account_ref,proof.proposed_role_ref,proof.reviewer_id]);
  const bumped=await tx.query<{access_version:string}>(`UPDATE account SET access_version=access_version+1,revision=revision+1,
   status=CASE WHEN $3::boolean THEN 'DEACTIVATED' ELSE status END,updated_at=now()
   WHERE realm_id=$1 AND id=$2 RETURNING access_version::text`,[realm,proof.target_account_ref,exit]);
  await tx.query("UPDATE auth_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL",[proof.target_account_ref]);
  await tx.query(`INSERT INTO cg01_hr_employment_effect(realm_id,change_ref,source_digest,source_revision,case_ref,decision_ref,
   target_account_ref,approved_role_ref,approved_role_revision,prior_access_version,resulting_access_version,reviewer_ref,effect_kind)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
   [realm,proof.change_id,proof.source_digest,proof.revision,proof.case_ref,proof.decision_ref,
    proof.target_account_ref,proof.proposed_role_ref,proof.expected_role_revision,proof.expected_access_version,
    bumped.rows[0].access_version,proof.reviewer_id,exit?"EXIT":"REASSIGN"]);
  await tx.query(`INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,action_key,outcome,safe_context,correlation_ref)
   VALUES($1,$2,$3,$4,'SUCCESS',$5::jsonb,$6)`,[realm,proof.reviewer_id,proof.target_account_ref,
    exit?"identity.hr.exit_access":"identity.hr.change_access",JSON.stringify({source:"Approved HR employment change",kind:proof.kind}),randomUUID()]);
  return {applied:true,accessVersion:bumped.rows[0].access_version};
 }
}
