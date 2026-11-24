import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {leaveDate,leaveId} from "./hr-leave-source.facade";

type AttendanceSnapshotRow={
 id:string;employee_id:string;local_date:string;status:string;version:number;assignment_id:string;
 policy_id:string;shift_id:string;time_zone:string;work_start_local:string;work_end_local:string;
 break_minutes:number;grace_minutes:number;weekly_off_days:number[];effective_from:string;
 checked_in_at:Date|string|null;checked_out_at:Date|string|null;worked_minutes:number|null;
 leave_half_days:number|null;leave_request_id:string|null;leave_decision_ref:string|null;
 correction_ref:string|null;correction_decision_ref:string|null;
};
/** Current HR-owned source values for a future CG11 immutable payroll snapshot.
 * No public endpoint, payroll row, or payroll capability is invented here.
 * The introducing CG11 owner must reauthorize the payroll operation and persist
 * this value+digest inside its own frozen revision. A later CG10 correction is
 * a new attendance version, never an update of a CG11 snapshot.
 */
@Injectable()
export class HrPayrollAttendanceSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 /** Aggregate only; current effective branch, never employee records or contact data. */
 async payrollActiveCount(tx:PoolClient,actor:VerifiedFoundationActor,branch:string|null){
  await this.identity.assertCurrent(tx,actor,"payroll.runs.view");
  const scope=await this.branches.projectBranchScope(tx,actor);
  if(branch)await this.branches.projectBranch(tx,actor,branch);
  const row=(await tx.query<{count:string}>(`SELECT count(DISTINCT e.id)::text count FROM hr_employee e
   JOIN hr_employment_assignment h ON h.root_realm_id=e.root_realm_id AND h.employee_id=e.id
   JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref AND b.status='ACTIVE'
   WHERE e.root_realm_id=$1 AND e.status IN('ACTIVE','PROBATION')
   AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date)
   AND h.branch_ref=ANY($2::uuid[]) AND ($3::uuid IS NULL OR h.branch_ref=$3)`,[actor.realmId,scope.branches.map(b=>b.value),branch])).rows[0];
  return Number(row.count);
 }
 /** Actual period assignments, including historical transfers and exit; no private HR fields. */
 async payrollCandidates(tx:PoolClient,actor:VerifiedFoundationActor,branch:string|null,from:string,until:string){
  await this.identity.assertCurrent(tx,actor,"payroll.runs.view");
  await this.identity.assertCurrent(tx,actor,"hr.attendance.view");
  await this.branches.projectBranch(tx,actor,branch);
  const scope=await this.branches.projectBranchScope(tx,actor);
  // One employee belongs to the last effective assignment in the period. A branch
  // run cannot consume earlier-branch private records; Foundation scope handles transfers.
  const rows=(await tx.query<{id:string;reference:string;name:string;status:string;statusVersion:number;branchRef:string;assignmentRef:string;designation:string;department:string|null;employmentType:string}>(
    `SELECT e.id,e.employee_code AS reference,app.legal_name AS name,e.status,e.status_version AS "statusVersion",last.branch_ref AS "branchRef",last.id AS "assignmentRef",last.designation,d.name AS department,last.employment_type AS "employmentType"
    FROM hr_employee e JOIN hr_employee_application app ON app.root_realm_id=e.root_realm_id AND app.id=e.application_id
    JOIN LATERAL (SELECT a.id,a.branch_ref,a.designation,a.department_ref,a.employment_type FROM hr_employment_assignment a WHERE a.root_realm_id=e.root_realm_id AND a.employee_id=e.id AND a.valid_from<$3::date AND (a.valid_to IS NULL OR a.valid_to>$2::date) ORDER BY a.valid_from DESC,a.id DESC LIMIT 1) last ON true
    LEFT JOIN department d ON d.root_realm_id=e.root_realm_id AND d.id=last.department_ref
    WHERE e.root_realm_id=$1 AND ($4::uuid IS NULL OR last.branch_ref=$4) AND ($6::boolean OR last.branch_ref=ANY($5::uuid[])) ORDER BY e.id LIMIT 501 FOR SHARE OF e`,[actor.realmId,from,until,branch,scope.branches.map(b=>b.value),scope.all])).rows;
  if(rows.length>500)throw new BadRequestException("Payroll scope exceeds 500 employees; use branch runs");
  return rows;
 }
 async payrollPeriod(tx:PoolClient,actor:VerifiedFoundationActor,employee:string,from:string,until:string,runBranch:string|null){
  await this.identity.assertCurrent(tx,actor,"payroll.runs.view");
  await this.identity.assertCurrent(tx,actor,"hr.attendance.view");
  await this.branches.projectBranch(tx,actor,runBranch);
  const scope=await this.branches.projectBranchScope(tx,actor);
  const assignments=(await tx.query<{id:string;branchRef:string;version:number;from:string;until:string|null}>(
   `SELECT id,branch_ref AS "branchRef",assignment_version AS version,valid_from::text AS "from",valid_to::text AS until FROM hr_employment_assignment WHERE root_realm_id=$1 AND employee_id=$2 AND valid_from<$4::date AND (valid_to IS NULL OR valid_to>$3::date) ORDER BY valid_from,id FOR SHARE`,[actor.realmId,employee,from,until])).rows;
  if(!assignments.length||assignments.some(a=>!scope.branches.some(b=>b.value===a.branchRef)||(runBranch!==null&&a.branchRef!==runBranch)))return {reason:"CROSS_BRANCH_REQUIRES_FOUNDATION_SCOPE",assignments:[],days:[]};
  const days=(await tx.query<{date:string;status:string;ref:string;revision:number;assignmentRef:string;branchRef:string;policyRef:string;shiftRef:string;workedMinutes:number|null;checkIn:string|null;checkOut:string|null;leaveUnits:number;leaveRef:string|null;leavePolicyRef:string|null;leaveDecisionRef:string|null;correctionRef:string|null;correctionDecisionRef:string|null;pendingCorrection:boolean}>(
    `SELECT d.local_date::text AS date,d.status,d.id AS ref,d.version AS revision,d.assignment_id AS "assignmentRef",a.branch_ref AS "branchRef",d.policy_id AS "policyRef",d.shift_id AS "shiftRef",d.worked_minutes AS "workedMinutes",to_char(d.checked_in_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "checkIn",to_char(d.checked_out_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "checkOut",COALESCE(d.leave_half_days,0) AS "leaveUnits",d.leave_request_id AS "leaveRef",l.policy_id AS "leavePolicyRef",l.decision_ref AS "leaveDecisionRef",c.id AS "correctionRef",c.decision_ref AS "correctionDecisionRef",EXISTS(SELECT 1 FROM hr_attendance_change pending WHERE pending.root_realm_id=d.root_realm_id AND pending.attendance_day_id=d.id AND pending.status='SUBMITTED') AS "pendingCorrection"
     FROM hr_attendance_day d JOIN hr_employment_assignment a ON a.root_realm_id=d.root_realm_id AND a.id=d.assignment_id AND a.employee_id=d.employee_id
     JOIN hr_shift_policy p ON p.root_realm_id=d.root_realm_id AND p.id=d.policy_id AND p.branch_ref=a.branch_ref
     LEFT JOIN hr_leave_request l ON l.root_realm_id=d.root_realm_id AND l.id=d.leave_request_id AND l.employee_id=d.employee_id AND l.status='APPROVED'
     LEFT JOIN LATERAL(SELECT c.id,c.decision_ref FROM hr_attendance_change c WHERE c.root_realm_id=d.root_realm_id AND c.attendance_day_id=d.id AND c.status='APPROVED' AND c.expected_version<d.version ORDER BY c.expected_version DESC LIMIT 1)c ON true
     WHERE d.root_realm_id=$1 AND d.employee_id=$2 AND d.local_date>=$3::date AND d.local_date<$4::date ORDER BY d.local_date,d.id FOR SHARE OF d,a,p`,[actor.realmId,employee,from,until])).rows;
  if(days.some(d=>!assignments.some(a=>a.id===d.assignmentRef&&a.branchRef===d.branchRef&&a.from<=d.date&&(!a.until||a.until>d.date))))return {reason:"ATTENDANCE_ASSIGNMENT_CHANGED",assignments:[],days:[]};
  const pendingLeave=(await tx.query("SELECT 1 FROM hr_leave_request WHERE root_realm_id=$1 AND employee_id=$2 AND status='SUBMITTED' AND start_date<$4::date AND end_date>=$3::date LIMIT 1",[actor.realmId,employee,from,until])).rowCount;
  return {reason:pendingLeave?"PENDING_LEAVE_REVIEW":null,assignments,days};
 }
 async readEmployeePeriod(tx:PoolClient,actor:VerifiedFoundationActor,input:{
  branchRef:string;employeeReference:string;from:string;through:string;
 }){
  await this.identity.assertCurrent(tx,actor,"hr.attendance.view");
  const branch=leaveId(input.branchRef),from=leaveDate(input.from),through=leaveDate(input.through);
  if(!/^CG-HR-EMP-[0-9]{6,}$/.test(input.employeeReference)||from>through||
   Date.parse(through)-Date.parse(from)>365*86400000)throw new BadRequestException("Choose an employee and a bounded attendance period");
  const scope=await tx.query(`SELECT id FROM branch b WHERE b.root_realm_id=$1 AND b.id=$2 AND b.status='ACTIVE'
   AND (b.manager_account_ref=$3 OR EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
    AND r.realm_id=ar.realm_id AND r.active
    LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin'
    WHERE ar.realm_id=$1 AND ar.account_id=$3 AND ar.revoked_at IS NULL
    AND (r.is_protected OR g.capability_key IS NOT NULL))) FOR SHARE OF b`,[actor.realmId,branch,actor.accountId]);
  if(!scope.rowCount)throw new ForbiddenException("Attendance source is not available for this branch");
  const employee=await tx.query<{id:string}>(`SELECT e.id FROM hr_employee e
   JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
   WHERE e.root_realm_id=$1 AND e.employee_code=$2 AND a.branch_ref=$3
   AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
   AND e.status IN('ACTIVE','PROBATION','ON_HOLD') FOR SHARE OF e,a`,[actor.realmId,input.employeeReference,branch]);
  if(employee.rows.length!==1)throw new NotFoundException("A current eligible employee is unavailable");
  const q=await tx.query<AttendanceSnapshotRow>(`SELECT d.id,d.employee_id,to_char(d.local_date,'YYYY-MM-DD') AS local_date,d.status,d.version,
   d.assignment_id,d.policy_id,d.shift_id,p.time_zone,p.work_start_local,p.work_end_local,p.break_minutes,p.grace_minutes,
   p.weekly_off_days,to_char(p.effective_from,'YYYY-MM-DD') AS effective_from,d.checked_in_at,d.checked_out_at,d.worked_minutes,
   d.leave_half_days,d.leave_request_id,lr.decision_ref AS leave_decision_ref,
   hc.id AS correction_ref,hc.decision_ref AS correction_decision_ref
   FROM hr_attendance_day d JOIN hr_employment_assignment a ON a.id=d.assignment_id AND a.root_realm_id=d.root_realm_id
   JOIN hr_shift_policy p ON p.id=d.policy_id AND p.root_realm_id=d.root_realm_id AND p.branch_ref=a.branch_ref
   LEFT JOIN hr_leave_request lr ON lr.id=d.leave_request_id AND lr.root_realm_id=d.root_realm_id AND lr.employee_id=d.employee_id AND lr.status='APPROVED'
   LEFT JOIN LATERAL (SELECT c.id,c.decision_ref FROM hr_attendance_change c WHERE c.root_realm_id=d.root_realm_id
    AND c.attendance_day_id=d.id AND c.status='APPROVED' AND c.expected_version<d.version
    ORDER BY c.expected_version DESC LIMIT 1) hc ON true
   WHERE d.root_realm_id=$1 AND d.employee_id=$2 AND a.branch_ref=$3
   AND d.local_date BETWEEN $4::date AND $5::date ORDER BY d.local_date,d.id LIMIT 367
   FOR SHARE OF d,a,p`,[actor.realmId,employee.rows[0].id,branch,from,through]);
  const days=q.rows.map(row=>{
   const snapshot={attendanceRef:row.id,employeeRef:row.employee_id,date:row.local_date,status:row.status,
    revision:row.version,assignmentRef:row.assignment_id,shiftRef:row.shift_id,
    policy:{ref:row.policy_id,timeZone:row.time_zone,start:row.work_start_local,end:row.work_end_local,
     breakMinutes:row.break_minutes,graceMinutes:row.grace_minutes,weeklyOffDays:row.weekly_off_days,effectiveFrom:row.effective_from},
    checkInAt:row.checked_in_at?new Date(row.checked_in_at).toISOString():null,
    checkOutAt:row.checked_out_at?new Date(row.checked_out_at).toISOString():null,
    workedMinutes:row.worked_minutes,leaveHalfDays:row.leave_half_days??0,
    approvedLeaveRef:row.leave_request_id,leaveDecisionRef:row.leave_decision_ref,
    latestCorrectionRef:row.correction_ref,latestCorrectionDecisionRef:row.correction_decision_ref};
   return {...snapshot,digest:createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")};
  });
  return {employeeReference:input.employeeReference,from,through,days,
   // The payroll owner must validate genuinely missing/open days; never substitute absence or zero pay.
   openPunchCount:days.filter(x=>x.checkInAt!==null&&x.checkOutAt===null).length};
 }
}
