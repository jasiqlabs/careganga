import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,ServiceUnavailableException} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso=/^\d{4}-\d{2}-\d{2}$/;
const uuid=(v:unknown)=>{if(typeof v!=="string"||!ID.test(v))throw new BadRequestException("Choose a permitted current report record.");return v.toLowerCase();};
const date=(v:unknown)=>{if(typeof v!=="string"||!iso.test(v)||!Number.isFinite(Date.parse(v+"T00:00:00Z"))||
 new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)throw new BadRequestException("Enter a valid report date.");return v;};
type Filters={branchRef?:string;partnerRef?:string;projectRef?:string;status?:string;from?:string;to?:string;q?:string;cursor?:string};
const parse=(raw:Record<string,unknown>):Filters=>{
 const keys=["branchRef","partnerRef","projectRef","status","from","to","q","cursor"];
 if(!raw||Array.isArray(raw)||Object.keys(raw).some(k=>!keys.includes(k)))throw new BadRequestException("Invalid report filter.");
 const f:Filters={};
 for(const k of ["branchRef","partnerRef","projectRef"] as const)if(raw[k]!==undefined)f[k]=uuid(raw[k]);
 for(const k of ["from","to"] as const)if(raw[k]!==undefined)f[k]=date(raw[k]);
 if(f.from&&f.to&&f.from>f.to)throw new BadRequestException("Report dates are reversed.");
 if(raw.status!==undefined){
  if(typeof raw.status!=="string"||!["ALL","DRAFT","SUBMITTED","APPROVED","RETURNED","REJECTED"].includes(raw.status))
   throw new BadRequestException("Invalid funding status.");
  f.status=raw.status;
 }
 if(raw.q!==undefined){
  if(typeof raw.q!=="string"||raw.q.length>100)throw new BadRequestException("Search is too long.");
  f.q=raw.q.trim().toLowerCase();
 }
 if(raw.cursor!==undefined){
  if(typeof raw.cursor!=="string"||raw.cursor.length>160||!/^[A-Za-z0-9_-]+$/.test(raw.cursor))
   throw new BadRequestException("Invalid report cursor.");
  f.cursor=raw.cursor;
 }
 return f;
};
const cursor=(text:string|undefined)=>{
 if(!text)return null;
 try{
  const parsed:unknown=JSON.parse(Buffer.from(text,"base64url").toString("utf8"));
  if(!Array.isArray(parsed)||parsed.length!==2||typeof parsed[0]!=="string"||
   !Number.isFinite(Date.parse(parsed[0])))throw Error();
  return [new Date(parsed[0]).toISOString(),uuid(parsed[1])] as const;
 }catch{throw new BadRequestException("Refresh the report cursor.");}
};
const csv=(value:unknown)=>{
 const v=String(value??"").replace(/[\r\n\t]/g," ").trim();
 const safe=/^[=+\-@]/.test(v)?"'"+v:v;
 return '"'+safe.replace(/"/g,'""')+'"';
};
type SourceRow={ref:string;branchRef:string|null;branchName:string|null;
 partnerName:string|null;projectName:string|null;hasProject:boolean;purpose:string;fundType:string;
 status:string;updatedAt:string;requestedMinor:string;
 receivedMinor:string;allocatedMinor:string;releasedMinor:string;utilizedMinor:string;invalidMinor:string};

/** US003: exclusively original signed CG08 commitment + original posted CG09.
 * No CG07 donation, CG17 patient money, private CG19 files, contact, or
 * CG18 editorial public-claim projection is accessible from this report. */
@Injectable()
export class CsrFundingReportsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 private readonly sql=[
 "WITH visible AS MATERIALIZED (",
 "SELECT f.id,f.root_realm_id,f.updated_at,f.branch_ref,f.csr_partner_id,",
 "f.project_ref,f.purpose,f.fund_type,f.status,f.requested_minor,",
 "b.name AS branch_name,p.legal_name AS partner_name,pr.title AS project_name",
 "FROM csr_funding_proposal f",
 "LEFT JOIN branch b ON b.root_realm_id=f.root_realm_id AND b.id=f.branch_ref",
 "LEFT JOIN csr_partner p ON p.root_realm_id=f.root_realm_id AND p.id=f.csr_partner_id",
 "LEFT JOIN project pr ON pr.root_realm_id=f.root_realm_id AND pr.id=f.project_ref",
 "AND pr.branch_ref IS NOT DISTINCT FROM f.branch_ref AND pr.status IN('PLANNED','ACTIVE')",
 "WHERE f.root_realm_id=$1 AND ($2::boolean OR f.branch_ref=ANY($3::uuid[]))",
 "AND ($4::boolean OR f.branch_ref IS NOT DISTINCT FROM $5::uuid)",
 "AND ($6::uuid IS NULL OR f.csr_partner_id=$6)",
 "AND ($7::uuid IS NULL OR f.project_ref=$7)",
 "AND ($8::text='ALL' OR f.status=$8)",
 "AND ($9::date IS NULL OR f.updated_at >= ($9::date::timestamp AT TIME ZONE 'Asia/Kolkata'))",
 "AND ($10::date IS NULL OR f.updated_at < (($10::date+INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata'))",
 "AND ($11::text='' OR strpos(lower(f.purpose),$11)>0 OR strpos(lower(coalesce(p.legal_name,'')),$11)>0)",
 "AND ($12::timestamptz IS NULL OR (f.updated_at,f.id)<($12::timestamptz,$13::uuid))",
 "ORDER BY f.updated_at DESC,f.id DESC LIMIT $14)",
 "SELECT v.id AS ref,v.branch_ref AS \"branchRef\",v.branch_name AS \"branchName\",",
 "v.partner_name AS \"partnerName\",v.project_name AS \"projectName\",v.project_ref IS NOT NULL AS \"hasProject\",v.purpose,",
 "v.fund_type AS \"fundType\",v.status,v.updated_at AS \"updatedAt\",",
 "v.requested_minor::text AS \"requestedMinor\",",
 "coalesce(bank.received,0)::text AS \"receivedMinor\",",
 "coalesce(bank.invalid,0)::text AS \"invalidMinor\",",
 "coalesce(bud.allocated,0)::text AS \"allocatedMinor\",",
 "coalesce(bud.released,0)::text AS \"releasedMinor\",",
 "coalesce(bud.utilized,0)::text AS \"utilizedMinor\"",
 "FROM visible v",
 "LEFT JOIN LATERAL (SELECT",
 "sum(rec.posted_amount_minor) FILTER (WHERE file.id IS NOT NULL AND intent.id IS NOT NULL",
 "AND reversal.id IS NULL AND rec.status='VERIFIED' AND rec.variance_minor=0) AS received,",
 "sum(rec.posted_amount_minor) FILTER (WHERE file.id IS NULL OR intent.id IS NULL",
 "OR reversal.id IS NOT NULL OR rec.status<>'VERIFIED' OR rec.variance_minor<>0) AS invalid",
 "FROM finance_csr_verified_receipt_link link",
 "JOIN finance_bank_reconciliation rec ON rec.root_realm_id=link.root_realm_id AND rec.id=link.reconciliation_id",
 "JOIN journal j ON j.root_realm_id=rec.root_realm_id AND j.id=rec.journal_id",
 "LEFT JOIN finance_reconciliation_decision d ON d.root_realm_id=rec.root_realm_id",
 "AND d.reconciliation_id=rec.id AND d.action='VERIFY' AND d.password_verified_at IS NOT NULL",
 "LEFT JOIN cg19_stored_file file ON file.realm_id=d.root_realm_id",
 "AND file.id=d.statement_file_id AND file.reconciliation_id=d.reconciliation_id",
 "AND file.revision=d.statement_file_version AND file.owner_kind='CG09_BANK_STATEMENT'",
 "AND file.scan_status='CLEAN_VERIFIED' AND file.revoked_at IS NULL",
 "LEFT JOIN cg19_upload_intent intent ON intent.realm_id=file.realm_id",
 "AND intent.id=file.upload_intent_id AND intent.reconciliation_id=rec.id",
 "AND intent.owner_kind='CG09_BANK_STATEMENT' AND intent.status='VALIDATED'",
 "LEFT JOIN journal reversal ON reversal.root_realm_id=j.root_realm_id",
 "AND reversal.reversal_of_id=j.id AND reversal.posting_kind='REVERSAL' AND reversal.status='POSTED'",
 "WHERE link.root_realm_id=v.root_realm_id AND link.funding_proposal_id=v.id",
 "AND link.remitter_attested) bank ON TRUE",
 "LEFT JOIN LATERAL (SELECT",
 "sum(CASE WHEN ev.kind='ALLOCATE' THEN ev.amount_minor "+
 "WHEN ev.kind='DEALLOCATE' THEN -ev.amount_minor ELSE 0 END) AS allocated,",
 "sum(ev.amount_minor) FILTER(WHERE ev.kind='DEALLOCATE') AS released,",
 "sum(ev.amount_minor) FILTER(WHERE ev.kind='UTILIZE' AND NOT EXISTS (",
 "SELECT 1 FROM journal reversal WHERE reversal.root_realm_id=ev.root_realm_id",
 "AND reversal.reversal_of_id=ev.source_journal_id",
 "AND reversal.posting_kind='REVERSAL' AND reversal.status='POSTED')) AS utilized",
 "FROM finance_csr_budget_effect link JOIN finance_budget_event ev",
 "ON ev.root_realm_id=link.root_realm_id AND ev.id=link.budget_event_id",
 "WHERE link.root_realm_id=v.root_realm_id AND link.funding_proposal_id=v.id) bud ON TRUE",
 "ORDER BY v.updated_at DESC,v.id DESC"
 ].join(" ");
 private async report(bearer:string,raw:Record<string,unknown>,max:26|1001){
  const f=parse(raw),page=cursor(f.cursor);
  await this.sessions.requireAction(bearer,"csr.partners.view");
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  const finances=await this.branches.financeReportScope(bearer,"finance.reports.view");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
   await this.identity.assertCurrent(tx,actor,"csr.partners.view");
   await this.identity.assertCurrent(tx,actor,"finance.reports.view");
   const csr=await this.branches.projectBranchScope(tx,actor);
   const all=csr.all&&finances.all;
   const branches=all?[]:finances.all?csr.branches.map(x=>x.value):
    csr.all?finances.branchRefs:
    csr.branches.map(x=>x.value).filter(x=>finances.branchRefs.includes(x));
   if(!all&&branches.length===0)throw new ForbiddenException("No current CSR and finance branch scope is assigned.");
   if(branches.length>100)throw new ConflictException("Narrow the permitted branch scope.");
   if(f.branchRef&&!all&&!branches.includes(f.branchRef))
    throw new ForbiddenException("This report branch is restricted.");
   if(all)await this.branches.requireFinanceRootScope(tx,actor,"finance.reports.view");
   else for(const id of branches)
    await this.branches.requireFinanceActiveBranch(tx,actor,id,"finance.reports.view");
   let projects=false;
   try{await this.identity.assertCurrent(tx,actor,"projects.view");projects=true;}
   catch(e){if(!(e instanceof ForbiddenException))throw e;}
   if(f.projectRef&&!projects)throw new ForbiddenException("Project reporting requires project access.");
   const rows=await tx.query<SourceRow>(this.sql,
    [actor.realmId,all,branches,f.branchRef!==undefined,f.branchRef??null,
     f.partnerRef??null,f.projectRef??null,f.status??"ALL",f.from??null,
     f.to??null,f.q??"",page?.[0]??null,page?.[1]??null,max]);
   const sourceAsOf=(await tx.query<{at:Date}>("SELECT transaction_timestamp() AS at")).rows[0].at.toISOString();
   await tx.query("COMMIT");
   // Recheck both original source grants after the snapshot, before disclosing amounts.
   await this.sessions.requireAction(bearer,"csr.partners.view");
   const currentActor=await this.sessions.requireAction(bearer,"finance.reports.view");
   if(currentActor.realmId!==actor.realmId||currentActor.accountId!==actor.accountId)throw new ForbiddenException("Reporting access changed. Refresh the report.");
   const currentFinance=await this.branches.financeReportScope(bearer,"finance.reports.view");
   await tx.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
   await this.identity.assertCurrent(tx,currentActor,"csr.partners.view");
   await this.identity.assertCurrent(tx,currentActor,"finance.reports.view");
   const currentCsr=await this.branches.projectBranchScope(tx,currentActor);
   if(all&&(!currentCsr.all||!currentFinance.all)||branches.some(id=>
      (!currentCsr.all&&!currentCsr.branches.some(b=>b.value===id))||(!currentFinance.all&&!currentFinance.branchRefs.includes(id))))
    throw new ForbiddenException("Reporting branch access changed. Refresh the report.");
   if(all)await this.branches.requireFinanceRootScope(tx,currentActor,"finance.reports.view");
   else for(const id of branches)await this.branches.requireFinanceActiveBranch(tx,currentActor,id,"finance.reports.view");
   if(projects)await this.identity.assertCurrent(tx,currentActor,"projects.view");
   await tx.query("COMMIT");
   const records=rows.rows.map(v=>{
    const received=BigInt(v.receivedMinor),allocated=BigInt(v.allocatedMinor),
     utilized=BigInt(v.utilizedMinor),invalid=BigInt(v.invalidMinor);
    const recheck=invalid>0n||allocated>received||utilized>allocated;
    return {ref:v.ref,branchRef:v.branchRef,branchName:v.branchName,
     partnerName:v.partnerName,projectName:projects?(v.projectName??(v.hasProject?"Project unavailable in current scope":null)):null,
     purpose:v.purpose,fundType:v.fundType,status:v.status,updatedAt:v.updatedAt,
     requestedMinor:v.requestedMinor,
     committedMinor:v.status==="APPROVED"?v.requestedMinor:"0",
     receivedMinor:v.receivedMinor,allocatedMinor:v.allocatedMinor,releasedMinor:v.releasedMinor,
     utilizedMinor:v.utilizedMinor,
     availableMinor:recheck?null:String(received-allocated),
     financeStatus:recheck?"REVALIDATION_REQUIRED":
      v.status==="APPROVED"?(received===0n?"RECEIPT_PENDING":"VERIFIED_SOURCE"):"NOT_APPROVED"};
   });
   const items=records.slice(0,max===26?25:1000),last=items.at(-1);
   return {items,hasMore:records.length>items.length,
    nextCursor:records.length>items.length&&last?
     Buffer.from(JSON.stringify([new Date(last.updatedAt).toISOString(),last.ref]),"utf8").toString("base64url"):null,
    sourceAsOf,currency:"INR",source:"CG08_APPROVED_CG09_VERIFIED",scope:all?"FOUNDATION":"ASSIGNED_BRANCHES",
    notice:"Committed means approved pledge, not received bank cash. Reversed/invalid proof requires CG09 revalidation."};
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   if(e instanceof BadRequestException||e instanceof ForbiddenException||e instanceof ConflictException)throw e;
   throw new ServiceUnavailableException("Original CG09 report unavailable. Finance verification pending.");
  }finally{tx.release();}
 }
 /** Bounded owner snapshot, never present an incomplete page as a total. */
 async misSummary(bearer:string,raw:Record<string,unknown>={}){
  const report=await this.report(bearer,raw,1001);
  const keys=["committedMinor","receivedMinor","allocatedMinor","releasedMinor","utilizedMinor","availableMinor"] as const;
  const unsafe=report.hasMore||report.items.some(v=>v.financeStatus==="REVALIDATION_REQUIRED"||
   (v.status!=="APPROVED"&&[v.receivedMinor,v.allocatedMinor,v.utilizedMinor].some(n=>BigInt(n)!==0n))||
   keys.some(k=>v[k]===null||BigInt(v[k]??"0")<0n));
  const totals=unsafe?null:Object.fromEntries(keys.map(k=>[k,report.items.reduce((sum,v)=>sum+BigInt(v[k]??"0"),0n).toString()]));
  return {state:unsafe?"PARTIAL" as const:report.items.length?"READY" as const:"EMPTY" as const,
   totals,sourceAsOf:report.sourceAsOf,scope:report.scope,count:unsafe?null:report.items.length,
   explanation:report.hasMore?"More than 1,000 proposals match. Narrow the proposal update dates.":unsafe?
    "Original CSR funding or finance proof requires revalidation. Totals withheld.":report.notice};
 }
 async list(bearer:string,raw:Record<string,unknown>){return this.report(bearer,raw,26);}
 async exportCsv(bearer:string,raw:Record<string,unknown>){
  if(raw.cursor!==undefined)throw new BadRequestException("Export starts from the first report row.");
  const result=await this.report(bearer,raw,1001);
  if(result.hasMore)throw new ConflictException("Narrow your report before exporting more than 1,000 rows.");
  const header=["Status","Finance verification","CSR partner","Project","Branch","Purpose",
   "Requested minor INR","Committed minor INR","Received minor INR","Allocated minor INR",
   "Released unspent allocation minor INR","Utilized minor INR","Available minor INR","Updated"];
  const content=result.items.map(v=>[v.status,v.financeStatus,v.partnerName??"Foundation",
   v.projectName??"General purpose",v.branchName??"Foundation",v.purpose,
   v.requestedMinor,v.committedMinor,v.receivedMinor,v.allocatedMinor,v.releasedMinor,
   v.utilizedMinor,v.availableMinor??"Verification pending",v.updatedAt].map(csv).join(","));
  return "\uFEFF"+header.map(csv).join(",")+"\r\n"+content.join("\r\n")+"\r\n";
 }
}
