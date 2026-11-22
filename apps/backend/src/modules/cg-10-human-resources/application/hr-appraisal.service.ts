import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {leaveDate,leaveId} from "./hr-leave-source.facade";
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const EMP=/^CG-HR-EMP-[0-9]{6,}$/;
const REF=/^CG-HR-APR-[0-9]{6,}$/;
function object(v:unknown,fields:string[]){
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!fields.includes(k)))
  throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
 return v as Record<string,unknown>;
}
function score(v:unknown){
 if(!Number.isInteger(v)||Number(v)<0||Number(v)>100)throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
 return Number(v);
}
function note(v:unknown){
 if(typeof v!=="string"||v.length>1000||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v))
  throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
 return v.trim();
}
function values(x:Record<string,unknown>){
 return {goal:score(x.goal),competency:score(x.competency),attendance:score(x.attendance),strengths:note(x.strengths),improvement:note(x.improvement)};
}
export function parseAppraisalDraft(body:unknown){
 const x=object(body,["requestKey","employeeReference","periodStart","periodEnd","goal","competency","attendance","strengths","improvement"]);
 if(typeof x.employeeReference!=="string"||!EMP.test(x.employeeReference))throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
 const periodStart=leaveDate(x.periodStart),periodEnd=leaveDate(x.periodEnd);
 if(periodStart>periodEnd)throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
 return {requestKey:leaveId(x.requestKey),employeeReference:x.employeeReference,periodStart,periodEnd,...values(x)};
}
function revision(v:unknown){
 if(!Number.isSafeInteger(v)||Number(v)<1)throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
 return Number(v);
}
export function parseAppraisalUpdate(body:unknown){
 const x=object(body,["requestKey","expectedRevision","goal","competency","attendance","strengths","improvement"]);
 return {requestKey:leaveId(x.requestKey),expectedRevision:revision(x.expectedRevision),...values(x)};
}
export function parseAppraisalTransition(body:unknown){
 const x=object(body,["requestKey","expectedRevision"]);
 return {requestKey:leaveId(x.requestKey),expectedRevision:revision(x.expectedRevision)};
}
function key(){
 const k=Buffer.from(process.env.CG10_PII_ENCRYPTION_KEY??"","base64");
 if(k.length!==32)throw new ServiceUnavailableException("Protected appraisal feedback is unavailable");
 return k;
}
function seal(realm:string,ref:string,feedback:{strengths:string;improvement:string}){
 const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),nonce);
 cipher.setAAD(Buffer.from(realm+"|appraisal|"+ref));
 const ct=Buffer.concat([cipher.update(JSON.stringify(feedback),"utf8"),cipher.final()]);
 return {ciphertext:ct.toString("base64url"),nonce:nonce.toString("base64url"),tag:cipher.getAuthTag().toString("base64url")};
}
type Row={id:string;reference:string;employee_id:string;assignment_id:string;employee_code:string;employee_name:string;
 reviewer_employee_ref:string;reviewer_account_ref:string;period_start:string;period_end:string;
 goal_delivery_score:number;competency_score:number;attendance_conduct_score:number;
 status:string;revision:number;request_key:string;request_digest:string;last_command_key:string;last_command_digest:string;
 feedback_ciphertext:string;feedback_nonce:string;feedback_tag:string;released_at:Date|null};
type Target={id:string;employee_code:string;employee_name:string;assignment_id:string;reviewer_id:string};
function unseal(realm:string,r:Row){
 try{const d=createDecipheriv("aes-256-gcm",key(),Buffer.from(r.feedback_nonce,"base64url"));
  d.setAAD(Buffer.from(realm+"|appraisal|"+r.id));d.setAuthTag(Buffer.from(r.feedback_tag,"base64url"));
  const v=JSON.parse(Buffer.concat([d.update(Buffer.from(r.feedback_ciphertext,"base64url")),d.final()]).toString("utf8"));
  return {strengths:note(v.strengths),improvement:note(v.improvement)};
 }catch{throw new ServiceUnavailableException("Protected appraisal feedback is unavailable");}
}
type ListRow=Pick<Row,"reference"|"employee_code"|"employee_name"|"period_start"|"period_end"|"goal_delivery_score"|"competency_score"|"attendance_conduct_score"|"status"|"revision">;
const projection=(r:ListRow)=>({reference:r.reference,employeeReference:r.employee_code,employeeName:r.employee_name,
 periodStart:r.period_start,periodEnd:r.period_end,goal:r.goal_delivery_score,competency:r.competency_score,
 attendance:r.attendance_conduct_score,status:r.status,revision:r.revision});
const baseQuery=`SELECT ar.*,to_char(ar.period_start,'YYYY-MM-DD') AS period_start,to_char(ar.period_end,'YYYY-MM-DD') AS period_end,
 e.employee_code,app.legal_name AS employee_name FROM hr_appraisal ar
 JOIN hr_employee e ON e.id=ar.employee_id AND e.root_realm_id=ar.root_realm_id
 JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id`;
/** Current reviewer is an actual active employee, and must be authorized for the
 * subject in its real active assignment. No role, branch or employee spoofing. */
const targetQuery=`SELECT e.id,e.employee_code,app.legal_name AS employee_name,a.id AS assignment_id,rv.id AS reviewer_id
 FROM hr_employee e JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
 JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
 JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
 JOIN hr_employee rv ON rv.root_realm_id=e.root_realm_id AND rv.account_ref=$2 AND rv.status IN('ACTIVE','PROBATION') AND rv.id<>e.id
 JOIN hr_employment_assignment ra ON ra.employee_id=rv.id AND ra.root_realm_id=rv.root_realm_id
 JOIN branch rb ON rb.id=ra.branch_ref AND rb.root_realm_id=ra.root_realm_id AND rb.status='ACTIVE'
 WHERE e.root_realm_id=$1 AND e.status IN('ACTIVE','PROBATION')
 AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
 AND ra.valid_from<=CURRENT_DATE AND (ra.valid_to IS NULL OR ra.valid_to>CURRENT_DATE)
 AND ((ra.branch_ref=a.branch_ref AND (a.manager_employee_ref=rv.id OR b.manager_account_ref=$2))
 OR EXISTS(SELECT 1 FROM account_role gr JOIN role rr ON rr.id=gr.role_id AND rr.realm_id=gr.realm_id
  AND rr.active AND rr.is_protected WHERE gr.realm_id=$1 AND gr.account_id=$2 AND gr.revoked_at IS NULL))`;
@Injectable()
export class HrAppraisalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   const v=await fn(tx);await tx.query("COMMIT");return v;
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async reviewer(token:string){return this.sessions.requireAction(token,"hr.appraisals.manage");}
 private async target(tx:PoolClient,actor:VerifiedFoundationActor,reference:string){
  await this.identity.assertCurrent(tx,actor,"hr.appraisals.manage");
  const q=await tx.query<Target>(targetQuery+" AND e.employee_code=$3 FOR SHARE OF e,a,b,rv,ra,rb",[actor.realmId,actor.accountId,reference]);
  if(q.rows.length!==1)throw new ForbiddenException("The employee is not available for your current appraisal scope");
  return q.rows[0];
 }
 private async row(tx:PoolClient,actor:VerifiedFoundationActor,reference:string,lock=false){
  if(!REF.test(reference))throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
  await this.identity.assertCurrent(tx,actor,"hr.appraisals.manage");
  const query=baseQuery+" WHERE ar.root_realm_id=$1 AND ar.reference=$2 AND ar.reviewer_account_ref=$3";
  const params=[actor.realmId,reference,actor.accountId];
  const original=(await tx.query<Row>(query,params)).rows[0];
  if(!original)throw new NotFoundException("This appraisal is unavailable");
  // Lock order: current identity and assignment before the appraisal row.
  const current=await this.target(tx,actor,original.employee_code);
  const r=(await tx.query<Row>(query+(lock?" FOR UPDATE OF ar":" FOR SHARE OF ar"),params)).rows[0];
  if(!r||current.id!==r.employee_id||current.assignment_id!==r.assignment_id||current.reviewer_id!==r.reviewer_employee_ref)
   throw new ConflictException({code:"CG10_APPRAISAL_STALE"});
  return r;
 }
 private async audit(tx:PoolClient,actor:VerifiedFoundationActor,employee:string,action:string){
  await tx.query("INSERT INTO hr_audit(root_realm_id,actor_ref,employee_ref,event_key,action) VALUES($1,$2,$3,$4,$5)",
   [actor.realmId,actor.accountId,employee,randomUUID(),action]);
 }
 async options(token:string,searchInput:unknown){
  const actor=await this.reviewer(token);
  if(searchInput!==undefined&&(typeof searchInput!=="string"||searchInput.length>80))throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
  const search=typeof searchInput==="string"?searchInput.trim().toLowerCase():"";
  return this.run(async tx=>{
   await this.identity.assertCurrent(tx,actor,"hr.appraisals.manage");
   const q=await tx.query<Target>(targetQuery+" AND ($3='' OR strpos(lower(app.legal_name),$3)>0) ORDER BY app.legal_name,e.id LIMIT 51",
    [actor.realmId,actor.accountId,search]);
   return {items:q.rows.slice(0,50).map(x=>({employeeReference:x.employee_code,employeeName:x.employee_name})),hasMore:q.rows.length>50};
  });
 }
 async list(token:string,offsetInput:unknown,statusInput:unknown="ALL"){
  const actor=await this.reviewer(token),offset=Number(offsetInput??0),status=statusInput??"ALL";
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||
   typeof status!=="string"||!["ALL","DRAFT","SUBMITTED","RELEASED"].includes(status))
   throw new BadRequestException({code:"CG10_APPRAISAL_INVALID"});
  return this.run(async tx=>{
   await this.identity.assertCurrent(tx,actor,"hr.appraisals.manage");
   // One consistent scoped snapshot for summary and bounded page; never fetch encrypted notes into a list.
   const q=await tx.query<{page:ListRow[];summary:{total:number;draft:number;submitted:number;released:number;averageScore:number|null;outstanding:number}}>(`
    WITH targets AS (${targetQuery}), scoped AS (
      SELECT ar.id,ar.reference,ar.status,ar.revision,ar.period_end AS sort_end,
       to_char(ar.period_start,'YYYY-MM-DD') AS period_start,to_char(ar.period_end,'YYYY-MM-DD') AS period_end,
       t.employee_code,t.employee_name,ar.goal_delivery_score,ar.competency_score,ar.attendance_conduct_score
      FROM hr_appraisal ar JOIN targets t ON t.id=ar.employee_id AND t.assignment_id=ar.assignment_id
       AND t.reviewer_id=ar.reviewer_employee_ref
      WHERE ar.root_realm_id=$1 AND ar.reviewer_account_ref=$2
    ), page AS (
      SELECT * FROM scoped WHERE ($4='ALL' OR status=$4) ORDER BY sort_end DESC,id DESC LIMIT 26 OFFSET $3
    ) SELECT
     (SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY sort_end DESC,id DESC),'[]'::jsonb) FROM page) AS page,
     (SELECT jsonb_build_object('total',COUNT(*)::integer,
      'draft',COUNT(*) FILTER(WHERE status='DRAFT')::integer,
      'submitted',COUNT(*) FILTER(WHERE status='SUBMITTED')::integer,
      'released',COUNT(*) FILTER(WHERE status='RELEASED')::integer,
      'averageScore',ROUND(AVG((goal_delivery_score+competency_score+attendance_conduct_score)/60.0),2),
      'outstanding',COUNT(*) FILTER(WHERE goal_delivery_score=100 AND competency_score=100 AND attendance_conduct_score=100)::integer)
      FROM scoped) AS summary`,[actor.realmId,actor.accountId,offset,status]);
   const page=q.rows[0]?.page??[];
   return {items:page.slice(0,25).map(projection),hasMore:page.length>25,offset,
    summary:q.rows[0]?.summary??{total:0,draft:0,submitted:0,released:0,averageScore:null,outstanding:0}};
  });
 }
 async detail(token:string,ref:string){
  const actor=await this.reviewer(token);
  return this.run(async tx=>{
   const r=await this.row(tx,actor,ref);
   const feedback=unseal(actor.realmId,r);await this.audit(tx,actor,r.employee_id,"APPRAISAL_PRIVATE_READ");
   return {...projection(r),...feedback};
  });
 }
 async create(token:string,body:unknown){
  const actor=await this.reviewer(token),x=parseAppraisalDraft(body),d=digest(["CREATE",x]);
  return this.run(async tx=>{
   const employee=await this.target(tx,actor,x.employeeReference);
   const old=(await tx.query<Row>(baseQuery+" WHERE ar.root_realm_id=$1 AND ar.reviewer_account_ref=$2 AND ar.request_key=$3 FOR SHARE OF ar",
    [actor.realmId,actor.accountId,x.requestKey])).rows[0];
   if(old){
    if(old.request_digest!==d||old.employee_id!==employee.id||old.assignment_id!==employee.assignment_id||old.reviewer_employee_ref!==employee.reviewer_id)
     throw new ConflictException({code:"CG10_APPRAISAL_STALE"});
    return {...projection(old),replayed:true};
   }
   const id=randomUUID(),encrypted=seal(actor.realmId,id,{strengths:x.strengths,improvement:x.improvement});
   const inserted=await tx.query<{reference:string}>(`INSERT INTO hr_appraisal(id,root_realm_id,employee_id,assignment_id,
    reviewer_employee_ref,reviewer_account_ref,period_start,period_end,goal_delivery_score,competency_score,attendance_conduct_score,
    feedback_ciphertext,feedback_nonce,feedback_tag,request_key,request_digest,last_command_key,last_command_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$15,$16)
    ON CONFLICT DO NOTHING RETURNING reference`,[id,actor.realmId,employee.id,employee.assignment_id,employee.reviewer_id,
      actor.accountId,x.periodStart,x.periodEnd,x.goal,x.competency,x.attendance,encrypted.ciphertext,encrypted.nonce,encrypted.tag,x.requestKey,d]);
   if(!inserted.rowCount){
    // A concurrent identical CREATE can win after the first replay lookup.
    const accepted=(await tx.query<Row>(baseQuery+" WHERE ar.root_realm_id=$1 AND ar.reviewer_account_ref=$2 AND ar.request_key=$3 FOR SHARE OF ar",
     [actor.realmId,actor.accountId,x.requestKey])).rows[0];
    if(accepted&&accepted.request_digest===d&&accepted.employee_id===employee.id&&
      accepted.assignment_id===employee.assignment_id&&accepted.reviewer_employee_ref===employee.reviewer_id)
     return {...projection(accepted),replayed:true};
    throw new ConflictException({code:accepted?"CG10_APPRAISAL_STALE":"CG10_APPRAISAL_DUPLICATE"});
   }
   await this.audit(tx,actor,employee.id,"APPRAISAL_DRAFT_CREATED");
   const r=await this.row(tx,actor,inserted.rows[0].reference);
   return {...projection(r),replayed:false};
  });
 }
 async edit(token:string,ref:string,body:unknown){
  const actor=await this.reviewer(token),x=parseAppraisalUpdate(body),d=digest(["EDIT",ref,x]);
  return this.run(async tx=>{
   const r=await this.row(tx,actor,ref,true);
   if(r.last_command_key===x.requestKey){
    if(r.last_command_digest!==d)throw new ConflictException({code:"CG10_APPRAISAL_STALE"});
    return {...projection(r),replayed:true};
   }
   if(r.status!=="DRAFT"||r.revision!==x.expectedRevision)throw new ConflictException({code:"CG10_APPRAISAL_STALE"});
   const encrypted=seal(actor.realmId,r.id,{strengths:x.strengths,improvement:x.improvement});
   const updated=await tx.query(`UPDATE hr_appraisal SET goal_delivery_score=$3,competency_score=$4,attendance_conduct_score=$5,
    feedback_ciphertext=$6,feedback_nonce=$7,feedback_tag=$8,last_command_key=$9,last_command_digest=$10,
    revision=revision+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND revision=$11 AND status='DRAFT' RETURNING id`,
    [actor.realmId,r.id,x.goal,x.competency,x.attendance,encrypted.ciphertext,encrypted.nonce,encrypted.tag,x.requestKey,d,x.expectedRevision]);
   if(!updated.rowCount)throw new ConflictException({code:"CG10_APPRAISAL_STALE"});
   await this.audit(tx,actor,r.employee_id,"APPRAISAL_DRAFT_UPDATED");
   return {...projection(await this.row(tx,actor,ref)),replayed:false};
  });
 }
 async transition(token:string,ref:string,body:unknown,action:"SUBMIT"|"RELEASE"){
  const actor=await this.reviewer(token),x=parseAppraisalTransition(body),d=digest([action,ref,x]);
  return this.run(async tx=>{
   const r=await this.row(tx,actor,ref,true);
   if(r.last_command_key===x.requestKey){
    if(r.last_command_digest!==d)throw new ConflictException({code:"CG10_APPRAISAL_STALE"});
    return {...projection(r),replayed:true};
   }
   const prior=action==="SUBMIT"?"DRAFT":"SUBMITTED",next=action==="SUBMIT"?"SUBMITTED":"RELEASED";
   if(r.status!==prior||r.revision!==x.expectedRevision)throw new ConflictException({code:"CG10_APPRAISAL_STALE"});
   const updated=await tx.query(`UPDATE hr_appraisal SET status=$3,revision=revision+1,updated_at=now(),
     submitted_at=CASE WHEN $3='SUBMITTED' THEN now() ELSE submitted_at END,
     released_at=CASE WHEN $3='RELEASED' THEN now() ELSE released_at END,last_command_key=$4,last_command_digest=$5
     WHERE root_realm_id=$1 AND id=$2 AND revision=$6 AND status=$7 RETURNING id`,
     [actor.realmId,r.id,next,x.requestKey,d,x.expectedRevision,prior]);
   if(!updated.rowCount)throw new ConflictException({code:"CG10_APPRAISAL_STALE"});
   await this.audit(tx,actor,r.employee_id,action==="SUBMIT"?"APPRAISAL_SUBMITTED":"APPRAISAL_RELEASED");
   return {...projection(await this.row(tx,actor,ref)),replayed:false};
  });
 }
 async mine(token:string){
  const actor=await this.sessions.verifySession(token);
  return this.run(async tx=>{
   await this.identity.assertPatientSessionCurrent(tx,actor);
   const q=await tx.query<{id:string}>(`SELECT e.id FROM hr_employee e JOIN hr_employment_assignment a
    ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
    JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
    WHERE e.root_realm_id=$1 AND e.account_ref=$2 AND e.status IN('ACTIVE','PROBATION')
    AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE) FOR SHARE OF e,a,b`,[actor.realmId,actor.accountId]);
   if(q.rows.length!==1)return {linked:false,items:[]};
   // Own released view never reads protected feedback, reviewer identity or command keys.
   const v=await tx.query<Pick<ListRow,"reference"|"period_start"|"period_end"|"goal_delivery_score"|"competency_score"|"attendance_conduct_score"|"status">>(`
    SELECT reference,to_char(period_start,'YYYY-MM-DD') AS period_start,to_char(period_end,'YYYY-MM-DD') AS period_end,
     goal_delivery_score,competency_score,attendance_conduct_score,status
    FROM hr_appraisal WHERE root_realm_id=$1 AND employee_id=$2 AND status='RELEASED'
    ORDER BY period_end DESC,id DESC LIMIT 50`,[actor.realmId,q.rows[0].id]);
   return {linked:true,items:v.rows.map(r=>({reference:r.reference,periodStart:r.period_start,periodEnd:r.period_end,
    goal:r.goal_delivery_score,competency:r.competency_score,attendance:r.attendance_conduct_score,status:r.status}))};
  });
 }
}
