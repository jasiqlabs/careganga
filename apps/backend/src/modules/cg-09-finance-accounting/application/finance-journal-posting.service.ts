import {BadRequestException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

type AccountingLine=Readonly<{
 accountRef:string;branchRef:string|null;debitMinor:string;creditMinor:string
}>;
type FinancePosting=Readonly<{
 financialYearRef:string;postingDate:string;sourceRef:string;eventKey:string;
 immutableDigest:string;kind:"OPENING"|"GENERAL"|"VOUCHER"|"REVERSAL"|"INVOICE"|"CREDIT_NOTE"|"REFUND";
 description?:string;payrollAllocation?:boolean;
 reversalOfRef?:string|null;lines:readonly AccountingLine[];
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeMinor=(value:string):bigint=>{
 if(!/^(0|[1-9][0-9]{0,17})$/.test(value))
  throw new BadRequestException({code:"FINANCE_OPENING_AMOUNT",field:"amount"});
 const n=BigInt(value);
 if(n>9223372036854775807n)
  throw new BadRequestException({code:"FINANCE_OPENING_AMOUNT",field:"amount"});
 return n;
};
/** CG-09 single authoritative double-entry posting engine, initially used by
 * US-001 openings; US-002 may extend callers, never create another ledger.
 * Caller owns the short transaction, current authorization and source policy.
 * DB triggers recheck CLOSED period, inactive accounts and balanced POSTED state.
 */
@Injectable()
export class FinanceJournalPostingService{
 async postBalanced(client:PoolClient,actor:VerifiedFoundationActor,
  event:FinancePosting):Promise<string>{
  if(!UUID.test(event.financialYearRef)||!UUID.test(event.sourceRef)||
     !UUID.test(event.eventKey)||!event.lines||
     event.lines.length<2||event.lines.length>(event.payrollAllocation?2500:40))
   throw new BadRequestException({code:"FINANCE_DEBITS_CREDITS",field:"debitAccountRef"});
  const description=event.description??"Opening balance";
  if(typeof description!=="string"||description.trim().length<3||
     description.trim().length>500)
   throw new BadRequestException({code:"FINANCE_JOURNAL_MEMO_INVALID",field:"description"});
  let debits=0n,credits=0n;
  for(const line of event.lines){
   if(!UUID.test(line.accountRef)||line.branchRef!==null&&!UUID.test(line.branchRef))
    throw new BadRequestException({code:"FINANCE_ACCOUNT_SCOPE",field:"debitAccountRef"});
   const d=safeMinor(line.debitMinor),c=safeMinor(line.creditMinor);
   if((d>0n)===(c>0n))
    throw new BadRequestException({code:"FINANCE_DEBITS_CREDITS",field:"amount"});
   debits+=d;credits+=c;
  }
  if(debits===0n||debits!==credits)
   throw new BadRequestException({code:"FINANCE_DEBITS_CREDITS",field:"amount"});
  const result=await client.query<{id:string}>(`
    INSERT INTO journal(root_realm_id,financial_year_id,source_owner,source_ref,
      posting_kind,immutable_source_event_key,immutable_payload_digest,
      posting_date,reversal_of_id,created_by,description)
    VALUES($1,$2,'CG-09',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[
     actor.realmId,event.financialYearRef,event.sourceRef,event.kind,
     event.eventKey,event.immutableDigest,event.postingDate,event.reversalOfRef??null,
     actor.accountId,description.trim()
    ]);
  const journalRef=result.rows[0].id;
  const params:unknown[]=[];
  const values=event.lines.map((line,i)=>{
   const base=i*6;
   params.push(actor.realmId,journalRef,line.accountRef,line.branchRef,
    line.debitMinor,line.creditMinor);
   return "("+[1,2,3,4,5,6].map(n=>"$"+(base+n)).join(",")+")";
  });
  await client.query(`
    INSERT INTO journal_line(root_realm_id,journal_id,account_id,branch_id,debit_minor,credit_minor)
    VALUES ${values.join(",")}`,params);
  return journalRef;
 }
}
