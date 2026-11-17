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
  return {claimRef:c.id,revision:c.version,sourceDigest:c.create_digest};
 }
 /** Reviewer view of only a submitted original claim. Never a public person master. */
 async reviewerSnapshot(bearer:string,reference:string,version:number){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.review");
  await this.sessions.requireAction(bearer,"approvals.review");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.claims.review");
   const found=await tx.query<{claimRef:string;claimNumber:string;category:string;
    purpose:string;expenseDate:string;amountMinor:string;status:string;version:number;
    requestedBy:string;billFileRef:string|null;billVersion:number|null}>(
    "SELECT id AS \"claimRef\",claim_number AS \"claimNumber\",category_label AS category,"+
    "purpose,expense_date::text AS \"expenseDate\",amount_minor::text AS \"amountMinor\","+
    "status,version,requested_by AS \"requestedBy\",bill_file_id AS \"billFileRef\","+
    "bill_file_version AS \"billVersion\" FROM expense_claim "+
    "WHERE root_realm_id=$1 AND id=$2 AND version=$3 AND status<>'DRAFT' FOR SHARE",
    [actor.realmId,reference,version]);
   const c=found.rows[0];
   if(!c||c.requestedBy===actor.accountId)
    throw new ConflictException({code:"FINANCE_CLAIM_REVIEW_UNAVAILABLE"});
   await tx.query("COMMIT");
   return {claimNumber:c.claimNumber,claimRef:c.claimRef,category:c.category,
    purpose:c.purpose,expenseDate:c.expenseDate,amountMinor:c.amountMinor,
    status:c.status,version:c.version,billFileRef:c.billFileRef,billVersion:c.billVersion};
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
   "SELECT id,root_realm_id,requested_by,version,status,create_digest "+
   "FROM expense_claim WHERE id=$1 AND root_realm_id=$2 AND version=$3 FOR SHARE",
   [reference,actor.realmId,version]);
  const claim=result.rows[0];
  if(!claim||claim.current_digest!==expectedDigest||
     claim.status!=="SUBMITTED"||claim.requested_by===actor.accountId)
   throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
  return {claimRef:claim.id,revision:claim.version,sourceDigest:claim.create_digest};
 }
 async guardFrozen(client:PoolClient,actor:VerifiedFoundationActor,
  reference:string,version:number,expectedDigest:string){
  const c=await this.lock(client,actor,reference,version,"read");
  if(c.create_digest!==expectedDigest||c.status==="DRAFT")
   throw new ConflictException({code:"FINANCE_CLAIM_SOURCE_INVALID"});
  return {claimRef:c.id,revision:c.version,sourceDigest:c.create_digest};
 }
}
