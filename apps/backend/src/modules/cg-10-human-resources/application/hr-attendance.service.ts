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
const sqlDate=(x:Date|string)=>typeof x==="string"?x.slice(0,10):x.toISOString().slice(0,10);
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
type Rule={id:string;name:string;time_zone:string;work_start_local:string;
 work_end_local:string;grace_minutes:number;break_minutes:number;
 weekly_off_days:number[];effective_from:Date|string;branch_ref:string};
type Shift=Rule&{shift_id:string;assignment_id:string;employee_id:string};
@Injectable()
export class HrAttendanceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
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
   const existing=await tx.query<{id:string;request_digest:string}>(
    "SELECT id,request_digest FROM hr_employee_shift WHERE root_realm_id=$1 AND request_key=$2",
    [actor.realmId,requestKey]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==hash)
     throw new ConflictException("This shift assignment request was changed");
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
 private async self(tx:PoolClient,actor:VerifiedFoundationActor){
  await this.identity.assertPatientSessionCurrent(tx,actor);
  const q=await tx.query<{id:string;status:string}>(`SELECT id,status FROM hr_employee
   WHERE root_realm_id=$1 AND account_ref=$2
   AND status IN('ACTIVE','PROBATION') FOR UPDATE`,[actor.realmId,actor.accountId]);
  return q.rows[0]??null;
 }
 private async shift(tx:PoolClient,actor:VerifiedFoundationActor,employeeId:string){
  const q=await tx.query<Shift>(`SELECT s.id AS shift_id,a.id AS assignment_id,
   e.id AS employee_id,p.id,p.name,p.time_zone,p.work_start_local,p.work_end_local,
   p.grace_minutes,p.break_minutes,p.weekly_off_days,p.effective_from,p.branch_ref
   FROM hr_employee e
   JOIN hr_employment_assignment a ON a.employee_id=e.id
    AND a.root_realm_id=e.root_realm_id
    AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
   JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
   JOIN hr_employee_shift s ON s.employee_id=e.id AND s.root_realm_id=e.root_realm_id
    AND s.valid_from<=CURRENT_DATE AND (s.valid_to IS NULL OR s.valid_to>CURRENT_DATE)
   JOIN hr_shift_policy p ON p.id=s.policy_id AND p.root_realm_id=e.root_realm_id
    AND p.branch_ref=a.branch_ref AND p.effective_from<=CURRENT_DATE
   WHERE e.root_realm_id=$1 AND e.id=$2 FOR SHARE OF a,b,s,p`,
   [actor.realmId,employeeId]);
  return q.rows[0]??null;
 }
 async mine(token:string){
  const actor=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const employee=await this.self(tx,actor);
   if(!employee){await tx.query("COMMIT");return {status:"NOT_LINKED",days:[]};}
   const rule=await this.shift(tx,actor,employee.id);
   const rows=await tx.query<{local_date:Date|string;status:string;checked_in_at:Date|string}>(
    `SELECT local_date,status,checked_in_at FROM hr_attendance_day
    WHERE root_realm_id=$1 AND employee_id=$2
    ORDER BY local_date DESC LIMIT 35`,[actor.realmId,employee.id]);
   await tx.query("COMMIT");
   return {status:rule?"ASSIGNED":"NO_CURRENT_SHIFT",
    shift:rule?{label:rule.name,timeZone:rule.time_zone,
      start:rule.work_start_local.slice(0,5),end:rule.work_end_local.slice(0,5),
      weeklyOffDays:rule.weekly_off_days}:null,
    days:rows.rows.map(x=>({date:sqlDate(x.local_date),status:x.status,
      checkInAt:new Date(x.checked_in_at).toISOString()}))};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async checkIn(token:string,body:unknown){
  const actor=await this.sessions.verifySession(token);
  const v=input(body,["requestKey"]),requestKey=id(v.requestKey,"check-in request");
  const requestDigest=digest(["CHECK_IN",actor.accountId]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const employee=await this.self(tx,actor);
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
   const clock=local(now,rule.time_zone);
   const start=isoTime(rule.work_start_local),end=isoTime(rule.work_end_local);
   const businessDate=end<start&&clock.minute<end?previous(clock.day):clock.day;
   if(sqlDate(rule.effective_from)>businessDate)
    throw new ConflictException("Your shift is not yet effective for this attendance day");
   if(rule.weekly_off_days.includes(new Date(businessDate+"T00:00:00Z").getUTCDay()))
    throw new ConflictException("Today is a scheduled weekly day off");
   const prior=await tx.query(`SELECT 1 FROM hr_attendance_day WHERE root_realm_id=$1
    AND employee_id=$2 AND local_date=$3 FOR UPDATE`,
    [actor.realmId,employee.id,businessDate]);
   if(prior.rowCount)throw new ConflictException("Check-in is already recorded for this shift day");
   const late=clock.minute>start+Number(rule.grace_minutes) &&
    !(end<start&&clock.minute<end);
   const status=late?"LATE":"PRESENT";
   const day=await tx.query<{id:string}>(`INSERT INTO hr_attendance_day(
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
}
