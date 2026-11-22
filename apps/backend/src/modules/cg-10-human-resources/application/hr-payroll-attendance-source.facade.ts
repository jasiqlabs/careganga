import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
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
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
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
