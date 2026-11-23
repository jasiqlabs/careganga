import {assertAttendanceBeforeChange} from "./hr-employment-attendance-guard";
import {BadRequestException,ConflictException,ForbiddenException,Injectable,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {shiftCheckInAt,verifiedWorkedMinutes} from "./hr-attendance.service";
import {leaveDate,leaveId} from "./hr-leave-source.facade";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const EMP=/^CG-HR-EMP-[0-9]{6,}$/;
const localTime=(v:unknown)=>{
 if(typeof v!=="string"||!/^20\d{2}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(v))
  throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
 leaveDate(v.slice(0,10));return v;
};
export function parseAttendanceCorrection(body:unknown){
 if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>
  !["requestKey","employeeReference","date","expectedVersion","result","checkInLocal","checkOutLocal","reason"].includes(k)))
  throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
 const x=body as Record<string,unknown>;
 const date=leaveDate(x.date),reason=typeof x.reason==="string"?x.reason.trim():"";
 if(!Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<1||
  typeof x.result!=="string"||!["WORKED","ABSENT","WEEKLY_OFF"].includes(x.result)||
  reason.length<2||reason.length>500||/[\u0000-\u001f\u007f]/.test(reason)||
  (x.employeeReference!==undefined&&(typeof x.employeeReference!=="string"||!EMP.test(x.employeeReference))))
  throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
 if(x.result!=="WORKED"&&[x.checkInLocal,x.checkOutLocal].some(v=>v!==null&&v!==undefined&&v!==""))
  throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
 return {requestKey:leaveId(x.requestKey),employeeReference:x.employeeReference as string|undefined,date,
  expectedVersion:Number(x.expectedVersion),result:x.result as "WORKED"|"ABSENT"|"WEEKLY_OFF",
  checkInLocal:x.result==="WORKED"?localTime(x.checkInLocal):null,
  checkOutLocal:x.result==="WORKED"?localTime(x.checkOutLocal):null,reason};
}
function key(){
 const k=Buffer.from(process.env.CG10_PII_ENCRYPTION_KEY??"","base64");
 if(k.length!==32)throw new ServiceUnavailableException("Private correction information is unavailable");
 return k;
}
function seal(reason:string,realm:string,ref:string){
 const nonce=randomBytes(12),c=createCipheriv("aes-256-gcm",key(),nonce);
 c.setAAD(Buffer.from(realm+"|attendance-change|"+ref));
 const ct=Buffer.concat([c.update(reason,"utf8"),c.final()]);
 return {ciphertext:ct.toString("base64url"),nonce:nonce.toString("base64url"),tag:c.getAuthTag().toString("base64url")};
}
type Employee={id:string;name:string;branch_ref:string;account_ref:string|null};
type Day={id:string;employee_id:string;assignment_id:string;shift_id:string;policy_id:string;
 day:string;status:string;checked_in_at:Date|string|null;checked_out_at:Date|string|null;worked_minutes:number|null;
 leave_half_days:number|null;version:number;branch_ref:string;time_zone:string;work_start_local:string;work_end_local:string;
 break_minutes:number;grace_minutes:number;weekly_off_days:number[]};
type Snapshot={status:string;checkInAt:string|null;checkOutAt:string|null;workedMinutes:number|null;leaveDays:number;
 date:string;timeZone:string;assignmentRef:string;shiftRef:string;policyRef:string;version:number};
const stamp=(v:Date|string|null)=>v?new Date(v).toISOString():null;
const snapshot=(d:Day):Snapshot=>({status:d.status,checkInAt:stamp(d.checked_in_at),checkOutAt:stamp(d.checked_out_at),
 workedMinutes:d.worked_minutes,leaveDays:(d.leave_half_days??0)/2,date:d.day,timeZone:d.time_zone,
 assignmentRef:d.assignment_id,shiftRef:d.shift_id,policyRef:d.policy_id,version:d.version});
const projection=(x:Snapshot)=>({status:x.status,checkInAt:x.checkInAt,checkOutAt:x.checkOutAt,
 workedMinutes:x.workedMinutes,leaveDays:x.leaveDays,date:x.date,timeZone:x.timeZone});
export type CorrectionRow={id:string;employee_id:string;attendance_day_id:string;expected_version:number;
 original_snapshot:Snapshot;proposed_snapshot:Snapshot;reason_ciphertext:string;reason_nonce:string;reason_tag:string;
 submitted_by:string;request_key:string;request_digest:string;source_digest:string;status:string;case_ref:string|null;
 employee_name:string;employee_account_ref:string|null};
export type CorrectionSubmission={requestRef:string;sourceDigest:string;requestKey:string;employeeName:string;expectedVersion:number};
@Injectable()
export class HrAttendanceCorrectionSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 /** A named target requires a current HR grant and either current Foundation-root,
  * delegated branch, or actual current reporting-manager scope. */
 private async employee(tx:PoolClient,actor:VerifiedFoundationActor,reference:string|undefined,write=false){
  if(reference!==undefined){
   if(!EMP.test(reference))throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
   await this.identity.assertCurrent(tx,actor,"hr.attendance.correct");
  }else await this.identity.assertPatientSessionCurrent(tx,actor);
  // Named correction requires both CG01 action and live CG02 assignment.
  // Own attendance continues to match only the current actor account.
  const permitted=reference===undefined?[]:
   await this.branches.currentStaffBranchRefs(tx,actor.realmId,actor.accountId);
  const q=await tx.query<Employee>(`SELECT e.id,e.account_ref,app.legal_name AS name,a.branch_ref
   FROM hr_employee e JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
   JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
   JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
   WHERE e.root_realm_id=$1 AND e.status IN('ACTIVE','PROBATION')
    AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
    AND (($3::text IS NULL AND e.account_ref=$2) OR ($3::text IS NOT NULL AND e.employee_code=$3 AND
      (b.manager_account_ref=$2 OR b.id=ANY($4::uuid[]) OR
        EXISTS(SELECT 1 FROM hr_employee manager WHERE manager.id=a.manager_employee_ref
        AND manager.root_realm_id=e.root_realm_id AND manager.account_ref=$2 AND manager.status IN('ACTIVE','PROBATION'))
       OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id
        AND r.active AND r.is_protected WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL))))
   `+(write?"FOR UPDATE OF e FOR SHARE OF a,b":"FOR SHARE OF e,a,b"),
   [actor.realmId,actor.accountId,reference??null,permitted]);
  if(q.rows.length!==1)return null;
  return q.rows[0];
 }
 private async day(tx:PoolClient,realm:string,employee:string,date:string,lock=false){
  const q=await tx.query<Day>(`SELECT d.*,to_char(d.local_date,'YYYY-MM-DD') AS day,
   a.branch_ref,p.time_zone,p.work_start_local,p.work_end_local,p.break_minutes,p.grace_minutes,p.weekly_off_days
   FROM hr_attendance_day d JOIN hr_employment_assignment a ON a.id=d.assignment_id AND a.root_realm_id=d.root_realm_id
   JOIN hr_shift_policy p ON p.id=d.policy_id AND p.root_realm_id=d.root_realm_id
   WHERE d.root_realm_id=$1 AND d.employee_id=$2 AND d.local_date=$3::date
   `+(lock?"FOR UPDATE OF d FOR SHARE OF a,p":"FOR SHARE OF d,a,p"),[realm,employee,date]);
  if(!q.rows[0])throw new ConflictException({code:"CG10_CORRECTION_STALE"});
  return q.rows[0];
 }
 private async proposed(tx:PoolClient,d:Day,x:ReturnType<typeof parseAttendanceCorrection>):Promise<Snapshot>{
  if(d.status==="LEAVE"||d.leave_half_days===2)throw new ConflictException({code:"CG10_CORRECTION_LEAVE"});
  const current=snapshot(d);
  const weeklyOff=d.weekly_off_days.includes(new Date(d.day+"T00:00:00Z").getUTCDay());
  if(x.result==="WEEKLY_OFF"&&!weeklyOff||x.result==="ABSENT"&&weeklyOff)
   throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
  if(x.result!=="WORKED"){
   if(d.leave_half_days===1&&x.result==="WEEKLY_OFF")throw new ConflictException({code:"CG10_CORRECTION_LEAVE"});
   return {...current,status:d.leave_half_days===1?"HALF_DAY_LEAVE":x.result,
    checkInAt:null,checkOutAt:null,workedMinutes:null,version:current.version+1};
  }
  if(weeklyOff||!x.checkInLocal||!x.checkOutLocal)throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
  const times=await tx.query<{check_in:Date;check_out:Date;in_local:string;out_local:string;now:Date}>(`
   SELECT $1::timestamp AT TIME ZONE $3 AS check_in,$2::timestamp AT TIME ZONE $3 AS check_out,
    to_char(($1::timestamp AT TIME ZONE $3) AT TIME ZONE $3,'YYYY-MM-DD"T"HH24:MI') AS in_local,
    to_char(($2::timestamp AT TIME ZONE $3) AT TIME ZONE $3,'YYYY-MM-DD"T"HH24:MI') AS out_local,now() AS now`,
   [x.checkInLocal,x.checkOutLocal,d.time_zone]);
  const time=times.rows[0];
  if(!time||time.in_local!==x.checkInLocal||time.out_local!==x.checkOutLocal||
    time.check_out.getTime()>time.now.getTime()||time.check_out.getTime()<=time.check_in.getTime())
   throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
  let classified:{businessDate:string;late:boolean};
  let minutes:number;
  try{classified=shiftCheckInAt(time.check_in,d.time_zone,d.work_start_local,d.work_end_local,d.grace_minutes);
   minutes=verifiedWorkedMinutes(time.check_in,time.check_out,d.break_minutes);}
  catch{throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});}
  if(classified.businessDate!==d.day)throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
  return {...current,status:classified.late?"LATE":"PRESENT",checkInAt:time.check_in.toISOString(),
   checkOutAt:time.check_out.toISOString(),workedMinutes:minutes,version:current.version+1};
 }
 /** Authorized initial entry for a finished shift with no existing day. Corrections use CG03. */
 async recordNonworking(tx:PoolClient,actor:VerifiedFoundationActor,body:unknown){
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["requestKey","employeeReference","date","result"].includes(k)))
   throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
  const x=body as Record<string,unknown>,requestKey=leaveId(x.requestKey),date=leaveDate(x.date);
  if(typeof x.employeeReference!=="string"||!EMP.test(x.employeeReference)||(x.result!=="ABSENT"&&x.result!=="WEEKLY_OFF"))
   throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
  const employee=await this.employee(tx,actor,x.employeeReference,true);
  if(!employee||employee.account_ref===actor.accountId)throw new ForbiddenException("A different authorized HR actor must record this employee's attendance");
  const requestDigest=hash(["INITIAL_NONWORKING_DAY",actor.accountId,employee.id,date,x.result]);
  const old=await tx.query<{request_digest:string;employee_id:string;status:string;branch_ref:string}>(`
   SELECT ev.request_digest,ev.employee_id,d.status,a.branch_ref FROM hr_attendance_event ev
   JOIN hr_attendance_day d ON d.id=ev.attendance_day_id AND d.root_realm_id=ev.root_realm_id
   JOIN hr_employment_assignment a ON a.id=d.assignment_id AND a.root_realm_id=d.root_realm_id
   WHERE ev.root_realm_id=$1 AND ev.actor_ref=$2 AND ev.request_key=$3 FOR SHARE OF ev,d,a`,[actor.realmId,actor.accountId,requestKey]);
  if(old.rows[0]){
   if(old.rows[0].request_digest!==requestDigest||old.rows[0].employee_id!==employee.id||old.rows[0].branch_ref!==employee.branch_ref)
    throw new ConflictException({code:"CG10_CORRECTION_STALE"});
   return {recorded:true,date,status:old.rows[0].status,replayed:true};
  }
  const q=await tx.query<{assignment_id:string;shift_id:string;policy_id:string;weekly_off_days:number[]}>(`
   SELECT a.id AS assignment_id,s.id AS shift_id,p.id AS policy_id,p.weekly_off_days
   FROM hr_employment_assignment a JOIN hr_employee_shift s ON s.employee_id=a.employee_id AND s.root_realm_id=a.root_realm_id
   JOIN hr_shift_policy p ON p.id=s.policy_id AND p.root_realm_id=s.root_realm_id AND p.branch_ref=a.branch_ref
   WHERE a.root_realm_id=$1 AND a.employee_id=$2 AND a.branch_ref=$3
    AND a.valid_from<=$4::date AND (a.valid_to IS NULL OR a.valid_to>$4::date)
    AND s.valid_from<=$4::date AND (s.valid_to IS NULL OR s.valid_to>$4::date) AND p.effective_from<=$4::date
    AND ((($4::date+p.work_end_local)+CASE WHEN p.work_end_local<p.work_start_local THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE p.time_zone)<now()
    FOR SHARE OF a,s,p`,[actor.realmId,employee.id,employee.branch_ref,date]);
  if(q.rows.length!==1)throw new ConflictException("Choose a finished date with an effective shift in the employee's current branch");
  const d=q.rows[0],off=d.weekly_off_days.includes(new Date(date+"T00:00:00Z").getUTCDay());
  await assertAttendanceBeforeChange(tx,actor.realmId,employee.id,d.assignment_id,date);
  if((x.result==="WEEKLY_OFF")!==off)throw new BadRequestException("The selected result does not match the effective weekly-off policy");
  const inserted=await tx.query<{id:string}>(`INSERT INTO hr_attendance_day(root_realm_id,employee_id,assignment_id,shift_id,policy_id,local_date,status)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(root_realm_id,employee_id,local_date) DO NOTHING RETURNING id`,
   [actor.realmId,employee.id,d.assignment_id,d.shift_id,d.policy_id,date,x.result]);
  if(!inserted.rows[0])throw new ConflictException({code:"CG10_CORRECTION_STALE"});
  await tx.query(`INSERT INTO hr_attendance_event(root_realm_id,employee_id,attendance_day_id,actor_ref,request_key,request_digest,action)
   VALUES($1,$2,$3,$4,$5,$6,'INITIAL_NONWORKING_DAY')`,[actor.realmId,employee.id,inserted.rows[0].id,actor.accountId,requestKey,requestDigest]);
  return {recorded:true,date,status:x.result,replayed:false};
 }
 async prepare(tx:PoolClient,actor:VerifiedFoundationActor,body:unknown){
  const x=parseAttendanceCorrection(body),employee=await this.employee(tx,actor,x.employeeReference,true);
  if(!employee)throw new ForbiddenException("The current employee or branch is not available");
  const requestDigest=hash([actor.accountId,x.employeeReference??null,x.date,x.expectedVersion,x.result,x.checkInLocal,x.checkOutLocal,x.reason]);
  const previous=await tx.query<CorrectionRow>(`SELECT * FROM hr_attendance_change WHERE root_realm_id=$1
   AND submitted_by=$2 AND request_key=$3 FOR SHARE`,[actor.realmId,actor.accountId,x.requestKey]);
  if(previous.rows[0]){
   const p=previous.rows[0];
   if(p.employee_id!==employee.id||p.request_digest!==requestDigest||!p.case_ref)throw new ConflictException({code:"CG10_CORRECTION_STALE"});
   return {replay:true as const,requestRef:p.id,caseRef:p.case_ref};
  }
  // A client restart may lose its in-memory key; an identical pending command must still not create another case.
  const duplicate=await tx.query(`SELECT 1 FROM hr_attendance_change WHERE root_realm_id=$1 AND employee_id=$2
   AND submitted_by=$3 AND request_digest=$4 AND status='SUBMITTED' LIMIT 1`,
   [actor.realmId,employee.id,actor.accountId,requestDigest]);
  if(duplicate.rowCount)throw new ConflictException({code:"CG10_CORRECTION_DUPLICATE_PENDING"});
  const d=await this.day(tx,actor.realmId,employee.id,x.date,true);
  if(d.branch_ref!==employee.branch_ref||d.version!==x.expectedVersion)throw new ConflictException({code:"CG10_CORRECTION_STALE"});
  const before=snapshot(d),after=await this.proposed(tx,d,x);
  if(hash(projection(before))===hash(projection(after)))throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
  const ref=randomUUID(),reason=seal(x.reason,actor.realmId,ref);
  const digest=hash([employee.id,d.id,before,after,reason,actor.accountId]);
  await tx.query(`INSERT INTO hr_attendance_change(id,root_realm_id,employee_id,attendance_day_id,expected_version,
   original_snapshot,proposed_snapshot,reason_ciphertext,reason_nonce,reason_tag,submitted_by,request_key,request_digest,source_digest)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
   [ref,actor.realmId,employee.id,d.id,d.version,JSON.stringify(before),JSON.stringify(after),reason.ciphertext,reason.nonce,
    reason.tag,actor.accountId,x.requestKey,requestDigest,digest]);
  return {replay:false as const,requestRef:ref,sourceDigest:digest,requestKey:x.requestKey,employeeName:employee.name,expectedVersion:d.version};
 }
 async original(tx:PoolClient,realm:string,ref:string){
  const q=await tx.query<CorrectionRow>(`SELECT c.*,app.legal_name AS employee_name,e.account_ref AS employee_account_ref
   FROM hr_attendance_change c JOIN hr_employee e ON e.id=c.employee_id AND e.root_realm_id=c.root_realm_id
   JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
   WHERE c.root_realm_id=$1 AND c.id=$2`,[realm,ref]);
  if(!q.rows[0])throw new ConflictException({code:"CG10_CORRECTION_STALE"});
  return q.rows[0];
 }
 async link(tx:PoolClient,realm:string,ref:string,caseRef:string){
  const q=await tx.query("UPDATE hr_attendance_change SET case_ref=$3 WHERE root_realm_id=$1 AND id=$2 AND case_ref IS NULL RETURNING id",[realm,ref,caseRef]);
  if(!q.rowCount)throw new ConflictException({code:"CG10_CORRECTION_STALE"});
 }
 reason(row:CorrectionRow,realm:string){
  try{const d=createDecipheriv("aes-256-gcm",key(),Buffer.from(row.reason_nonce,"base64url"));
   d.setAAD(Buffer.from(realm+"|attendance-change|"+row.id));d.setAuthTag(Buffer.from(row.reason_tag,"base64url"));
   return Buffer.concat([d.update(Buffer.from(row.reason_ciphertext,"base64url")),d.final()]).toString("utf8");
  }catch{throw new ServiceUnavailableException("The private correction reason is unavailable");}
 }
 summary(row:CorrectionRow){
  return {employeeName:row.employee_name,status:row.status,original:projection(row.original_snapshot),proposed:projection(row.proposed_snapshot)};
 }
 async history(tx:PoolClient,actor:VerifiedFoundationActor,employeeReference:unknown){
  if(employeeReference!==undefined&&typeof employeeReference!=="string")throw new BadRequestException({code:"CG10_CORRECTION_INVALID"});
  const employee=await this.employee(tx,actor,employeeReference);
  if(!employee)return {linked:false,items:[]};
  const q=await tx.query<CorrectionRow&{case_number:string;case_status:string}>(`
   SELECT h.*,c.case_number,c.status AS case_status FROM hr_attendance_change h JOIN cg03_case c
    ON c.id=h.case_ref AND c.realm_id=h.root_realm_id AND c.case_kind='ATTENDANCE_CORRECTION'
    AND c.hr_attendance_change_id=h.id AND c.hr_attendance_change_digest=h.source_digest
   JOIN hr_attendance_day d ON d.id=h.attendance_day_id AND d.root_realm_id=h.root_realm_id
   JOIN hr_employment_assignment a ON a.id=d.assignment_id AND a.root_realm_id=d.root_realm_id
   WHERE h.root_realm_id=$1 AND h.employee_id=$2 AND ($3::boolean OR a.branch_ref=$4)
   ORDER BY h.submitted_at DESC,h.id DESC LIMIT 50`,[actor.realmId,employee.id,!employeeReference,employee.branch_ref]);
  return {linked:true,items:q.rows.map(x=>({reference:x.case_number,caseStatus:x.case_status,...this.summary({...x,employee_name:employee.name})}))};
 }
 async validateApproval(tx:PoolClient,realm:string,row:CorrectionRow){
  const employee=await tx.query<{id:string;branch_ref:string}>(`SELECT e.id,a.branch_ref FROM hr_employee e
   JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
   JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
   WHERE e.root_realm_id=$1 AND e.id=$2 AND e.status IN('ACTIVE','PROBATION')
   AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
   FOR UPDATE OF e FOR SHARE OF a,b`,[realm,row.employee_id]);
  if(employee.rows.length!==1)throw new ConflictException({code:"CG10_CORRECTION_STALE"});
  const d=await this.day(tx,realm,row.employee_id,row.original_snapshot.date,true);
  const current=snapshot(d);
  if(d.id!==row.attendance_day_id||d.branch_ref!==employee.rows[0].branch_ref||d.version!==row.expected_version||
   hash([projection(current),current.assignmentRef,current.shiftRef,current.policyRef,current.version])!==
   hash([projection(row.original_snapshot),row.original_snapshot.assignmentRef,row.original_snapshot.shiftRef,row.original_snapshot.policyRef,row.original_snapshot.version])||d.status==="LEAVE"||d.leave_half_days===2)
   throw new ConflictException({code:"CG10_CORRECTION_STALE"});
  return d;
 }
 async applyDecision(tx:PoolClient,realm:string,row:CorrectionRow,decisionRef:string,action:"APPROVE"|"RETURN"|"REJECT"){
  const next=action==="APPROVE"?"APPROVED":action==="RETURN"?"RETURNED":"REJECTED";
  if(action==="APPROVE"){
   const p=row.proposed_snapshot;
   const updated=await tx.query(`UPDATE hr_attendance_day SET status=$4,checked_in_at=$5,checked_out_at=$6,worked_minutes=$7,version=version+1
    WHERE root_realm_id=$1 AND id=$2 AND version=$3 RETURNING id`,
    [realm,row.attendance_day_id,row.expected_version,p.status,p.checkInAt,p.checkOutAt,p.workedMinutes]);
   if(!updated.rowCount)throw new ConflictException({code:"CG10_CORRECTION_STALE"});
  }
  const changed=await tx.query(`UPDATE hr_attendance_change SET status=$3,decision_ref=$4,decided_at=now()
    WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' RETURNING id`,[realm,row.id,next,decisionRef]);
  if(!changed.rowCount)throw new ConflictException({code:"CG10_CORRECTION_STALE"});
 }
}
