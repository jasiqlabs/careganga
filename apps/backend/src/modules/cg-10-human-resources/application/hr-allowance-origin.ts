import {ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

export type HrAllowanceOrigin={hr_employee_id:string;hr_assignment_id:string;hr_branch_id:string};
export type ClaimOrigin={source_kind:string;hr_employee_id:string|null;hr_assignment_id:string|null;hr_branch_id:string|null};

/** CG10 is authoritative for current employment. Never trust a caller's branch/employee IDs.
 * Shared row locks serialize claimant writes with employment status/assignment changes. */
export async function currentHrAllowanceOrigin(tx:PoolClient,actor:VerifiedFoundationActor):Promise<HrAllowanceOrigin>{
 const q=await tx.query<HrAllowanceOrigin>(`SELECT e.id AS hr_employee_id,a.id AS hr_assignment_id,a.branch_ref AS hr_branch_id
 FROM hr_employee e JOIN hr_employee_application p ON p.id=e.application_id AND p.root_realm_id=e.root_realm_id AND p.state='ACTIVE'
 JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id
 JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
 JOIN account ac ON ac.id=e.account_ref AND ac.realm_id=e.root_realm_id AND ac.status='ACTIVE'
 WHERE e.root_realm_id=$1 AND e.account_ref=$2 AND e.status IN('ACTIVE','PROBATION')
 AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
 FOR SHARE OF e,p,a,b,ac`,[actor.realmId,actor.accountId]);
 if(q.rows.length!==1)throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
 return q.rows[0];
}
export async function assertHrAllowanceOrigin(tx:PoolClient,actor:VerifiedFoundationActor,origin:ClaimOrigin){
 if(origin.source_kind!=="HR_ALLOWANCE")return;
 const current=await currentHrAllowanceOrigin(tx,actor);
 if(current.hr_employee_id!==origin.hr_employee_id||current.hr_assignment_id!==origin.hr_assignment_id||current.hr_branch_id!==origin.hr_branch_id)
  throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
}
export async function assertOwnClaimOrigin(tx:PoolClient,actor:VerifiedFoundationActor,claimRef:string){
 const q=await tx.query<ClaimOrigin>(`SELECT source_kind,hr_employee_id,hr_assignment_id,hr_branch_id FROM expense_claim
 WHERE root_realm_id=$1 AND id=$2 AND requested_by=$3 FOR SHARE`,[actor.realmId,claimRef,actor.accountId]);
 if(q.rows.length!==1)throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
 await assertHrAllowanceOrigin(tx,actor,q.rows[0]);
}
