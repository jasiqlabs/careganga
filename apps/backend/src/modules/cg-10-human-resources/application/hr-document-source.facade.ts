import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {leaveDate,leaveId} from "./hr-leave-source.facade";
const KINDS=["APPOINTMENT","OFFER","JOINING","EXPERIENCE","RELIEVING","MEMO","EMPLOYEE_ID"] as const;
export type HrDocumentKind=typeof KINDS[number];
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function parseHrDocumentDraft(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!["kind","subjectReference","templateId","templateVersion","issueDate","expiryDate","requestKey"].includes(k)))
  throw new BadRequestException("Check the document request");
 const x=raw as Record<string,unknown>;
 if(typeof x.kind!=="string"||!KINDS.some(k=>k===x.kind)||typeof x.subjectReference!=="string"||!Number.isSafeInteger(x.templateVersion)||Number(x.templateVersion)<1)
  throw new BadRequestException("Choose an eligible document subject and template");
 const kind=x.kind as HrDocumentKind,reference=x.subjectReference;
 if(!(kind==="OFFER"?/^CG-HR-APP-[0-9]{6,}$/:/^CG-HR-EMP-[0-9]{6,}$/).test(reference))throw new BadRequestException("Choose the original eligible employee or pending application");
 const issueDate=leaveDate(x.issueDate),expiryDate=x.expiryDate?leaveDate(x.expiryDate):null;
 if(kind==="EMPLOYEE_ID"?(!expiryDate||expiryDate<=issueDate):expiryDate!==null)throw new BadRequestException("Check the ID card expiry date");
 return {kind,subjectReference:reference,templateId:leaveId(x.templateId),templateVersion:Number(x.templateVersion),issueDate,expiryDate,requestKey:leaveId(x.requestKey)};
}
type Input=ReturnType<typeof parseHrDocumentDraft>;
type Subject={employee_id:string|null;application_id:string|null;application_revision_id:string|null;application_revision_no:number|null;application_source_digest:string|null;assignment_id:string|null;assignment_version:number|null;employee_version:number|null;exit_change_id:string|null;branch_ref:string;recipient:string;designation:string;branch:string;department:string|null;hire_date:string;last_working_date:string|null;account_ref:string|null;today:string};
type Template={id:string;version:number;title:string;body:string;content_sha256:string};
export type HrDocumentRow={id:string;root_realm_id:string;reference:string;kind:HrDocumentKind;employee_id:string|null;application_id:string|null;source_branch_ref:string;created_by:string;status:string;revision:number;case_ref:string|null;source_digest:string;request_digest:string;template_id:string;template_version:number;source_snapshot:Record<string,unknown>;decision_ref:string|null;issue_date:string;expiry_date:string|null};
const scope=`(b.manager_account_ref=$2 OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active
 LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin'
 WHERE ar.realm_id=$1 AND ar.account_id=$2 AND ar.revoked_at IS NULL AND (r.is_protected OR g.role_id IS NOT NULL)))`;
@Injectable()
export class HrDocumentSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 async subject(tx:PoolClient,actor:VerifiedFoundationActor,kind:HrDocumentKind,ref:string){
  await this.identity.assertCurrent(tx,actor,"hr.documents.manage");
  const q=kind==="OFFER"?await tx.query<Subject>(`SELECT NULL::uuid AS employee_id,a.id AS application_id,v.id AS application_revision_id,v.revision_no AS application_revision_no,v.source_digest AS application_source_digest,
    NULL::uuid AS assignment_id,NULL::int AS assignment_version,NULL::int AS employee_version,NULL::uuid AS exit_change_id,
    b.id AS branch_ref,a.legal_name AS recipient,a.designation,b.name AS branch,d.name AS department,to_char(a.hire_date,'YYYY-MM-DD') AS hire_date,
    NULL::text AS last_working_date,a.applicant_account_ref AS account_ref,to_char(CURRENT_DATE,'YYYY-MM-DD') AS today
   FROM hr_employee_application a JOIN hr_application_revision v ON v.root_realm_id=a.root_realm_id AND v.application_id=a.id AND v.revision_no=a.revision_no AND v.source_digest=a.submitted_digest
   JOIN cg03_case c ON c.realm_id=a.root_realm_id AND c.id=a.cg03_case_ref AND c.hr_application_id=a.id AND c.hr_revision_id=v.id AND c.hr_source_digest=v.source_digest
   JOIN branch b ON b.id=a.proposed_branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
   LEFT JOIN department d ON d.id=a.department_ref AND d.root_realm_id=a.root_realm_id
   WHERE a.root_realm_id=$1 AND a.application_no=$3 AND a.state IN('SUBMITTED','IN_REVIEW') AND c.status IN('SUBMITTED','IN_REVIEW')
    AND NOT EXISTS(SELECT 1 FROM hr_employee e WHERE e.root_realm_id=a.root_realm_id AND e.application_id=a.id) AND ${scope}
   FOR SHARE OF a,v,c,b`,[actor.realmId,actor.accountId,ref]):
   await tx.query<Subject>(`SELECT e.id AS employee_id,NULL::uuid AS application_id,NULL::uuid AS application_revision_id,NULL::int AS application_revision_no,NULL::text AS application_source_digest,
    a.id AS assignment_id,a.assignment_version,e.status_version AS employee_version,h.id AS exit_change_id,
    b.id AS branch_ref,app.legal_name AS recipient,a.designation,b.name AS branch,d.name AS department,to_char(app.hire_date,'YYYY-MM-DD') AS hire_date,
    to_char(h.last_working_date,'YYYY-MM-DD') AS last_working_date,e.account_ref,to_char(CURRENT_DATE,'YYYY-MM-DD') AS today
   FROM hr_employee e JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
   JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
   JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=e.root_realm_id
   LEFT JOIN department d ON d.id=a.department_ref AND d.root_realm_id=e.root_realm_id
   LEFT JOIN hr_employment_change h ON $4='RELIEVING' AND h.root_realm_id=e.root_realm_id AND h.employee_id=e.id AND h.prior_assignment_id=a.id
    AND h.kind IN('RESIGNATION','EXIT') AND h.status='APPLIED' AND h.decision_ref IS NOT NULL
   WHERE e.root_realm_id=$1 AND e.employee_code=$3 AND ${scope}
   AND (($4='RELIEVING' AND e.status='EXITED' AND h.id IS NOT NULL AND a.valid_to=h.effective_date)
     OR ($4<>'RELIEVING' AND e.status IN('ACTIVE','PROBATION') AND a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL AND b.status='ACTIVE'))
   FOR SHARE OF e,a,b`,[actor.realmId,actor.accountId,ref,kind]);
  if(q.rows.length!==1)throw new ForbiddenException("The original eligible subject is unavailable for your current branch");
  return q.rows[0];
 }
 async template(tx:PoolClient,realm:string,x:Input){
  const q=await tx.query<Template>("SELECT id,version,title,body,content_sha256 FROM cg19_document_template WHERE realm_id=$1 AND id=$2 AND version=$3 AND template_kind=$4 AND status='APPROVED' FOR SHARE",[realm,x.templateId,x.templateVersion,"HR_"+x.kind]);
  if(!q.rows[0])throw new ConflictException("The original approved template is unavailable");
  return q.rows[0];
 }
 async create(tx:PoolClient,actor:VerifiedFoundationActor,raw:unknown){
  const x=parseHrDocumentDraft(raw);
  const s=await this.subject(tx,actor,x.kind,x.subjectReference),t=await this.template(tx,actor.realmId,x),requestDigest=sha(x);
  if(x.issueDate>s.today||x.expiryDate&&x.expiryDate<=s.today)throw new BadRequestException("Choose a current issue date and future card expiry");
  const previous=(await tx.query<HrDocumentRow>("SELECT * FROM hr_document_request WHERE root_realm_id=$1 AND created_by=$2 AND request_key=$3",[actor.realmId,actor.accountId,x.requestKey])).rows[0];
  if(previous){if(previous.request_digest!==requestDigest)throw new ConflictException("The original request key belongs to different document details");return this.summary(previous);}
  const snapshot={kind:x.kind,subjectReference:x.subjectReference,recipient:s.recipient,designation:s.designation,branch:s.branch,department:s.department,
   hireDate:s.hire_date,lastWorkingDate:s.last_working_date,issueDate:x.issueDate,expiryDate:x.expiryDate,templateVersion:t.version,templateHash:t.content_sha256,
   salaryStatus:"NOT_APPLICABLE",sourceVersion:s.employee_version??s.application_revision_no,assignmentVersion:s.assignment_version};
  const sourceDigest=sha([s.employee_id,s.application_id,s.application_revision_id,s.assignment_id,s.exit_change_id,t.id,snapshot]);
  const q=await tx.query<HrDocumentRow>(`INSERT INTO hr_document_request(root_realm_id,kind,employee_id,application_id,application_revision_id,application_revision_no,application_source_digest,
   assignment_id,assignment_version,employee_version,exit_change_id,source_branch_ref,template_id,template_version,issue_date,expiry_date,source_snapshot,source_digest,request_key,request_digest,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21) ON CONFLICT DO NOTHING RETURNING *`,
   [actor.realmId,x.kind,s.employee_id,s.application_id,s.application_revision_id,s.application_revision_no,s.application_source_digest,s.assignment_id,s.assignment_version,s.employee_version,s.exit_change_id,s.branch_ref,t.id,t.version,x.issueDate,x.expiryDate,JSON.stringify(snapshot),sourceDigest,x.requestKey,requestDigest,actor.accountId]);
  if(!q.rows[0])throw new ConflictException("An identical document intent already exists. Refresh before retrying.");
  return this.summary(q.rows[0]);
 }
 summary(row:HrDocumentRow){return {reference:row.reference,kind:row.kind,status:row.status,revision:row.revision,snapshot:row.source_snapshot};}
 async original(tx:PoolClient,realm:string,id:string,lock=false){
  const q=await tx.query<HrDocumentRow>("SELECT * FROM hr_document_request WHERE root_realm_id=$1 AND id=$2"+(lock?" FOR UPDATE":""),[realm,id]);
  if(!q.rows[0])throw new NotFoundException("Document request unavailable");return q.rows[0];
 }
 async requester(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,lock=false){
  if(!/^CG-HR-DOC-[0-9]{6,}$/.test(ref))throw new BadRequestException("Choose the original document request");
  const q=await tx.query<HrDocumentRow>("SELECT * FROM hr_document_request WHERE root_realm_id=$1 AND reference=$2 AND created_by=$3"+(lock?" FOR UPDATE":""),[actor.realmId,ref,actor.accountId]);
  if(!q.rows[0])throw new NotFoundException("Document request unavailable");return q.rows[0];
 }
 async authorizedHistory(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,own=false){
  if(!/^CG-HR-DOC-[0-9]{6,}$/.test(ref))throw new BadRequestException("Choose the original document");
  const q=await this.history(tx,actor,own,0,ref);
  if(q.length!==1)throw new NotFoundException("Employee document unavailable");return q[0];
 }
 async history(tx:PoolClient,actor:VerifiedFoundationActor,own:boolean,offset:number,reference:string|null=null){
  if(own)await this.identity.assertPatientSessionCurrent(tx,actor);
  else await this.identity.assertCurrent(tx,actor,"hr.documents.manage");
  const q=await tx.query<HrDocumentRow>(`SELECT h.* FROM hr_document_request h JOIN branch b ON b.id=h.source_branch_ref AND b.root_realm_id=h.root_realm_id
   LEFT JOIN hr_employee e ON e.id=h.employee_id AND e.root_realm_id=h.root_realm_id
   WHERE h.root_realm_id=$1 AND ($3::text IS NULL OR h.reference=$3)
    AND (${own?`e.account_ref=$2 AND e.status IN('ACTIVE','PROBATION') AND h.status='APPROVED' AND EXISTS(
     SELECT 1 FROM cg19_generated_document d WHERE d.realm_id=h.root_realm_id AND d.case_id=h.case_ref AND d.state IN('ISSUED','REVOKED'))`:`${scope} AND (
     h.employee_id IS NULL OR EXISTS(SELECT 1 FROM hr_employment_assignment a WHERE a.root_realm_id=h.root_realm_id AND a.employee_id=h.employee_id
      AND a.branch_ref=h.source_branch_ref AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR (e.status='EXITED' AND a.id=h.assignment_id)))
     OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active AND r.is_protected WHERE ar.realm_id=$1 AND ar.account_id=$2 AND ar.revoked_at IS NULL))
     AND (h.status<>'DRAFT' OR h.created_by=$2)`})
   ORDER BY h.created_at DESC,h.id DESC LIMIT 26 OFFSET $4`,[actor.realmId,actor.accountId,reference,offset]);
  return q.rows;
 }
 async verifyCurrent(tx:PoolClient,actor:VerifiedFoundationActor,row:HrDocumentRow){
  const snapshot=row.source_snapshot;
  if(typeof snapshot.subjectReference!=="string")throw new ConflictException("Original document subject unavailable");
  const s=await this.subject(tx,actor,row.kind,snapshot.subjectReference);
  const t=await this.template(tx,actor.realmId,{kind:row.kind,templateId:row.template_id,templateVersion:row.template_version,subjectReference:snapshot.subjectReference,issueDate:String(snapshot.issueDate),expiryDate:typeof snapshot.expiryDate==="string"?snapshot.expiryDate:null,requestKey:row.id});
  if(s.employee_id!==row.employee_id||s.application_id!==row.application_id||s.branch_ref!==row.source_branch_ref||
   sha([s.employee_id,s.application_id,s.application_revision_id,s.assignment_id,s.exit_change_id,t.id,{
    kind:row.kind,subjectReference:snapshot.subjectReference,recipient:s.recipient,designation:s.designation,branch:s.branch,department:s.department,
    hireDate:s.hire_date,lastWorkingDate:s.last_working_date,issueDate:snapshot.issueDate,expiryDate:snapshot.expiryDate,templateVersion:t.version,templateHash:t.content_sha256,
    salaryStatus:"NOT_APPLICABLE",sourceVersion:s.employee_version??s.application_revision_no,assignmentVersion:s.assignment_version}])!==row.source_digest)
   throw new ConflictException("The original employee, assignment or approved template changed");
  return s;
 }
}
