import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

type SafeDraft={year:string;branch:string|null;branchVersion:number|null;
 kind:"PAYMENT"|"EXPENSE"|"CONTRA"|"GENERAL";date:string;payee:string;
 purpose:string;lines:{description:string;quantity:number;unitRateMinor:string;
 lineTotalMinor:string}[];grossMinor:string;taxMinor:string;chargesMinor:string;totalMinor:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(code:string,field?:string):never=>{throw new BadRequestException({code,...(field?{field}:{})});};
const uid=(v:unknown,field:string):string=>{
 if(typeof v!=="string"||!UUID.test(v))return fail("FINANCE_VOUCHER_SOURCE_INVALID",field);
 return v;
};
const name=(v:unknown,field:string,max:number):string=>{
 if(typeof v!=="string"||v.trim().length<2||v.trim().length>max)
  return fail("FINANCE_VOUCHER_NAME_INVALID",field);
 const val=v.trim().replace(/\s+/g," ");
 if(field==="payeeName"&&/([0-9][ -]?){8,}/.test(val))
  return fail("FINANCE_VOUCHER_NAME_INVALID",field);
 return val;
};
const purpose=(v:unknown):string=>{
 if(typeof v!=="string"||v.trim().length<3||v.trim().length>500)
  return fail("FINANCE_VOUCHER_PURPOSE_INVALID","purpose");
 return v.trim().replace(/\s+/g," ");
};
const date=(v:unknown):string=>{
 if(typeof v!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))
  return fail("FINANCE_VOUCHER_DATE_INVALID","postingDate");
 const d=new Date(v+"T00:00:00Z");
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v)
  return fail("FINANCE_VOUCHER_DATE_INVALID","postingDate");
 return v;
};
const amountMinor=(v:unknown,field:string,positive=false):bigint=>{
 if(typeof v!=="string"||!/^([1-9][0-9]{0,11}|0)(\.[0-9]{1,2})?$/.test(v))
  return fail("FINANCE_VOUCHER_AMOUNT_INVALID",field);
 const [main,decimal=""]=v.split(".");
 const minor=BigInt(main)*100n+BigInt((decimal+"00").slice(0,2));
 if(minor>99999999999999n||(positive&&minor<=0n))
  return fail("FINANCE_VOUCHER_AMOUNT_INVALID",field);
 return minor;
};
function normalize(input:unknown):SafeDraft{
 if(!input||typeof input!=="object"||Array.isArray(input))
  return fail("FINANCE_VOUCHER_FORM_INVALID");
 const value=input as Record<string,unknown>;
 const fields=["financialYearRef","branchRef","branchVersion","voucherType","postingDate",
  "payeeName","purpose","lines","tax","charges","requestKey","expectedVersion"];
 if(Object.keys(value).some(k=>!fields.includes(k)))
  return fail("FINANCE_VOUCHER_FORM_INVALID");
 const year=uid(value.financialYearRef,"financialYearRef");
 const branch=value.branchRef?uid(value.branchRef,"branchRef"):null;
 const branchVersion=branch?value.branchVersion:null;
 if(branch&&(!Number.isSafeInteger(branchVersion)||Number(branchVersion)<1))
  return fail("FINANCE_BRANCH_STALE","branchRef");
 const kind=value.voucherType;
 if(!["PAYMENT","EXPENSE","CONTRA","GENERAL"].includes(String(kind)))
  return fail("FINANCE_VOUCHER_TYPE_INVALID","voucherType");
 if(!Array.isArray(value.lines)||!value.lines.length||value.lines.length>40)
  return fail("FINANCE_VOUCHER_LINES_INVALID","lines");
 let gross=0n;
 const lines=value.lines.map((row:unknown)=>{
  if(!row||typeof row!=="object"||Array.isArray(row))
   return fail("FINANCE_VOUCHER_LINES_INVALID","lines");
  const item=row as Record<string,unknown>;
  if(Object.keys(item).some(k=>!["description","quantity","unitRate"].includes(k)))
   return fail("FINANCE_VOUCHER_LINES_INVALID","lines");
  const desc=name(item.description,"lines",180);
  if(!Number.isSafeInteger(item.quantity)||Number(item.quantity)<1||Number(item.quantity)>1000000)
   return fail("FINANCE_VOUCHER_QUANTITY_INVALID","lines");
  const rate=amountMinor(item.unitRate,"lines",true);
  const qty=Number(item.quantity);
  const line=rate*BigInt(qty);
  if(line>99999999999999n)return fail("FINANCE_VOUCHER_AMOUNT_INVALID","lines");
  gross+=line;
  if(gross>99999999999999n)return fail("FINANCE_VOUCHER_AMOUNT_INVALID","lines");
  return {description:desc,quantity:qty,unitRateMinor:rate.toString(),
   lineTotalMinor:line.toString()};
 });
 const tax=amountMinor(value.tax??"0","tax"),
   charges=amountMinor(value.charges??"0","charges");
 const total=gross+tax+charges;
 if(gross<=0n||total>99999999999999n)
  return fail("FINANCE_VOUCHER_AMOUNT_INVALID","lines");
 return {year,branch,branchVersion:branch?Number(branchVersion):null,
  kind:kind as SafeDraft["kind"],date:date(value.postingDate),
  payee:name(value.payeeName,"payeeName",150),purpose:purpose(value.purpose),
  lines,grossMinor:gross.toString(),taxMinor:tax.toString(),
  chargesMinor:charges.toString(),totalMinor:total.toString()};
}
type Prior={voucher_id:string;payload_digest:string;version:number;voucher_number:string};
const fingerprint=(safe:SafeDraft,reference:string|null)=>createHash("sha256")
 .update(JSON.stringify({reference,safe})).digest("hex");

@Injectable()
export class FinanceVoucherDraftService{
 constructor(@Inject(DATABASE) private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 private async actor(bearer:string,capability:"finance.vouchers.manage"|"finance.vouchers.view"){
  return this.sessions.requireAction(bearer,capability);
 }
 async list(bearer:string){
  const actor=await this.actor(bearer,"finance.vouchers.view");
  const rows=await this.db.query<{voucherRef:string;voucherNumber:string;type:string;
    postingDate:string;payeeName:string;purpose:string;totalMinor:string;version:number}>(`
    SELECT id AS "voucherRef",voucher_number AS "voucherNumber",voucher_type AS type,
     posting_date::text AS "postingDate",payee_name AS "payeeName",
     purpose,total_minor::text AS "totalMinor",version
    FROM finance_voucher WHERE root_realm_id=$1 AND status='DRAFT'
    ORDER BY updated_at DESC,id DESC LIMIT 40`,[actor.realmId]);
  return {vouchers:rows.rows,status:"DRAFT_NOT_APPROVED_OR_POSTED"};
 }
 private async prior(client:PoolClient,actor:VerifiedFoundationActor,key:string){
  return client.query<Prior>(`
    SELECT v.id AS voucher_id,r.payload_digest,r.version,v.voucher_number
    FROM finance_voucher_draft_revision r
    JOIN finance_voucher v ON v.id=r.voucher_id AND v.root_realm_id=r.root_realm_id
    WHERE r.root_realm_id=$1 AND r.actor_ref=$2 AND r.request_key=$3 LIMIT 1`,
    [actor.realmId,actor.accountId,key]);
 }
 private async inspect(client:PoolClient,actor:VerifiedFoundationActor,safe:SafeDraft){
  const year=await client.query<{start_on:string;end_on:string;status:string}>(`
   SELECT start_on::text AS start_on,end_on::text AS end_on,status
   FROM financial_year WHERE id=$1 AND root_realm_id=$2 FOR SHARE`,
   [safe.year,actor.realmId]);
  if(!year.rows[0]||year.rows[0].status!=="OPEN")
   throw new ConflictException({code:"FINANCE_YEAR_CLOSED",field:"financialYearRef"});
  if(safe.date<year.rows[0].start_on||safe.date>year.rows[0].end_on)
   return fail("FINANCE_VOUCHER_DATE_INVALID","postingDate");
  if(safe.branch)await this.branches.financeActiveBranch(client,actor,safe.branch,
   safe.branchVersion??0,"finance.vouchers.manage");
 }
 private async commitDraft(client:PoolClient,actor:VerifiedFoundationActor,
  key:string,safe:SafeDraft,reference:string|null,expectedVersion:number|null){
  await this.identity.assertCurrent(client,actor,"finance.vouchers.manage");
  const hash=fingerprint(safe,reference);
  const existing=await this.prior(client,actor,key);
  if(existing.rows[0]){
   if(existing.rows[0].payload_digest!==hash)
    throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
   return {voucherRef:existing.rows[0].voucher_id,
    voucherNumber:existing.rows[0].voucher_number,
    version:existing.rows[0].version,confirmed:true as const,replayed:true};
  }
  await this.inspect(client,actor,safe);
  let voucherRef:string,voucherNumber:string,version:number;
  if(reference){
   const old=await client.query<{id:string;voucher_number:string;version:number;
      status:string;created_by:string}>(`
    SELECT id,voucher_number,version,status,created_by FROM finance_voucher
    WHERE id=$1 AND root_realm_id=$2 FOR UPDATE`,[reference,actor.realmId]);
   if(!old.rows[0]||old.rows[0].status!=="DRAFT")
    throw new ConflictException({code:"FINANCE_VOUCHER_NOT_EDITABLE"});
   if(old.rows[0].version!==expectedVersion)
    throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   voucherRef=old.rows[0].id;
   voucherNumber=old.rows[0].voucher_number;
   version=old.rows[0].version+1;
   await client.query(`
     UPDATE finance_voucher
     SET financial_year_id=$1,branch_id=$2,voucher_type=$3,posting_date=$4,
       payee_name=$5,purpose=$6,gross_minor=$7,tax_minor=$8,charges_minor=$9,
       total_minor=$10,version=$11,updated_at=now()
     WHERE id=$12 AND root_realm_id=$13`,
    [safe.year,safe.branch,safe.kind,safe.date,safe.payee,safe.purpose,
     safe.grossMinor,safe.taxMinor,safe.chargesMinor,safe.totalMinor,version,
     reference,actor.realmId]);
  }else{
   const out=await client.query<{id:string;voucher_number:string}>(`
     INSERT INTO finance_voucher(root_realm_id,financial_year_id,branch_id,voucher_type,
      posting_date,payee_name,purpose,gross_minor,tax_minor,charges_minor,total_minor,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id,voucher_number`,[actor.realmId,safe.year,safe.branch,safe.kind,
      safe.date,safe.payee,safe.purpose,safe.grossMinor,safe.taxMinor,
      safe.chargesMinor,safe.totalMinor,actor.accountId]);
   voucherRef=out.rows[0].id;
   voucherNumber=out.rows[0].voucher_number;
   version=1;
  }
  const header={financialYearRef:safe.year,branchRef:safe.branch,type:safe.kind,
    postingDate:safe.date,payeeName:safe.payee,purpose:safe.purpose};
  await client.query(`
    INSERT INTO finance_voucher_draft_revision(root_realm_id,voucher_id,version,
     header_snapshot,line_snapshot,gross_minor,tax_minor,charges_minor,total_minor,
     actor_ref,request_key,payload_digest)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)`,
   [actor.realmId,voucherRef,version,JSON.stringify(header),JSON.stringify(safe.lines),
    safe.grossMinor,safe.taxMinor,safe.chargesMinor,safe.totalMinor,
    actor.accountId,key,hash]);
  return {voucherRef,voucherNumber,version,confirmed:true as const,replayed:false};
 }
 async save(bearer:string,payload:unknown,voucherInput?:string){
  const capability="finance.vouchers.manage" as const;
  const actor=await this.actor(bearer,capability);
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   return fail("FINANCE_VOUCHER_FORM_INVALID");
  const body=payload as Record<string,unknown>;
  const key=uid(body.requestKey,"requestKey");
  const reference=voucherInput?uid(voucherInput,"voucherRef"):null;
  const expected=reference?body.expectedVersion:null;
  if(reference&&(!Number.isSafeInteger(expected)||Number(expected)<1))
   return fail("FINANCE_VOUCHER_STALE","expectedVersion");
  const safe=normalize(payload);
  const hash=fingerprint(safe,reference);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   try{
    const result=await this.commitDraft(client,actor,key,safe,reference,
      reference?Number(expected):null);
    await client.query("COMMIT");
    return result;
   }catch(e){
    await client.query("ROLLBACK");
    if(e&&typeof e==="object"&&"code" in e&&e.code==="23505"&&
      "constraint" in e&&e.constraint==="ux_cg09_voucher_request"){
      const prior=await this.prior(client,actor,key);
      if(prior.rows[0]&&prior.rows[0].payload_digest===hash)
       return {voucherRef:prior.rows[0].voucher_id,voucherNumber:prior.rows[0].voucher_number,
         version:prior.rows[0].version,confirmed:true as const,replayed:true};
      throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
    }
    if(e&&typeof e==="object"&&"code" in e){
     if(e.code==="P0901")throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
     if(e.code==="P0911")throw new BadRequestException({code:"FINANCE_VOUCHER_DATE_INVALID",field:"postingDate"});
     if(e.code==="P0904")throw new ConflictException({code:"FINANCE_BRANCH_INACTIVE",field:"branchRef"});
     if(e.code==="P0907")throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
    }
    throw e;
   }
  }finally{client.release();}
 }
 async lookup(bearer:string,requestInput:string){
  const actor=await this.actor(bearer,"finance.vouchers.manage");
  const key=uid(requestInput,"requestKey");
  const records=await this.db.query<{voucher_number:string}>(`
    SELECT v.voucher_number FROM finance_voucher_draft_revision r
    JOIN finance_voucher v ON v.id=r.voucher_id AND v.root_realm_id=r.root_realm_id
    WHERE r.root_realm_id=$1 AND r.actor_ref=$2 AND r.request_key=$3 LIMIT 1`,
    [actor.realmId,actor.accountId,key]);
  return {confirmed:Boolean(records.rows[0]),voucherNumber:records.rows[0]?.voucher_number??null};
 }
}
