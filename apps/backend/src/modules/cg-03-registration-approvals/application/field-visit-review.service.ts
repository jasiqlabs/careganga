import {ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FieldVisitsService} from "../../cg-05-projects-field-operations/application/field-visits.service";
import {ProjectsService} from "../../cg-05-projects-field-operations/application/projects.service";
import {choice,clean,fields,invalid,ref,stale,version} from "../../cg-05-projects-field-operations/domain/project-input";
type Case={id:string;case_number:string;proposer_id:string;visit_review_ref:string;visit_review_id:string;visit_review_version:number;visit_review_digest:string;status:string;revision:number;process_id:string;current_step:number};
type Snap={id:string;visit_version:number;visit_id:string;source_digest:string;submitted_by:string;report_snapshot:Record<string,unknown>};
type Proof={fileRef:string;sourceVersion:number;fileVersion:number;sha256:string;mime:string};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
@Injectable()
export class FieldVisitReviewService{
 constructor(private readonly projects:ProjectsService,private readonly visits:FieldVisitsService,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService){}
 private async event(tx:PoolClient,a:Actor,id:string,action:string){await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,id,a.accountId,action,randomUUID()]);}
 private async proofs(tx:PoolClient,a:Actor,id:string,ver:number):Promise<Proof[]>{
  const active=await tx.query("SELECT 1 FROM cg19_upload_intent WHERE realm_id=$1 AND visit_id=$2 AND owner_kind='CG05_VISIT' AND status IN('INITIATED','UNKNOWN','VERIFYING') AND reserved_until>now() LIMIT 1",[a.realmId,id]);
  if(active.rowCount)throw stale();
  const q=await tx.query<Proof>(`SELECT f.id AS "fileRef",f.proposal_revision AS "sourceVersion",f.revision AS "fileVersion",f.verified_sha256 AS sha256,f.original_mime AS mime
   FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE f.realm_id=$1 AND f.visit_id=$2 AND f.proposal_revision<=$3 AND f.owner_kind='CG05_VISIT'
   AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.owner_kind='CG05_VISIT' AND i.status='VALIDATED' AND i.visit_consent_confirmed
   ORDER BY f.id LIMIT 51 FOR SHARE OF f,i`,[a.realmId,id,ver]);
  if(q.rows.length>50)throw invalid();
  if(q.rows.length)await this.identity.assertCurrent(tx,a,"documents.files.view");
  return q.rows;
 }
 private async snapshot(tx:PoolClient,a:Actor,id:string,version:number){
  const v=(await tx.query("SELECT visit_code AS code,project_id,task_id,actor_account_ref,actor_employee_ref,actor_branch_ref,branch_ref,state_ref,district_ref,visit_kind,location_label_private,planned_at,purpose,report_text,started_at,completed_at FROM field_visit WHERE root_realm_id=$1 AND id=$2",[a.realmId,id])).rows[0];
  if(!v||!v.started_at||!v.completed_at||!String(v.report_text).trim())throw invalid();
  const captures=(await tx.query("SELECT kind,latitude,longitude,accuracy_m,recorded_at,device_recorded_at,location_provenance,consent_state FROM visit_checkin_event WHERE root_realm_id=$1 AND visit_id=$2 ORDER BY recorded_at,kind",[a.realmId,id])).rows;
  if(captures.length!==2)throw stale();
  const proof=await this.proofs(tx,a,id,version);
  const report={...v,captures,locationState:captures.every(c=>c.location_provenance==="DEVICE_GPS")?"DEVICE_REPORTED":"UNVERIFIED_LOCATION"};
  return {report,proof,digest:hash([id,version,report,proof])};
 }
 async submit(token:string,visitRef:string,raw:unknown){
  const target=ref(visitRef),x=fields(raw,["requestKey","expectedVersion"]),key=ref(x.requestKey),expected=version(x.expectedVersion);
  return this.projects.run(token,"projects.visits.view",async(tx,a)=>{
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   const v=await this.visits.guardReview(tx,a,target,null,true);
   const prior=(await tx.query<Snap>("SELECT * FROM field_visit_review_snapshot WHERE root_realm_id=$1 AND request_key=$2",[a.realmId,key])).rows[0];
   if(prior){if(prior.visit_id!==target||prior.submitted_by!==a.accountId||prior.visit_version!==expected+1)throw stale();
    const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND visit_review_ref=$2 AND case_kind='FIELD_VISIT_REVIEW'",[a.realmId,prior.id])).rows[0];if(!c)throw stale();return {caseNumber:c.case_number,status:c.status,replayed:true};}
   if(v.version!==expected||!["PENDING_PROOF","RETURNED"].includes(v.status))throw stale();
   await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   const snap=await this.snapshot(tx,a,target,expected);
   if(snap.report.locationState==="UNVERIFIED_LOCATION"&&snap.proof.length===0)throw invalid();
   let process=(await tx.query<{process_id:string}>("SELECT process_id FROM cg03_visit_review_process_current WHERE realm_id=$1 FOR SHARE",[a.realmId])).rows[0]?.process_id;
   if(!process){
    process=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'FIELD_VISIT_REVIEW' FROM cg03_process WHERE realm_id=$1 RETURNING id",[a.realmId,a.accountId])).rows[0].id;
    await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[process]);
    await tx.query("INSERT INTO cg03_visit_review_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,process]);
   }
   const next=await this.visits.reviewTransition(tx,a,target,expected,"PENDING_APPROVAL",key,snap.digest,"",false);
   const s=(await tx.query<{id:string}>("INSERT INTO field_visit_review_snapshot(root_realm_id,visit_id,visit_version,source_digest,report_snapshot,submitted_by,request_key) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id",[a.realmId,target,next.version,snap.digest,JSON.stringify(snap.report),a.accountId,key])).rows[0];
   for(const f of snap.proof)await tx.query("INSERT INTO field_visit_review_file(root_realm_id,snapshot_id,visit_id,file_ref,source_version,file_version,sha256) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,s.id,target,f.fileRef,f.sourceVersion,f.fileVersion,f.sha256]);
   const c=(await tx.query<Case>("INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,visit_review_ref,visit_review_id,visit_review_version,visit_review_digest) SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,$3,'Field visit review',NULL,NULL,$4,$5,$6,$7,'FIELD_VISIT_REVIEW',$8,$9,$4,$5 FROM cg03_process p WHERE p.id=$10 AND p.realm_id=$1 AND p.process_kind='FIELD_VISIT_REVIEW' RETURNING *",[a.realmId,a.accountId,String(snap.report.code),next.version,snap.digest,hash([target,key,snap.digest]),key,s.id,target,process])).rows[0];
   if(!c)throw stale();await this.event(tx,a,c.id,"SUBMITTED");return {caseNumber:c.case_number,status:c.status,replayed:false};
  });
 }
 async detail(token:string,visitRef:string){
  return this.projects.run(token,"projects.visits.view",async(tx,a)=>{
   const v=await this.visits.guardEvidence(tx,a,ref(visitRef),null,false);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND visit_review_id=$2 AND case_kind='FIELD_VISIT_REVIEW' ORDER BY visit_review_version DESC LIMIT 1",[a.realmId,v.id])).rows[0];
   if(!c)return {status:"NOT_SUBMITTED",canReview:false,caseRef:null};
   const s=(await tx.query<Snap>("SELECT * FROM field_visit_review_snapshot WHERE root_realm_id=$1 AND id=$2",[a.realmId,c.visit_review_ref])).rows[0];if(!s)throw stale();
   let canReview=false;
   if(c.proposer_id!==a.accountId&&v.actor_account_ref!==a.accountId&&v.version===c.visit_review_version&&v.status==="PENDING_APPROVAL"&&["SUBMITTED","IN_REVIEW"].includes(c.status)){try{await this.owner.verifyReviewer(tx,a,"approvals.review",true);canReview=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}}
   const decisions=(await tx.query("SELECT d.action,d.safe_remarks AS remarks,d.fresh_password_verified_at AS at,a.display_name AS reviewer FROM cg03_case_decision d JOIN account a ON a.id=d.actor_id AND a.realm_id=d.realm_id WHERE d.realm_id=$1 AND d.case_id=$2 ORDER BY d.accepted_case_revision",[a.realmId,c.id])).rows;
   const files=(await tx.query("SELECT count(*)::int AS count FROM field_visit_review_file WHERE root_realm_id=$1 AND snapshot_id=$2",[a.realmId,s.id])).rows[0].count;
   return {caseRef:canReview?c.id:null,caseNumber:c.case_number,status:c.status,revision:c.revision,canReview,sourceVersion:s.visit_version,report:s.report_snapshot.report_text,locationState:s.report_snapshot.locationState,verifiedFileCount:files,decisions};
  },true);
 }
 async decide(token:string,caseRef:string,raw:unknown){
  const target=ref(caseRef),x=fields(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]),key=ref(x.requestKey),expected=version(x.expectedRevision),action=choice(x.action,["APPROVE","RETURN","REJECT"] as const),remarks=clean(x.remarks??"",action==="APPROVE"?0:3,500),password=x.currentPassword;
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password)>1024)throw invalid();
  const h=hash([target,expected,action,remarks]),actor=await this.sessions.requireAction(token,"approvals.review");await this.sessions.limitFoundationRootProof(actor);
  return this.projects.run(token,"approvals.review",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"projects.visits.view");await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   const found=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='FIELD_VISIT_REVIEW'",[a.realmId,target])).rows[0];if(!found)throw new NotFoundException("Visit review unavailable");
   const v=await this.visits.guardReview(tx,a,found.visit_review_id,null,true,true);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='FIELD_VISIT_REVIEW' FOR UPDATE",[a.realmId,target])).rows[0];
   if(!c||c.proposer_id===a.accountId||v.actor_account_ref===a.accountId)throw new ForbiddenException("A different authorized reviewer must decide");
   const prior=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,target,key])).rows[0];
   if(prior){if(prior.actor_id!==a.accountId||prior.request_digest!==h)throw stale();return {status:c.status,replayed:true};}
   if(c.revision!==expected||v.version!==c.visit_review_version||v.status!=="PENDING_APPROVAL"||!["SUBMITTED","IN_REVIEW"].includes(c.status))throw stale();
   if(!(await tx.query("SELECT 1 FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2 AND capability_key='approvals.review' AND protected_root_required FOR SHARE",[c.process_id,c.current_step])).rowCount)throw stale();
   const s=(await tx.query<Snap>("SELECT * FROM field_visit_review_snapshot WHERE root_realm_id=$1 AND id=$2 AND visit_id=$3 AND visit_version=$4 AND source_digest=$5 FOR SHARE",[a.realmId,c.visit_review_ref,v.id,v.version,c.visit_review_digest])).rows[0];if(!s)throw stale();
   if(action==="APPROVE"){
    const snap=await this.snapshot(tx,a,v.id,v.version-1);
    if(snap.digest!==s.source_digest)throw stale();
    if(snap.report.locationState==="UNVERIFIED_LOCATION"&&snap.proof.length===0)throw stale();
    // Approval attests the report; device supplied coordinates are not independently verified GPS.
   }
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const next=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,target,next]);
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",[a.realmId,target,a.accountId,action,expected,expected+1,key,h,remarks]);
   await this.event(tx,a,target,action==="APPROVE"?"FINAL_APPROVED":next);
   await this.visits.reviewTransition(tx,a,v.id,v.version,action==="APPROVE"?"COMPLETED":action==="RETURN"?"RETURNED":"REJECTED",key,h,remarks,true);
   if(action==="APPROVE"){await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,target]);await this.event(tx,a,target,"OWNER_COMPLETED");}
   return {status:action==="APPROVE"?"OWNER_COMPLETED":next,replayed:false};
  });
 }
}
