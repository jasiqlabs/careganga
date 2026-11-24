import {BadRequestException,ForbiddenException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BeneficiariesService} from "./beneficiaries.service";
import {AssistanceService,aidDigest} from "./assistance.service";
import {parseListQuery,optionalRef} from "../domain/beneficiary-input";
export function reportCsvCell(v:unknown){
 const raw=String(v??"").replace(/[\r\n\t]/g," ");
 return '"'+(/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw).replace(/"/g,'""')+'"';
}
function period(raw:Record<string,unknown>){
 const q=parseListQuery({registeredFrom:raw.from,registeredTo:raw.to});
 if(q.from&&q.to&&Date.parse(q.to)-Date.parse(q.from)>366*86400000)throw new BadRequestException("Choose a delivery period of at most 366 days");
 return [q.from,q.to];
}
@Injectable()
export class BeneficiaryReportService{
 constructor(private readonly source:AssistanceService,private readonly beneficiaries:BeneficiariesService,private readonly identity:FoundationStructureIdentityFacade){}
 private async campaignScope(tx:PoolClient,a:Actor,raw:Record<string,unknown>,params:unknown[]){
  const campaign=optionalRef(raw.campaignRef);
  if(campaign){
   await this.identity.assertCurrent(tx,a,"campaigns.view");
   if(!(await tx.query("SELECT 1 FROM campaign WHERE root_realm_id=$1 AND id=$2 AND ((branch_ref IS NULL AND $3::boolean) OR branch_ref=ANY($4::uuid[])) AND ($5::uuid IS NULL OR branch_ref=$5) AND ($6::uuid IS NULL OR project_source_ref=$6) AND source_status IN('APPROVED','PUBLISHED','PAUSED','CLOSED')",[a.realmId,campaign,params[1],params[2],params[3],params[10]])).rowCount)throw new ForbiddenException("Campaign unavailable");
  }
  return campaign;
 }
 async campaignOptions(token:string,raw:Record<string,unknown>){
  return this.source.run(token,"beneficiaries.assistance.view",async(tx,a)=>{
   const {params}=await this.beneficiaries.reportScope(tx,a,parseListQuery(raw));
   try{await this.identity.assertCurrent(tx,a,"campaigns.view");}catch(e){if(e instanceof ForbiddenException)return {items:[]};throw e;}
   const items=(await tx.query("SELECT id AS value,code_norm||' · '||title AS label FROM campaign WHERE root_realm_id=$1 AND ((branch_ref IS NULL AND $2::boolean) OR branch_ref=ANY($3::uuid[])) AND ($4::uuid IS NULL OR branch_ref=$4) AND ($5::uuid IS NULL OR project_source_ref=$5) AND source_status IN('APPROVED','PUBLISHED','PAUSED','CLOSED') ORDER BY title,id LIMIT 100",[a.realmId,params[1],params[2],params[3],params[10]])).rows;
   return {items};
  },true);
 }
 async readBeneficiaryImpactForMIS(tx:PoolClient,a:Actor,raw:Record<string,unknown>){
  await this.identity.assertCurrent(tx,a,"beneficiaries.assistance.view");
  const q=parseListQuery(raw),{where,params}=await this.beneficiaries.reportScope(tx,a,q);
  const [from,to]=period(raw),campaign=await this.campaignScope(tx,a,raw,params);
  const eligible="WITH eligible AS (SELECT b.id,b.display_ref,b.branch_scope_id,b.gender,b.age_group,b.verification_state,b.lifecycle_state,b.beneficiary_category,b.beneficiary_type"+where+" AND b.consent_revoked_at IS NULL)";
  const events=eligible+", effects AS (SELECT d.action,d.at,a.item_ref,a.unit_code,f.quantity,f.amount_minor,a.beneficiary_id,a.reference FROM assistance_delivery_event d JOIN assistance_case a ON a.root_realm_id=d.root_realm_id AND a.id=d.assistance_id JOIN assistance_fulfillment f ON f.root_realm_id=d.root_realm_id AND f.id=d.fulfillment_id JOIN eligible b ON b.id=a.beneficiary_id AND b.branch_scope_id IS NOT DISTINCT FROM a.branch_ref WHERE d.root_realm_id=$1 AND ($19::date IS NULL OR d.at>=($19::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($20::date IS NULL OR d.at<(($20::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($21::uuid IS NULL OR a.campaign_ref=$21) AND ($11::uuid IS NULL OR a.project_ref=$11))";
  const ep=[...params,from,to,campaign];
  const summary=(await tx.query(eligible+" SELECT count(*)::int total,count(*) FILTER(WHERE gender='MALE')::int male,count(*) FILTER(WHERE gender='FEMALE')::int female,count(*) FILTER(WHERE gender IN('OTHER','NOT_SPECIFIED'))::int other_or_unknown,count(*) FILTER(WHERE age_group='CHILD')::int children,count(*) FILTER(WHERE lifecycle_state='ACTIVE')::int active,count(*) FILTER(WHERE verification_state='VERIFIED')::int verified FROM eligible",params)).rows[0];
  const financial=(await tx.query(events+" SELECT count(DISTINCT beneficiary_id) FILTER(WHERE action='PAID')::int AS recipients,COALESCE(sum(amount_minor) FILTER(WHERE action='PAID'),0)::text AS paid_minor,COALESCE(sum(amount_minor) FILTER(WHERE action='REVERSED'),0)::text AS reversed_minor,(COALESCE(sum(amount_minor) FILTER(WHERE action='PAID'),0)-COALESCE(sum(amount_minor) FILTER(WHERE action='REVERSED'),0))::text AS net_minor FROM effects",ep)).rows[0];
  const materials=(await tx.query(events+" SELECT i.sku_norm AS item_code,i.name AS item,e.unit_code AS unit,COALESCE(sum(e.quantity) FILTER(WHERE e.action='DELIVERED'),0)::text AS issued,COALESCE(sum(e.quantity) FILTER(WHERE e.action='RETURNED'),0)::text AS returned,(COALESCE(sum(e.quantity) FILTER(WHERE e.action='DELIVERED'),0)-COALESCE(sum(e.quantity) FILTER(WHERE e.action='RETURNED'),0))::text AS net FROM effects e JOIN inventory_item i ON i.root_realm_id=$1 AND i.id=e.item_ref WHERE e.action IN('DELIVERED','RETURNED') GROUP BY i.id,i.sku_norm,i.name,e.unit_code ORDER BY i.sku_norm,e.unit_code LIMIT 501",ep)).rows;
  const recipients=(await tx.query(events+" SELECT count(DISTINCT beneficiary_id) FILTER(WHERE action IN('DELIVERED','PAID'))::int AS recipients FROM effects",ep)).rows[0];
  const recent=(await tx.query(events+" SELECT reference,action,at,unit_code AS unit,quantity::text,amount_minor::text FROM effects ORDER BY at DESC,reference DESC LIMIT 20",ep)).rows;
  let projects:unknown[]|null=null;
  try{await this.identity.assertCurrent(tx,a,"projects.view");projects=(await tx.query(eligible+" SELECT p.id AS \"projectRef\",p.title AS project,count(DISTINCT b.id)::int AS beneficiaries FROM eligible b JOIN beneficiary_project_link l ON l.root_realm_id=$1 AND l.beneficiary_id=b.id AND l.ended_at IS NULL AND l.branch_scope_id IS NOT DISTINCT FROM b.branch_scope_id JOIN project p ON p.root_realm_id=l.root_realm_id AND p.id=l.project_ref WHERE p.status='ACTIVE' AND p.branch_ref IS NOT DISTINCT FROM b.branch_scope_id AND ($11::uuid IS NULL OR l.project_ref=$11) GROUP BY p.id,p.title ORDER BY p.title,p.id LIMIT 101",params)).rows;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
  return {summary,financial:{...financial,currency:"INR"},materials:materials.slice(0,500),materialsTruncated:materials.length>500,recipients:recipients.recipients,recent,projects:projects?.slice(0,100)??null,projectsTruncated:(projects?.length??0)>100,asOf:(await tx.query("SELECT transaction_timestamp() AS at")).rows[0].at,from,to};
 }
 async report(token:string,raw:Record<string,unknown>){
  return this.source.run(token,"beneficiaries.assistance.view",async(tx,a)=>{
   const report=await this.readBeneficiaryImpactForMIS(tx,a,raw);
   await tx.query("INSERT INTO beneficiary_report_access(root_realm_id,actor_ref,action,filter_digest,row_count) VALUES($1,$2,'READ',$3,$4)",[a.realmId,a.accountId,aidDigest(raw),report.summary.total]);
   return report;
  },true);
 }
 /** Current actor scope only. Never pass the detailed owner report or rare cells to MIS. */
 async misSummary(token:string){
  const x=await this.report(token,{});
  const {total,male,female,other_or_unknown,children,active,verified}=x.summary;
  const recipients=x.recipients;
  const counts=[total,male,female,other_or_unknown,children,active,verified,recipients];
  if(counts.some(v=>typeof v!=="number"||!Number.isSafeInteger(v)||v<0||v>total)||
     male+female+other_or_unknown!==total)throw Error("Beneficiary aggregate unavailable");
  // Suppress the whole report, including totals, if a complement reveals a rare group.
  const sensitive=[...counts,total-children,total-active,total-verified,total-recipients];
  const suppressed=sensitive.some(v=>v>0&&v<5);
  return {state:suppressed?"SUPPRESSED" as const:total===0?"EMPTY" as const:"READY" as const,
   rows:suppressed||total===0?[]:[{total:String(total),male:String(male),female:String(female),
    other:String(other_or_unknown),children:String(children),active:String(active),
    verified:String(verified),recipients:String(recipients)}],
   sourceAsOf:new Date(x.asOf).toISOString()};
 }
 async export(token:string,raw:Record<string,unknown>){
  return this.source.run(token,"beneficiaries.reports.export",async(tx,a)=>{
   const q=parseListQuery(raw),{where,params}=await this.beneficiaries.reportScope(tx,a,q);
   const aid=raw.exportKind==="AID_HISTORY";
   if(raw.exportKind!==undefined&&raw.exportKind!=="AID_HISTORY"&&raw.exportKind!=="REGISTER")throw new BadRequestException("Unknown report type");
   if(aid)await this.identity.assertCurrent(tx,a,"beneficiaries.assistance.view");
   const [from,to]=period(raw),campaign=aid?await this.campaignScope(tx,a,raw,params):null;
   const rows=aid?(await tx.query("WITH eligible AS (SELECT b.id,b.branch_scope_id,b.display_ref"+where+" AND b.consent_revoked_at IS NULL) SELECT b.display_ref,a.reference,d.action,d.at::text AS occurred_at,i.sku_norm AS item_code,a.unit_code,f.quantity::text,f.amount_minor::text FROM assistance_delivery_event d JOIN assistance_case a ON a.root_realm_id=d.root_realm_id AND a.id=d.assistance_id JOIN assistance_fulfillment f ON f.root_realm_id=d.root_realm_id AND f.id=d.fulfillment_id JOIN eligible b ON b.id=a.beneficiary_id AND b.branch_scope_id IS NOT DISTINCT FROM a.branch_ref LEFT JOIN inventory_item i ON i.root_realm_id=a.root_realm_id AND i.id=a.item_ref WHERE d.root_realm_id=$1 AND ($19::date IS NULL OR d.at>=($19::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($20::date IS NULL OR d.at<(($20::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($11::uuid IS NULL OR a.project_ref=$11) AND ($21::uuid IS NULL OR a.campaign_ref=$21) ORDER BY d.at DESC,d.id DESC LIMIT 501",[...params,from,to,campaign])).rows:
    (await tx.query("SELECT b.display_ref,b.beneficiary_type,b.verification_state,b.lifecycle_state,b.created_at::text"+where+" AND b.consent_revoked_at IS NULL ORDER BY b.created_at DESC,b.id DESC LIMIT 501",params)).rows;
   // Export minimal references; no precise geography, name, contact, child/gender
   // fields or rare category cells unless a future explicit policy allows it.
   const items=rows.slice(0,500),columns=aid?["display_ref","reference","action","occurred_at","item_code","unit_code","quantity","amount_minor"]:["display_ref","beneficiary_type","verification_state","lifecycle_state","created_at"];
   const csv=[columns.map(reportCsvCell).join(","),...items.map(r=>columns.map(k=>reportCsvCell(r[k])).join(","))].join("\r\n");
   await tx.query("INSERT INTO beneficiary_report_access(root_realm_id,actor_ref,action,filter_digest,row_count) VALUES($1,$2,'EXPORT',$3,$4)",[a.realmId,a.accountId,aidDigest(raw),items.length]);
   return {csv,rows:items.length,hasMore:rows.length>500};
  },true);
 }
}
