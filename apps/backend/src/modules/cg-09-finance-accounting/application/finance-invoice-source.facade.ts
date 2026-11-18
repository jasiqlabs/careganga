import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type InvoiceSource=Readonly<{
 invoiceRef:string;version:number;status:string;sourceDigest:string;
 invoiceNumber:string;createdBy:string;branchRef:string|null;draft:Record<string,unknown>;
}>;
const valid=(id:unknown):string=>{
 if(typeof id!=="string"||!UUID.test(id))
  throw new BadRequestException({code:"FINANCE_INVOICE_SOURCE_INVALID",field:"invoiceRef"});
 return id;
};
@Injectable()
export class FinanceInvoiceSourceFacade{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 /** CG-19 must call this before revealing invoice-document status or private bytes.
  * Finance view capability is necessary but NOT sufficient for branch visibility.
  */
 async authorizedView(bearer:string,refInput:string,
    action:"finance.invoices.view"|"finance.invoices.issue"="finance.invoices.view"){
  const actor=await this.sessions.requireAction(bearer,action);
  const reference=valid(refInput);
  const rows=await this.db.query<{id:string;branch_id:string|null;created_by:string}>(
   "SELECT id,branch_id,created_by FROM finance_invoice "+
   "WHERE id=$1 AND root_realm_id=$2",[reference,actor.realmId]);
  const source=rows.rows[0];
  if(!source)throw new ConflictException({code:"FINANCE_INVOICE_SOURCE_INVALID"});
  const scope=await this.branches.financeReportScope(bearer,action);
  if(!scope.all&&(!source.branch_id||!scope.branchRefs.includes(source.branch_id)))
   throw new ForbiddenException("This invoice document belongs to another branch");
  return {invoiceRef:source.id,branchRef:source.branch_id};
 }
 private async original(tx:PoolClient,actor:VerifiedFoundationActor,
  reference:string,version:number,action:string):Promise<InvoiceSource>{
  await this.identity.assertCurrent(tx,actor,action);
  if(!Number.isSafeInteger(version)||version<1)
   throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
  const rows=await tx.query<{id:string;version:number;status:string;
   current_digest:string;invoice_number:string;created_by:string;branch_id:string|null;
   draft_payload:Record<string,unknown>}>(
   "SELECT id,version,status,current_digest,invoice_number,created_by,branch_id,draft_payload "+
   "FROM finance_invoice WHERE id=$1 AND root_realm_id=$2 AND version=$3 FOR SHARE",
   [valid(reference),actor.realmId,version]);
  const row=rows.rows[0];
  if(!row)throw new ConflictException({code:"FINANCE_INVOICE_SOURCE_INVALID"});
  return {invoiceRef:row.id,version:row.version,status:row.status,
   sourceDigest:row.current_digest,invoiceNumber:row.invoice_number,
   createdBy:row.created_by,branchRef:row.branch_id,draft:row.draft_payload};
 }
 async guardDraft(tx:PoolClient,actor:VerifiedFoundationActor,
  reference:string,version:number,digest:string){
  const x=await this.original(tx,actor,reference,version,"finance.invoices.manage");
  if(x.branchRef)await this.branches.requireFinanceActorBranch(tx,actor,x.branchRef,"finance.invoices.manage");
  if(x.status!=="DRAFT"||x.sourceDigest!==digest)
   throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
  return x;
 }
 async submittedForReviewer(tx:PoolClient,actor:VerifiedFoundationActor,
  reference:string,version:number,digest:string){
  const x=await this.original(tx,actor,reference,version,"finance.invoices.review");
  if(x.branchRef)await this.branches.requireFinanceActorBranch(tx,actor,x.branchRef,"finance.invoices.review");
  await this.identity.assertCurrent(tx,actor,"approvals.review");
  if(x.status!=="SUBMITTED"||x.sourceDigest!==digest||x.createdBy===actor.accountId)
   throw new ConflictException({code:"FINANCE_INVOICE_REVIEW_UNAVAILABLE"});
  return x;
 }
 async reviewerSnapshot(bearer:string,reference:string,version:number){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.review");
  await this.sessions.requireAction(bearer,"approvals.review");
  if(!Number.isSafeInteger(version)||version<1)
   throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.review");
   const result=await tx.query<{invoice_number:string;created_by:string;branch_id:string|null;
    status:string;draft_payload:Record<string,unknown>}>( 
    "SELECT i.invoice_number,i.created_by,i.branch_id,c.status,r.draft_payload "+
    "FROM finance_invoice_revision r JOIN finance_invoice i "+
    "ON i.id=r.invoice_id AND i.root_realm_id=r.root_realm_id "+
    "JOIN cg03_case c ON c.finance_invoice_id=i.id AND c.realm_id=i.root_realm_id "+
    "AND c.finance_invoice_revision=r.version AND c.case_kind='FINANCE_INVOICE' "+
    "WHERE r.root_realm_id=$1 AND r.invoice_id=$2 AND r.version=$3 "+
    "FOR SHARE OF r,i,c",
    [actor.realmId,valid(reference),version]);
   const row=result.rows[0];
   if(!row||row.created_by===actor.accountId)
    throw new ConflictException({code:"FINANCE_INVOICE_REVIEW_UNAVAILABLE"});
   const scope=await this.branches.financeReportScope(bearer,"finance.invoices.review");
   if(!scope.all&&(!row.branch_id||!scope.branchRefs.includes(row.branch_id)))
    throw new ForbiddenException("This invoice review belongs to another branch");
   await tx.query("COMMIT");
   return {invoiceNumber:row.invoice_number,version,status:row.status,
    draft:row.draft_payload};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** CG19 issue owner reads only one actual posted approved snapshot. */
 async issuedSource(bearer:string,reference:string,version:number){
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.issue");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const source=await this.original(tx,actor,reference,version,"finance.invoices.issue");
   if(source.branchRef)await this.branches.requireFinanceActorBranch(tx,actor,source.branchRef,"finance.invoices.issue");
   const scope=await this.branches.financeReportScope(bearer,"finance.invoices.issue");
   if(!scope.all&&(!source.branchRef||!scope.branchRefs.includes(source.branchRef)))
    throw new ForbiddenException("This invoice document belongs to another branch");
   if(source.status!=="POSTED"&&source.status!=="ISSUED")
    throw new ConflictException({code:"FINANCE_INVOICE_NOT_ISSUABLE"});
   const cancelled=await tx.query(
    "SELECT id FROM finance_invoice_posted_cancellation "+
    "WHERE root_realm_id=$1 AND invoice_id=$2",
    [actor.realmId,source.invoiceRef]);
   if(cancelled.rowCount)
    throw new ConflictException({code:"FINANCE_INVOICE_NOT_ISSUABLE"});
   const link=await tx.query<{journal_id:string;posted_at:Date}>(
    "SELECT journal_id,posted_at FROM finance_invoice_posting WHERE root_realm_id=$1 "+
    "AND invoice_id=$2 AND invoice_version=$3",
    [actor.realmId,source.invoiceRef,version]);
   if(!link.rows[0])
    throw new ConflictException({code:"FINANCE_INVOICE_NOT_ISSUABLE"});
   const corrected=await tx.query<{invoice_number:string}>(
    "SELECT original.invoice_number FROM finance_invoice_reissue_link l "+
    "JOIN finance_invoice original ON original.id=l.original_invoice_id "+
    "AND original.root_realm_id=l.root_realm_id "+
    "WHERE l.root_realm_id=$1 AND l.replacement_invoice_id=$2",
    [actor.realmId,source.invoiceRef]);
   await tx.query("COMMIT");
   return {...source,journalPosted:true,postedAt:link.rows[0].posted_at.toISOString(),
    replacesInvoiceNumber:corrected.rows[0]?.invoice_number??null};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
}
