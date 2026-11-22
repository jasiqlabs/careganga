import {BadRequestException,ConflictException,ForbiddenException,Injectable,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export const leaveDate=(v:unknown)=>{
 if(typeof v!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||
    new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)throw new BadRequestException({code:"CG10_LEAVE_INVALID"});
 return v;
};
export const leaveId=(v:unknown)=>{if(typeof v!=="string"||!UUID.test(v))
 throw new BadRequestException({code:"CG10_LEAVE_INVALID"});return v;};
export function parseLeaveRequest(body:unknown){
 if(!body||typeof body!=="object"||Array.isArray(body)||
  Object.keys(body).some(k=>!["requestKey","policyRef","startDate","endDate","halfDay","reason"].includes(k)))
  throw new BadRequestException({code:"CG10_LEAVE_INVALID"});
 const x=body as Record<string,unknown>;
 const startDate=leaveDate(x.startDate),endDate=leaveDate(x.endDate);
 const reason=typeof x.reason==="string"?x.reason.trim():"";
 if(startDate>endDate||startDate.slice(0,4)!==endDate.slice(0,4)||
    typeof x.halfDay!=="boolean"||(x.halfDay&&startDate!==endDate)||
    reason.length<2||reason.length>500||/[\u0000-\u001f\u007f]/.test(reason))
  throw new BadRequestException({code:"CG10_LEAVE_INVALID"});
 return {requestKey:leaveId(x.requestKey),policyRef:leaveId(x.policyRef),
  startDate,endDate,halfDay:x.halfDay,reason};
}
export function countedLeaveDates(start:string,end:string,weeklyOff:number[],countWeeklyOff:boolean){
 if(start>end||start.slice(0,4)!==end.slice(0,4))throw new BadRequestException({code:"CG10_LEAVE_INVALID"});
 const result:string[]=[];
 for(let at=Date.parse(leaveDate(start)+"T00:00:00Z"),last=Date.parse(leaveDate(end)+"T00:00:00Z");
  at<=last;at+=86400000){
  if(result.length>366||end.slice(0,4)!==start.slice(0,4))throw new BadRequestException({code:"CG10_LEAVE_INVALID"});
  const day=new Date(at);
  if(countWeeklyOff||!weeklyOff.includes(day.getUTCDay()))result.push(day.toISOString().slice(0,10));
 }
 return result;
}
const dateText=(v:Date|string)=>typeof v==="string"?v.slice(0,10):
 [v.getFullYear(),String(v.getMonth()+1).padStart(2,"0"),String(v.getDate()).padStart(2,"0")].join("-");
function secret(){
 const key=Buffer.from(process.env.CG10_PII_ENCRYPTION_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException("Private leave information cannot be stored securely");
 return key;
}
function encrypt(reason:string,realm:string,ref:string){
 const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",secret(),nonce);
 cipher.setAAD(Buffer.from(realm+"|leave|"+ref));
 const ciphertext=Buffer.concat([cipher.update(reason,"utf8"),cipher.final()]);
 return {ciphertext:ciphertext.toString("base64url"),nonce:nonce.toString("base64url"),tag:cipher.getAuthTag().toString("base64url")};
}
type Context={assignment_id:string;shift_id:string;shift_policy_id:string;branch_ref:string;
 weekly_off_days:number[];leave_type:string;type_key:string;annual_half_days:number;
 allow_half_days:boolean;count_weekly_off:boolean};
type Employee={id:string;name:string};
export type LeaveRequestRow={id:string;employee_id:string;assignment_id:string;shift_id:string;
 shift_policy_id:string;policy_id:string;start_date:string|Date;end_date:string|Date;
 half_days:number;half_day:boolean;reason_ciphertext:string;reason_nonce:string;reason_tag:string;
 submitted_by:string;request_key:string;request_digest:string;source_digest:string;case_ref:string|null;
 status:string;employee_name:string;leave_type:string;branch_ref:string};
export type LeaveSubmission={requestRef:string;sourceDigest:string;requestKey:string;employeeName:string};
@Injectable()
export class HrLeaveSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 private async employee(tx:PoolClient,actor:VerifiedFoundationActor,write=false){
  await this.identity.assertPatientSessionCurrent(tx,actor);
  const q=await tx.query<Employee>(`SELECT e.id,app.legal_name AS name FROM hr_employee e
   JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
   WHERE e.root_realm_id=$1 AND e.account_ref=$2 AND e.status IN('ACTIVE','PROBATION')
   `+(write?"FOR UPDATE OF e":"FOR SHARE OF e"),[actor.realmId,actor.accountId]);
  return q.rows[0]??null;
 }
 private async context(tx:PoolClient,realm:string,employee:string,policy:string,start:string,end:string){
  const q=await tx.query<Context>(`SELECT a.id AS assignment_id,s.id AS shift_id,p.id AS shift_policy_id,
   a.branch_ref,p.weekly_off_days,l.leave_type,l.type_key,l.annual_half_days,l.allow_half_days,l.count_weekly_off
   FROM hr_employment_assignment a
   JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
   JOIN hr_employee_shift s ON s.employee_id=a.employee_id AND s.root_realm_id=a.root_realm_id
   JOIN hr_shift_policy p ON p.id=s.policy_id AND p.root_realm_id=a.root_realm_id AND p.branch_ref=a.branch_ref
   JOIN hr_leave_policy l ON l.id=$3 AND l.root_realm_id=a.root_realm_id
   WHERE a.root_realm_id=$1 AND a.employee_id=$2
   AND a.valid_from<=$4::date AND (a.valid_to IS NULL OR a.valid_to>$5::date)
   AND a.valid_from<=(CURRENT_TIMESTAMP AT TIME ZONE p.time_zone)::date
   AND (a.valid_to IS NULL OR a.valid_to>(CURRENT_TIMESTAMP AT TIME ZONE p.time_zone)::date)
   AND s.valid_from<=$4::date AND (s.valid_to IS NULL OR s.valid_to>$5::date)
   AND p.effective_from<=$4::date
   AND l.effective_from<=$4::date AND (l.effective_to IS NULL OR l.effective_to>$5::date)
   FOR SHARE OF a,b,s,p,l`,[realm,employee,policy,start,end]);
  if(q.rows.length!==1)throw new ConflictException({code:"CG10_LEAVE_POLICY_CHANGED"});
  return q.rows[0];
 }
 private async used(tx:PoolClient,realm:string,employee:string,typeKey:string,year:string){
  const q=await tx.query<{used:string}>(`SELECT COALESCE(SUM(r.half_days),0)::text AS used
   FROM hr_leave_request r JOIN hr_leave_policy p ON p.id=r.policy_id AND p.root_realm_id=r.root_realm_id
   WHERE r.root_realm_id=$1 AND r.employee_id=$2 AND p.type_key=$3 AND r.status='APPROVED'
    AND r.start_date >= $4::date AND r.start_date < ($4::date+interval '1 year')`,
   [realm,employee,typeKey,year+"-01-01"]);
  return Number(q.rows[0]?.used??0);
 }
 private async noOverlap(tx:PoolClient,realm:string,employee:string,start:string,end:string){
  const found=await tx.query(`SELECT 1 FROM hr_leave_request WHERE root_realm_id=$1 AND employee_id=$2
    AND status='APPROVED' AND start_date<=$4::date AND end_date>=$3::date LIMIT 1`,
   [realm,employee,start,end]);
  if(found.rowCount)throw new ConflictException({code:"CG10_LEAVE_OVERLAP"});
 }
 private requestDigest(actor:VerifiedFoundationActor,x:ReturnType<typeof parseLeaveRequest>){
  return hash([actor.accountId,x.policyRef,x.startDate,x.endDate,x.halfDay,x.reason]);
 }
 async prepare(tx:PoolClient,actor:VerifiedFoundationActor,body:unknown){
  const x=parseLeaveRequest(body),employee=await this.employee(tx,actor,true);
  if(!employee)throw new ForbiddenException("Your approved active employment is unavailable");
  const requestDigest=this.requestDigest(actor,x);
  const previous=await tx.query<LeaveRequestRow>(`SELECT r.* FROM hr_leave_request r
   WHERE r.root_realm_id=$1 AND r.submitted_by=$2 AND r.request_key=$3 FOR SHARE`,
   [actor.realmId,actor.accountId,x.requestKey]);
  if(previous.rows[0]){
   const p=previous.rows[0];
   if(p.employee_id!==employee.id||p.request_digest!==requestDigest||!p.case_ref)
    throw new ConflictException({code:"CG10_LEAVE_STALE"});
   return {replay:true as const,requestRef:p.id,caseRef:p.case_ref};
  }
  // A client restart may lose its in-memory key; an identical pending command must still not create another case.
  const duplicate=await tx.query(`SELECT 1 FROM hr_leave_request WHERE root_realm_id=$1 AND employee_id=$2
   AND submitted_by=$3 AND request_digest=$4 AND status='SUBMITTED' LIMIT 1`,
   [actor.realmId,employee.id,actor.accountId,requestDigest]);
  if(duplicate.rowCount)throw new ConflictException({code:"CG10_LEAVE_DUPLICATE_PENDING"});
  const c=await this.context(tx,actor.realmId,employee.id,x.policyRef,x.startDate,x.endDate);
  const days=countedLeaveDates(x.startDate,x.endDate,c.weekly_off_days,c.count_weekly_off);
  const halfDays=x.halfDay?1:days.length*2;
  if(!days.length||(x.halfDay&&!c.allow_half_days))
   throw new BadRequestException({code:"CG10_LEAVE_INVALID"});
  await this.noOverlap(tx,actor.realmId,employee.id,x.startDate,x.endDate);
  if(halfDays+await this.used(tx,actor.realmId,employee.id,c.type_key,x.startDate.slice(0,4))>c.annual_half_days)
   throw new ConflictException({code:"CG10_LEAVE_ENTITLEMENT"});
  const ref=randomUUID(),privateReason=encrypt(x.reason,actor.realmId,ref);
  const sourceDigest=hash([employee.id,c.assignment_id,c.shift_id,c.shift_policy_id,x.policyRef,
   x.startDate,x.endDate,halfDays,x.halfDay,privateReason,actor.accountId]);
  await tx.query(`INSERT INTO hr_leave_request(id,root_realm_id,employee_id,assignment_id,shift_id,shift_policy_id,
   policy_id,start_date,end_date,half_days,half_day,reason_ciphertext,reason_nonce,reason_tag,
   submitted_by,request_key,request_digest,source_digest)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
   [ref,actor.realmId,employee.id,c.assignment_id,c.shift_id,c.shift_policy_id,x.policyRef,x.startDate,
    x.endDate,halfDays,x.halfDay,privateReason.ciphertext,privateReason.nonce,privateReason.tag,
    actor.accountId,x.requestKey,requestDigest,sourceDigest]);
  return {replay:false as const,requestRef:ref,sourceDigest,requestKey:x.requestKey,employeeName:employee.name};
 }
 async original(tx:PoolClient,realm:string,ref:string){
  const q=await tx.query<LeaveRequestRow>(`SELECT r.*,app.legal_name AS employee_name,
    p.leave_type,a.branch_ref FROM hr_leave_request r
    JOIN hr_employee e ON e.id=r.employee_id AND e.root_realm_id=r.root_realm_id
    JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
    JOIN hr_leave_policy p ON p.id=r.policy_id AND p.root_realm_id=r.root_realm_id
    JOIN hr_employment_assignment a ON a.id=r.assignment_id AND a.root_realm_id=r.root_realm_id
    WHERE r.root_realm_id=$1 AND r.id=$2`,[realm,ref]);
  if(!q.rows[0])throw new ConflictException({code:"CG10_LEAVE_STALE"});
  return q.rows[0];
 }
 async link(tx:PoolClient,realm:string,ref:string,caseRef:string){
  const q=await tx.query("UPDATE hr_leave_request SET case_ref=$3 WHERE root_realm_id=$1 AND id=$2 AND case_ref IS NULL RETURNING id",
   [realm,ref,caseRef]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_LEAVE_STALE"});
 }
 reason(row:LeaveRequestRow,realm:string){
  try{
   const d=createDecipheriv("aes-256-gcm",secret(),Buffer.from(row.reason_nonce,"base64url"));
   d.setAAD(Buffer.from(realm+"|leave|"+row.id));d.setAuthTag(Buffer.from(row.reason_tag,"base64url"));
   return Buffer.concat([d.update(Buffer.from(row.reason_ciphertext,"base64url")),d.final()]).toString("utf8");
  }catch{throw new ServiceUnavailableException("The private leave reason is unavailable");}
 }
 summary(row:LeaveRequestRow){
  return {employeeName:row.employee_name,leaveType:row.leave_type,startDate:dateText(row.start_date),
   endDate:dateText(row.end_date),days:row.half_days/2,status:row.status};
 }
 async assertOwnRequest(tx:PoolClient,actor:VerifiedFoundationActor,row:LeaveRequestRow){
  const employee=await this.employee(tx,actor,true);
  if(!employee||employee.id!==row.employee_id||row.submitted_by!==actor.accountId)
   throw new ForbiddenException("This leave request is not available for your current employment");
 }
 async applyCancellation(tx:PoolClient,realm:string,row:LeaveRequestRow,eventRef:string){
  const q=await tx.query(`UPDATE hr_leave_request SET status='CANCELLED',cancel_event_ref=$3,decided_at=now()
   WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' RETURNING id`,[realm,row.id,eventRef]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_LEAVE_STALE"});
 }
 async reviewBalance(tx:PoolClient,realm:string,row:LeaveRequestRow){
  const p=(await tx.query<{type_key:string;annual_half_days:number}>(`SELECT type_key,annual_half_days
   FROM hr_leave_policy WHERE root_realm_id=$1 AND id=$2`,[realm,row.policy_id])).rows[0];
  if(!p)throw new ConflictException({code:"CG10_LEAVE_POLICY_CHANGED"});
  const used=await this.used(tx,realm,row.employee_id,p.type_key,dateText(row.start_date).slice(0,4));
  return {annualDays:p.annual_half_days/2,approvedDays:used/2,availableDays:Math.max(0,p.annual_half_days-used)/2};
 }
 async mine(tx:PoolClient,actor:VerifiedFoundationActor,yearInput:unknown){
  const year=typeof yearInput==="string"?yearInput:String(new Date().getUTCFullYear());
  if(!/^20\d{2}$/.test(year))throw new BadRequestException({code:"CG10_LEAVE_INVALID"});
  const employee=await this.employee(tx,actor);
  if(!employee)return {linked:false,year,policies:[],requests:[]};
  const p=await tx.query<{id:string;leave_type:string;annual_half_days:number;allow_half_days:boolean;
    count_weekly_off:boolean;effective_from:Date|string;effective_to:Date|string|null;used:number}>(`
   WITH usage AS (
    SELECT lp.type_key,SUM(l.half_days)::integer AS used FROM hr_leave_request l
    JOIN hr_leave_policy lp ON lp.id=l.policy_id AND lp.root_realm_id=l.root_realm_id
    WHERE l.root_realm_id=$1 AND l.employee_id=$2 AND l.status='APPROVED'
     AND l.start_date>=$3::date AND l.start_date<$3::date+interval '1 year' GROUP BY lp.type_key)
   SELECT p.id,p.leave_type,p.annual_half_days,p.allow_half_days,p.count_weekly_off,p.effective_from,p.effective_to,
    COALESCE(u.used,0)::integer AS used FROM hr_leave_policy p LEFT JOIN usage u ON u.type_key=p.type_key
   WHERE p.root_realm_id=$1 AND p.effective_from<$3::date+interval '1 year'
    AND (p.effective_to IS NULL OR p.effective_to>$3::date) ORDER BY p.leave_type,p.effective_from DESC LIMIT 100`,
   [actor.realmId,employee.id,year+"-01-01"]);
  const q=await tx.query<LeaveRequestRow&{case_number:string;case_status:string}>(`
   SELECT r.*,p.leave_type,c.case_number,c.status AS case_status FROM hr_leave_request r
   JOIN hr_leave_policy p ON p.id=r.policy_id AND p.root_realm_id=r.root_realm_id
   JOIN cg03_case c ON c.id=r.case_ref AND c.realm_id=r.root_realm_id AND c.case_kind='LEAVE_REQUEST'
    AND c.hr_leave_request_id=r.id AND c.hr_leave_source_digest=r.source_digest
   WHERE r.root_realm_id=$1 AND r.employee_id=$2 AND r.start_date>=$3::date
    AND r.start_date<$3::date+interval '1 year' ORDER BY r.submitted_at DESC,r.id DESC LIMIT 50`,
   [actor.realmId,employee.id,year+"-01-01"]);
  return {linked:true,year,policies:p.rows.map(x=>({policyRef:x.id,leaveType:x.leave_type,
   annualDays:x.annual_half_days/2,usedDays:x.used/2,availableDays:Math.max(0,x.annual_half_days-x.used)/2,
   allowHalfDays:x.allow_half_days,countWeeklyOff:x.count_weekly_off,effectiveFrom:dateText(x.effective_from),
   effectiveTo:x.effective_to?dateText(x.effective_to):null})),
   requests:q.rows.map(x=>({reference:x.case_number,caseStatus:x.case_status,...this.summary({...x,employee_name:employee.name})}))};
 }
 /** Apply the original immutable CG03 decision. The approval path already
  * holds the employee lock and validated the pinned dates and remaining units. */
 async applyDecision(tx:PoolClient,realm:string,row:LeaveRequestRow,decisionRef:string,
   action:"APPROVE"|"RETURN"|"REJECT",days:string[]){
  if(action==="APPROVE"&&(!days.length||(row.half_day?1:days.length*2)!==row.half_days))
   throw new ConflictException("The original leave day count changed");
  const next=action==="APPROVE"?"APPROVED":action==="RETURN"?"RETURNED":"REJECTED";
  const changed=await tx.query(`UPDATE hr_leave_request SET status=$3,decision_ref=$4,decided_at=now()
    WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' RETURNING id`,[realm,row.id,next,decisionRef]);
  if(!changed.rowCount)throw new ConflictException({code:"CG10_LEAVE_STALE"});
  if(action!=="APPROVE")return;
  const units=row.half_day?1:2;
  // Never replace a real full-day punch; a half-day can coexist with the
  // original recorded in/out time. All chosen dates succeed or none do.
  const effected=await tx.query(`INSERT INTO hr_attendance_day(root_realm_id,employee_id,assignment_id,shift_id,policy_id,
    local_date,status,checked_in_at,leave_request_id,leave_half_days)
   SELECT $1,$2,$3,$4,$5,d,CASE WHEN $7::integer=1 THEN 'HALF_DAY_LEAVE' ELSE 'LEAVE' END,NULL,$8,$7
   FROM unnest($6::date[]) AS dates(d)
   ON CONFLICT(root_realm_id,employee_id,local_date) DO UPDATE SET
    leave_request_id=EXCLUDED.leave_request_id,leave_half_days=EXCLUDED.leave_half_days,
    status=CASE WHEN hr_attendance_day.status IN('ABSENT','WEEKLY_OFF') THEN EXCLUDED.status ELSE hr_attendance_day.status END,
    version=hr_attendance_day.version+1
   WHERE hr_attendance_day.leave_request_id IS NULL
    AND ((EXCLUDED.leave_half_days=1 AND hr_attendance_day.status IN('PRESENT','LATE'))
      OR (hr_attendance_day.status IN('ABSENT','WEEKLY_OFF') AND hr_attendance_day.checked_in_at IS NULL AND hr_attendance_day.checked_out_at IS NULL))
    AND hr_attendance_day.assignment_id=EXCLUDED.assignment_id AND hr_attendance_day.shift_id=EXCLUDED.shift_id
    AND hr_attendance_day.policy_id=EXCLUDED.policy_id RETURNING id`,
   [realm,row.employee_id,row.assignment_id,row.shift_id,row.shift_policy_id,days,units,row.id]);
  if(effected.rowCount!==days.length)throw new ConflictException({code:"CG10_LEAVE_PUNCH_CONFLICT"});
 }
 /** Called by CG03 with original case and employee lock before any decision is written. */
 async validateApproval(tx:PoolClient,realm:string,row:LeaveRequestRow){
  const employee=await tx.query(`SELECT e.id FROM hr_employee e JOIN account a
   ON a.id=e.account_ref AND a.realm_id=e.root_realm_id AND a.status='ACTIVE'
   WHERE e.root_realm_id=$1 AND e.id=$2 AND e.account_ref=$3 AND e.status IN('ACTIVE','PROBATION') FOR UPDATE OF e FOR SHARE OF a`,
   [realm,row.employee_id,row.submitted_by]);
  if(!employee.rowCount)throw new ConflictException({code:"CG10_LEAVE_POLICY_CHANGED"});
  const start=dateText(row.start_date),end=dateText(row.end_date);
  const c=await this.context(tx,realm,row.employee_id,row.policy_id,start,end);
  const days=countedLeaveDates(start,end,c.weekly_off_days,c.count_weekly_off);
  if(c.assignment_id!==row.assignment_id||c.shift_id!==row.shift_id||c.shift_policy_id!==row.shift_policy_id||
   !days.length||(row.half_day&&!c.allow_half_days)||(row.half_day?1:days.length*2)!==row.half_days)
   throw new ConflictException({code:"CG10_LEAVE_POLICY_CHANGED"});
  await this.noOverlap(tx,realm,row.employee_id,start,end);
  if(row.half_days+await this.used(tx,realm,row.employee_id,c.type_key,start.slice(0,4))>c.annual_half_days)
   throw new ConflictException({code:"CG10_LEAVE_ENTITLEMENT"});
  return days;
 }
}
