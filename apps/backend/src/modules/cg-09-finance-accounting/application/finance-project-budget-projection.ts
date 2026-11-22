import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
/** Read only. Original CG09 budget event amounts; never project-estimated or paid cash.
 * Caller must establish current project and finance permissions and actual branch scope. */
export async function projectBudgetProjection(tx:PoolClient,a:VerifiedFoundationActor,scope:{all:boolean;branchRefs:string[]},mine:boolean,target:string|null){
 const q=await tx.query<{linked:number;approved:number;ceilingMinor:string;allocatedMinor:string;utilizedMinor:string}>(`
  WITH selected AS(
   SELECT b.id,b.root_realm_id,b.status,b.approved_ceiling_minor
   FROM finance_budget b JOIN project p ON p.id=b.project_ref AND p.root_realm_id=b.root_realm_id
   WHERE b.root_realm_id=$1 AND p.branch_ref IS NOT DISTINCT FROM b.branch_id
    AND ((b.branch_id IS NULL AND $2::boolean) OR b.branch_id=ANY($3::uuid[]))
    AND (b.branch_id IS NULL OR EXISTS(SELECT 1 FROM branch br WHERE br.root_realm_id=b.root_realm_id AND br.id=b.branch_id AND br.status='ACTIVE'))
    AND (NOT $4::boolean OR p.owner_account_ref=$5)
    AND ($6::uuid IS NULL OR p.id=$6)
  ), movement AS(
   SELECT e.budget_id,sum(e.amount_minor) FILTER(WHERE e.kind='ALLOCATE') allocated,
    sum(e.amount_minor) FILTER(WHERE e.kind='UTILIZE') utilized
   FROM finance_budget_event e JOIN selected b ON b.id=e.budget_id AND b.root_realm_id=e.root_realm_id
   WHERE b.status='APPROVED' GROUP BY e.budget_id
  )
  SELECT count(*)::int AS linked,count(*) FILTER(WHERE s.status='APPROVED')::int AS approved,
   COALESCE(sum(s.approved_ceiling_minor) FILTER(WHERE s.status='APPROVED'),0)::text AS "ceilingMinor",
   COALESCE(sum(m.allocated),0)::text AS "allocatedMinor",COALESCE(sum(m.utilized),0)::text AS "utilizedMinor"
  FROM selected s LEFT JOIN movement m ON m.budget_id=s.id`,[a.realmId,scope.all,scope.branchRefs,mine,a.accountId,target]);
 return q.rows[0];
}
