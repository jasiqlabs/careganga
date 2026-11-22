import {ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {conflict,object,plain,uuid} from "../domain/tier-input";
import {parseApplicationDraft,parseDraftCancel} from "../domain/member-application-input";
type Actor=VerifiedFoundationActor;
type Contact={name:string;mobile:string;email:string|null};
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const projection='m.id AS ref,m.application_ref AS "applicationNumber",m.version,m.status,m.display_name AS name,m.contact_mobile AS mobile,m.contact_email AS email,m.address_text AS address,m.city,m.pin_code AS "pinCode",m.state_ref AS "stateRef",s.display_name AS state,m.district_ref AS "districtRef",d.display_name AS district,m.branch_ref AS "branchRef",b.name AS branch,m.referral_input AS referral,m.consent_version AS "consentVersion",t.plan_code AS "planCode",v.version_no AS "offerRevision",v.name AS plan,m.accepted_fee_minor::text AS "feeMinor",m.currency,v.duration_unit AS "durationUnit",v.duration_count AS "durationCount",(t.version=v.version_no AND t.status=\'ACTIVE\' AND v.status=\'ACTIVE\') AS "currentOffer",m.updated_at AS "updatedAt"';
const joins=" FROM membership_application m JOIN membership_tier_version v ON v.root_realm_id=m.root_realm_id AND v.id=m.tier_version_id JOIN membership_tier t ON t.root_realm_id=v.root_realm_id AND t.id=v.tier_id JOIN geography_area s ON s.root_realm_id=m.root_realm_id AND s.id=m.state_ref JOIN geography_area d ON d.root_realm_id=m.root_realm_id AND d.id=m.district_ref LEFT JOIN branch b ON b.root_realm_id=m.root_realm_id AND b.id=m.branch_ref";
@Injectable()
export class MembershipApplicationsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async run<T>(token:string,fn:(tx:PoolClient,a:Actor,contact:Contact)=>Promise<T>,read=false){
  const a=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");const contact=await this.identity.verifiedCommunityApplicant(tx,a);const result=await fn(tx,a,contact);await tx.query("COMMIT");return result;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}if(e&&typeof e==="object"&&"code" in e){if(e.code==="23505")throw new ConflictException({code:"CG04_APPLICATION_EXISTING",message:"An application or request already exists. Open your current application to continue."});if(["40001","40P01","55P03","23503","23514"].includes(String(e.code)))throw new ConflictException({code:"CG04_APPLICATION_CHANGED",message:"The application or selected plan changed. Refresh and review your current application."});}throw e;}finally{tx.release();}
 }
 private async self(tx:PoolClient,a:Actor,id:string,lock=false){
  const row=(await tx.query("SELECT "+projection+joins+" WHERE m.root_realm_id=$1 AND m.applicant_account_ref=$2 AND m.id=$3"+(lock?" FOR UPDATE OF m":""),[a.realmId,a.accountId,id])).rows[0];
  if(!row)throw new NotFoundException("Your membership application is not available.");return row;
 }
 private async lock(tx:PoolClient,a:Actor){await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG04:APPLICATION:"+a.realmId+":"+a.accountId]);}
 private async replay(tx:PoolClient,a:Actor,key:string,digest:string,action:string,target:string|null){
  const cmd=(await tx.query<{actor_ref:string;application_id:string;payload_digest:string;action:string}>("SELECT actor_ref,application_id,payload_digest,action FROM membership_application_command WHERE root_realm_id=$1 AND request_key=$2",[a.realmId,key])).rows[0];if(!cmd)return null;
  if(cmd.actor_ref!==a.accountId||cmd.payload_digest!==digest||cmd.action!==action||target!==null&&cmd.application_id!==target)return conflict();
  return {record:await this.self(tx,a,cmd.application_id),replayed:true};
 }
 private async audit(tx:PoolClient,a:Actor,id:string,version:number,key:string,digest:string,action:string){await tx.query("INSERT INTO membership_application_command(root_realm_id,request_key,application_id,result_version,actor_ref,action,payload_digest) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,key,id,version,a.accountId,action,digest]);}
 async options(token:string,raw:unknown){
  const q=object(raw,["stateRef"]),state=q.stateRef===undefined||q.stateRef===""?null:uuid(q.stateRef);
  return this.run(token,async(tx,a,contact)=>({contact,branches:await this.branches.membershipApplicantBranches(tx,a),states:await this.branches.projectGeographyOptions(tx,a,null),districts:state?await this.branches.projectGeographyOptions(tx,a,state):[]}),true);
 }
 async list(token:string){
  return this.run(token,async(tx,a)=>({items:(await tx.query("SELECT "+projection+joins+" WHERE m.root_realm_id=$1 AND m.applicant_account_ref=$2 ORDER BY m.created_at DESC,m.id DESC LIMIT 20",[a.realmId,a.accountId])).rows}),true);
 }
 async detail(token:string,raw:unknown){const id=uuid(raw);return this.run(token,(tx,a)=>this.self(tx,a,id),true);}
 async save(token:string,raw:unknown,target?:string){
  const id=target===undefined?null:uuid(target),d=parseApplicationDraft(raw,id!==null),kind=id?"EDIT":"CREATE",digest=hash([id,d]);
  return this.run(token,async(tx,a,contact)=>{
   await this.lock(tx,a);const prior=await this.replay(tx,a,d.key,digest,kind,id);if(prior)return prior;
   if(id){const old=await this.self(tx,a,id,true);if(old.version!==d.expected||old.status!=="DRAFT")return conflict();}
   const offer=(await tx.query<{id:string;fee_minor:string;currency:string}>(`SELECT v.id,v.fee_minor::text,v.currency FROM membership_tier_version v JOIN membership_tier t ON t.root_realm_id=v.root_realm_id AND t.id=v.tier_id AND t.version=v.version_no
    WHERE t.root_realm_id=$1 AND t.plan_code=$2 AND v.version_no=$3 AND t.status='ACTIVE' AND v.status='ACTIVE' AND v.published_at<=now() FOR SHARE OF t`,[a.realmId,d.planCode,d.offerRevision])).rows[0];
   if(!offer)throw new ConflictException({code:"CG04_OFFER_CHANGED",message:"This membership plan or price changed. Choose the current plan and confirm the new details."});
   await this.branches.membershipApplicantBranch(tx,a,d.branch);await this.branches.projectGeography(tx,a,d.state,d.district);
   const name=plain(contact.name,2,200,"account name");
   const values=[d.branch,offer.id,offer.fee_minor,offer.currency,name,contact.mobile,contact.email,d.address,d.city,d.pin,d.state,d.district,d.referral,d.consentVersion];
   let result:{id:string;version:number};
   if(id){result=(await tx.query<{id:string;version:number}>(`UPDATE membership_application SET branch_ref=$4,tier_version_id=$5,accepted_fee_minor=$6,currency=$7,display_name=$8,contact_mobile=$9,contact_email=$10,address_text=$11,city=$12,pin_code=$13,state_ref=$14,district_ref=$15,referral_input=$16,consent_version=$17,consented_at=now(),version=version+1,updated_at=now()
    WHERE root_realm_id=$1 AND applicant_account_ref=$2 AND id=$3 AND status='DRAFT' AND version=$18 RETURNING id,version`,[a.realmId,a.accountId,id,...values,d.expected])).rows[0];}
   else{result=(await tx.query<{id:string;version:number}>(`INSERT INTO membership_application(root_realm_id,applicant_account_ref,branch_ref,tier_version_id,accepted_fee_minor,currency,display_name,contact_mobile,contact_email,address_text,city,pin_code,state_ref,district_ref,referral_input,consent_version,status,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'DRAFT',1) RETURNING id,version`,[a.realmId,a.accountId,...values])).rows[0];}
   if(!result)return conflict();await this.audit(tx,a,result.id,result.version,d.key,digest,kind);return {record:await this.self(tx,a,result.id),replayed:false};
  });
 }
 async cancel(token:string,ref:string,raw:unknown){
  const id=uuid(ref),d=parseDraftCancel(raw),digest=hash([id,d]);return this.run(token,async(tx,a)=>{await this.lock(tx,a);const prior=await this.replay(tx,a,d.key,digest,"CANCEL",id);if(prior)return prior;
   const old=await this.self(tx,a,id,true);if(old.version!==d.expected||old.status!=="DRAFT")return conflict();
   const v=(await tx.query<{version:number}>("UPDATE membership_application SET status='CANCELLED',version=version+1,updated_at=now() WHERE root_realm_id=$1 AND applicant_account_ref=$2 AND id=$3 AND version=$4 AND status='DRAFT' RETURNING version",[a.realmId,a.accountId,id,d.expected])).rows[0];if(!v)return conflict();await this.audit(tx,a,id,v.version,d.key,digest,"CANCEL");return {record:await this.self(tx,a,id),replayed:false};});
 }
}
