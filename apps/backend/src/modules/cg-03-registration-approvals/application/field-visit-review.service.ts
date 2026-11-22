import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
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
type Step={ordinal:number;capability_key:"projects.visits.manage"|"approvals.review";protected_root_required:boolean};
type Snap={id:string;visit_version:number;visit_id:string;source_digest:string;submitted_by:string;report_snapshot:Record<string,unknown>};
type Proof={fileRef:string;sourceVersion:number;fileVersion:number;sha256:string;mime:string};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
@Injectable()
export class FieldVisitReviewService{
 constructor(private readonly projects:ProjectsService,private readonly visits:FieldVisitsService,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService){}
 private async event(tx:PoolClient,a:Actor,id:string,action:string,step=1,remarks=""){await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref,safe_remarks) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,id,a.accountId,action,step,randomUUID(),remarks]);}
 private async route(tx:PoolClient,process:string){
  const rows=(await tx.query<Step>("SELECT ordinal,capability_key,protected_root_required FROM cg03_process_step WHERE process_id=$1 ORDER BY ordinal FOR SHARE",[process])).rows;
  if(rows.length<1||rows.length>2||rows.some((s,i)=>s.ordinal!==i+1)||rows.at(-1)?.capability_key!=="approvals.review"||!rows.at(-1)?.protected_root_required||rows.length===2&&(rows[0].capability_key!=="projects.visits.manage"||rows[0].protected_root_required))throw stale();
  return rows;
 }
 private async authority(tx:PoolClient,a:Actor,step:Step){
  await this.identity.assertCurrent(tx,a,step.capability_key);
  if(step.protected_root_required)await this.owner.verifyReviewer(tx,a,"approvals.review",true);
 }
 private async makeRoute(tx:PoolClient,a:Actor,preliminary:boolean){
  const p=(await tx.query<{id:string;version:number}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,$3,$2,'FIELD_VISIT_REVIEW' FROM cg03_process WHERE realm_id=$1 RETURNING id,version",[a.realmId,a.accountId,preliminary?"projects.visits.manage":null])).rows[0];
  if(preliminary)await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'projects.visits.manage',false),($1,2,'approvals.review',true)",[p.id]);
  else await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[p.id]);
  await tx.query("INSERT INTO cg03_visit_review_process_current(realm_id,process_id) VALUES($1,$2) ON CONFLICT(realm_id) DO UPDATE SET process_id=EXCLUDED.process_id",[a.realmId,p.id]);
  return p;
 }
 async policy(token:string){
  return this.projects.run(token,"approvals.process.manage",async(tx,a)=>{
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   const p=(await tx.query<{id:string;version:number;first_reviewer_capability:string|null}>("SELECT p.id,p.version,p.first_reviewer_capability FROM cg03_visit_review_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id WHERE cur.realm_id=$1",[a.realmId])).rows[0];
   return {preliminary:p?.first_reviewer_capability==="projects.visits.manage",version:p?.version??0};
  },true);
 }
 async configure(token:string,raw:unknown){
  const x=fields(raw,["requestKey","preliminary","currentPassword","expectedVersion"]),key=ref(x.requestKey);
  if(typeof x.preliminary!=="boolean"||typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)throw new BadRequestException("Choose the review route and enter your current password.");
  if(typeof x.expectedVersion!=="number"||!Number.isSafeInteger(x.expectedVersion)||x.expectedVersion<0||x.expectedVersion>=2147483647)throw invalid();
  const preliminary=x.preliminary,password=x.currentPassword,expected=x.expectedVersion,digest=hash(["FIELD_VISIT_REVIEW",preliminary,expected]);
  const actor=await this.sessions.requireAction(token,"approvals.process.manage");await this.sessions.limitFoundationRootProof(actor);
  return this.projects.run(token,"approvals.process.manage",async(tx,a)=>{
   await this.owner.verifyReviewer(tx,a,"approvals.review",true);
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   const prior=(await tx.query<{version:number;request_digest:string}>("SELECT p.version,cmd.request_digest FROM cg03_process_command cmd JOIN cg03_process p ON p.id=cmd.process_id AND p.realm_id=cmd.realm_id WHERE cmd.realm_id=$1 AND cmd.actor_id=$2 AND cmd.request_key=$3",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.request_digest!==digest)throw stale();return {version:prior.version,replayed:true};}
   const current=(await tx.query<{version:number;first_reviewer_capability:string|null}>("SELECT p.version,p.first_reviewer_capability FROM cg03_visit_review_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id WHERE cur.realm_id=$1 FOR UPDATE OF cur",[a.realmId])).rows[0];
   if((current?.version??0)!==expected)throw new ConflictException("Review settings changed. Reload the current settings before saving.");
   if(current&&(current.first_reviewer_capability==="projects.visits.manage")===preliminary)throw new BadRequestException("Choose a different review route.");
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const p=await this.makeRoute(tx,a,preliminary);
   await tx.query("INSERT INTO cg03_process_command(realm_id,actor_id,request_key,request_digest,process_id) VALUES($1,$2,$3,$4,$5)",[a.realmId,a.accountId,key,digest,p.id]);
   return {version:p.version,replayed:false};
  });
 }
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
  if(!v||!v.started_at||!v.completed_at||!String(v.report_text).trim())throw new BadRequestException("Complete check-in and check-out and save your visit report before submitting.");
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
   if(snap.report.locationState==="UNVERIFIED_LOCATION"&&snap.proof.length===0)throw new BadRequestException("Add verified supporting evidence because the visit location is unverified.");
   let process=(await tx.query<{process_id:string}>("SELECT process_id FROM cg03_visit_review_process_current WHERE realm_id=$1 FOR SHARE",[a.realmId])).rows[0]?.process_id;
   if(!process)process=(await this.makeRoute(tx,a,false)).id;
   const steps=await this.route(tx,process);
   const excluded=[a.accountId,v.actor_account_ref];
   const reviewers=(await tx.query<{id:string;root:boolean;coordinator:boolean}>(`
    SELECT acc.id,bool_or(r.is_protected) AS root,bool_or(r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='projects.visits.manage')) AS coordinator
    FROM account acc JOIN account_role ar ON ar.realm_id=acc.realm_id AND ar.account_id=acc.id AND ar.revoked_at IS NULL
    JOIN role r ON r.id=ar.role_id AND r.realm_id=acc.realm_id AND r.active
    WHERE acc.realm_id=$1 AND acc.status='ACTIVE' AND NOT(acc.id=ANY($2::uuid[]))
      AND (r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='projects.visits.manage'))
    AND EXISTS(SELECT 1 FROM account_role vr JOIN role rv ON rv.id=vr.role_id AND rv.realm_id=vr.realm_id AND rv.active WHERE vr.realm_id=acc.realm_id AND vr.account_id=acc.id AND vr.revoked_at IS NULL AND (rv.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=rv.id AND g.capability_key='projects.visits.view')))
      AND (EXISTS(SELECT 1 FROM account_role gr JOIN role rg ON rg.id=gr.role_id AND rg.realm_id=gr.realm_id AND rg.active WHERE gr.realm_id=acc.realm_id AND gr.account_id=acc.id AND gr.revoked_at IS NULL AND (rg.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=rg.id AND g.capability_key='foundation.branches.admin'))) OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=acc.realm_id AND b.id=$3 AND b.status='ACTIVE' AND b.manager_account_ref=acc.id))
    AND (NOT $4::boolean OR EXISTS(SELECT 1 FROM account_role fr JOIN role rf ON rf.id=fr.role_id AND rf.realm_id=fr.realm_id AND rf.active WHERE fr.realm_id=acc.realm_id AND fr.account_id=acc.id AND fr.revoked_at IS NULL AND (rf.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=rf.id AND g.capability_key='documents.files.view'))))
    GROUP BY acc.id ORDER BY bool_or(r.is_protected) DESC,acc.id LIMIT 200`,[a.realmId,excluded,v.branch_ref,snap.proof.length>0])).rows;
   const eligible=reviewers.filter(r=>r.root);
   if(!eligible.length||steps.length===2&&!eligible.some(r=>reviewers.some(s=>s.id!==r.id&&s.coordinator)))throw new ConflictException("No distinct eligible reviewers are available for this visit review route. Ask a Foundation administrator to check the review setup.");
   const next=await this.visits.reviewTransition(tx,a,target,expected,"PENDING_APPROVAL",key,snap.digest,"",false);
   const s=(await tx.query<{id:string}>("INSERT INTO field_visit_review_snapshot(root_realm_id,visit_id,visit_version,source_digest,report_snapshot,submitted_by,request_key) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id",[a.realmId,target,next.version,snap.digest,JSON.stringify(snap.report),a.accountId,key])).rows[0];
   for(const f of snap.proof)await tx.query("INSERT INTO field_visit_review_file(root_realm_id,snapshot_id,visit_id,file_ref,source_version,file_version,sha256) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,s.id,target,f.fileRef,f.sourceVersion,f.fileVersion,f.sha256]);
   const previous=v.status==="RETURNED"?(await tx.query<{id:string}>("SELECT id FROM cg03_case WHERE realm_id=$1 AND visit_review_id=$2 AND case_kind='FIELD_VISIT_REVIEW' AND status='RETURNED' ORDER BY visit_review_version DESC LIMIT 1",[a.realmId,target])).rows[0]?.id??null:null;
   if(v.status==="RETURNED"&&!previous)throw stale();
   const c=(await tx.query<Case>("INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,visit_review_ref,visit_review_id,visit_review_version,visit_review_digest,previous_case_id) SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,$3,'Field visit review',NULL,NULL,$4,$5,$6,$7,'FIELD_VISIT_REVIEW',$8,$9,$4,$5,$11 FROM cg03_process p WHERE p.id=$10 AND p.realm_id=$1 AND p.process_kind='FIELD_VISIT_REVIEW' RETURNING *",[a.realmId,a.accountId,String(snap.report.code),next.version,snap.digest,hash([target,key,snap.digest]),key,s.id,target,process,previous])).rows[0];
   if(!c)throw stale();await this.event(tx,a,c.id,previous?"CORRECTED":"SUBMITTED");return {caseNumber:c.case_number,status:c.status,replayed:false};
  });
 }
 async detail(token:string,visitRef:string){
  return this.projects.run(token,"projects.visits.view",async(tx,a)=>{
   const v=await this.visits.guardEvidence(tx,a,ref(visitRef),null,false);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND visit_review_id=$2 AND case_kind='FIELD_VISIT_REVIEW' ORDER BY visit_review_version DESC LIMIT 1",[a.realmId,v.id])).rows[0];
   if(!c)return {status:"NOT_SUBMITTED",canReview:false,caseRef:null};
   const s=(await tx.query<Snap>("SELECT * FROM field_visit_review_snapshot WHERE root_realm_id=$1 AND id=$2",[a.realmId,c.visit_review_ref])).rows[0];if(!s)throw stale();
   let canReview=false;
   const steps=await this.route(tx,c.process_id),step=steps.find(s=>s.ordinal===c.current_step);
   const earlier=(await tx.query("SELECT 1 FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND actor_id=$3 AND step_ordinal<$4",[a.realmId,c.id,a.accountId,c.current_step])).rowCount;
   if(step&&!earlier&&c.proposer_id!==a.accountId&&v.actor_account_ref!==a.accountId&&v.version===c.visit_review_version&&v.status==="PENDING_APPROVAL"&&["SUBMITTED","IN_REVIEW"].includes(c.status)){try{await this.authority(tx,a,step);await this.visits.guardReview(tx,a,v.id,v.version,false,true);canReview=true;}catch(e){if(!(e instanceof ForbiddenException)&&!(e instanceof ConflictException))throw e;}}
   const decisions=(await tx.query("SELECT d.action,d.safe_remarks AS remarks,d.created_at AS at,a.display_name AS reviewer,prior.case_number AS \"caseNumber\",d.step_ordinal AS step FROM cg03_case_decision d JOIN account a ON a.id=d.actor_id AND a.realm_id=d.realm_id JOIN cg03_case prior ON prior.id=d.case_id AND prior.realm_id=d.realm_id WHERE d.realm_id=$1 AND prior.case_kind='FIELD_VISIT_REVIEW' AND prior.visit_review_id=$2 ORDER BY prior.visit_review_version DESC,d.accepted_case_revision DESC LIMIT 50",[a.realmId,v.id])).rows;
   const files=(await tx.query("SELECT count(*)::int AS count FROM field_visit_review_file WHERE root_realm_id=$1 AND snapshot_id=$2",[a.realmId,s.id])).rows[0].count;
   if(canReview&&files)try{await this.identity.assertCurrent(tx,a,"documents.files.view");}catch(e){if(!(e instanceof ForbiddenException))throw e;canReview=false;}
   return {caseRef:canReview?c.id:null,caseNumber:c.case_number,status:c.status,revision:c.revision,canReview,allowedDecisions:canReview?(step?.protected_root_required?["APPROVE","RETURN","REJECT"]:["APPROVE","FORWARD","RETURN","REJECT"]):[],requiresCurrentPassword:canReview&&!!step?.protected_root_required,currentStep:c.current_step,totalSteps:steps.length,sourceVersion:s.visit_version,report:s.report_snapshot.report_text,locationState:s.report_snapshot.locationState,verifiedFileCount:files,decisions};
  },true);
 }
 async decide(token:string,caseRef:string,raw:unknown){
  const target=ref(caseRef),x=fields(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]),key=ref(x.requestKey),expected=version(x.expectedRevision),action=choice(x.action,["APPROVE","RETURN","REJECT","FORWARD"] as const),remarks=clean(x.remarks??"",action==="APPROVE"||action==="FORWARD"?0:3,500),password=x.currentPassword??"";
  if(typeof password!=="string"||Buffer.byteLength(password)>1024)throw invalid();
  const h=hash([target,expected,action,remarks]);
  if(password){const actor=await this.sessions.requireAction(token,"approvals.review");await this.sessions.limitFoundationRootProof(actor);}
  return this.projects.run(token,"projects.visits.view",async(tx,a)=>{
   const found=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='FIELD_VISIT_REVIEW'",[a.realmId,target])).rows[0];if(!found)throw new NotFoundException("Visit review unavailable.");
   const v=await this.visits.guardReview(tx,a,found.visit_review_id,null,true,true);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='FIELD_VISIT_REVIEW' FOR UPDATE",[a.realmId,target])).rows[0];
   if(!c||c.proposer_id===a.accountId||v.actor_account_ref===a.accountId)throw new ForbiddenException("A different authorized reviewer must decide.");
   const steps=await this.route(tx,c.process_id);
   if((await tx.query("SELECT 1 FROM field_visit_review_file WHERE root_realm_id=$1 AND snapshot_id=$2 LIMIT 1",[a.realmId,c.visit_review_ref])).rowCount)await this.identity.assertCurrent(tx,a,"documents.files.view");
   const prior=(await tx.query<{actor_id:string;request_digest:string;step_ordinal:number}>("SELECT actor_id,request_digest,step_ordinal FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,target,key])).rows[0];
   if(prior){if(prior.actor_id!==a.accountId||prior.request_digest!==h)throw stale();const original=steps.find(s=>s.ordinal===prior.step_ordinal);if(!original)throw stale();await this.authority(tx,a,original);return {status:c.status,replayed:true};}
   if(c.revision!==expected||v.version!==c.visit_review_version||v.status!=="PENDING_APPROVAL"||!["SUBMITTED","IN_REVIEW"].includes(c.status))throw stale();
   const step=steps.find(s=>s.ordinal===c.current_step);if(!step)throw stale();
   await this.authority(tx,a,step);
   if((await tx.query("SELECT 1 FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND actor_id=$3 AND step_ordinal<$4",[a.realmId,target,a.accountId,c.current_step])).rowCount)throw new ForbiddenException("A different reviewer must make the final decision.");
   if(step.protected_root_required&&action==="FORWARD")throw new BadRequestException("The final reviewer must approve, send back or reject.");
   if(step.protected_root_required&&password.length<8)throw new BadRequestException("Enter your current Foundation password to confirm the decision.");
   const s=(await tx.query<Snap>("SELECT * FROM field_visit_review_snapshot WHERE root_realm_id=$1 AND id=$2 AND visit_id=$3 AND visit_version=$4 AND source_digest=$5 FOR SHARE",[a.realmId,c.visit_review_ref,v.id,v.version,c.visit_review_digest])).rows[0];if(!s)throw stale();
   if(action==="APPROVE"||action==="FORWARD"){
    const snap=await this.snapshot(tx,a,v.id,v.version-1);if(snap.digest!==s.source_digest)throw stale();
    if(snap.report.locationState==="UNVERIFIED_LOCATION"&&snap.proof.length===0)throw stale();
   }
   if(step.protected_root_required)await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const next=action==="RETURN"?"RETURNED":action==="REJECT"?"REJECTED":step.protected_root_required?"PENDING_OWNER":"IN_REVIEW";
   const nextStep=next==="IN_REVIEW"?c.current_step+1:c.current_step;
   if(!(await tx.query("UPDATE cg03_case SET status=$3,current_step=$4,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$5",[a.realmId,target,next,nextStep,expected])).rowCount)throw stale();
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $11::boolean THEN now() ELSE NULL END)",[a.realmId,target,a.accountId,action,c.current_step,expected,expected+1,key,h,remarks,step.protected_root_required]);
   await this.event(tx,a,target,next==="PENDING_OWNER"?"FINAL_APPROVED":next==="IN_REVIEW"?(action==="FORWARD"?"FORWARDED":"APPROVED"):next,c.current_step,remarks);
   if(next==="IN_REVIEW"){
    const final=(await tx.query("SELECT 1 FROM account acc JOIN account_role ar ON ar.realm_id=acc.realm_id AND ar.account_id=acc.id AND ar.revoked_at IS NULL JOIN role r ON r.realm_id=ar.realm_id AND r.id=ar.role_id AND r.is_protected AND r.active WHERE acc.realm_id=$1 AND acc.status='ACTIVE' AND NOT(acc.id=ANY($2::uuid[])) LIMIT 1",[a.realmId,[c.proposer_id,v.actor_account_ref,a.accountId]])).rowCount;
    if(!final)throw new ConflictException("No distinct final reviewer is available. Ask a Foundation administrator to review the setup.");
    return {status:next,replayed:false};
   }
   await this.visits.reviewTransition(tx,a,v.id,v.version,next==="PENDING_OWNER"?"COMPLETED":action==="RETURN"?"RETURNED":"REJECTED",key,h,remarks,true);
   if(next==="PENDING_OWNER"){await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,target]);await this.event(tx,a,target,"OWNER_COMPLETED",c.current_step);}
   return {status:next==="PENDING_OWNER"?"OWNER_COMPLETED":next,replayed:false};
  });
 }
}
