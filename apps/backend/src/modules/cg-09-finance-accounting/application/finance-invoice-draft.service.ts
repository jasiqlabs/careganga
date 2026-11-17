import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import {financeSqlFailure} from "./finance-sql-error";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Stage="INFO"|"ITEMS"|"PAYMENT";
type Draft={info?:{
 financialYearRef:string;branchRef:string|null;branchVersion:number|null;
 invoiceDate:string;dueDate:string;category:string;purpose:string;
 counterpartyName:string;counterpartyAddress:string|null};
 items?:{rows:{description:string;quantity:number;unitRateMinor:string;
  lineTotalMinor:string}[];grossMinor:string;taxMinor:string;chargesMinor:string;
  totalMinor:string};
 payment?:{receivableAccountRef:string;incomeAccountRef:string;
  taxAccountRef:string|null;terms:string;notes:string|null}};
type Stored={id:string;root_realm_id:string;created_by:string;version:number;
 current_digest:string;invoice_number:string;status:string;draft_payload:Draft};
type Previous={request_digest:string;invoice_id:string;source_version:number;result_status:string};
const reject=(code:string,field?:string):never=>{
 throw new BadRequestException({code,...(field?{field}:{})});
};
const ref=(v:unknown,field:string):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  return reject("FINANCE_INVOICE_SOURCE_INVALID",field);
 return v;
};
const text=(v:unknown,field:string,min:number,max:number):string=>{
 if(typeof v!=="string"||v.trim().length<min||v.trim().length>max||
    /[\u0000-\u001f\u007f]/.test(v))
  return reject("FINANCE_INVOICE_TEXT_INVALID",field);
 return v.trim().replace(/\s+/g," ");
};
const day=(v:unknown,field:string):string=>{
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))
  return reject("FINANCE_INVOICE_DATE_INVALID",field);
 const date=new Date(v+"T00:00:00Z");
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==v)
  return reject("FINANCE_INVOICE_DATE_INVALID",field);
 return v;
};
const money=(v:unknown,field:string,positive=false):bigint=>{
 if(typeof v!=="string"||!/^([1-9][0-9]{0,11}|0)(\.[0-9]{1,2})?$/.test(v))
  return reject("FINANCE_INVOICE_AMOUNT_INVALID",field);
 const [whole,fract=""]=v.split(".");
 const n=BigInt(whole)*100n+BigInt((fract+"00").slice(0,2));
 if(n>99999999999999n||(positive&&n<=0n))
  return reject("FINANCE_INVOICE_AMOUNT_INVALID",field);
 return n;
};
const valid=(body:unknown,keys:string[]):Record<string,unknown>=>{
 if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).some(k=>!keys.includes(k)))
  return reject("FINANCE_INVOICE_FORM_INVALID");
 return body as Record<string,unknown>;
};
function parseStage(stage:Stage,input:unknown):Draft[keyof Draft]{
 if(stage==="INFO"){
  const v=valid(input,["financialYearRef","branchRef","branchVersion",
   "invoiceDate","dueDate","category","purpose","counterpartyName","counterpartyAddress"]);
  const branch=v.branchRef?ref(v.branchRef,"branchRef"):null;
  const version=branch?v.branchVersion:null;
  if(branch&&(!Number.isSafeInteger(version)||Number(version)<1))
   return reject("FINANCE_BRANCH_STALE","branchRef");
  const date=day(v.invoiceDate,"invoiceDate"),due=day(v.dueDate,"dueDate");
  if(due<date)return reject("FINANCE_INVOICE_DATE_INVALID","dueDate");
  return {financialYearRef:ref(v.financialYearRef,"financialYearRef"),
   branchRef:branch,branchVersion:branch?Number(version):null,
   invoiceDate:date,dueDate:due,
   category:text(v.category,"category",2,80),purpose:text(v.purpose,"purpose",3,500),
   counterpartyName:text(v.counterpartyName,"counterpartyName",2,150),
   counterpartyAddress:v.counterpartyAddress?text(v.counterpartyAddress,
    "counterpartyAddress",2,250):null};
 }
 if(stage==="ITEMS"){
  const v=valid(input,["rows","tax","charges"]);
  if(!Array.isArray(v.rows)||v.rows.length<1||v.rows.length>40)
   return reject("FINANCE_INVOICE_ITEMS_INVALID","rows");
  let gross=0n;
  const rows=v.rows.map((raw:unknown)=>{
   const x=valid(raw,["description","quantity","unitRate"]);
   if(!Number.isSafeInteger(x.quantity)||Number(x.quantity)<1||Number(x.quantity)>1000000)
    return reject("FINANCE_INVOICE_ITEMS_INVALID","rows");
   const rate=money(x.unitRate,"rows",true),quantity=Number(x.quantity);
   const subtotal=rate*BigInt(quantity);gross+=subtotal;
   if(subtotal>99999999999999n||gross>99999999999999n)
    return reject("FINANCE_INVOICE_AMOUNT_INVALID","rows");
   return {description:text(x.description,"rows",2,180),
    quantity,unitRateMinor:rate.toString(),lineTotalMinor:subtotal.toString()};
  });
  const tax=money(v.tax??"0","tax"),charges=money(v.charges??"0","charges");
  const total=gross+tax+charges;
  if(!gross||total>99999999999999n)
   return reject("FINANCE_INVOICE_AMOUNT_INVALID","rows");
  return {rows,grossMinor:gross.toString(),taxMinor:tax.toString(),
   chargesMinor:charges.toString(),totalMinor:total.toString()};
 }
 const v=valid(input,["receivableAccountRef","incomeAccountRef","taxAccountRef","terms","notes"]);
 const asset=ref(v.receivableAccountRef,"receivableAccountRef"),
  income=ref(v.incomeAccountRef,"incomeAccountRef");
 const tax=v.taxAccountRef?ref(v.taxAccountRef,"taxAccountRef"):null;
 if(asset===income||asset===tax||income===tax)
  return reject("FINANCE_INVOICE_ACCOUNT_INVALID","receivableAccountRef");
 return {receivableAccountRef:asset,incomeAccountRef:income,
  taxAccountRef:tax,terms:text(v.terms??"Payment due per invoice",
    "terms",3,300),
  notes:v.notes?text(v.notes,"notes",2,500):null};
}
function stageOf(v:unknown):Stage{
 if(v==="INFO"||v==="ITEMS"||v==="PAYMENT")return v;
 return reject("FINANCE_INVOICE_STAGE_INVALID","stage");
}
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
@Injectable()
export class FinanceInvoiceDraftService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 private async owner(bearer:string,write=false){
  return this.sessions.requireAction(bearer,
   write?"finance.invoices.manage":"finance.invoices.view");
 }
 async options(bearer:string){
  const actor=await this.owner(bearer);
  const years=await this.db.query<{yearRef:string;name:string;startOn:string;
    endOn:string;status:string}>(
   "SELECT id AS \"yearRef\",name,start_on::text AS \"startOn\","+
   "end_on::text AS \"endOn\",status FROM financial_year "+
   "WHERE root_realm_id=$1 ORDER BY start_on DESC,id DESC LIMIT 30",[actor.realmId]);
  const branches=await this.branches.financeBranches(bearer,"finance.invoices.view");
  return {years:years.rows,branches};
 }
 async accounts(bearer:string,searchInput?:string){
  const actor=await this.owner(bearer);
  if(searchInput!==undefined&&(typeof searchInput!=="string"||searchInput.length>80))
   return reject("FINANCE_INVOICE_FILTER_INVALID","search");
  const allowed=await this.branches.financeBranches(bearer,"finance.invoices.view");
  const branches=allowed.map(b=>b.branchRef);
  const labels=new Map(allowed.map(b=>[b.branchRef,b.name]));
  const q=(searchInput??"").trim();
  const pattern="%"+q.replace(/[\\%_]/g,x=>"\\"+x)+"%";
  const rows=await this.db.query<{accountRef:string;name:string;code:string;
   category:string;branchRef:string|null;branchName:string|null}>(
   "SELECT a.id AS \"accountRef\",a.name,a.code,g.category,"+
   "a.branch_id AS \"branchRef\" "+
   "FROM finance_account a JOIN account_group g ON g.id=a.group_id "+
   "AND g.root_realm_id=a.root_realm_id "+
   "WHERE a.root_realm_id=$1 AND a.status='ACTIVE' "+
   "AND g.category IN('ASSET','INCOME','LIABILITY') "+
   "AND (a.branch_id IS NULL OR a.branch_id=ANY($3::uuid[])) "+
   "AND (a.name ILIKE $2 ESCAPE '\\' OR a.code ILIKE $2 ESCAPE '\\') "+
   "ORDER BY a.name,a.id LIMIT 51",
   [actor.realmId,pattern,branches]);
  return {accounts:rows.rows.slice(0,50).map(a=>({...a,
    branchName:a.branchRef?labels.get(a.branchRef)??null:null})),
    hasMore:rows.rows.length>50};
 }
 private async validateInfo(tx:PoolClient,actor:VerifiedFoundationActor,
  info:NonNullable<Draft["info"]>){
  await this.identity.assertCurrent(tx,actor,"finance.invoices.manage");
  const fy=await tx.query<{start_on:string;end_on:string;status:string}>(
   "SELECT start_on::text,end_on::text,status FROM financial_year "+
   "WHERE id=$1 AND root_realm_id=$2 FOR SHARE",
   [info.financialYearRef,actor.realmId]);
  const y=fy.rows[0];
  if(!y||y.status!=="OPEN"||info.invoiceDate<y.start_on||
     info.invoiceDate>y.end_on)
   throw new ConflictException({code:"FINANCE_YEAR_CLOSED",field:"financialYearRef"});
  if(info.branchRef)
   await this.branches.requireFinanceBranchVersion(tx,actor,info.branchRef,
    info.branchVersion??0,"finance.invoices.manage");
 }
 private async validatePayment(tx:PoolClient,actor:VerifiedFoundationActor,
  data:Draft){
  const info=data.info,payment=data.payment;
  if(!payment||!info)return;
  const rows=await tx.query<{id:string;category:string;account_kind:string;branch_id:string|null}>(
   "SELECT a.id,g.category,a.account_kind,a.branch_id FROM finance_account a "+
   "JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id "+
   "WHERE a.root_realm_id=$1 AND a.status='ACTIVE' "+
   "AND a.id=ANY($2::uuid[]) FOR SHARE OF a,g",
   [actor.realmId,[payment.receivableAccountRef,payment.incomeAccountRef,
    ...(payment.taxAccountRef?[payment.taxAccountRef]:[])]]);
  const found=new Map(rows.rows.map(r=>[r.id,r]));
  const eligible=(ref:string,cat:string)=>{
   const account=found.get(ref);
   return account?.category===cat&&(cat!=="ASSET"||account.account_kind==="GENERAL")&&
    (account.branch_id===null||account.branch_id===info.branchRef);
  };
  if(!eligible(payment.receivableAccountRef,"ASSET")||
     !eligible(payment.incomeAccountRef,"INCOME")||
     (payment.taxAccountRef&&!eligible(payment.taxAccountRef,"LIABILITY")))
   throw new ConflictException({code:"FINANCE_INVOICE_ACCOUNT_INVALID",
    field:"receivableAccountRef"});
 }
 async save(bearer:string,input:unknown,invoiceInput?:string){
  const actor=await this.owner(bearer,true);
  const body=valid(input,["stage","data","requestKey","expectedVersion"]);
  const stage=stageOf(body.stage),normalized=parseStage(stage,body.data);
  const key=ref(body.requestKey,"requestKey");
  const target=invoiceInput?ref(invoiceInput,"invoiceRef"):null;
  const expected=body.expectedVersion;
  if(target&&(!Number.isSafeInteger(expected)||Number(expected)<1))
   return reject("FINANCE_INVOICE_STALE","expectedVersion");
  if(!target&&expected!==undefined&&expected!==null)
   return reject("FINANCE_INVOICE_FORM_INVALID");
  const fingerprint=digest(["INVOICE_DRAFT_SAVE",stage,normalized,target,expected??null]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [actor.realmId+":"+actor.accountId+":"+key]);
   await this.identity.assertCurrent(tx,actor,"finance.invoices.manage");
   const prior=await tx.query<Previous>(
    "SELECT request_digest,invoice_id,source_version,result_status "+
    "FROM finance_invoice_command "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,actor.accountId,key]);
   if(prior.rows[0]){
    const row=prior.rows[0];
    if(row.request_digest!==fingerprint)
     throw new ConflictException({code:"FINANCE_INVOICE_REPLAY_CONFLICT"});
    const num=await tx.query<{invoice_number:string}>(
     "SELECT invoice_number FROM finance_invoice WHERE id=$1 AND root_realm_id=$2",
     [row.invoice_id,actor.realmId]);
    await tx.query("COMMIT");
    return {confirmed:true,invoiceRef:row.invoice_id,invoiceNumber:num.rows[0]?.invoice_number??null,
     version:row.source_version,status:row.result_status,replayed:true};
   }
   let invoice:Stored|undefined;
   if(target){
    const found=await tx.query<Stored>(
     "SELECT * FROM finance_invoice WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
     [target,actor.realmId]);
    invoice=found.rows[0];
    if(!invoice||invoice.created_by!==actor.accountId||
       !["DRAFT","RETURNED"].includes(invoice.status)||invoice.version!==expected)
     throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
   }
   const payload:Draft={...(invoice?.draft_payload??{}),[stage.toLowerCase()]:normalized};
   if(payload.info)await this.validateInfo(tx,actor,payload.info);
   if(payload.info&&payload.payment)await this.validatePayment(tx,actor,payload);
   const version=invoice?invoice.version+1:1;
   const sourceDigest=digest(["CG09_INVOICE_REVISION_V1",target??"NEW",version,payload]);
   // A first draft's persisted ID is itself a source fact; digest is actor-bound
   // and version-bound, never a posted financial event key.
   let id=target;
   if(invoice){
    const updated=await tx.query(
     "UPDATE finance_invoice SET version=$3,draft_payload=$4::jsonb,"+
     "current_digest=$5,status='DRAFT',approval_case_id=NULL,"+
     "financial_year_id=NULL,branch_id=NULL,invoice_date=NULL,due_date=NULL,"+
     "category_label=NULL,purpose=NULL,counterparty_name=NULL,counterparty_address=NULL,"+
     "gross_minor=NULL,tax_minor=NULL,charges_minor=NULL,total_minor=NULL,"+
     "receivable_account_id=NULL,income_account_id=NULL,tax_account_id=NULL,updated_at=now() "+
     "WHERE id=$1 AND root_realm_id=$2 AND status IN('DRAFT','RETURNED') "+
     "AND version=$6 RETURNING id",
     [id,actor.realmId,version,JSON.stringify(payload),sourceDigest,invoice.version]);
    if(updated.rowCount!==1)throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
   }else{
    const created=await tx.query<{id:string;invoice_number:string}>(
     "INSERT INTO finance_invoice(root_realm_id,version,draft_payload,current_digest,created_by) "+
     "VALUES($1,$2,$3::jsonb,$4,$5) RETURNING id,invoice_number",
     [actor.realmId,version,JSON.stringify(payload),sourceDigest,actor.accountId]);
    id=created.rows[0].id;
   }
   await tx.query(
    "INSERT INTO finance_invoice_revision(root_realm_id,invoice_id,version,"+
    "payload_digest,draft_payload,actor_ref) "+
    "VALUES($1,$2,$3,$4,$5::jsonb,$6)",
    [actor.realmId,id,version,sourceDigest,JSON.stringify(payload),actor.accountId]);
   await tx.query(
    "INSERT INTO finance_invoice_command(root_realm_id,actor_ref,request_key,invoice_id,"+
    "action,request_digest,result_status,source_version) "+
    "VALUES($1,$2,$3,$4,'DRAFT_SAVE',$5,'DRAFT',$6)",
    [actor.realmId,actor.accountId,key,id,fingerprint,version]);
   await tx.query(
    "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
    "VALUES($1,$2,'INVOICE',$3,'INVOICE_DRAFT_SAVED',$4)",
    [actor.realmId,actor.accountId,id,key]);
   const result=await tx.query<{invoice_number:string}>(
    "SELECT invoice_number FROM finance_invoice WHERE id=$1 AND root_realm_id=$2",
    [id,actor.realmId]);
   await tx.query("COMMIT");
   return {confirmed:true,invoiceRef:id,invoiceNumber:result.rows[0].invoice_number,
    version,status:"DRAFT",replayed:false};
  }catch(e){await tx.query("ROLLBACK");financeSqlFailure(e,"invoice");}finally{tx.release();}
 }
 async dashboard(bearer:string){
  const actor=await this.owner(bearer);
  const rows=await this.db.query<{total:number;drafts:number;pending:number;
   approved:number;issued:number;rejected:number;returned:number;
   paidVerified:number;partiallyPaid:number;faceValueMinor:string;issuedMinor:string;
   receivedVerifiedMinor:string}>(
   "WITH receipt_sums AS (SELECT invoice_id,root_realm_id,"+
   "SUM(amount_minor) AS paid_minor FROM finance_invoice_receipt "+
   "WHERE root_realm_id=$1 GROUP BY invoice_id,root_realm_id) "+
   "SELECT COUNT(i.id)::int AS total,"+
   "COUNT(i.id) FILTER(WHERE i.status='DRAFT')::int AS drafts,"+
   "COUNT(i.id) FILTER(WHERE i.status='SUBMITTED')::int AS pending,"+
   "COUNT(i.id) FILTER(WHERE i.status IN('APPROVED','POSTED'))::int AS approved,"+
   "COUNT(i.id) FILTER(WHERE i.status='ISSUED')::int AS issued,"+
   "COUNT(i.id) FILTER(WHERE i.status='REJECTED')::int AS rejected,"+
   "COUNT(i.id) FILTER(WHERE i.status='RETURNED')::int AS returned,"+
   "COUNT(i.id) FILTER(WHERE i.status='ISSUED' AND i.total_minor>0 "+
   "AND COALESCE(r.paid_minor,0)=i.total_minor)::int AS \"paidVerified\","+
   "COUNT(i.id) FILTER(WHERE i.status='ISSUED' "+
   "AND COALESCE(r.paid_minor,0)>0 AND r.paid_minor<i.total_minor)::int AS \"partiallyPaid\","+
   "COALESCE(SUM(i.total_minor),0)::text AS \"faceValueMinor\","+
   "COALESCE(SUM(i.total_minor) FILTER(WHERE i.status='ISSUED'),0)::text AS \"issuedMinor\","+
   "COALESCE(SUM(r.paid_minor),0)::text AS \"receivedVerifiedMinor\" "+
   "FROM finance_invoice i LEFT JOIN receipt_sums r "+
   "ON r.invoice_id=i.id AND r.root_realm_id=i.root_realm_id "+
   "WHERE i.root_realm_id=$1",[actor.realmId]);
  const monthly=await this.db.query<{month:string;count:number;issuedMinor:string}>(
   "SELECT to_char(date_trunc('month',created_at),'YYYY-MM') AS month,"+
   "COUNT(*)::int AS count,"+
   "COALESCE(SUM(total_minor) FILTER(WHERE status='ISSUED'),0)::text AS \"issuedMinor\" "+
   "FROM finance_invoice WHERE root_realm_id=$1 "+
   "AND created_at>=date_trunc('month',now())-interval '11 months' "+
   "GROUP BY date_trunc('month',created_at) "+
   "ORDER BY date_trunc('month',created_at) LIMIT 12",[actor.realmId]);
  return {cards:rows.rows[0],monthly:monthly.rows,
   explanation:"Invoice face value is not paid income. Verified receipts are separately linked to original reconciled bank journals."};
 }
 async list(bearer:string,offsetInput?:string,statusInput?:string){
  const actor=await this.owner(bearer);
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   return reject("FINANCE_INVOICE_FILTER_INVALID","offset");
  const validStatus=new Set(["ALL","DRAFT","SUBMITTED","RETURNED","REJECTED",
   "APPROVED","POSTED","ISSUED"]);
  if(statusInput!==undefined&&!validStatus.has(statusInput))
   return reject("FINANCE_INVOICE_FILTER_INVALID","status");
  const chosen=statusInput&&statusInput!=="ALL"?statusInput:null;
  const offset=Number(offsetInput??"0");
  const rows=await this.db.query<{invoiceRef:string;invoiceNumber:string;
   createdAt:Date;invoiceDate:string|null;dueDate:string|null;category:string|null;
   counterpartyName:string|null;totalMinor:string|null;status:string;version:number}>(
   "SELECT id AS \"invoiceRef\",invoice_number AS \"invoiceNumber\","+
   "created_at AS \"createdAt\",invoice_date::text AS \"invoiceDate\","+
   "due_date::text AS \"dueDate\",category_label AS category,"+
   "counterparty_name AS \"counterpartyName\",total_minor::text AS \"totalMinor\","+
   "status,version FROM finance_invoice WHERE root_realm_id=$1 "+
   "AND ($3::text IS NULL OR status=$3) "+
   "ORDER BY created_at DESC,id DESC LIMIT 41 OFFSET $2",
   [actor.realmId,offset,chosen]);
  return {invoices:rows.rows.slice(0,40),nextOffset:rows.rows.length>40?offset+40:null};
 }
 async detail(bearer:string,invoiceInput:string){
  const actor=await this.owner(bearer);
  const id=ref(invoiceInput,"invoiceRef");
  const rows=await this.db.query<{invoiceRef:string;invoiceNumber:string;
   createdBy:string;version:number;status:string;draft:Draft;sourceDigest:string}>(
   "SELECT id AS \"invoiceRef\",invoice_number AS \"invoiceNumber\","+
   "created_by AS \"createdBy\",version,status,draft_payload AS draft,"+
   "current_digest AS \"sourceDigest\" FROM finance_invoice "+
   "WHERE id=$1 AND root_realm_id=$2",[id,actor.realmId]);
  if(!rows.rows[0])throw new ConflictException({code:"FINANCE_INVOICE_SOURCE_INVALID"});
  return rows.rows[0];
 }
 async command(bearer:string,keyInput:string){
  const actor=await this.owner(bearer);
  const key=ref(keyInput,"requestKey");
  const rows=await this.db.query<{invoice_id:string;result_status:string;
   source_version:number}>(
   "SELECT invoice_id,result_status,source_version FROM finance_invoice_command "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [actor.realmId,actor.accountId,key]);
  return rows.rows[0]?{confirmed:true,invoiceRef:rows.rows[0].invoice_id,
   status:rows.rows[0].result_status,version:rows.rows[0].source_version}:
   {confirmed:false,status:"NOT_FOUND"};
 }
}
