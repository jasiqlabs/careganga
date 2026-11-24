import {ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";
/** Minimal original CG06 eligibility for stock/finance owners. It returns no person
 * fields and does not grant the owner access to the beneficiary workspace. The
 * caller still enforces its own actor, warehouse/finance scope and proof. */
export async function guardAssistanceOwner(tx:PoolClient,root:string,kind:"STOCK"|"PAYMENT",source:string){
 const col=kind==="STOCK"?"stock_operation_ref":"voucher_ref";
 const link=(await tx.query<{assistance_id:string;action:string;beneficiary_id:string}>(`SELECT f.assistance_id,f.action,a.beneficiary_id FROM assistance_fulfillment f JOIN assistance_case a ON a.root_realm_id=f.root_realm_id AND a.id=f.assistance_id WHERE f.root_realm_id=$1 AND f.${col}=$2`,[root,source])).rows[0];
 if(!link)return false;
 // Same beneficiary -> assistance order as preparation, before the owner row lock.
 const b=(await tx.query<{branch_scope_id:string|null;consent_revoked_at:Date|null;verification_state:string;lifecycle_state:string}>("SELECT branch_scope_id,consent_revoked_at,verification_state,lifecycle_state FROM beneficiary WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[root,link.beneficiary_id])).rows[0];
 const a=(await tx.query<{branch_ref:string|null;state:string;approval_case_ref:string;source_digest:string;project_ref:string|null;activity_ref:string|null;visit_ref:string|null;campaign_ref:string|null}>("SELECT branch_ref,state,approval_case_ref,source_digest,project_ref,activity_ref,visit_ref,campaign_ref FROM assistance_case WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[root,link.assistance_id])).rows[0];
 const fail=()=>new ConflictException({code:"CG06_SOURCE_STALE"});
 if(!b||!a||b.branch_scope_id!==a.branch_ref||a.state!=="APPROVED")throw fail();
 if(!(await tx.query("SELECT 1 FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='ASSISTANCE_REVIEW' AND assistance_review_ref=$3 AND assistance_source_digest=$4 AND status='OWNER_COMPLETED' FOR SHARE",[root,a.approval_case_ref,link.assistance_id,a.source_digest])).rowCount)throw fail();
 // Return is an inventory correction of an already confirmed delivery; it must
 // not be prevented solely by later consent withdrawal. New releases are blocked.
 if(link.action==="RETURN")return true;
 if(b.consent_revoked_at||b.verification_state!=="VERIFIED"||b.lifecycle_state!=="ACTIVE")throw fail();
 if(a.branch_ref&&!(await tx.query("SELECT 1 FROM branch WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[root,a.branch_ref])).rowCount)throw fail();
 if(a.project_ref&&!(await tx.query("SELECT 1 FROM project WHERE root_realm_id=$1 AND id=$2 AND branch_ref IS NOT DISTINCT FROM $3::uuid AND status='ACTIVE' FOR SHARE",[root,a.project_ref,a.branch_ref])).rowCount)throw fail();
 if(a.activity_ref&&!(await tx.query("SELECT 1 FROM project_activity WHERE root_realm_id=$1 AND id=$2 AND project_id=$3 AND status IN('SCHEDULED','ONGOING','COMPLETED') FOR SHARE",[root,a.activity_ref,a.project_ref])).rowCount)throw fail();
 if(a.visit_ref&&!(await tx.query("SELECT 1 FROM field_visit WHERE root_realm_id=$1 AND id=$2 AND project_id=$3 AND status='COMPLETED' FOR SHARE",[root,a.visit_ref,a.project_ref])).rowCount)throw fail();
 if(a.campaign_ref&&!(await tx.query("SELECT 1 FROM campaign WHERE root_realm_id=$1 AND id=$2 AND branch_ref IS NOT DISTINCT FROM $3::uuid AND source_status IN('APPROVED','PUBLISHED','PAUSED','CLOSED') FOR SHARE",[root,a.campaign_ref,a.branch_ref])).rowCount)throw fail();
 return true;
}
