import {ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {VolunteerApprovalService} from "../../cg-03-registration-approvals/application/volunteer-approval.service";
import {creditVerifiedCG04Qualification} from "../../cg-13-referrals-rewards/application/verified-qualification.source";
import {object,uuid} from "../domain/tier-input";
const changed=()=>new ConflictException("Volunteer activation is not confirmed. Check the original independent approval and current verified details.");
@Injectable()
export class VolunteerActivationService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly approvals:VolunteerApprovalService){}
 private async run<T>(token:string,work:(tx:PoolClient,a:Actor)=>Promise<T>){
  const actor=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   await this.identity.verifiedCommunityApplicant(tx,actor);
   const value=await work(tx,actor);await tx.query("COMMIT");return value;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e&&["23505","23503","23514","40001","40P01","55P03","P0001"].includes(String(e.code)))throw changed();
   throw e;
  }finally{tx.release();}
 }
 private async own(tx:PoolClient,a:Actor){
  return (await tx.query<{
   volunteerNumber:string;name:string;branch:string|null;department:string;
   availability:string;skills:string[];status:string;joinedOn:string
  }>(`SELECT v.volunteer_no AS "volunteerNumber",v.display_name AS name,b.name AS branch,
     d.name AS department,v.availability,v.skills,v.status,
     (v.created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS "joinedOn"
     FROM volunteer v JOIN department d ON d.root_realm_id=v.root_realm_id AND d.id=v.department_ref
     LEFT JOIN branch b ON b.root_realm_id=v.root_realm_id AND b.id=v.branch_ref
     WHERE v.root_realm_id=$1 AND v.account_ref=$2`,[a.realmId,a.accountId])).rows[0]??null;
 }
 async me(token:string){return this.run(token,async(tx,a)=>({volunteer:await this.own(tx,a)}));}
 async activate(token:string,ref:string,raw:unknown){
  const id=uuid(ref),x=object(raw,["requestKey"]),key=uuid(x.requestKey);
  return this.run(token,async(tx,a)=>{
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG04:VOLUNTEER:"+a.realmId+":"+a.accountId]);
   const app=(await tx.query<{
    id:string;version:number;status:string;submitted_digest:string|null;first_name:string;last_name:string;
    branch_ref:string|null;department_ref:string;availability:string;skills:string[]
   }>(`SELECT id,version,status,submitted_digest,first_name,last_name,branch_ref,department_ref,availability,skills
      FROM volunteer_application WHERE root_realm_id=$1 AND id=$2 AND applicant_account_ref=$3 FOR UPDATE`,
    [a.realmId,id,a.accountId])).rows[0];
   if(!app)throw new NotFoundException("Your volunteer application is unavailable.");
   const effect=(await tx.query<{actor_ref:string;request_key:string}>(
    "SELECT actor_ref,request_key FROM volunteer_approval_effect WHERE root_realm_id=$1 AND application_id=$2",
    [a.realmId,id])).rows[0];
   if(effect){
    if(effect.actor_ref!==a.accountId||app.status!=="APPROVED")throw changed();
    const volunteer=await this.own(tx,a);if(!volunteer)throw changed();
    return {volunteer,replayed:true};
   }
   if(app.status!=="SUBMITTED"||!app.submitted_digest)throw changed();
   const reviewed=await this.approvals.approvedForActivation(tx,a,id,app.version,app.submitted_digest);
   const check=(await tx.query<{approved:boolean}>("SELECT cg04_volunteer_approved_source($1,$2) AS approved",[a.realmId,id])).rows[0];
   if(!check?.approved)throw changed();
   const existed=(await tx.query("SELECT 1 FROM volunteer WHERE root_realm_id=$1 AND account_ref=$2 FOR UPDATE",[a.realmId,a.accountId])).rowCount;
   if(existed)throw new ConflictException("Your existing volunteer identity is already registered.");
   const created=(await tx.query<{id:string}>(`INSERT INTO volunteer(root_realm_id,original_application_id,account_ref,display_name,branch_ref,department_ref,skills,availability)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id`,
     [a.realmId,id,a.accountId,app.first_name+" "+app.last_name,app.branch_ref,app.department_ref,JSON.stringify(app.skills),app.availability])).rows[0];
   await tx.query(`INSERT INTO volunteer_affiliation_history(root_realm_id,volunteer_id,branch_ref,department_ref,actor_ref,reason)
     VALUES($1,$2,$3,$4,$5,'APPROVED_VOLUNTEER')`,
     [a.realmId,created.id,app.branch_ref,app.department_ref,a.accountId]);
   await tx.query(`INSERT INTO volunteer_approval_effect(root_realm_id,application_id,case_id,decision_id,volunteer_id,source_digest,request_key,actor_ref)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
     [a.realmId,id,reviewed.caseRef,reviewed.decisionRef,created.id,app.submitted_digest,key,a.accountId]);
   const updated=await tx.query(`UPDATE volunteer_application SET status='APPROVED',version=version+1,updated_at=now()
     WHERE root_realm_id=$1 AND id=$2 AND applicant_account_ref=$3 AND status='SUBMITTED' AND version=$4 RETURNING id`,
     [a.realmId,id,a.accountId,app.version]);
   if(!updated.rowCount)throw changed();
   await this.approvals.completeVolunteer(tx,a,reviewed.caseRef,id);
   const volunteer=await this.own(tx,a);if(!volunteer)throw changed();
   // CG13: original CG03/CG04 verified volunteer source only; same transaction.
   await creditVerifiedCG04Qualification(tx,{root:a.realmId,applicantKind:"VOLUNTEER",
    application:id,applicantAccount:a.accountId});
   return {volunteer,replayed:false};
  });
 }
}
