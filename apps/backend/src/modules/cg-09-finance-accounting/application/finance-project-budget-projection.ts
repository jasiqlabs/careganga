import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
/** Original CG09 budget event amounts, never a project estimate or paid cash.
 * Caller establishes current project and finance permissions and branch scope.
 * A missing immutable posted expense proof makes the projection unavailable.
 */
export async function projectBudgetProjection(tx:PoolClient,a:VerifiedFoundationActor,scope:{all:boolean;branchRefs:string[]},mine:boolean,target:string|null){
 const q=await tx.query<{linked:number;approved:number;ceilingMinor:string;allocatedMinor:string;committedOutstandingMinor:string;utilizedMinor:string;invalid:number}>(`
  WITH selected AS(
   SELECT b.id,b.root_realm_id,b.status,b.approved_ceiling_minor,b.branch_id,b.project_ref,b.financial_year_id
   FROM finance_budget b JOIN project p ON p.id=b.project_ref AND p.root_realm_id=b.root_realm_id
   WHERE b.root_realm_id=$1 AND p.branch_ref IS NOT DISTINCT FROM b.branch_id
    AND ((b.branch_id IS NULL AND $2::boolean) OR b.branch_id=ANY($3::uuid[]))
    AND (b.branch_id IS NULL OR EXISTS(SELECT 1 FROM branch br WHERE br.root_realm_id=b.root_realm_id AND br.id=b.branch_id AND br.status='ACTIVE'))
    AND (NOT $4::boolean OR p.owner_account_ref=$5)
    AND ($6::uuid IS NULL OR p.id=$6)
  ), effects AS(
   SELECT e.*,CASE WHEN e.kind<>'UTILIZE' THEN true ELSE EXISTS(
    SELECT 1 FROM journal j JOIN finance_voucher v ON v.root_realm_id=j.root_realm_id AND v.id=j.source_ref
     JOIN finance_voucher_posting vp ON vp.root_realm_id=j.root_realm_id AND vp.journal_id=j.id
    WHERE j.root_realm_id=e.root_realm_id AND j.id=e.source_journal_id
     AND j.status='POSTED' AND j.posting_kind='VOUCHER'
     AND j.financial_year_id=b.financial_year_id AND v.voucher_type='EXPENSE'
     AND v.branch_id IS NOT DISTINCT FROM b.branch_id AND v.project_ref=b.project_ref
     AND v.total_minor=e.amount_minor
   ) END AS proven,
   CASE WHEN e.kind='UTILIZE' THEN EXISTS(SELECT 1 FROM journal reversal
    WHERE reversal.root_realm_id=e.root_realm_id AND reversal.reversal_of_id=e.source_journal_id
     AND reversal.posting_kind='REVERSAL' AND reversal.status='POSTED') ELSE false END AS reversed
   FROM finance_budget_event e JOIN selected b ON b.id=e.budget_id AND b.root_realm_id=e.root_realm_id
   WHERE b.status='APPROVED'
  ), movement AS(
   SELECT budget_id,COALESCE(sum(amount_minor) FILTER(WHERE kind='ALLOCATE'),0)-COALESCE(sum(amount_minor) FILTER(WHERE kind='DEALLOCATE'),0) allocated,
    COALESCE(sum(amount_minor) FILTER(WHERE kind='COMMIT'),0)-COALESCE(sum(amount_minor) FILTER(WHERE kind='RELEASE'),0)-
     COALESCE(sum(commitment_applied_minor) FILTER(WHERE kind='UTILIZE' AND proven AND NOT reversed),0) outstanding,
    COALESCE(sum(amount_minor) FILTER(WHERE kind='UTILIZE' AND proven AND NOT reversed),0) utilized,
    count(*) FILTER(WHERE NOT proven)::int invalid
   FROM effects GROUP BY budget_id
  )
  SELECT count(*)::int AS linked,count(*) FILTER(WHERE s.status='APPROVED')::int AS approved,
   COALESCE(sum(s.approved_ceiling_minor) FILTER(WHERE s.status='APPROVED'),0)::text AS "ceilingMinor",
   COALESCE(sum(m.allocated),0)::text AS "allocatedMinor",
   COALESCE(sum(m.outstanding),0)::text AS "committedOutstandingMinor",
   COALESCE(sum(m.utilized),0)::text AS "utilizedMinor",
   COALESCE(sum(m.invalid+CASE WHEN m.allocated<0 OR m.outstanding<0 THEN 1 ELSE 0 END),0)::int invalid
  FROM selected s LEFT JOIN movement m ON m.budget_id=s.id`,[a.realmId,scope.all,scope.branchRefs,mine,a.accountId,target]);
 const result=q.rows[0];
 if(!result||result.invalid!==0)throw Error("Original project budget proof requires reconciliation");
 const {invalid,...verified}=result;
 return verified;
}
