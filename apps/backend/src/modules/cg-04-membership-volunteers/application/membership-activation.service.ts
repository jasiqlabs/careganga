import {ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {MembershipApprovalService} from "../../cg-03-registration-approvals/application/membership-approval.service";
import {MembershipFeesService} from "../../cg-09-finance-accounting/application/membership-fees.service";
import {creditVerifiedCG04Qualification} from "../../cg-13-referrals-rewards/application/verified-qualification.source";
import {object,uuid} from "../domain/tier-input";
const changed=()=>new ConflictException("Membership is not ready for activation. Check the latest approval and payment status.");
@Injectable()
export class MembershipActivationService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly approvals:MembershipApprovalService,private readonly fees:MembershipFeesService){}
 private async run<T>(token:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>){
  const a=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.identity.verifiedCommunityApplicant(tx,a);const r=await fn(tx,a);await tx.query("COMMIT");return r;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}if(e&&typeof e==="object"&&"code" in e&&["23505","23503","23514","40001","40P01","55P03","P0001"].includes(String(e.code)))throw changed();throw e;}finally{tx.release();}
 }
 private async ownMember(tx:PoolClient,a:Actor){
  const record=(await tx.query("SELECT m.member_no AS \"memberNumber\",m.display_name AS name,b.name AS branch,v.name AS plan,v.category,t.fee_minor::text AS \"feeMinor\",t.currency,t.starts_on::text AS \"startsOn\",t.expires_on::text AS \"expiresOn\",CASE WHEN m.status='ACTIVE' AND t.expires_on IS NOT NULL AND t.expires_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date THEN 'EXPIRED' ELSE m.status END AS status FROM member m JOIN membership_term t ON t.root_realm_id=m.root_realm_id AND t.member_id=m.id JOIN membership_tier_version v ON v.root_realm_id=t.root_realm_id AND v.id=t.tier_version_id LEFT JOIN branch b ON b.root_realm_id=m.root_realm_id AND b.id=m.branch_ref WHERE m.root_realm_id=$1 AND m.account_ref=$2 AND t.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY t.starts_on DESC LIMIT 1",[a.realmId,a.accountId])).rows[0];
  return record??null;
 }
 async me(token:string){return this.run(token,async(tx,a)=>({member:await this.ownMember(tx,a)}));}
 /** Own history only: same verified CG01 community identity, same CG04 member.
  * Immutable paid terms are read from original CG09-confirmed activation records.
  * Names, visible business numbers and real branch labels are exposed; never UUIDs. */
 async history(token:string){
  return this.run(token,async(tx,a)=>{
   const member=(await tx.query<{id:string}>(
    "SELECT id FROM member WHERE root_realm_id=$1 AND account_ref=$2 FOR SHARE",
    [a.realmId,a.accountId])).rows[0];
   if(!member)return {terms:[],branches:[],termsHasMore:false,branchesHasMore:false};
   const [terms,branches]=await Promise.all([
    tx.query<{plan:string;category:string;feeMinor:string;currency:string;startsOn:string;expiresOn:string|null;applicationNumber:string;recordedAt:string}>(
     `SELECT v.name AS plan,v.category,t.fee_minor::text AS "feeMinor",t.currency,
     t.starts_on::text AS "startsOn",t.expires_on::text AS "expiresOn",
     app.application_ref AS "applicationNumber",t.created_at AS "recordedAt"
     FROM membership_term t
     JOIN membership_tier_version v ON v.root_realm_id=t.root_realm_id AND v.id=t.tier_version_id
     JOIN membership_application app ON app.root_realm_id=t.root_realm_id AND app.id=t.original_application_id
     WHERE t.root_realm_id=$1 AND t.member_id=$2
     ORDER BY t.starts_on DESC,t.id DESC LIMIT 26`,[a.realmId,member.id]),
    tx.query<{branch:string|null;effectiveFrom:string;effectiveTo:string|null;reason:string}>(
     `SELECT b.name AS branch,h.effective_from AS "effectiveFrom",
     h.effective_to AS "effectiveTo",h.reason
     FROM member_branch_history h LEFT JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref
     WHERE h.root_realm_id=$1 AND h.member_id=$2
     ORDER BY h.effective_from DESC,h.id DESC LIMIT 26`,[a.realmId,member.id])
   ]);
   return {terms:terms.rows.slice(0,25),branches:branches.rows.slice(0,25),
    termsHasMore:terms.rows.length>25,branchesHasMore:branches.rows.length>25};
  });
 }
 async fee(token:string,ref:string){const id=uuid(ref);return this.run(token,async(tx,a)=>{
  if(!(await tx.query("SELECT 1 FROM membership_application WHERE root_realm_id=$1 AND id=$2 AND applicant_account_ref=$3 FOR SHARE",[a.realmId,id,a.accountId])).rowCount)throw new NotFoundException("Your membership application is unavailable.");
  return this.fees.statusInTx(tx,a.realmId,id);
 });}
 async activate(token:string,ref:string,raw:unknown){
  const id=uuid(ref),x=object(raw,["requestKey"]),key=uuid(x.requestKey);
  return this.run(token,async(tx,a)=>{
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG04:APPLICATION:"+a.realmId+":"+a.accountId]);
   const app=(await tx.query<{id:string;version:number;status:string;submitted_digest:string|null;display_name:string;branch_ref:string|null;accepted_fee_minor:string;tier_version_id:string;currency:string;duration_unit:string;duration_count:number}>("SELECT a.id,a.version,a.status,a.submitted_digest,a.display_name,a.branch_ref,a.accepted_fee_minor::text,a.tier_version_id,a.currency,v.duration_unit,v.duration_count FROM membership_application a JOIN membership_tier_version v ON v.root_realm_id=a.root_realm_id AND v.id=a.tier_version_id WHERE a.root_realm_id=$1 AND a.id=$2 AND a.applicant_account_ref=$3 FOR UPDATE OF a",[a.realmId,id,a.accountId])).rows[0];
   if(!app)throw new NotFoundException("Your membership application is unavailable.");
   const prior=(await tx.query<{request_key:string;actor_ref:string}>("SELECT request_key,actor_ref FROM membership_application_effect WHERE root_realm_id=$1 AND application_id=$2",[a.realmId,id])).rows[0];
   if(prior){if(prior.actor_ref!==a.accountId||app.status!=="APPROVED")throw changed();const member=await this.ownMember(tx,a);if(!member)throw changed();return {member,replayed:true};}
   if(app.status!=="SUBMITTED"||!app.submitted_digest)throw changed();
   const review=await this.approvals.approvedForActivation(tx,a,id,app.version,app.submitted_digest);
   let journal:string|null=null;
   if(BigInt(app.accepted_fee_minor)>0n){
    const paid=(await tx.query<{journal_id:string;reconciliation_id:string}>("SELECT journal_id,reconciliation_id FROM finance_membership_verified_collection WHERE root_realm_id=$1 AND application_id=$2 AND amount_minor=$3",[a.realmId,id,app.accepted_fee_minor])).rows[0];if(!paid)throw new ConflictException("Membership payment has not yet been verified. Your approval is saved.");
    const locked=await tx.query("SELECT f.id FROM finance_bank_reconciliation r JOIN finance_reconciliation_decision d ON d.root_realm_id=r.root_realm_id AND d.reconciliation_id=r.id AND d.action='VERIFY' JOIN cg19_stored_file f ON f.realm_id=d.root_realm_id AND f.id=d.statement_file_id AND f.revision=d.statement_file_version JOIN cg19_upload_intent i ON i.realm_id=f.realm_id AND i.id=f.upload_intent_id WHERE r.root_realm_id=$1 AND r.id=$2 AND r.status='VERIFIED' AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED' FOR SHARE OF r,d,f,i",[a.realmId,paid.reconciliation_id]);
    if(!locked.rowCount)throw changed();journal=paid.journal_id;
   }
   if(!(await tx.query("SELECT 1 WHERE cg04_member_approved_source($1,$2)",[a.realmId,id])).rowCount)throw changed();

   const existing=(await tx.query<{id:string;status:string;branch_ref:string|null}>("SELECT id,status,branch_ref FROM member WHERE root_realm_id=$1 AND account_ref=$2 FOR UPDATE",[a.realmId,a.accountId])).rows[0];
   if(existing&&(existing.status!=="ACTIVE"||existing.branch_ref!==app.branch_ref))throw new ConflictException("Renew using your current membership branch. A protected transfer must be approved separately.");
   let starts:string;
   if(existing){
    const last=(await tx.query<{starts:string;ends:string|null;today:string}>("SELECT starts_on::text AS starts,expires_on::text AS ends,(now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today FROM membership_term WHERE root_realm_id=$1 AND member_id=$2 ORDER BY starts_on DESC,id DESC LIMIT 1 FOR SHARE",[a.realmId,existing.id])).rows[0];
    if(!last||last.ends===null||last.starts>last.today)throw new ConflictException("Your membership has lifetime or already scheduled validity. Another renewal is not available yet.");
    starts=last.ends>last.today?last.ends:last.today;
   }else starts=(await tx.query<{today:string}>("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today")).rows[0].today;
   const effectKind=existing?"RENEW" as const:"ACTIVATE" as const;
   const m=existing??(await tx.query<{id:string}>("INSERT INTO member(root_realm_id,original_application_id,account_ref,display_name,branch_ref) VALUES($1,$2,$3,$4,$5) RETURNING id",[a.realmId,id,a.accountId,app.display_name,app.branch_ref])).rows[0];
   const t=(await tx.query<{id:string}>(`WITH day AS (SELECT $9::date AS start)
    INSERT INTO membership_term(root_realm_id,member_id,original_application_id,tier_version_id,fee_minor,currency,starts_on,expires_on)
    SELECT $1,$2,$3,$4,$5,$6,day.start,CASE $7::text WHEN 'LIFETIME' THEN NULL::date WHEN 'DAY' THEN day.start+$8::int WHEN 'MONTH' THEN (day.start+make_interval(months=>$8::int))::date ELSE (day.start+make_interval(years=>$8::int))::date END FROM day RETURNING id`,[a.realmId,m.id,id,app.tier_version_id,app.accepted_fee_minor,app.currency,app.duration_unit,app.duration_count,starts])).rows[0];
   if(!existing)await tx.query("INSERT INTO member_branch_history(root_realm_id,member_id,branch_ref,reason,actor_ref) VALUES($1,$2,$3,'Initial approved membership',$4)",[a.realmId,m.id,app.branch_ref,a.accountId]);
   await tx.query("INSERT INTO membership_application_effect(root_realm_id,application_id,case_id,decision_id,member_id,term_id,pinned_review_revision,source_digest,fee_journal_id,request_key,actor_ref,effect_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",[a.realmId,id,review.caseRef,review.decisionRef,m.id,t.id,app.version,app.submitted_digest,journal,key,a.accountId,effectKind]);
   const updated=await tx.query("UPDATE membership_application SET status='APPROVED',version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' AND version=$3 RETURNING id",[a.realmId,id,app.version]);
   if(!updated.rowCount)throw changed();await this.approvals.completeMembership(tx,a,review.caseRef,id);const member=await this.ownMember(tx,a);if(!member)throw changed();
    // CG13: only AFTER original CG03/CG09/CG04 verified activation and final
    // current source check. Same database TX: never award from a public flag.
    await creditVerifiedCG04Qualification(tx,{root:a.realmId,applicantKind:"MEMBER",
     application:id,applicantAccount:a.accountId});
    return {member,replayed:false};
  });
 }
}
