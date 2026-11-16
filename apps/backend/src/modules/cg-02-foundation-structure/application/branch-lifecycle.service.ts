import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "./branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Choose a valid branch");
 return v;
};
const integer=(v:unknown,min=1,max=2147483646)=>{
 if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)
   throw new BadRequestException("Refresh the branch before continuing");
 return Number(v);
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const str=(v:unknown,max:number,required=false):string=>{
 if(typeof v!=="string"){if(required)throw new BadRequestException("Complete the branch details");return "";}
 const result=v.trim().replace(/\s+/g," ");
 if(result.length>max||required&&result.length<2)
   throw new BadRequestException("Check the branch details");
 return result;
};
const ids=(v:unknown,max:number):string[]=>{
 if(!Array.isArray(v)||v.length>max)throw new BadRequestException("Choose valid Foundation departments");
 const arr=v.map(id);
 if(arr.length!==new Set(arr).size)throw new BadRequestException("Remove duplicate departments");
 return arr;
};
export type BranchFileVersion=Readonly<{fileRef:string;revision:number;classification:string}>;
export type ReadProof=(client:PoolClient,actor:VerifiedFoundationActor)=>Promise<void>;
export type SubmissionSource=Readonly<{registrationRef:string;submissionRef:string;
 submissionRevision:number;digest:string;sourceKey:string;status:string}>;
type RegistrationRow={id:string;root_realm_id:string;requested_by:string;
 manager_account_ref:string|null;geography_area_id:string|null;status:string;
 draft_version:number;current_step:number;profile_payload:Record<string,Record<string,unknown>>;
 current_submission_revision:number|null};
type SubmissionRow={id:string;root_realm_id:string;registration_id:string;
 submitted_revision:number;source_submission_key:string;immutable_payload:Record<string,Record<string,unknown>>;
 immutable_payload_digest:string;verified_file_versions:BranchFileVersion[];
 approval_case_ref:string|null;status:string;submitted_by:string;submitted_at:Date};
type BranchRow={id:string;root_realm_id:string;registration_id:string;approved_submission_id:string;
 name:string;branch_code:string;status:string;version:number;manager_account_ref:string;
 geography_area_id:string;updated_at:Date;normalized_name:string;branch_type:string;
 opening_date:string|null;postal_address:string;pin_code:string|null;
 latitude:string|null;longitude:string|null;official_phone:string;official_email:string;
 evidence_versions:BranchFileVersion[]};
const stage=(row:RegistrationRow,index:number):Record<string,unknown>=>
  row.profile_payload[String(index)]??{};
function checkedDraft(row:RegistrationRow){
 if(row.current_step!==7||row.profile_payload["7"]?.reviewAcknowledged!==true)
   throw new BadRequestException("Review and save every registration step before submitting");
 const first=stage(row,1),location=stage(row,2),manager=stage(row,5),departments=stage(row,6);
 const branchName=str(first.branchName,160,true);
 const managerRef=id(manager.managerRef);
 const geographyRef=id(location.geographyRef);
 const departmentRefs=ids(departments.departmentRefs,30);
 const registrationRefs=ids(stage(row,3).registrationFiles??[],5);
 const agreements=ids(stage(row,4).agreementFiles??[],5);
 const photos=ids(stage(row,4).photoFiles??[],5);
 if(!registrationRefs.length||!agreements.length)
   throw new BadRequestException("Registration and agreement proof must be attached and verified");
 return {branchName,managerRef,geographyRef,departmentRefs,
   fileRefs:[...new Set([...registrationRefs,...agreements,...photos,...ids(stage(row,1).photoFiles??[],5),
     ...ids(stage(row,1).logoFiles??[],5)])],
   first,location,manager,departments};
}
/** CG-02 is the sole authority for immutable snapshots, code allocation,
 * current operating branch and Foundation-to-branch associations.
 *
 * This class accepts ONLY in-process owner-local proof callbacks supplied by
 * the server-side integration coordinator, never a caller-supplied proof object.
 */
@Injectable()
export class BranchLifecycleService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:BranchSourceFacade){}
 private async authorized(bearer:string,action:string){
   return this.sessions.requireAction(bearer,action);
 }
 private async admin(bearer:string){
   try{await this.sessions.requireAction(bearer,"foundation.branches.admin");return true;}
   catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 private async scope(client:PoolClient,actor:VerifiedFoundationActor,action:string){
   await this.identity.assertCurrent(client,actor,action);
 }
 private error(error:unknown):never{
   if(error&&typeof error==="object"&&"code" in error){
     if(error.code==="23505")throw new ConflictException("The branch source changed. Refresh first.");
     if(error.code==="23503"||error.code==="23514")
       throw new BadRequestException("Choose valid current Foundation details");
   }
   throw error;
 }
 /** No external calls in this method; coordinator prevalidates bytes/CG-19
  * beforehand, then supplies CG-19 owner-row proof in the short shared TX.
  */
 async freezeSubmission(bearer:string,registrationRef:string,versionInput:unknown,
   requestKey:string,fileVersions:readonly BranchFileVersion[],proof:ReadProof):Promise<SubmissionSource>{
   const actor=await this.authorized(bearer,"foundation.branches.manage");
   const reg=id(registrationRef),version=integer(versionInput),key=id(requestKey);
   // Replays may arrive after the original draft has been frozen.
   // Verify the original digest and same scoped actor before enforcing editability.
   const prior=await this.db.query<{request_digest:string;result_ref:string|null}>(`
     SELECT request_digest,result_ref FROM branch_operation_command
     WHERE root_realm_id=$1 AND actor_ref=$2 AND action='SUBMIT' AND request_key=$3
   `,[actor.realmId,actor.accountId,key]);
   if(prior.rows[0]){
     const submission=await this.db.query<SubmissionRow>(`
       SELECT * FROM branch_registration_submission
       WHERE id=$1 AND root_realm_id=$2 AND registration_id=$3
     `,[prior.rows[0].result_ref,actor.realmId,reg]);
     const saved=submission.rows[0];
     if(!saved||saved.submitted_revision!==version||
       JSON.stringify(saved.verified_file_versions)!==JSON.stringify(fileVersions)||
       prior.rows[0].request_digest!==hash([reg,version,saved.immutable_payload_digest,fileVersions]))
       throw new ConflictException("The original submission key has a different source");
     await this.source.draft(bearer,reg,undefined,false);
     return {registrationRef:reg,submissionRef:saved.id,
       submissionRevision:saved.submitted_revision,digest:saved.immutable_payload_digest,
       sourceKey:saved.source_submission_key,status:saved.status};
   }
   await this.source.draft(bearer,reg,version,true);
   const existing=await this.db.query<RegistrationRow>(`
     SELECT * FROM branch_registration WHERE id=$1 AND root_realm_id=$2
   `,[reg,actor.realmId]);
   const draft=existing.rows[0];
   if(!draft)throw new NotFoundException("Branch registration unavailable");
   const needed=checkedDraft(draft);
   const expected=[...needed.fileRefs].sort();
   const actual=fileVersions.map(x=>id(x.fileRef)).sort();
   const category=(refs:string[],allowed:string[])=>{
     for(const fileRef of refs){
       const match=fileVersions.find(x=>x.fileRef===fileRef);
       if(!match||!allowed.includes(match.classification))
         throw new ConflictException("The saved attachment does not match its evidence category");
     }
   };
   category(ids(stage(draft,3).registrationFiles??[],5),["REGISTRATION_PROOF"]);
   category(ids(stage(draft,4).agreementFiles??[],5),["AGREEMENT"]);
   category(ids(stage(draft,4).photoFiles??[],5),["BRANCH_PHOTO","BRANCH_LOGO"]);
   category(ids(stage(draft,1).photoFiles??[],5),["BRANCH_PHOTO"]);
   category(ids(stage(draft,1).logoFiles??[],5),["BRANCH_LOGO"]);
   if(JSON.stringify(expected)!==JSON.stringify(actual)||
     actual.length>16||fileVersions.some(x=>!Number.isSafeInteger(x.revision)||x.revision<1))
     throw new ConflictException("Selected documents do not match the saved branch draft");
   const payloadDigest=hash([actor.realmId,draft.profile_payload,fileVersions]);
   const commandDigest=hash([reg,version,payloadDigest,fileVersions]);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.scope(client,actor,"foundation.branches.manage");
     // Owner-local file proof is sorted/locked before taking any CG-02 row lock.
     await proof(client,actor);
     const current=await client.query<RegistrationRow>(`
       SELECT * FROM branch_registration WHERE id=$1 AND root_realm_id=$2 FOR UPDATE
     `,[reg,actor.realmId]);
     const row=current.rows[0];
     if(!row||row.draft_version!==version||!["DRAFT","RETURNED"].includes(row.status)||
       JSON.stringify(row.profile_payload)!==JSON.stringify(draft.profile_payload))
       throw new ConflictException("The branch draft changed before submission");
     if(row.requested_by!==actor.accountId&&row.manager_account_ref!==actor.accountId)
       await this.scope(client,actor,"foundation.branches.admin");
     const valid=checkedDraft(row);
     await this.identity.eligibleOfficeholder(client,actor,valid.managerRef);
     const block=await client.query(`
       SELECT id FROM geography_area WHERE id=$1 AND root_realm_id=$2
         AND level='BLOCK' AND status='ACTIVE' FOR SHARE
     `,[valid.geographyRef,actor.realmId]);
     if(!block.rowCount)throw new ConflictException("The selected branch location is inactive");
     const dep=await client.query<{id:string}>(`
       SELECT id FROM department WHERE root_realm_id=$1 AND id=ANY($2::uuid[])
         AND scope_kind='FOUNDATION' AND active FOR SHARE
     `,[actor.realmId,valid.departmentRefs]);
     if(dep.rowCount!==valid.departmentRefs.length)
       throw new ConflictException("Selected Foundation departments changed");
     const accepted=await client.query<{id:string;request_digest:string;
       result_ref:string|null;result_version:number|null}>(`
       INSERT INTO branch_operation_command(root_realm_id,actor_ref,action,request_key,request_digest)
       VALUES($1,$2,'SUBMIT',$3,$4)
       ON CONFLICT(root_realm_id,actor_ref,action,request_key) DO NOTHING
       RETURNING id,request_digest,result_ref,result_version
     `,[actor.realmId,actor.accountId,key,commandDigest]);
     if(!accepted.rows[0]){
       const previous=await client.query<{request_digest:string;result_ref:string|null;
         result_version:number|null}>(`
         SELECT request_digest,result_ref,result_version FROM branch_operation_command
         WHERE root_realm_id=$1 AND actor_ref=$2 AND action='SUBMIT' AND request_key=$3 FOR SHARE
       `,[actor.realmId,actor.accountId,key]);
       if(!previous.rows[0]||previous.rows[0].request_digest!==commandDigest||
         !previous.rows[0].result_ref)
         throw new ConflictException("An incompatible submission uses the same request");
       const original=await client.query<SubmissionRow>(`
         SELECT * FROM branch_registration_submission WHERE id=$1 AND root_realm_id=$2
       `,[previous.rows[0].result_ref,actor.realmId]);
       if(!original.rows[0])throw new ConflictException("Original submission unavailable");
       await client.query("COMMIT");tx=false;
       return {registrationRef:reg,submissionRef:original.rows[0].id,
         submissionRevision:original.rows[0].submitted_revision,
         digest:original.rows[0].immutable_payload_digest,
         sourceKey:original.rows[0].source_submission_key,status:original.rows[0].status};
     }
     const created=await client.query<SubmissionRow>(`
       INSERT INTO branch_registration_submission(
         root_realm_id,registration_id,submitted_revision,source_submission_key,
         immutable_payload,immutable_payload_digest,verified_file_versions,submitted_by
       ) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8) RETURNING *
     `,[actor.realmId,reg,version,key,JSON.stringify(row.profile_payload),
       payloadDigest,JSON.stringify(fileVersions),actor.accountId]);
     await client.query(`
       UPDATE branch_registration SET status='SUBMISSION_UNCONFIRMED',
         current_submission_revision=$3,updated_by=$4,updated_at=now()
       WHERE id=$1 AND root_realm_id=$2
     `,[reg,actor.realmId,version,actor.accountId]);
     await client.query(`
       UPDATE branch_operation_command SET result_ref=$2,result_version=$3 WHERE id=$1
     `,[accepted.rows[0].id,created.rows[0].id,version]);
     await client.query("COMMIT");tx=false;
     return {registrationRef:reg,submissionRef:created.rows[0].id,
       submissionRevision:version,digest:payloadDigest,sourceKey:key,
       status:"SUBMISSION_UNCONFIRMED"};
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};return this.error(e);}
   finally{client.release();}
 }
 /** Bind a real CG-03 case returned from CG-03's source-aware create-or-get.
  * CG-03 case proof runs before the registration row lock, in this TX.
  */
 async acceptCase(bearer:string,registrationRef:string,revision:number,digest:string,
   caseRef:string,guard:ReadProof){
   const actor=await this.authorized(bearer,"foundation.branches.manage");
   const reg=id(registrationRef),caseId=id(caseRef);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.scope(client,actor,"foundation.branches.manage");
     await guard(client,actor);
     const source=await client.query<SubmissionRow>(`
       SELECT * FROM branch_registration_submission
       WHERE root_realm_id=$1 AND registration_id=$2 AND submitted_revision=$3
         AND immutable_payload_digest=$4 FOR UPDATE
     `,[actor.realmId,reg,revision,digest]);
     const row=source.rows[0];
     if(!row||row.approval_case_ref&&row.approval_case_ref!==caseId)
       throw new ConflictException("The original approved source changed");
     if(!["SUBMISSION_UNCONFIRMED","SUBMITTED","IN_REVIEW"].includes(row.status))
       throw new ConflictException("This submission cannot accept a new review");
     await client.query(`
       UPDATE branch_registration_submission SET
         approval_case_ref=$2,status='SUBMITTED',updated_at=now()
       WHERE id=$1 AND approval_case_ref IS NULL
     `,[row.id,caseId]);
     await client.query(`
       UPDATE branch_registration SET status='SUBMITTED',updated_at=now()
       WHERE id=$1 AND root_realm_id=$2 AND status='SUBMISSION_UNCONFIRMED'
     `,[reg,actor.realmId]);
     await client.query("COMMIT");tx=false;
     return {status:"SUBMITTED",caseRef:caseId};
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};return this.error(e);}
   finally{client.release();}
 }
 async syncDecision(bearer:string,registrationRef:string,caseRef:string,
   outcome:"RETURNED"|"REJECTED"|"PENDING_OWNER",guard:ReadProof){
   const actor=await this.authorized(bearer,"foundation.branches.admin");
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.scope(client,actor,"foundation.branches.admin");
     await guard(client,actor);
     const row=await client.query<SubmissionRow>(`
       SELECT * FROM branch_registration_submission
       WHERE root_realm_id=$1 AND registration_id=$2 AND approval_case_ref=$3
       FOR UPDATE
     `,[actor.realmId,id(registrationRef),id(caseRef)]);
     if(!row.rows[0])throw new ConflictException("The branch review source is unavailable");
     const status=outcome==="PENDING_OWNER"?"FINAL_APPROVED_PENDING_ACTIVATION":outcome;
     await client.query(`
       UPDATE branch_registration_submission SET status=$2,updated_at=now()
       WHERE id=$1 AND status NOT IN('ACTIVE')
     `,[row.rows[0].id,status]);
     await client.query(`
       UPDATE branch_registration SET status=$3,
         updated_by=$4,updated_at=now()
       WHERE id=$1 AND root_realm_id=$2 AND status NOT IN('ACTIVE')
     `,[registrationRef,actor.realmId,status,actor.accountId]);
     await client.query("COMMIT");tx=false;
     return {status};
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};return this.error(e);}
   finally{client.release();}
 }
 /** Pre-validated CG-03 decision and CG-19 evidence, with owner guards performed
  * in-process on one short shared Postgres connection BEFORE CG-02 row locks.
  */
 async activate(bearer:string,registrationRef:string,revision:number,digest:string,
   caseRef:string,effectKey:string,guardDecision:ReadProof,guardFiles:ReadProof){
   const actor=await this.authorized(bearer,"foundation.branches.admin");
   const reg=id(registrationRef),caseId=id(caseRef),effect=id(effectKey);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.scope(client,actor,"foundation.branches.admin");
     // Same root-local protection as geography commands prevents an ACTIVE
     // branch using a concurrently reparented/deactivated area.
     const stableRoot=await client.query(`
       SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR SHARE
     `,[actor.realmId]);
     if(!stableRoot.rowCount)
       throw new ConflictException("The Foundation root is unavailable");
     await guardDecision(client,actor);
     await guardFiles(client,actor);
     const submitted=await client.query<SubmissionRow>(`
       SELECT * FROM branch_registration_submission
       WHERE root_realm_id=$1 AND registration_id=$2
         AND submitted_revision=$3 AND immutable_payload_digest=$4
         AND approval_case_ref=$5 FOR UPDATE
     `,[actor.realmId,reg,revision,digest,caseId]);
     const snapshot=submitted.rows[0];
     if(!snapshot)throw new ConflictException("The approved branch version is not current");
     const current=await client.query<RegistrationRow>(`
       SELECT * FROM branch_registration WHERE id=$1 AND root_realm_id=$2 FOR UPDATE
     `,[reg,actor.realmId]);
     const draft=current.rows[0];
     if(!draft||draft.current_submission_revision!==revision||
       draft.draft_version!==revision||
       !["SUBMITTED","FINAL_APPROVED_PENDING_ACTIVATION","ACTIVE"].includes(draft.status))
       throw new ConflictException("The original branch submission has changed");
     const previous=await client.query<{id:string;branch_code:string}>(`
       SELECT id,branch_code FROM branch WHERE root_realm_id=$1 AND registration_id=$2
     `,[actor.realmId,reg]);
     if(previous.rows[0]){
       if(snapshot.status!=="ACTIVE")
         throw new ConflictException("An existing branch has another active snapshot");
       await client.query("COMMIT");tx=false;
       return {status:"ACTIVE" as const,branchRef:previous.rows[0].id,
         branchCode:previous.rows[0].branch_code,alreadyActivated:true};
     }
     const first=snapshot.immutable_payload["1"]??{};
     const loc=snapshot.immutable_payload["2"]??{};
     const mgr=snapshot.immutable_payload["5"]??{};
     const links=snapshot.immutable_payload["6"]??{};
     const name=str(first.branchName,160,true),
       managerRef=id(mgr.managerRef),areaRef=id(loc.geographyRef);
     const departments=ids(links.departmentRefs,30);
     await this.identity.eligibleOfficeholder(client,actor,managerRef);
     const area=await client.query(`
       SELECT id FROM geography_area WHERE id=$1 AND root_realm_id=$2
         AND level='BLOCK' AND status='ACTIVE' FOR SHARE
     `,[areaRef,actor.realmId]);
     if(!area.rowCount)throw new ConflictException("The branch area is no longer active");
     const found=await client.query<{id:string}>(`
       SELECT id FROM department WHERE root_realm_id=$1 AND id=ANY($2::uuid[])
         AND scope_kind='FOUNDATION' AND active=true FOR SHARE
     `,[actor.realmId,departments]);
     if(found.rowCount!==departments.length)
       throw new ConflictException("A selected Foundation department became unavailable");
     const code=await client.query<{code:string}>(`
       SELECT 'CG-BR-'||lpad(nextval('cg02_branch_code_sequence')::text,6,'0') AS code
     `);
     const branchName=code.rows[0].code;
     const result=await client.query<{id:string}>(`
       INSERT INTO branch(
         root_realm_id,registration_id,approved_submission_id,branch_code,
         name,normalized_name,branch_type,opening_date,geography_area_id,postal_address,
         pin_code,latitude,longitude,official_phone,official_email,
         manager_account_ref,evidence_versions,updated_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)
       RETURNING id
     `,[actor.realmId,reg,snapshot.id,branchName,name,name.toLowerCase(),
       str(first.branchType,80),first.openingDate??null,areaRef,
       str(loc.postalAddress,700),loc.pinCode||null,
       loc.latitude??null,loc.longitude??null,
       str(first.officialPhone,80),str(first.officialEmail,180),
       managerRef,JSON.stringify(snapshot.verified_file_versions),actor.accountId]);
     const branchRef=result.rows[0].id;
     const activeProfile={
       branchName:name,branchType:str(first.branchType,80),
       openingDate:typeof first.openingDate==="string"?first.openingDate:null,
       geographyRef:areaRef,postalAddress:str(loc.postalAddress,700),
       pinCode:typeof loc.pinCode==="string"?loc.pinCode:"",
       latitude:typeof loc.latitude==="number"?loc.latitude:null,
       longitude:typeof loc.longitude==="number"?loc.longitude:null,
       officialPhone:str(first.officialPhone,80),
       officialEmail:str(first.officialEmail,180),managerRef
     };
     await client.query(`
       INSERT INTO branch_profile_revision(
         branch_id,root_realm_id,branch_version,mutation_key,changed_by,
         before_payload,after_payload,evidence_versions,approved_submission_id
       ) VALUES($1,$2,1,$3,$4,'{}'::jsonb,$5::jsonb,$6::jsonb,$7)
     `,[branchRef,actor.realmId,effect,actor.accountId,
       JSON.stringify(activeProfile),
       JSON.stringify(snapshot.verified_file_versions),snapshot.id]);
     if(departments.length)await client.query(`
       INSERT INTO branch_department_link(root_realm_id,branch_id,foundation_department_id,linked_by)
       SELECT $1,$2,id,$4 FROM department
       WHERE root_realm_id=$1 AND id=ANY($3::uuid[])
     `,[actor.realmId,branchRef,departments,actor.accountId]);
     await client.query(`
       UPDATE branch_registration_submission SET status='ACTIVE',updated_at=now()
       WHERE id=$1
     `,[snapshot.id]);
     await client.query(`
       UPDATE branch_registration SET status='ACTIVE',updated_by=$3,updated_at=now()
       WHERE id=$1 AND root_realm_id=$2
     `,[reg,actor.realmId,actor.accountId]);
     await client.query(`
       INSERT INTO branch_operation_command(
         root_realm_id,actor_ref,action,request_key,request_digest,result_ref,result_version
       ) VALUES($1,$2,'ACTIVATE',$3,$4,$5,1)
       ON CONFLICT(root_realm_id,actor_ref,action,request_key) DO NOTHING
     `,[actor.realmId,actor.accountId,effect,hash([reg,caseId,revision,digest]),branchRef]);
     await client.query("COMMIT");tx=false;
     return {status:"ACTIVE" as const,branchRef,branchCode:branchName,alreadyActivated:false};
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};return this.error(e);}
   finally{client.release();}
 }
 async status(bearer:string,registrationRef:string){
   const actor=await this.authorized(bearer,"foundation.branches.view");
   const draft=await this.source.draft(bearer,id(registrationRef));
   const rows=await this.db.query<SubmissionRow>(`
     SELECT * FROM branch_registration_submission WHERE root_realm_id=$1
       AND registration_id=$2 ORDER BY submitted_revision DESC LIMIT 25
   `,[actor.realmId,draft.registrationRef]);
   const approved=await this.db.query<{id:string;branch_code:string;status:string}>(`
     SELECT id,branch_code,status FROM branch WHERE root_realm_id=$1 AND registration_id=$2
   `,[actor.realmId,draft.registrationRef]);
   return {registrationRef:draft.registrationRef,status:draft.status,
     currentRevision:draft.revision,
     submissions:rows.rows.map(s=>({submissionRef:s.id,revision:s.submitted_revision,
       status:s.status,caseRef:s.approval_case_ref,submittedAt:s.submitted_at.toISOString()})),
     branch:approved.rows[0]?{branchRef:approved.rows[0].id,
       branchCode:approved.rows[0].branch_code,status:approved.rows[0].status}:null};
 }
}
