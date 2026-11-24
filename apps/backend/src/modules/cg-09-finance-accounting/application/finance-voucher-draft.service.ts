import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import {assertFinanceProject,financeProjectOptions} from "../../cg-05-projects-field-operations/application/project-finance-source";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

type SafeDraft={year:string;branch:string|null;branchVersion:number|null;paymentAccount:string|null;
 claimRef:string|null;claimVersion:number|null;projectRef?:string;
 debitAccount:string;creditAccount:string;
 kind:"PAYMENT"|"EXPENSE"|"CONTRA"|"GENERAL";date:string;payee:string;
 purpose:string;lines:{description:string;quantity:number;unitRateMinor:string;
 lineTotalMinor:string}[];grossMinor:string;taxMinor:string;chargesMinor:string;totalMinor:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  "payeeName","purpose","paymentAccountRef","debitAccountRef","creditAccountRef","lines","tax","charges","requestKey","expectedVersion","expenseClaimRef","expenseClaimVersion","projectRef"];
 if(Object.keys(value).some(k=>!fields.includes(k)))
  return fail("FINANCE_VOUCHER_FORM_INVALID");
 const year=uid(value.financialYearRef,"financialYearRef");
 const branch=value.branchRef?uid(value.branchRef,"branchRef"):null;
 const branchVersion=branch?value.branchVersion:null;
 if(branch&&(!Number.isSafeInteger(branchVersion)||Number(branchVersion)<1))
  return fail("FINANCE_BRANCH_STALE","branchRef");
 const claimRef=value.expenseClaimRef?uid(value.expenseClaimRef,"expenseClaimRef"):null;
 const claimVersion=claimRef?value.expenseClaimVersion:null;
 if(claimRef&&(!Number.isSafeInteger(claimVersion)||Number(claimVersion)<1))
  return fail("FINANCE_CLAIM_STALE","expenseClaimRef");
 const kind=value.voucherType;
 if(!["PAYMENT","EXPENSE","CONTRA","GENERAL"].includes(String(kind)))
  return fail("FINANCE_VOUCHER_TYPE_INVALID","voucherType");
 const projectRef=value.projectRef?uid(value.projectRef,"projectRef"):null;
 if(projectRef&&kind!=="EXPENSE")return fail("FINANCE_VOUCHER_FORM_INVALID","projectRef");
 const paymentAccount=value.paymentAccountRef?uid(value.paymentAccountRef,"paymentAccountRef"):null;
 const debitAccount=uid(value.debitAccountRef,"debitAccountRef");
 const creditAccount=uid(value.creditAccountRef,"creditAccountRef");
 if(debitAccount===creditAccount)
  return fail("FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID","creditAccountRef");
 if((kind==="PAYMENT"||kind==="CONTRA")&&creditAccount!==paymentAccount)
  return fail("FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID","creditAccountRef");
 if((kind==="PAYMENT"||kind==="CONTRA")&&!paymentAccount)
  return fail("FINANCE_VOUCHER_PAYMENT_ACCOUNT_REQUIRED","paymentAccountRef");
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
 return {year,branch,branchVersion:branch?Number(branchVersion):null,paymentAccount,
  claimRef,claimVersion:claimRef?Number(claimVersion):null,
  ...(projectRef?{projectRef}:{}),debitAccount,creditAccount,
  kind:kind as SafeDraft["kind"],date:date(value.postingDate),
  payee:name(value.payeeName,"payeeName",150),purpose:purpose(value.purpose),
  lines,grossMinor:gross.toString(),taxMinor:tax.toString(),
  chargesMinor:charges.toString(),totalMinor:total.toString()};
}
type Prior={voucher_id:string;payload_digest:string;version:number;voucher_number:string};
const fingerprint=(safe:SafeDraft,reference:string|null,expectedVersion:number|null)=>createHash("sha256")
 .update(JSON.stringify({reference,expectedVersion,safe})).digest("hex");

@Injectable()
export class FinanceVoucherDraftService{
 constructor(@Inject(DATABASE) private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 private async actor(bearer:string,capability:"finance.vouchers.manage"|"finance.vouchers.view"){
  return this.sessions.requireAction(bearer,capability);
 }
 /** Minimal masked selector scoped to current voucher access, not general ledger. */
 async paymentAccounts(bearer:string,queryInput?:string){
  const actor=await this.actor(bearer,"finance.vouchers.view");
  if(queryInput!==undefined&&(typeof queryInput!=="string"||queryInput.length>80))
   throw new BadRequestException({code:"FINANCE_ACCOUNT_SEARCH_INVALID",field:"search"});
  const search=(queryInput??"").trim();
  const pattern="%"+search.replace(/[\\%_]/g,character=>"\\"+character)+"%";
  const branches=await this.branches.financeBranches(bearer,"finance.vouchers.view");
  const allowed=branches.map(b=>b.branchRef);
  const labels=new Map(branches.map(b=>[b.branchRef,b.name]));
  const rows=await this.db.query<{accountRef:string;name:string;code:string;
   kind:string;branchRef:string|null}>(`
    SELECT a.id AS "accountRef",b.display_label AS name,a.code,
      b.kind,a.branch_id AS "branchRef"
    FROM cash_bank_account b JOIN finance_account a
      ON a.id=b.account_id AND a.root_realm_id=b.root_realm_id
    WHERE a.root_realm_id=$1 AND a.status='ACTIVE' AND b.status='ACTIVE'
      AND (a.branch_id IS NULL OR a.branch_id=ANY($3::uuid[]))
      AND (a.name ILIKE $2 ESCAPE '\\' OR b.display_label ILIKE $2 ESCAPE '\\'
       OR a.code ILIKE $2 ESCAPE '\\')
    ORDER BY b.display_label,a.id LIMIT 51`,[actor.realmId,pattern,allowed]);
  return {accounts:rows.rows.slice(0,50).map(row=>({
   ...row,branchName:row.branchRef?labels.get(row.branchRef)??null:null})),
   hasMore:rows.rows.length>50};
 }
 /** Current permitted voucher posting accounts; no broad ledger access. */
 async postingAccounts(bearer:string,queryInput?:string){
  const actor=await this.actor(bearer,"finance.vouchers.view");
  if(queryInput!==undefined&&(typeof queryInput!=="string"||queryInput.length>80))
   throw new BadRequestException({code:"FINANCE_ACCOUNT_SEARCH_INVALID",field:"search"});
  const search=(queryInput??"").trim();
  const pattern="%"+search.replace(/[\\%_]/g,part=>"\\"+part)+"%";
  const branches=await this.branches.financeBranches(bearer,"finance.vouchers.view");
  const allowed=branches.map(b=>b.branchRef),names=new Map(branches.map(b=>[b.branchRef,b.name]));
  const rows=await this.db.query<{accountRef:string;name:string;code:string;
    kind:string;category:string;branchRef:string|null}>(`
    SELECT a.id AS "accountRef",a.name,a.code,a.account_kind AS kind,
      g.category,a.branch_id AS "branchRef"
    FROM finance_account a JOIN account_group g
      ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
    WHERE a.root_realm_id=$1 AND a.status='ACTIVE'
     AND (a.branch_id IS NULL OR a.branch_id=ANY($3::uuid[]))
     AND (a.name ILIKE $2 ESCAPE '\\' OR a.code ILIKE $2 ESCAPE '\\')
    ORDER BY a.name,a.id LIMIT 51`,[actor.realmId,pattern,allowed]);
  return {accounts:rows.rows.slice(0,50).map(a=>({...a,
    branchName:a.branchRef?names.get(a.branchRef)??null:null})),hasMore:rows.rows.length>50};
 }
 async options(bearer:string){
  const actor=await this.actor(bearer,"finance.vouchers.view");
  const years=await this.db.query<{yearRef:string;name:string;startOn:string;
    endOn:string;status:string}>(`
    SELECT id AS "yearRef",name,start_on::text AS "startOn",
     end_on::text AS "endOn",status FROM financial_year WHERE root_realm_id=$1
     ORDER BY start_on DESC,id DESC LIMIT 30`,[actor.realmId]);
  const branches=await this.branches.financeBranches(bearer,"finance.vouchers.view");
  const scope=await this.branches.financeReportScope(bearer,"finance.vouchers.view");
  const projects=await financeProjectOptions(this.db,actor.realmId,scope);
  return {years:years.rows,branches,projects};
 }
 async list(bearer:string,offsetInput?:string){
  const actor=await this.actor(bearer,"finance.vouchers.view");
  const scope=await this.branches.financeReportScope(bearer,"finance.vouchers.view");
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   throw new BadRequestException({code:"FINANCE_FILTER_INVALID",field:"offset"});
  const offset=Number(offsetInput??"0");
  const rows=await this.db.query<{voucherRef:string;voucherNumber:string;type:string;
    postingDate:string;payeeName:string;purpose:string;totalMinor:string;version:number;status:string;approvalCaseRef:string|null;paymentAccountKind:"CASH"|"BANK"|null}>(`
    SELECT v.id AS "voucherRef",v.voucher_number AS "voucherNumber",v.voucher_type AS type,
     v.posting_date::text AS "postingDate",v.payee_name AS "payeeName",
     v.purpose,v.total_minor::text AS "totalMinor",v.version,v.status,
      v.approval_case_id AS "approvalCaseRef",b.kind AS "paymentAccountKind"
    FROM finance_voucher v LEFT JOIN cash_bank_account b ON b.account_id=v.payment_account_id
      AND b.root_realm_id=v.root_realm_id WHERE v.root_realm_id=$1
      AND ($3::boolean OR v.branch_id=ANY($4::uuid[]))
    ORDER BY v.updated_at DESC,v.id DESC LIMIT 41 OFFSET $2`,[actor.realmId,offset,scope.all,scope.branchRefs]);
  return {vouchers:rows.rows.slice(0,40),nextOffset:rows.rows.length>40?offset+40:null,
   status:"SOURCE_BACKED_VOUCHER_STATUS"};
 }
 /** Frozen historical snapshot for CG-03 review of the pinned case revision.
  * Not the editable current draft and never a payment source.
  */
 async historicalDetail(bearer:string,voucherInput:string,versionInput:string){
  const actor=await this.actor(bearer,"finance.vouchers.view");
  const voucherRef=uid(voucherInput,"voucherRef");
  const scope=await this.branches.financeReportScope(bearer,"finance.vouchers.view");
  if(!/^[1-9][0-9]{0,5}$/.test(versionInput))
   throw new BadRequestException({code:"FINANCE_VOUCHER_STALE",field:"expectedVersion"});
  const version=Number(versionInput);
  const record=await this.db.query<{voucherNumber:string;version:number;
   header:Record<string,unknown>;lines:Record<string,unknown>[];
   grossMinor:string;taxMinor:string;chargesMinor:string;totalMinor:string}>(`
   SELECT v.voucher_number AS "voucherNumber",r.version,
     r.header_snapshot AS header,r.line_snapshot AS lines,
     r.gross_minor::text AS "grossMinor",r.tax_minor::text AS "taxMinor",
     r.charges_minor::text AS "chargesMinor",r.total_minor::text AS "totalMinor"
   FROM finance_voucher_draft_revision r JOIN finance_voucher v
    ON v.id=r.voucher_id AND v.root_realm_id=r.root_realm_id
   WHERE v.id=$1 AND v.root_realm_id=$2 AND r.version=$3
     AND ($4::boolean OR v.branch_id=ANY($5::uuid[]))`,
   [voucherRef,actor.realmId,version,scope.all,scope.branchRefs]);
  if(!record.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
  return {...record.rows[0],status:"ORIGINAL_FROZEN_REVISION"};
 }
 async detail(bearer:string,voucherInput:string){
  const actor=await this.actor(bearer,"finance.vouchers.view");
  const ref=uid(voucherInput,"voucherRef");
  const scope=await this.branches.financeReportScope(bearer,"finance.vouchers.view");
  const found=await this.db.query<{voucherRef:string;voucherNumber:string;version:number;
    header:Record<string,unknown>;lines:Record<string,unknown>[];
    taxMinor:string;chargesMinor:string;grossMinor:string;totalMinor:string;status:string}>(`
    SELECT v.id AS "voucherRef",v.voucher_number AS "voucherNumber",
      v.version,v.status,r.header_snapshot AS header,r.line_snapshot AS lines,
      r.tax_minor::text AS "taxMinor",r.charges_minor::text AS "chargesMinor",
      r.gross_minor::text AS "grossMinor",r.total_minor::text AS "totalMinor"
    FROM finance_voucher v
    JOIN finance_voucher_draft_revision r
      ON r.voucher_id=v.id AND r.root_realm_id=v.root_realm_id AND r.version=v.version
    WHERE v.id=$1 AND v.root_realm_id=$2
      AND ($3::boolean OR v.branch_id=ANY($4::uuid[]))`,
    [ref,actor.realmId,scope.all,scope.branchRefs]);
  if(!found.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_NOT_EDITABLE"});
  return {...found.rows[0],status:found.rows[0].status};
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
  else await this.branches.requireFinanceRootScope(client,actor,"finance.vouchers.manage");
  const projectLabel=safe.projectRef?(await assertFinanceProject(client,actor,safe.projectRef,safe.branch)).label:null;
  if(safe.claimRef){
   await this.identity.assertCurrent(client,actor,"finance.claims.manage");
   if(!["EXPENSE","PAYMENT"].includes(safe.kind))
    return fail("FINANCE_CLAIM_VOUCHER_INVALID","expenseClaimRef");
   const claim=await client.query<{status:string;version:number;amount_minor:string}>(
    "SELECT status,version,amount_minor::text FROM expense_claim "+
    "WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
    [actor.realmId,safe.claimRef]);
   if(!claim.rows[0]||claim.rows[0].status!=="APPROVED"||
      claim.rows[0].version!==safe.claimVersion||
      claim.rows[0].amount_minor!==safe.totalMinor)
    throw new ConflictException({code:"FINANCE_CLAIM_VOUCHER_INVALID",
      field:"expenseClaimRef"});
  }
  const accounts=await client.query<{id:string;status:string;account_kind:string;
    branch_id:string|null;category:string}>(`
     SELECT a.id,a.status,a.account_kind,a.branch_id,g.category
     FROM finance_account a JOIN account_group g ON g.id=a.group_id
      AND g.root_realm_id=a.root_realm_id
     WHERE a.root_realm_id=$1 AND a.id=ANY($2::uuid[]) ORDER BY a.id FOR SHARE OF a,g`,
    [actor.realmId,[safe.debitAccount,safe.creditAccount]]);
  if(accounts.rows.length!==2||accounts.rows.some(a=>a.status!=="ACTIVE"||
     a.branch_id!==null&&a.branch_id!==safe.branch))
   throw new ConflictException({code:"FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID",
    field:"debitAccountRef"});
  const deb=accounts.rows.find(a=>a.id===safe.debitAccount)!;
  const cred=accounts.rows.find(a=>a.id===safe.creditAccount)!;
  if(safe.kind==="EXPENSE"&&(deb.category!=="EXPENSE"||cred.category!=="LIABILITY")||
     safe.kind==="PAYMENT"&&(!["EXPENSE","LIABILITY","ASSET"].includes(deb.category)||
       !["CASH","BANK"].includes(cred.account_kind))||
     safe.kind==="CONTRA"&&(!["CASH","BANK"].includes(deb.account_kind)||
       !["CASH","BANK"].includes(cred.account_kind)))
   throw new ConflictException({code:"FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID",
    field:"creditAccountRef"});
  if(safe.paymentAccount){
   const found=await client.query<{scope_kind:string;branch_id:string|null}>(`
    SELECT a.scope_kind,a.branch_id FROM finance_account a
    JOIN cash_bank_account b ON b.account_id=a.id AND b.root_realm_id=a.root_realm_id
    WHERE a.root_realm_id=$1 AND a.id=$2 AND a.status=\'ACTIVE\'
     AND b.status=\'ACTIVE\' AND a.account_kind IN (\'CASH\',\'BANK\')
    FOR SHARE OF a,b`,[actor.realmId,safe.paymentAccount]);
   if(!found.rows[0]||(found.rows[0].scope_kind==="BRANCH"&&
      found.rows[0].branch_id!==safe.branch))
    throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_ACCOUNT_UNAVAILABLE",field:"paymentAccountRef"});
  }
  return projectLabel;
 }
 private async commitDraft(client:PoolClient,actor:VerifiedFoundationActor,
  key:string,safe:SafeDraft,reference:string|null,expectedVersion:number|null){
  await this.identity.assertCurrent(client,actor,"finance.vouchers.manage");
  const hash=fingerprint(safe,reference,expectedVersion);
  const existing=await this.prior(client,actor,key);
  if(existing.rows[0]){
   if(existing.rows[0].payload_digest!==hash)
    throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
   return {voucherRef:existing.rows[0].voucher_id,
    voucherNumber:existing.rows[0].voucher_number,
    version:existing.rows[0].version,confirmed:true as const,replayed:true};
  }
  const projectLabel=await this.inspect(client,actor,safe);
  let voucherRef:string,voucherNumber:string,version:number;
  if(reference){
   const old=await client.query<{id:string;voucher_number:string;version:number;
      status:string;created_by:string;branch_id:string|null}>(`
    SELECT id,voucher_number,version,status,created_by,branch_id FROM finance_voucher
    WHERE id=$1 AND root_realm_id=$2 FOR UPDATE`,[reference,actor.realmId]);
   if(!old.rows[0]||!["DRAFT","RETURNED"].includes(old.rows[0].status))
    throw new ConflictException({code:"FINANCE_VOUCHER_NOT_EDITABLE"});
   if(old.rows[0].version!==expectedVersion)
    throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   if(old.rows[0].branch_id)
    await this.branches.requireFinanceActorBranch(client,actor,old.rows[0].branch_id,
     "finance.vouchers.manage");
   else await this.branches.requireFinanceRootScope(client,actor,"finance.vouchers.manage");
   voucherRef=old.rows[0].id;
   voucherNumber=old.rows[0].voucher_number;
   version=old.rows[0].version+1;
   await client.query(`
     UPDATE finance_voucher
     SET financial_year_id=$1,branch_id=$2,voucher_type=$3,posting_date=$4,
       payee_name=$5,purpose=$6,gross_minor=$7,tax_minor=$8,charges_minor=$9,
       total_minor=$10,version=$11,payment_account_id=$14,
       debit_account_id=$15,credit_account_id=$16,expense_claim_id=$17,
       expense_claim_version=$18,project_ref=$19,project_label=$20,status='DRAFT',approval_case_id=NULL,
       proof_file_id=NULL,proof_file_revision=NULL,updated_at=now()
     WHERE id=$12 AND root_realm_id=$13`,
    [safe.year,safe.branch,safe.kind,safe.date,safe.payee,safe.purpose,
     safe.grossMinor,safe.taxMinor,safe.chargesMinor,safe.totalMinor,version,
     reference,actor.realmId,safe.paymentAccount,safe.debitAccount,safe.creditAccount,
     safe.claimRef,safe.claimVersion,safe.projectRef??null,projectLabel]);
  }else{
   const out=await client.query<{id:string;voucher_number:string}>(`
     INSERT INTO finance_voucher(root_realm_id,financial_year_id,branch_id,voucher_type,
      posting_date,payee_name,purpose,gross_minor,tax_minor,charges_minor,total_minor,created_by,payment_account_id,
      debit_account_id,credit_account_id,expense_claim_id,expense_claim_version,project_ref,project_label)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING id,voucher_number`,[actor.realmId,safe.year,safe.branch,safe.kind,
      safe.date,safe.payee,safe.purpose,safe.grossMinor,safe.taxMinor,
      safe.chargesMinor,safe.totalMinor,actor.accountId,safe.paymentAccount,
      safe.debitAccount,safe.creditAccount,safe.claimRef,safe.claimVersion,safe.projectRef??null,projectLabel]);
   voucherRef=out.rows[0].id;
   voucherNumber=out.rows[0].voucher_number;
   version=1;
  }
  const header={financialYearRef:safe.year,branchRef:safe.branch,type:safe.kind,paymentAccountRef:safe.paymentAccount,
    debitAccountRef:safe.debitAccount,creditAccountRef:safe.creditAccount,
    expenseClaimRef:safe.claimRef,expenseClaimVersion:safe.claimVersion,
    ...(safe.projectRef?{projectRef:safe.projectRef,projectLabel}:{}),
    postingDate:safe.date,payeeName:safe.payee,purpose:safe.purpose};
  await client.query(`
    INSERT INTO finance_voucher_draft_revision(root_realm_id,voucher_id,version,
     header_snapshot,line_snapshot,gross_minor,tax_minor,charges_minor,total_minor,
     actor_ref,request_key,payload_digest)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)`,
   [actor.realmId,voucherRef,version,JSON.stringify(header),JSON.stringify(safe.lines),
    safe.grossMinor,safe.taxMinor,safe.chargesMinor,safe.totalMinor,
    actor.accountId,key,hash]);
  await client.query(`
   INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key)
   VALUES($1,$2,'VOUCHER',$3,$4,$5)`,
   [actor.realmId,actor.accountId,voucherRef,
    reference?"VOUCHER_DRAFT_REVISED":"VOUCHER_DRAFT_CREATED",key]);
  return {voucherRef,voucherNumber,version,confirmed:true as const,replayed:false};
 }
 /** Current CG09-owned bank options only; payroll cannot create a cash/bank master. */
 async payrollBankOptions(client:PoolClient,actor:VerifiedFoundationActor,branch:string|null){
  await this.identity.assertCurrent(client,actor,"finance.accounts.view");
  if(branch)await this.branches.requireFinanceActorBranch(client,actor,branch,"finance.accounts.view");else await this.branches.requireFinanceRootScope(client,actor,"finance.accounts.view");
  const rows=(await client.query<{value:string;label:string;maskedDetails:string|null}>(
   "SELECT a.id AS value,b.display_label AS label,b.masked_details AS \"maskedDetails\" FROM cash_bank_account b JOIN finance_account a ON a.root_realm_id=b.root_realm_id AND a.id=b.account_id WHERE a.root_realm_id=$1 AND a.status='ACTIVE' AND b.status='ACTIVE' AND b.kind='BANK' AND (a.branch_id IS NULL OR a.branch_id=$2) ORDER BY b.display_label,a.id LIMIT 101",[actor.realmId,branch])).rows;
  return {items:rows.slice(0,100),hasMore:rows.length>100};
 }
 async aidPaymentOptions(client:PoolClient,actor:VerifiedFoundationActor,branch:string|null){
  await this.identity.assertCurrent(client,actor,"finance.vouchers.manage");
  await this.identity.assertCurrent(client,actor,"finance.vouchers.view");
  if(branch)await this.branches.requireFinanceActorBranch(client,actor,branch,"finance.vouchers.manage");
  else await this.branches.requireFinanceRootScope(client,actor,"finance.vouchers.manage");
  const years=(await client.query<{value:string;label:string}>("SELECT id AS value,name AS label FROM financial_year WHERE root_realm_id=$1 AND status='OPEN' ORDER BY start_on DESC LIMIT 20",[actor.realmId])).rows;
  const accounts=(await client.query<{value:string;label:string}>("SELECT a.id AS value,a.code||' · '||a.name AS label FROM finance_account a JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id WHERE a.root_realm_id=$1 AND a.status='ACTIVE' AND g.category='EXPENSE' AND (a.branch_id IS NULL OR a.branch_id=$2::uuid) ORDER BY a.name,a.id LIMIT 100",[actor.realmId,branch])).rows;
  const paymentAccounts=(await client.query<{value:string;label:string}>("SELECT a.id AS value,b.display_label AS label FROM finance_account a JOIN cash_bank_account b ON b.root_realm_id=a.root_realm_id AND b.account_id=a.id WHERE a.root_realm_id=$1 AND a.status='ACTIVE' AND b.status='ACTIVE' AND a.account_kind IN('CASH','BANK') AND (a.branch_id IS NULL OR a.branch_id=$2::uuid) ORDER BY b.display_label,a.id LIMIT 100",[actor.realmId,branch])).rows;
  return {years,accounts,paymentAccounts};
 }
 /** Create a real aid PAYMENT voucher through the same validated draft owner.
  * The approved assistance source controls amount, branch and purpose; no alternate ledger. */
 async preparePayrollPayment(client:PoolClient,actor:VerifiedFoundationActor,v:{
  key:string;branch:string|null;year:string;date:string;debit:string;payment:string;minor:string;reference:string
 }){
  const minor=BigInt(v.minor);
  if(minor<1n||minor>99999999999999n)throw new ConflictException({code:"FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID"});
  const debit=await client.query("SELECT 1 FROM finance_account a JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id WHERE a.root_realm_id=$1 AND a.id=$2 AND a.status='ACTIVE' AND g.category='LIABILITY' FOR SHARE OF a,g",[actor.realmId,v.debit]);
  if(!debit.rowCount)throw new ConflictException({code:"FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID"});
  const branchVersion=v.branch?(await client.query<{version:number}>("SELECT version FROM branch WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[actor.realmId,v.branch])).rows[0]?.version:null;
  const amount=(minor/100n).toString()+"."+(minor%100n).toString().padStart(2,"0");
  const safe=normalize({requestKey:v.key,financialYearRef:v.year,branchRef:v.branch,branchVersion,voucherType:"PAYMENT",postingDate:v.date,payeeName:"Protected payroll employee",purpose:"Approved salary payable "+v.reference,paymentAccountRef:v.payment,debitAccountRef:v.debit,creditAccountRef:v.payment,lines:[{description:"Settlement of accrued salary payable",quantity:1,unitRate:amount}],tax:"0",charges:"0"});
  return this.commitDraft(client,actor,v.key,safe,null,null);
 }
 async prepareAidPayment(client:PoolClient,actor:VerifiedFoundationActor,v:{
  key:string;branch:string|null;year:string;date:string;debit:string;payment:string;minor:string;reference:string
 }){
  const minor=BigInt(v.minor);
  if(minor<1n||minor>99999999999999n)throw new ConflictException({code:"CG06_INVALID_INPUT"});
  const debit=await client.query("SELECT 1 FROM finance_account a JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id WHERE a.root_realm_id=$1 AND a.id=$2 AND a.status='ACTIVE' AND g.category='EXPENSE' FOR SHARE OF a,g",[actor.realmId,v.debit]);
  if(!debit.rowCount)throw new ConflictException({code:"FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID"});
  const branchVersion=v.branch?(await client.query<{version:number}>("SELECT version FROM branch WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[actor.realmId,v.branch])).rows[0]?.version:null;
  const amount=(minor/100n).toString()+"."+(minor%100n).toString().padStart(2,"0");
  const safe=normalize({requestKey:v.key,financialYearRef:v.year,branchRef:v.branch,branchVersion,voucherType:"PAYMENT",postingDate:v.date,payeeName:"Protected Foundation beneficiary",purpose:"Approved assistance "+v.reference,paymentAccountRef:v.payment,debitAccountRef:v.debit,creditAccountRef:v.payment,lines:[{description:"Approved beneficiary assistance",quantity:1,unitRate:amount}],tax:"0",charges:"0"});
  return this.commitDraft(client,actor,v.key,safe,null,null);
 }
 async prepareAidRecovery(client:PoolClient,actor:VerifiedFoundationActor,v:{key:string;originalVoucher:string;branch:string|null;year:string;date:string;minor:string;reference:string}){
  const original=(await client.query<{debit_account_id:string;credit_account_id:string;total_minor:string}>("SELECT debit_account_id,credit_account_id,total_minor::text FROM finance_voucher WHERE root_realm_id=$1 AND id=$2 AND voucher_type='PAYMENT' AND status='POSTED' AND branch_id IS NOT DISTINCT FROM $3::uuid FOR SHARE",[actor.realmId,v.originalVoucher,v.branch])).rows[0];
  if(!original||original.total_minor!==v.minor)throw new ConflictException({code:"CG06_SOURCE_STALE"});
  const minor=BigInt(v.minor),amount=(minor/100n).toString()+"."+(minor%100n).toString().padStart(2,"0");
  const branchVersion=v.branch?(await client.query<{version:number}>("SELECT version FROM branch WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[actor.realmId,v.branch])).rows[0]?.version:null;
  const safe=normalize({requestKey:v.key,financialYearRef:v.year,branchRef:v.branch,branchVersion,voucherType:"GENERAL",postingDate:v.date,payeeName:"Protected Foundation beneficiary",purpose:"Actual recovery of approved assistance "+v.reference,debitAccountRef:original.credit_account_id,creditAccountRef:original.debit_account_id,lines:[{description:"Documented return of beneficiary assistance",quantity:1,unitRate:amount}],tax:"0",charges:"0"});
  return this.commitDraft(client,actor,v.key,safe,null,null);
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
  const hash=fingerprint(safe,reference,reference?Number(expected):null);
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
     if(e.code==="P0913")throw new BadRequestException({code:"FINANCE_VOUCHER_LINES_INVALID",field:"lines"});
     if(e.code==="P0924")throw new ConflictException({code:"CG05_FINANCE_PROJECT_UNAVAILABLE",field:"projectRef"});
     if(e.code==="P0914")throw new ConflictException({code:"FINANCE_VOUCHER_PAYMENT_ACCOUNT_UNAVAILABLE",field:"paymentAccountRef"});
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
