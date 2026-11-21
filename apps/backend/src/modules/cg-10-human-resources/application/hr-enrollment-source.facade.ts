import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import {createHash} from "node:crypto";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type HrApplicationSnapshot={id:string;root_realm_id:string;revision_no:number;
 legal_name:string;designation:string;employment_type:string;
 proposed_branch_ref:string;department_ref:string|null;applicant_account_ref:string|null;
 hire_date:Date|string;created_by:string;state:string};
export type HrFrozenSource={applicationRef:string;revisionRef:string;
 revisionNo:number;digest:string;proposerRef:string;source:HrApplicationSnapshot;
 files:readonly {fileRef:string;fileVersion:number;classification:string}[]};
/** Canonical hashing survives PostgreSQL jsonb key reordering and JS object insertion order. */
const canonical=(v:unknown):unknown=>{
 if(Array.isArray(v))return v.map(canonical);
 if(v&&typeof v==="object"&&!(v instanceof Date))
  return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))
   .map(([k,x])=>[k,canonical(x)]));
 return v;
};
export const sourceHash=(v:unknown)=>
 createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
const uuid=(v:unknown)=>{if(typeof v!=="string"||!ID.test(v))
 throw new BadRequestException("Choose an existing employee application");return v;};
@Injectable()
export class HrEnrollmentSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 /** Only this CG10 owner reads application rows; CG03/CG19 call here. */
 async draft(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,
  forWrite=true):Promise<HrApplicationSnapshot>{
  await this.identity.assertCurrent(tx,actor,forWrite?
   "hr.applications.manage":"hr.applications.view");
  const q=await tx.query<HrApplicationSnapshot>(
   "SELECT id,root_realm_id,revision_no,legal_name,designation,employment_type,"+
   "proposed_branch_ref,department_ref,applicant_account_ref,hire_date,created_by,state "+
   "FROM hr_employee_application WHERE id=$1 AND root_realm_id=$2 FOR SHARE",
   [uuid(ref),actor.realmId]);
  const app=q.rows[0];
  if(!app)throw new NotFoundException("Employee application unavailable");
  const branch=await tx.query<{manager_account_ref:string;full_access:boolean}>(
   "SELECT b.manager_account_ref,EXISTS(SELECT 1 FROM account_role ar "+
   "JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active "+
   "LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin' "+
   "WHERE ar.account_id=$2 AND ar.realm_id=$3 AND ar.revoked_at IS NULL "+
   "AND (r.is_protected OR g.capability_key IS NOT NULL)) AS full_access "+
   "FROM branch b WHERE b.id=$1 AND b.root_realm_id=$3 AND b.status='ACTIVE' "+
   "FOR SHARE OF b",[app.proposed_branch_ref,actor.accountId,actor.realmId]);
  if(!branch.rows[0]||(!branch.rows[0].full_access&&
   branch.rows[0].manager_account_ref!==actor.accountId))
   throw new ForbiddenException("The employee branch is no longer assigned to your account");
  return app;
 }
 async frozen(tx:PoolClient,realm:string,revisionRef:string,revisionNo:number,
  digest:string,requireCurrent=true):Promise<HrFrozenSource>{
  if(!ID.test(revisionRef)||!Number.isSafeInteger(revisionNo)||revisionNo<1||
   !/^[a-f0-9]{64}$/.test(digest))throw new BadRequestException("Invalid original employee revision");
  const q=await tx.query<{application_id:string;root_realm_id:string;
    revision_no:number;source_digest:string;submitted_by:string;
    private_file_versions:HrFrozenSource["files"];source_snapshot:HrApplicationSnapshot;
    app_state:string;app_revision_no:number}>(
   "SELECT rev.application_id,rev.root_realm_id,rev.revision_no,rev.source_digest,"+
   "rev.submitted_by,rev.private_file_versions,rev.source_snapshot,"+
   "app.state AS app_state,app.revision_no AS app_revision_no "+
   "FROM hr_application_revision rev "+
   "JOIN hr_employee_application app ON app.id=rev.application_id "+
   "AND app.root_realm_id=rev.root_realm_id "+
   "WHERE rev.root_realm_id=$1 AND rev.id=$2 AND rev.revision_no=$3 "+
   "AND rev.source_digest=$4 FOR SHARE OF rev,app",
   [realm,revisionRef,revisionNo,digest]);
  const source=q.rows[0];
  if(!source||(requireCurrent&&(source.app_revision_no!==revisionNo||
    !["SUBMISSION_UNCONFIRMED","SUBMITTED","IN_REVIEW","FINAL_APPROVED_PENDING_ACTIVATION",
      "PENDING_ACCESS","ACTIVE"].includes(source.app_state)))||
    !Array.isArray(source.private_file_versions)||
    sourceHash(source.source_snapshot)!==digest)
   throw new ConflictException("The employee submission changed or cannot be verified");
  const snap=source.source_snapshot;
  if(!snap||typeof snap!=="object"||snap.id!==source.application_id||
     snap.root_realm_id!==realm||snap.revision_no!==revisionNo)
    throw new ConflictException("The original employee source no longer matches");
  return {applicationRef:source.application_id,revisionRef,
    revisionNo,digest,proposerRef:source.submitted_by,
    source:snap,files:source.private_file_versions};
 }

 /** CG03 calls this CG10-owned effect inside the SAME original decision tx.
  * Never accepts a client-provided approved status or reviewer shortcut.
  */
 async applyCaseDecision(tx:PoolClient,realm:string,applicationRef:string,
  caseRef:string,outcome:"RETURNED"|"REJECTED"|"FINAL_APPROVED_PENDING_ACTIVATION"){
  const q=await tx.query(
   "UPDATE hr_employee_application SET state=$4,updated_at=now() "+
   "WHERE id=$1 AND root_realm_id=$2 AND cg03_case_ref=$3 "+
   "AND state IN('SUBMITTED','IN_REVIEW') RETURNING id",
   [applicationRef,realm,caseRef,outcome]);
  if(!q.rowCount)throw new ConflictException("The original employee application changed");
 }

}
