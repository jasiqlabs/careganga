import {ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";
/** Caller already holds actual employee lock. A due approved change cannot be
 * bypassed by creating a later day against the prior assignment. */
export async function assertAttendanceBeforeChange(tx:PoolClient,realm:string,employee:string,assignment:string,date:string){
 if((await tx.query(`SELECT 1 FROM hr_employment_change WHERE root_realm_id=$1 AND employee_id=$2
  AND prior_assignment_id=$3 AND status='APPROVED_PENDING_EFFECT' AND effective_date<=$4::date LIMIT 1`,[realm,employee,assignment,date])).rowCount)
  throw new ConflictException({code:"CG10_CHANGE_ATTENDANCE_CONFLICT"});
}
