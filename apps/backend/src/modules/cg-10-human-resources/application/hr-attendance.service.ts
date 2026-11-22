import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const EMP=/^CG-HR-EMP-[0-9]{6,}$/;
const id=(v:unknown,label:string)=>{if(typeof v!=="string"||!UUID.test(v))
 throw new BadRequestException("Choose a valid "+label);return v;};
const date=(v:unknown)=>{if(typeof v!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(v)||
 Number.isNaN(Date.parse(v))||new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)
 throw new BadRequestException("Choose a real effective date");return v;};
const input=(v:unknown,names:string[])=>{if(!v||typeof v!=="object"||Array.isArray(v)||
 Object.keys(v).some(k=>!names.includes(k)))
 throw new BadRequestException("Check the shift or attendance form");return v as Record<string,unknown>;};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const sqlDate=(x:Date|string)=>typeof x==="string"?x.slice(0,10):
 [x.getFullYear(),String(x.getMonth()+1).padStart(2,"0"),
  String(x.getDate()).padStart(2,"0")].join("-");
const hm=(v:unknown)=>{if(typeof v!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
 throw new BadRequestException("Enter a valid 24-hour shift time");return v;};
const isoTime=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const local=(d:Date,timeZone:string)=>{const parts=new Intl.DateTimeFormat("en-GB",{
 timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",
 minute:"2-digit",hourCycle:"h23"}).formatToParts(d);
 const get=(type:string)=>parts.find(p=>p.type===type)?.value??"";
 return {day:`${get("year")}-${get("month")}-${get("day")}`,
  minute:Number(get("hour"))*60+Number(get("minute"))};};
const previous=(s:string)=>new Date(Date.parse(s+"T00:00:00Z")-86400000)
 .toISOString().slice(0,10);
/** A check-in uses the database instant and the original shift time zone, not a client clock. */
export function verifiedWorkedMinutes(checkInAt:Date,checkOutAt:Date,breakMinutes:number){
 const elapsed=Math.floor((checkOutAt.getTime()-checkInAt.getTime())/60000);
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>2160||
  !Number.isInteger(breakMinutes)||breakMinutes<0||breakMinutes>720)
  throw new ConflictException("Working time is not within the verified shift window");
 return Math.max(0,elapsed-breakMinutes);
}
export function shiftCheckInAt(instant:Date,timezone:string,startText:string,
 endText:string,graceMinutes:number){
 const clock=local(instant,timezone),start=isoTime(startText),end=isoTime(endText);
 const overnight=end<start;
 if(overnight ? (clock.minute>=end&&clock.minute<start)
              : (clock.minute<start||clock.minute>=end))
  throw new ConflictException("Check-in is outside your assigned shift window");
 const afterStart=overnight&&clock.minute<end?
  (1440-start+clock.minute):clock.minute-start;
 return {businessDate:overnight&&clock.minute<end?previous(clock.day):clock.day,
  late:afterStart>graceMinutes};
}
/** Annual entitlement is stored in integer half-day units, not floating balances. */
export function leavePolicyInput(body:unknown){
 const v=input(body,["requestKey","leaveType","annualHalfDays","allowHalfDays","countWeeklyOff","effectiveFrom"]);
 const requestKey=id(v.requestKey,"save request");
 const leaveType=typeof v.leaveType==="string"?v.leaveType.trim().replace(/\s+/g," "):"";
 if(leaveType.length<2||leaveType.length>80||/[\u0000-\u001f\u007f]/.test(leaveType))
  throw new BadRequestException("Enter a valid leave type");
 if(typeof v.annualHalfDays!=="number"||!Number.isInteger(v.annualHalfDays)||
  v.annualHalfDays<1||v.annualHalfDays>732||typeof v.allowHalfDays!=="boolean"||
  typeof v.countWeeklyOff!=="boolean"||(!v.allowHalfDays&&v.annualHalfDays%2!==0))
  throw new BadRequestException("Check annual leave days and half-day settings");
 return {requestKey,leaveType,typeKey:leaveType.toLowerCase(),annualHalfDays:v.annualHalfDays,
  allowHalfDays:v.allowHalfDays,countWeeklyOff:v.countWeeklyOff,effectiveFrom:date(v.effectiveFrom)};
}
type LeaveRule={id:string;leave_type:string;annual_half_days:number;allow_half_days:boolean;
 count_weekly_off:boolean;effective_from:Date|string;effective_to:Date|string|null;version:number};
type Rule={id:string;name:string;time_zone:string;work_start_local:string;
 work_end_local:string;grace_minutes:number;break_minutes:number;
 weekly_off_days:number[];effective_from:Date|string;branch_ref:string};
type Shift=Rule&{shift_id:string;assignment_id:string;employee_id:string};
@Injectable()
export class HrAttendanceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 async leavePolicies(token:string){
  const actor=await this.sessions.requireAction(token,"hr.leave.policies.manage");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.leave.policies.manage");
   const q=await tx.query<LeaveRule>(`SELECT id,leave_type,annual_half_days,allow_half_days,
    count_weekly_off,effective_from,effective_to,version FROM hr_leave_policy
    WHERE root_realm_id=$1 ORDER BY effective_from DESC,id DESC LIMIT 101`,[actor.realmId]);
   await tx.query("COMMIT");
   return {items:q.rows.slice(0,100).map(x=>({policyRef:x.id,leaveType:x.leave_type,
    annualHalfDays:x.annual_half_days,allowHalfDays:x.allow_half_days,countWeeklyOff:x.count_weekly_off,
    effectiveFrom:sqlDate(x.effective_from),effectiveTo:x.effective_to?sqlDate(x.effective_to):null,
    version:x.version})),hasMore:q.rows.length>100};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async createLeavePolicy(token:string,body:unknown){
  const actor=await this.sessions.requireAction(token,"hr.leave.policies.manage");
  const v=leavePolicyInput(body);
  const hash=digest([actor.accountId,v.typeKey,v.leaveType,v.annualHalfDays,
   v.allowHalfDays,v.countWeeklyOff,v.effectiveFrom]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const root=await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
    [actor.realmId]);
   if(!root.rowCount)throw new ForbiddenException("Foundation leave policy access is unavailable");
   await this.identity.assertCurrent(tx,actor,"hr.leave.policies.manage");
   const replay=await tx.query<{request_digest:string}>("SELECT request_digest FROM hr_leave_policy WHERE root_realm_id=$1 AND request_key=$2",
    [actor.realmId,v.requestKey]);
   if(replay.rows[0]){
    if(replay.rows[0].request_digest!==hash)throw new ConflictException("This leave policy request was used for another change");
    await tx.query("COMMIT");return {saved:true,replayed:true};
   }
   const prior=await tx.query<{id:string;effective_from:Date|string;version:number}>(`
    SELECT id,effective_from,version FROM hr_leave_policy WHERE root_realm_id=$1
    AND type_key=$2 AND effective_to IS NULL FOR UPDATE`,[actor.realmId,v.typeKey]);
   if(prior.rows[0]){
    if(sqlDate(prior.rows[0].effective_from)>=v.effectiveFrom)
     throw new ConflictException("A new leave policy version must begin after the previous version");
    await tx.query("UPDATE hr_leave_policy SET effective_to=$3 WHERE root_realm_id=$1 AND id=$2",
     [actor.realmId,prior.rows[0].id,v.effectiveFrom]);
   }
   await tx.query(`INSERT INTO hr_leave_policy(root_realm_id,leave_type,type_key,
    annual_half_days,allow_half_days,count_weekly_off,effective_from,version,created_by,request_key,request_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [actor.realmId,v.leaveType,v.typeKey,v.annualHalfDays,v.allowHalfDays,v.countWeeklyOff,
     v.effectiveFrom,(prior.rows[0]?.version??0)+1,actor.accountId,v.requestKey,hash]);
   await tx.query("COMMIT");return {saved:true,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async allowedBranch(tx:PoolClient,actor:VerifiedFoundationActor,branchRef:string){
  const q=await tx.query<{id:string}>(`SELECT b.id FROM branch b WHERE b.id=$1
   AND b.root_realm_id=$2 AND b.status='ACTIVE'
   AND (b.manager_account_ref=$3 OR EXISTS(
    SELECT 1 FROM account_role ar
    JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active
    LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin'
    WHERE ar.account_id=$3 AND ar.realm_id=$2 AND ar.revoked_at IS NULL
    AND (r.is_protected OR g.capability_key IS NOT NULL))) FOR SHARE OF b`,
   [branchRef,actor.realmId,actor.accountId]);
  if(!q.rowCount)throw new ForbiddenException("This branch is not available for your staff action");
 }
 async policies(token:string,branchInput:string){
  const actor=await this.sessions.requireAction(token,"hr.attendance.view");
  const branch=id(branchInput,"branch"),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.attendance.view");
   await this.allowedBranch(tx,actor,branch);
   const q=await tx.query<Rule>(`SELECT id,branch_ref,name,time_zone,work_start_local,
    work_end_local,break_minutes,grace_minutes,weekly_off_days,effective_from
    FROM hr_shift_policy WHERE root_realm_id=$1 AND branch_ref=$2
    ORDER BY effective_from DESC,id DESC LIMIT 50`,[actor.realmId,branch]);
   await tx.query("COMMIT");
   return {items:q.rows.map(x=>({policyRef:x.id,label:x.name,
    timeZone:x.time_zone,start:x.work_start_local.slice(0,5),
    end:x.work_end_local.slice(0,5),graceMinutes:x.grace_minutes,
    breakMinutes:x.break_minutes,weeklyOffDays:x.weekly_off_days,
    effectiveFrom:sqlDate(x.effective_from)}))};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async createPolicy(token:string,body:unknown){
  const actor=await this.sessions.requireAction(token,"hr.shifts.manage");
  const v=input(body,["requestKey","branchRef","name","timeZone","start","end",
   "graceMinutes","breakMinutes","weeklyOffDays","effectiveFrom"]);
  const requestKey=id(v.requestKey,"save request"),branch=id(v.branchRef,"branch");
  const name=typeof v.name==="string"?v.name.trim():"";
  if(name.length<2||name.length>100)throw new BadRequestException("Name the shift");
  const start=hm(v.start),end=hm(v.end),effectiveFrom=date(v.effectiveFrom);
  if(start===end)throw new BadRequestException("Shift start and end must differ");
  const timeZone=v.timeZone;
  if(typeof timeZone!=="string"||timeZone.length>80||timeZone.length<3)
   throw new BadRequestException("Choose an IANA shift time zone");
  try{new Intl.DateTimeFormat("en-GB",{timeZone}).format(new Date());}
  catch{throw new BadRequestException("Choose a supported shift time zone");}
  const grace=Number(v.graceMinutes),breakMinutes=Number(v.breakMinutes);
  if(!Number.isInteger(grace)||grace<0||grace>180||
     !Number.isInteger(breakMinutes)||breakMinutes<0||breakMinutes>720)
   throw new BadRequestException("Check shift break and grace minutes");
  if(!Array.isArray(v.weeklyOffDays)||v.weeklyOffDays.length>7||
   v.weeklyOffDays.some(n=>!Number.isInteger(n)||n<0||n>6)||
   new Set(v.weeklyOffDays).size!==v.weeklyOffDays.length)
   throw new BadRequestException("Choose valid weekly days off");
  const duration=(isoTime(end)-isoTime(start)+1440)%1440;
  if(breakMinutes>=duration)
   throw new BadRequestException("Break must be shorter than the actual shift");
  const weekly=[...v.weeklyOffDays].sort();
  const hash=digest([actor.accountId,branch,name,timeZone,start,end,grace,breakMinutes,weekly,effectiveFrom]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.shifts.manage");
   await this.allowedBranch(tx,actor,branch);
   const q=await tx.query<{id:string;request_digest:string}>(`INSERT INTO hr_shift_policy(
    root_realm_id,branch_ref,name,time_zone,work_start_local,work_end_local,
    grace_minutes,break_minutes,weekly_off_days,effective_from,created_by,
    request_key,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT(root_realm_id,request_key) DO NOTHING RETURNING id,request_digest`,
    [actor.realmId,branch,name,timeZone,start,end,grace,breakMinutes,weekly,effectiveFrom,
     actor.accountId,requestKey,hash]);
   const row=q.rows[0]??(await tx.query<{id:string;request_digest:string}>(
    "SELECT id,request_digest FROM hr_shift_policy WHERE root_realm_id=$1 AND request_key=$2",
    [actor.realmId,requestKey])).rows[0];
   if(!row||row.request_digest!==hash)
    throw new ConflictException("This shift save request belongs to another change");
   await tx.query("COMMIT");
   return {policyRef:row.id,saved:true,replayed:!q.rows[0]};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async assign(token:string,body:unknown){
  const actor=await this.sessions.requireAction(token,"hr.shifts.manage");
  const v=input(body,["requestKey","employeeReference","policyRef","validFrom"]);
  const requestKey=id(v.requestKey,"save request"),policyRef=id(v.policyRef,"shift");
  if(typeof v.employeeReference!=="string"||!EMP.test(v.employeeReference))
   throw new BadRequestException("Choose an approved employee");
  const from=date(v.validFrom);
  const hash=digest([actor.accountId,v.employeeReference,policyRef,from]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.shifts.manage");
   const existing=await tx.query<{id:string;request_digest:string;employee_id:string}>(
    "SELECT id,request_digest,employee_id FROM hr_employee_shift WHERE root_realm_id=$1 AND request_key=$2",
    [actor.realmId,requestKey]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==hash)
     throw new ConflictException("This shift assignment request was changed");
    const allowed=await tx.query<{branch_ref:string}>(`SELECT a.branch_ref
     FROM hr_employee e JOIN hr_employment_assignment a
     ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
     WHERE e.id=$1 AND e.root_realm_id=$2
     AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
     FOR SHARE OF e,a`,[existing.rows[0].employee_id,actor.realmId]);
    if(allowed.rows.length!==1)
     throw new ForbiddenException("The employee's current branch cannot be verified");
    await this.allowedBranch(tx,actor,allowed.rows[0].branch_ref);
    await tx.query("COMMIT");return {assigned:true,replayed:true};
   }
   const employee=await tx.query<{id:string;branch_ref:string;valid_from:Date|string}>(`
    SELECT e.id,a.branch_ref,a.valid_from FROM hr_employee e
    JOIN hr_employment_assignment a ON a.employee_id=e.id
    AND a.root_realm_id=e.root_realm_id
    WHERE e.root_realm_id=$1 AND e.employee_code=$2
    AND e.status IN('ACTIVE','PROBATION','PENDING_ACCESS')
    AND a.valid_from<=$3::date AND (a.valid_to IS NULL OR a.valid_to>$3::date)
    FOR UPDATE OF e`,[actor.realmId,v.employeeReference,from]);
   if(employee.rows.length!==1)throw new NotFoundException("Select a current approved employee");
   const target=employee.rows[0];
   await this.allowedBranch(tx,actor,target.branch_ref);
   const policy=await tx.query<{id:string}>(`SELECT id FROM hr_shift_policy
    WHERE id=$1 AND root_realm_id=$2 AND branch_ref=$3 AND effective_from<=$4::date
    FOR SHARE`,[policyRef,actor.realmId,target.branch_ref,from]);
   if(!policy.rowCount)throw new ConflictException("Choose a current shift for this employee's branch");
   const active=await tx.query<{id:string;valid_from:Date|string}>(`SELECT id,valid_from
    FROM hr_employee_shift WHERE root_realm_id=$1 AND employee_id=$2
    AND valid_to IS NULL FOR UPDATE`,[actor.realmId,target.id]);
   if(active.rows[0]){
    if(sqlDate(active.rows[0].valid_from)>=from)
     throw new ConflictException("Shift changes must start after the previous assignment");
    await tx.query("UPDATE hr_employee_shift SET valid_to=$3 WHERE id=$1 AND root_realm_id=$2",
      [active.rows[0].id,actor.realmId,from]);
   }
   await tx.query(`INSERT INTO hr_employee_shift(root_realm_id,employee_id,policy_id,
    valid_from,created_by,request_key,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [actor.realmId,target.id,policyRef,from,actor.accountId,requestKey,hash]);
   await tx.query("COMMIT");
   return {assigned:true,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async self(tx:PoolClient,actor:VerifiedFoundationActor,forWrite=false){
  await this.identity.assertPatientSessionCurrent(tx,actor);
  const q=await tx.query<{id:string;status:string}>(`SELECT id,status FROM hr_employee
   WHERE root_realm_id=$1 AND account_ref=$2
   AND status IN('ACTIVE','PROBATION') `+(forWrite?"FOR UPDATE":"FOR SHARE"),
   [actor.realmId,actor.accountId]);
  return q.rows[0]??null;
 }
 private async shift(tx:PoolClient,actor:VerifiedFoundationActor,employeeId:string){
  const q=await tx.query<Shift>(`SELECT s.id AS shift_id,a.id AS assignment_id,
   e.id AS employee_id,p.id,p.name,p.time_zone,p.work_start_local,p.work_end_local,
   p.grace_minutes,p.break_minutes,p.weekly_off_days,p.effective_from,p.branch_ref
   FROM hr_employee e
   JOIN hr_employment_assignment a ON a.employee_id=e.id
    AND a.root_realm_id=e.root_realm_id
   JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
   JOIN hr_employee_shift s ON s.employee_id=e.id AND s.root_realm_id=e.root_realm_id
   JOIN hr_shift_policy p ON p.id=s.policy_id AND p.root_realm_id=e.root_realm_id
    AND p.branch_ref=a.branch_ref
   CROSS JOIN LATERAL (
    SELECT CASE WHEN p.work_end_local<p.work_start_local AND
      (now() AT TIME ZONE p.time_zone)::time<p.work_end_local
      THEN (now() AT TIME ZONE p.time_zone)::date-1
      ELSE (now() AT TIME ZONE p.time_zone)::date END AS local_shift_date
   ) clock
   WHERE e.root_realm_id=$1 AND e.id=$2
    AND a.valid_from<=clock.local_shift_date
    AND (a.valid_to IS NULL OR a.valid_to>clock.local_shift_date)
    AND s.valid_from<=clock.local_shift_date
    AND (s.valid_to IS NULL OR s.valid_to>clock.local_shift_date)
    AND p.effective_from<=clock.local_shift_date
   FOR SHARE OF a,b,s,p`,
   [actor.realmId,employeeId]);
  return q.rows[0]??null;
 }
 /** Staff attendance read has narrower direct-report scope than shift management. */
 async attendanceBranches(token:string){
  const actor=await this.sessions.requireAction(token,"hr.attendance.view"),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,actor,"hr.attendance.view");
   const q=await tx.query<{id:string;name:string;broad:boolean}>(`SELECT b.id,b.name,(b.manager_account_ref=$2 OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
 AND r.realm_id=ar.realm_id AND r.active
 LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin'
 WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL AND (r.is_protected OR g.capability_key IS NOT NULL))) AS broad
    FROM branch b WHERE b.root_realm_id=$1 AND b.status='ACTIVE' AND ((b.manager_account_ref=$2 OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
 AND r.realm_id=ar.realm_id AND r.active
 LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin'
 WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL AND (r.is_protected OR g.capability_key IS NOT NULL))) OR EXISTS(SELECT 1 FROM hr_employment_assignment a JOIN hr_employee e ON e.id=a.employee_id AND e.root_realm_id=a.root_realm_id
 JOIN hr_employee m ON m.id=a.manager_employee_ref AND m.root_realm_id=a.root_realm_id
 WHERE a.root_realm_id=$1 AND a.branch_ref=b.id AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
 AND e.status IN('ACTIVE','PROBATION','ON_HOLD','PENDING_ACCESS') AND m.account_ref=$2 AND m.status IN('ACTIVE','PROBATION')))
    ORDER BY b.name,b.id LIMIT 100`,[actor.realmId,actor.accountId]);
   await tx.query("COMMIT");return {items:q.rows.map(x=>({branchRef:x.id,label:x.name,manageShifts:x.broad}))};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async matrix(token:string,branchInput:string,monthInput:string,offsetInput:unknown){
  const actor=await this.sessions.requireAction(token,"hr.attendance.view");
  const branch=id(branchInput,"branch");
  if(typeof monthInput!=="string"||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(monthInput))
   throw new BadRequestException("Choose a valid attendance month");
  const offset=Number(offsetInput??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)
   throw new BadRequestException("Choose a valid attendance page");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.attendance.view");
   const scope=await tx.query<{broad:boolean}>(`SELECT (b.manager_account_ref=$2 OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
 AND r.realm_id=ar.realm_id AND r.active
 LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin'
 WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL AND (r.is_protected OR g.capability_key IS NOT NULL))) AS broad FROM branch b WHERE b.root_realm_id=$1 AND b.id=$3 AND b.status='ACTIVE' AND ((b.manager_account_ref=$2 OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
 AND r.realm_id=ar.realm_id AND r.active
 LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin'
 WHERE ar.account_id=$2 AND ar.realm_id=$1 AND ar.revoked_at IS NULL AND (r.is_protected OR g.capability_key IS NOT NULL))) OR EXISTS(SELECT 1 FROM hr_employment_assignment a JOIN hr_employee e ON e.id=a.employee_id AND e.root_realm_id=a.root_realm_id
 JOIN hr_employee m ON m.id=a.manager_employee_ref AND m.root_realm_id=a.root_realm_id
 WHERE a.root_realm_id=$1 AND a.branch_ref=b.id AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
 AND e.status IN('ACTIVE','PROBATION','ON_HOLD','PENDING_ACCESS') AND m.account_ref=$2 AND m.status IN('ACTIVE','PROBATION'))) FOR SHARE OF b`,[actor.realmId,actor.accountId,branch]);
   if(!scope.rows[0])throw new ForbiddenException("This branch is not available for your attendance view");
   const rows=await tx.query<{employee_code:string;legal_name:string;designation:string;
    days:Array<{date:string;status:string;version:number;timeZone:string;checkInLocal:string|null;checkOutLocal:string|null}>}>(`SELECT e.employee_code,
    app.legal_name,a.designation,
    COALESCE(jsonb_agg(jsonb_build_object(
      'date',to_char(d.local_date,'YYYY-MM-DD'),'status',d.status,'leaveDays',COALESCE(d.leave_half_days,0)/2.0,
      'version',d.version,'timeZone',dp.time_zone,
      'checkInLocal',to_char(d.checked_in_at AT TIME ZONE dp.time_zone,'YYYY-MM-DD"T"HH24:MI'),
      'checkOutLocal',to_char(d.checked_out_at AT TIME ZONE dp.time_zone,'YYYY-MM-DD"T"HH24:MI'))
      ORDER BY d.local_date) FILTER(WHERE d.id IS NOT NULL),'[]'::jsonb) AS days
    FROM hr_employee e
    JOIN hr_employee_application app ON app.id=e.application_id
      AND app.root_realm_id=e.root_realm_id
    JOIN hr_employment_assignment a ON a.employee_id=e.id
      AND a.root_realm_id=e.root_realm_id
      AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
    LEFT JOIN hr_attendance_day d ON d.employee_id=e.id AND d.root_realm_id=e.root_realm_id
      AND d.local_date>=$3::date AND d.local_date<($3::date+interval '1 month')
      AND EXISTS(SELECT 1 FROM hr_employment_assignment da WHERE da.id=d.assignment_id
        AND da.root_realm_id=d.root_realm_id AND da.branch_ref=$2)
    LEFT JOIN hr_shift_policy dp ON dp.id=d.policy_id AND dp.root_realm_id=d.root_realm_id
    WHERE e.root_realm_id=$1 AND a.branch_ref=$2
      AND ($5::boolean OR EXISTS(SELECT 1 FROM hr_employee m WHERE m.id=a.manager_employee_ref AND m.root_realm_id=a.root_realm_id AND m.account_ref=$6 AND m.status IN('ACTIVE','PROBATION')))
      AND e.status IN('ACTIVE','PROBATION','ON_HOLD','PENDING_ACCESS')
    GROUP BY e.id,e.employee_code,app.legal_name,a.designation
    ORDER BY app.legal_name,e.id LIMIT 26 OFFSET $4`,
    [actor.realmId,branch,monthInput+"-01",offset,scope.rows[0].broad,actor.accountId]);
   await tx.query("COMMIT");
   return {month:monthInput,items:rows.rows.slice(0,25).map(x=>({
    employeeReference:x.employee_code,employeeName:x.legal_name,designation:x.designation,days:x.days})),
    hasMore:rows.rows.length>25,offset};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async mine(token:string){
  const actor=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const employee=await this.self(tx,actor);
   if(!employee){await tx.query("COMMIT");return {status:"NOT_LINKED",days:[]};}
   const rule=await this.shift(tx,actor,employee.id);
   const rows=await tx.query<{local_date:Date|string;status:string;checked_in_at:Date|string|null;
    checked_out_at:Date|string|null;worked_minutes:number|null;leave_half_days:number|null;version:number;
    time_zone:string;check_in_local:string|null;check_out_local:string|null}>(`
    SELECT d.local_date,d.status,d.checked_in_at,d.checked_out_at,d.worked_minutes,d.leave_half_days,d.version,p.time_zone,
     to_char(d.checked_in_at AT TIME ZONE p.time_zone,'YYYY-MM-DD"T"HH24:MI') AS check_in_local,
     to_char(d.checked_out_at AT TIME ZONE p.time_zone,'YYYY-MM-DD"T"HH24:MI') AS check_out_local
    FROM hr_attendance_day d JOIN hr_shift_policy p ON p.id=d.policy_id AND p.root_realm_id=d.root_realm_id
    WHERE d.root_realm_id=$1 AND d.employee_id=$2
    ORDER BY d.local_date DESC LIMIT 35`,[actor.realmId,employee.id]);
   const open=await tx.query<{available:boolean}>(`SELECT EXISTS(SELECT 1 FROM hr_attendance_day WHERE root_realm_id=$1 AND employee_id=$2 AND checked_out_at IS NULL AND checked_in_at BETWEEN now()-interval '36 hours' AND now()) AS available`,[actor.realmId,employee.id]);
   await tx.query("COMMIT");
   return {status:rule?"ASSIGNED":"NO_CURRENT_SHIFT",
    shift:rule?{label:rule.name,timeZone:rule.time_zone,
      start:rule.work_start_local.slice(0,5),end:rule.work_end_local.slice(0,5),
      weeklyOffDays:rule.weekly_off_days}:null,
    canCheckOut:open.rows[0]?.available===true,
    days:rows.rows.map(x=>({date:sqlDate(x.local_date),status:x.status,
      checkInAt:x.checked_in_at?new Date(x.checked_in_at).toISOString():null,
      leaveDays:(x.leave_half_days??0)/2,version:x.version,timeZone:x.time_zone,
      checkInLocal:x.check_in_local,checkOutLocal:x.check_out_local,
      checkOutAt:x.checked_out_at?new Date(x.checked_out_at).toISOString():null,
      workedMinutes:x.worked_minutes}))};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async checkIn(token:string,body:unknown){
  const actor=await this.sessions.verifySession(token);
  const v=input(body,["requestKey"]),requestKey=id(v.requestKey,"check-in request");
  const requestDigest=digest(["CHECK_IN",actor.accountId]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const employee=await this.self(tx,actor,true);
   if(!employee)throw new ForbiddenException("Your approved active employment is unavailable");
   const previousEvent=await tx.query<{request_digest:string;local_date:Date|string;status:string}>(`
    SELECT ev.request_digest,d.local_date,d.status FROM hr_attendance_event ev
    JOIN hr_attendance_day d ON d.id=ev.attendance_day_id AND d.root_realm_id=ev.root_realm_id
    WHERE ev.root_realm_id=$1 AND ev.actor_ref=$2 AND ev.request_key=$3 FOR SHARE OF ev,d`,
    [actor.realmId,actor.accountId,requestKey]);
   if(previousEvent.rows[0]){
    if(previousEvent.rows[0].request_digest!==requestDigest)
     throw new ConflictException("This check-in request was used for another action");
    await tx.query("COMMIT");
    return {recorded:true,date:sqlDate(previousEvent.rows[0].local_date),
      status:previousEvent.rows[0].status,replayed:true};
   }
   const rule=await this.shift(tx,actor,employee.id);
   if(!rule)throw new ConflictException("Ask HR to assign your current branch shift before checking in");
   const now=(await tx.query<{now:Date}>("SELECT CURRENT_TIMESTAMP AS now")).rows[0].now;
   const clock=shiftCheckInAt(now,rule.time_zone,rule.work_start_local,
    rule.work_end_local,Number(rule.grace_minutes));
   const businessDate=clock.businessDate;
   if(sqlDate(rule.effective_from)>businessDate)
    throw new ConflictException("Your shift is not yet effective for this attendance day");
   if(rule.weekly_off_days.includes(new Date(businessDate+"T00:00:00Z").getUTCDay()))
    throw new ConflictException("Today is a scheduled weekly day off");
   const prior=await tx.query<{id:string;status:string;assignment_id:string;shift_id:string;policy_id:string}>(`
    SELECT id,status,assignment_id,shift_id,policy_id FROM hr_attendance_day WHERE root_realm_id=$1
    AND employee_id=$2 AND local_date=$3 FOR UPDATE`,[actor.realmId,employee.id,businessDate]);
   const existing=prior.rows[0];
   if(existing&&(existing.status!=="HALF_DAY_LEAVE"||existing.assignment_id!==rule.assignment_id||
     existing.shift_id!==rule.shift_id||existing.policy_id!==rule.id))
    throw new ConflictException(existing.status==="LEAVE"?"Approved leave is recorded for this date":"Check-in is already recorded or the shift changed");
   const open=await tx.query(`SELECT 1 FROM hr_attendance_day
    WHERE root_realm_id=$1 AND employee_id=$2 AND checked_out_at IS NULL
    AND checked_in_at>now()-interval '36 hours' FOR UPDATE`,
    [actor.realmId,employee.id]);
   if(open.rowCount)throw new ConflictException("Complete your previous check-out before a new check-in");
   const status=clock.late?"LATE":"PRESENT";
   const day=existing?await tx.query<{id:string}>(`UPDATE hr_attendance_day SET status=$3,checked_in_at=$4,version=version+1 WHERE root_realm_id=$1 AND id=$2 AND status='HALF_DAY_LEAVE' RETURNING id`,[actor.realmId,existing.id,status,now]):await tx.query<{id:string}>(`INSERT INTO hr_attendance_day(
    root_realm_id,employee_id,assignment_id,shift_id,policy_id,local_date,
    status,checked_in_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [actor.realmId,employee.id,rule.assignment_id,rule.shift_id,rule.id,
     businessDate,status,now]);
   await tx.query(`INSERT INTO hr_attendance_event(root_realm_id,employee_id,
    attendance_day_id,actor_ref,request_key,request_digest,action)
    VALUES($1,$2,$3,$4,$5,$6,'CHECK_IN')`,
    [actor.realmId,employee.id,day.rows[0].id,actor.accountId,requestKey,requestDigest]);
   await tx.query("COMMIT");
   return {recorded:true,date:businessDate,status,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async checkOut(token:string,body:unknown){
  const actor=await this.sessions.verifySession(token);
  const v=input(body,["requestKey"]),requestKey=id(v.requestKey,"check-out request");
  const hash=digest(["CHECK_OUT",actor.accountId]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const employee=await this.self(tx,actor,true);
   if(!employee)throw new ForbiddenException("Your current approved employment is unavailable");
   const previous=await tx.query<{request_digest:string;local_date:Date|string;
    status:string;worked_minutes:number|null}>(`SELECT ev.request_digest,
    d.local_date,d.status,d.worked_minutes
    FROM hr_attendance_event ev JOIN hr_attendance_day d
    ON d.id=ev.attendance_day_id AND d.root_realm_id=ev.root_realm_id
    WHERE ev.root_realm_id=$1 AND ev.actor_ref=$2 AND ev.request_key=$3
    FOR SHARE OF ev,d`,[actor.realmId,actor.accountId,requestKey]);
   if(previous.rows[0]){
    if(previous.rows[0].request_digest!==hash)
     throw new ConflictException("This check-out request is not an original checkout");
    await tx.query("COMMIT");
    return {recorded:true,replayed:true,date:sqlDate(previous.rows[0].local_date),
      status:previous.rows[0].status,workedMinutes:previous.rows[0].worked_minutes};
   }
   const day=await tx.query<{id:string;local_date:Date|string;status:string;
    checked_in_at:Date|string;break_minutes:number}>(`SELECT d.id,d.local_date,
    d.status,d.checked_in_at,p.break_minutes
    FROM hr_attendance_day d JOIN hr_shift_policy p ON p.id=d.policy_id
    AND p.root_realm_id=d.root_realm_id
    WHERE d.root_realm_id=$1 AND d.employee_id=$2 AND d.checked_out_at IS NULL
    AND d.checked_in_at>now()-interval '36 hours'
    ORDER BY d.checked_in_at DESC LIMIT 1 FOR UPDATE OF d`,
    [actor.realmId,employee.id]);
   if(!day.rows[0])throw new ConflictException(
    "No recent open check-in is available. Contact HR for a reviewed correction.");
   const now=(await tx.query<{now:Date}>("SELECT CURRENT_TIMESTAMP AS now")).rows[0].now;
   const worked=verifiedWorkedMinutes(new Date(day.rows[0].checked_in_at),
    now,Number(day.rows[0].break_minutes));
   const updated=await tx.query(`UPDATE hr_attendance_day SET
    checked_out_at=$3,worked_minutes=$4,version=version+1
    WHERE id=$1 AND root_realm_id=$2 AND checked_out_at IS NULL RETURNING id`,
    [day.rows[0].id,actor.realmId,now,worked]);
   if(!updated.rowCount)throw new ConflictException("Check-out changed. Refresh attendance.");
   await tx.query(`INSERT INTO hr_attendance_event(root_realm_id,employee_id,
    attendance_day_id,actor_ref,request_key,request_digest,action)
    VALUES($1,$2,$3,$4,$5,$6,'CHECK_OUT')`,
    [actor.realmId,employee.id,day.rows[0].id,actor.accountId,requestKey,hash]);
   await tx.query("COMMIT");
   return {recorded:true,replayed:false,date:sqlDate(day.rows[0].local_date),
    status:day.rows[0].status,workedMinutes:worked};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }

}
