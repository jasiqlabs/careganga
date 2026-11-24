import {ConflictException,Inject,Injectable} from "@nestjs/common";
import {assertFinanceProject} from "../../cg-05-projects-field-operations/application/project-finance-source";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

export type VerifiedVoucherDraftSource=Readonly<{
 voucherRef:string;rootRef:string;revision:number;createdBy:string;
 status:"DRAFT"|"SUBMITTED"|"RETURNED"|"REJECTED"|"APPROVED"|
  "POSTED"|"PAYMENT_REQUESTED"|"PAID_VERIFIED";
 sourceDigest:string
}>;
/** CG-09-owned, read-only cross-owner contract.
 * CG-03 and CG-19 must not create, revise or read CG-09 financial masters.
 * The pinned source digest comes from the original immutable voucher revision.
 */
@Injectable()
export class FinanceVoucherSourceFacade{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 async guardPaymentScope(client:PoolClient,actor:VerifiedFoundationActor,branch:string|null,write=false){
  const capability=write?"finance.vouchers.manage":"finance.vouchers.view";
  if(branch)await this.branches.requireFinanceActorBranch(client,actor,branch,capability);
  else await this.branches.requireFinanceRootScope(client,actor,capability);
 }
 private async load(client:PoolClient,actor:VerifiedFoundationActor,reference:string,
  revision:number,capability:"finance.vouchers.manage"|"finance.vouchers.view"){
  await this.identity.assertCurrent(client,actor,capability);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)||
    !Number.isSafeInteger(revision)||revision<1)
   throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
  const row=await client.query<{id:string;root_realm_id:string;version:number;
    created_by:string;branch_id:string|null;project_ref:string|null;status:VerifiedVoucherDraftSource["status"];payload_digest:string}>(`
    SELECT v.id,v.root_realm_id,v.version,v.created_by,v.branch_id,v.project_ref,v.status,r.payload_digest
    FROM finance_voucher v JOIN finance_voucher_draft_revision r
      ON r.voucher_id=v.id AND r.root_realm_id=v.root_realm_id AND r.version=v.version
    WHERE v.id=$1 AND v.root_realm_id=$2 AND v.version=$3 FOR SHARE OF v,r`,
    [reference,actor.realmId,revision]);
  if(!row.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
  const v=row.rows[0];
  if(v.branch_id)
   await this.branches.requireFinanceActorBranch(client,actor,v.branch_id,capability);
  else await this.branches.requireFinanceRootScope(client,actor,capability);
  if(v.project_ref&&["DRAFT","SUBMITTED","APPROVED"].includes(v.status))await assertFinanceProject(client,actor,v.project_ref,v.branch_id);
  return {voucherRef:v.id,rootRef:v.root_realm_id,revision:v.version,
   createdBy:v.created_by,status:v.status,sourceDigest:v.payload_digest};
 }
 /** Historical original CG-09 source is immutable and may be read after RETURN/correction.
  * This is read-only; it never authorizes a stale submission or new upload.
  */
 async historical(bearer:string,reference:string,revision:number){
  const actor=await this.sessions.requireAction(bearer,"finance.vouchers.view");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)||
   !Number.isSafeInteger(revision)||revision<1)
   throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.vouchers.view");
   const found=await client.query<{id:string;root_realm_id:string;created_by:string;
    branch_id:string|null;status:VerifiedVoucherDraftSource["status"];payload_digest:string}>(`
    SELECT v.id,v.root_realm_id,v.created_by,v.branch_id,v.status,r.payload_digest
    FROM finance_voucher_draft_revision r JOIN finance_voucher v
     ON v.id=r.voucher_id AND v.root_realm_id=r.root_realm_id
    WHERE v.id=$1 AND v.root_realm_id=$2 AND r.version=$3 FOR SHARE OF v,r`,
    [reference,actor.realmId,revision]);
   if(!found.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   if(found.rows[0].branch_id)
    await this.branches.requireFinanceActorBranch(client,actor,found.rows[0].branch_id,
     "finance.vouchers.view");
   else await this.branches.requireFinanceRootScope(client,actor,"finance.vouchers.view");
   await client.query("COMMIT");
   return {voucherRef:found.rows[0].id,rootRef:found.rows[0].root_realm_id,
    revision,createdBy:found.rows[0].created_by,status:found.rows[0].status,
    sourceDigest:found.rows[0].payload_digest};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async current(bearer:string,reference:string,revision:number,write:boolean=false){
  const actor=await this.sessions.requireAction(bearer,
   write?"finance.vouchers.manage":"finance.vouchers.view");
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   const row=await this.load(client,actor,reference,revision,
    write?"finance.vouchers.manage":"finance.vouchers.view");
   if(write&&row.status!=="DRAFT")
    throw new ConflictException({code:"FINANCE_VOUCHER_NOT_EDITABLE"});
   await client.query("COMMIT");return row;
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async currentForPayment(bearer:string,reference:string,revision:number){
  const actor=await this.sessions.requireAction(bearer,"finance.vouchers.manage");
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   const row=await this.load(client,actor,reference,revision,"finance.vouchers.manage");
   if(row.status!=="PAYMENT_REQUESTED")
    throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_NOT_READY"});
   await client.query("COMMIT");return row;
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async guardPayment(client:PoolClient,actor:VerifiedFoundationActor,reference:string,revision:number){
  const row=await this.load(client,actor,reference,revision,"finance.vouchers.manage");
  if(row.status!=="PAYMENT_REQUESTED")
   throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_PROOF_NOT_READY"});
  return row;
 }
 async guardDraft(client:PoolClient,actor:VerifiedFoundationActor,reference:string,revision:number){
  const row=await this.load(client,actor,reference,revision,"finance.vouchers.manage");
  if(row.status!=="DRAFT")throw new ConflictException({code:"FINANCE_VOUCHER_NOT_EDITABLE"});
  return row;
 }
 async guardFrozen(client:PoolClient,actor:VerifiedFoundationActor,reference:string,revision:number,
  digest:string){
  const row=await this.load(client,actor,reference,revision,"finance.vouchers.view");
  if(row.sourceDigest!==digest)throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
  return row;
 }
}
