import type {PoolClient} from "pg";
/** CG10 current, minimal work-assignment projection. Caller owns task
 * permissions and the current project/branch scope; no HR private fields. */
export const currentTaskEmployee = `e.status IN('ACTIVE','PROBATION') AND e.account_ref IS NOT NULL
 AND h.valid_from<=CURRENT_DATE AND (h.valid_to IS NULL OR h.valid_to>CURRENT_DATE)
 AND b.status='ACTIVE'
 AND NOT EXISTS(SELECT 1 FROM hr_employment_change ch
 WHERE ch.root_realm_id=e.root_realm_id AND ch.employee_id=e.id
 AND ch.prior_assignment_id=h.id AND ch.status='APPROVED_PENDING_EFFECT'
 AND ch.effective_date<=CURRENT_DATE)`;
export const taskEmployeeFrom = `hr_employee e JOIN hr_employment_assignment h
 ON h.root_realm_id=e.root_realm_id AND h.employee_id=e.id
 JOIN branch b ON b.root_realm_id=h.root_realm_id AND b.id=h.branch_ref`;
export async function lockCurrentTaskEmployee(tx:PoolClient,root:string,employee:string,projectBranch:string|null){
 const q=await tx.query<{accountRef:string;employeeRef:string;branchRef:string}>(`
 SELECT e.account_ref AS "accountRef",e.id AS "employeeRef",h.branch_ref AS "branchRef"
 FROM ${taskEmployeeFrom} WHERE e.root_realm_id=$1 AND e.id=$2
 AND ($3::uuid IS NULL OR h.branch_ref=$3) AND ${currentTaskEmployee}
 FOR SHARE OF e,h,b`,[root,employee,projectBranch]);
 return q.rows.length===1?q.rows[0]:null;
}
