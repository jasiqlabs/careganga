import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
type Kind="POLICY"|"COMPENSATION"|"PAYOUT"|"RUN"|"ACCESS";
type Result="DRAFT_CREATED"|"SUBMITTED"|"APPROVED"|"RETURNED"|"REJECTED"|"READ"|"DENIED"|"CONFLICT"|"INVALID";
/** CG21-owned original append-only transport. Only enumerated labels; never source fields. */
export async function recordPayrollAudit(db:Pool|PoolClient,a:Actor,kind:Kind,result:Result,correlation=randomUUID()){
 await db.query(`INSERT INTO platform_operation_audit(foundation_realm_id,actor_account_id,action_key,resource_ref,outcome,safe_context,correlation_ref)
 SELECT $1,$2,'payroll.source.operation',$2,CASE WHEN $4 IN('DENIED','CONFLICT','INVALID') THEN 'UNAVAILABLE' ELSE 'SUCCESS' END,
 jsonb_build_object('payrollKind',$3::text,'payrollResult',$4::text),$5
 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'`,[a.realmId,a.accountId,kind,result,correlation]);
}
