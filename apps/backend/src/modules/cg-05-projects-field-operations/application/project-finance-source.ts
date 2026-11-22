import {ConflictException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {ref} from "../domain/project-input";
/** CG05 exposes only real project identity to the original finance owner.
 * The caller must first establish the current CG09 action and branch scope. */
export async function assertFinanceProject(tx:PoolClient,actor:VerifiedFoundationActor,projectRef:string,branchRef:string|null){
 const p=(await tx.query<{id:string;code_norm:string;title:string}>(
  "SELECT id,code_norm,title FROM project WHERE root_realm_id=$1 AND id=$2 AND branch_ref IS NOT DISTINCT FROM $3::uuid AND status IN('PLANNED','ACTIVE','ON_HOLD') AND (branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=project.root_realm_id AND b.id=project.branch_ref AND b.status='ACTIVE' FOR SHARE)) FOR SHARE",
  [actor.realmId,ref(projectRef),branchRef])).rows[0];
 if(!p)throw new ConflictException({code:"CG05_FINANCE_PROJECT_UNAVAILABLE",field:"projectRef"});
 return {value:p.id,label:p.code_norm+" · "+p.title};
}
export async function financeProjectOptions(db:Pool|PoolClient,root:string,scope:{all:boolean;branchRefs:string[]}){
 const q=await db.query<{value:string;label:string;branchRef:string|null}>(
  "SELECT id AS value,code_norm||' · '||title AS label,branch_ref AS \"branchRef\" FROM project WHERE root_realm_id=$1 AND status IN('PLANNED','ACTIVE','ON_HOLD') AND ($2::boolean OR branch_ref=ANY($3::uuid[])) AND (branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=project.root_realm_id AND b.id=project.branch_ref AND b.status='ACTIVE')) ORDER BY title,id LIMIT 100",
  [root,scope.all,scope.branchRefs]);
 return q.rows;
}
