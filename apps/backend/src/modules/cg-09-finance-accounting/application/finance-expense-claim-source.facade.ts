import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Original={id:string;root_realm_id:string;requested_by:string;version:number;
 status:"DRAFT"|"SUBMITTED"|"RETURNED"|"REJECTED"|"APPROVED";current_digest:string};
@Injectable()
export class FinanceExpenseClaimSourceFacade{
 constructor(@Inject(DATABASE) private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 private async lock(client:PoolClient,actor:VerifiedFoundationActor,reference:string,
  version:number,mode:"write"|"read"):Promise<Original>{
  if(typeof reference!=="string"||!UUID.test(reference)||!Number.isSafeInteger(version)||version<1)
   throw new BadRequestException({code:"FINANCE_CLAIM_SOURCE_INVALID",field:"claimRef"});
  await this.identity.assertCurrent(client,actor,
   mode==="write"?"finance.claims.create":"finance.claims.view");
  const found=await client.query<Original>(
   "SELECT id,root_realm_id,requested_by,version,status,current_digest "+
   "FROM expense_claim WHERE id=$1 AND root_realm_id=$2 AND version=$3 FOR SHARE",
   [reference,actor.realmId,version]);
  const c=found.rows[0];
  if(!c||c.requested_by!==actor.accountId)
   throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
  return c;
 }
 async current(bearer:string,reference:string,version:number,write=false){
  const actor=await this.sessions.requireAction(bearer,
   write?"finance.claims.create":"finance.claims.view");
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   const c=await this.lock(client,actor,reference,version,write?"write":"read");
   if(write&&c.status!=="DRAFT")
    throw new ConflictException({code:"FINANCE_CLAIM_NOT_EDITABLE"});
   await client.query("COMMIT");
   return {claimRef:c.id,revision:c.version,status:c.status,sourceDigest:c.current_digest};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async historical(bearer:string,reference:string,version:number){
  return this.current(bearer,reference,version,false);
 }
 async guardDraft(client:PoolClient,actor:VerifiedFoundationActor,
  reference:string,version:number){
  const c=await this.lock(client,actor,reference,version,"write");
  if(c.status!=="DRAFT")throw new ConflictException({code:"FINANCE_CLAIM_NOT_EDITABLE"});
  return {claimRef:c.id,revision:c.version,sourceDigest:c.current_digest};
 }
 /** Reviewer view of only a submitted original claim. Never a public person master. */
 async reviewerSnapshot(bearer:string,reference:string,version:number){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.review");
  await this.sessions.requireAction(bearer,"approvals.review");
  if(typeof reference!=="string"||!UUID.test(reference)||
      !Number.isSafeInteger(version)||version<1)
   throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.claims.review");
   const found=await tx.query<{claimRef:string;claimNumber:string;category:string;
    purpose:string;expenseDate:string;amountMinor:string;status:string;version:number;
    requestedBy:string;billFileRef:string;billVersion:number}>(
    "SELECT c.id AS \"claimRef\",c.claim_number AS \"claimNumber\","+
    "r.category_label AS category,r.purpose,r.expense_date::text AS \"expenseDate\","+
    "r.amount_minor::text AS \"amountMinor\",k.status,r.version,"+
    "c.requested_by AS \"requestedBy\",k.finance_claim_bill_id AS \"billFileRef\","+
    "k.finance_claim_bill_version AS \"billVersion\" "+
    "FROM expense_claim_revision r JOIN expense_claim c "+
    "ON c.id=r.claim_id AND c.root_realm_id=r.root_realm_id "+
    "JOIN cg03_case k ON k.finance_claim_id=c.id AND k.realm_id=c.root_realm_id "+
    "AND k.finance_claim_revision=r.version AND k.case_kind='FINANCE_REIMBURSEMENT' "+
    "WHERE r.root_realm_id=$1 AND r.claim_id=$2 AND r.version=$3 FOR SHARE OF r,c,k",
    [actor.realmId,reference,version]);
   const row=found.rows[0];
   if(!row||row.requestedBy===actor.accountId)
    throw new ConflictException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
   await tx.query("COMMIT");
   return {claimNumber:row.claimNumber,claimRef:row.claimRef,category:row.category,
    purpose:row.purpose,expenseDate:row.expenseDate,amountMinor:row.amountMinor,
    status:row.status,version:row.version,billFileRef:row.billFileRef,
    billVersion:row.billVersion};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async guardForReviewer(client:PoolClient,actor:VerifiedFoundationActor,reference:string,
  version:number,expectedDigest:string){
  if(typeof reference!=="string"||!UUID.test(reference)||!Number.isSafeInteger(version)||
     version<1)
   throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
  await this.identity.assertCurrent(client,actor,"finance.claims.review");
  await this.identity.assertCurrent(client,actor,"approvals.review");
  const result=await client.query<Original>(
   "SELECT id,root_realm_id,requested_by,version,status,current_digest "+
   "FROM expense_claim WHERE id=$1 AND root_realm_id=$2 AND version=$3 FOR SHARE",
   [reference,actor.realmId,version]);
  const claim=result.rows[0];
  if(!claim||claim.current_digest!==expectedDigest||
     claim.status!=="SUBMITTED"||claim.requested_by===actor.accountId)
   throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
  return {claimRef:claim.id,revision:claim.version,sourceDigest:claim.current_digest};
 }
 async guardFrozen(client:PoolClient,actor:VerifiedFoundationActor,
  reference:string,version:number,expectedDigest:string){
  const c=await this.lock(client,actor,reference,version,"read");
  if(c.current_digest!==expectedDigest||c.status==="DRAFT")
   throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
  return {claimRef:c.id,revision:c.version,sourceDigest:c.current_digest};
 }
}
