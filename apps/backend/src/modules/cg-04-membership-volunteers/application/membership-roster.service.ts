import {BadRequestException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {object,plain,uuid} from "../domain/tier-input";
import {rosterCsvCell} from "../domain/roster-csv-cell";
type Filter={q:string;status:string;category:string;feeClass:string;joinedFrom:string|null;joinedTo:string|null;branch:string|null;at:string|null;id:string|null};
type Row={ref:string;memberNumber:string;name:string;email:string|null;mobile:string;plan:string;category:string;joinedOn:string;expiresOn:string|null;status:string;city:string;district:string;branch:string|null;createdAt:string};
const categories=["ALL","ANNUAL","LIFETIME","HONORARY","STUDENT","OTHER"];
const statuses=["ALL","ACTIVE","EXPIRED","SUSPENDED","CANCELLED"];
const feeClasses=["ALL","GENERAL","PAID"];
function joinDate(value:unknown,label:string):string|null{
 if(value===undefined||value===null||value==="")return null;
 if(typeof value!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))throw new BadRequestException("Choose a valid "+label+" date.");
 const d=new Date(value+"T00:00:00.000Z");
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw new BadRequestException("Choose a valid "+label+" date.");
 return value;
}
function read(raw:unknown):Filter{
 const x=object(raw,["q","status","category","feeClass","joinedFrom","joinedTo","branch","cursor"]),status=x.status??"ALL",category=x.category??"ALL",feeClass=x.feeClass??"ALL";
 if(typeof status!=="string"||!statuses.includes(status))throw new BadRequestException("Choose a valid membership status.");
 if(typeof category!=="string"||!categories.includes(category))throw new BadRequestException("Choose a valid membership category.");
 if(typeof feeClass!=="string"||!feeClasses.includes(feeClass))throw new BadRequestException("Choose a valid general or paid membership filter.");
 const joinedFrom=joinDate(x.joinedFrom,"start"),joinedTo=joinDate(x.joinedTo,"end");
 if(joinedFrom&&joinedTo&&joinedFrom>joinedTo)throw new BadRequestException("The start date cannot be after the end date.");
 let at:string|null=null,id:string|null=null;
 if(x.cursor!==undefined&&x.cursor!==""){
  if(typeof x.cursor!=="string"||x.cursor.length>256)throw new BadRequestException("Reset the membership roster filters.");
  try{const d=JSON.parse(Buffer.from(x.cursor,"base64url").toString()) as {at?:string;id?:string};
   if(typeof d.at!=="string"||!Number.isFinite(Date.parse(d.at))||typeof d.id!=="string")throw Error();
   at=d.at;id=uuid(d.id);
  }catch{throw new BadRequestException("Reset the membership roster filters.");}
 }
 return {q:plain(x.q??"",0,100,"member search").toLowerCase(),status,category,feeClass,joinedFrom,joinedTo,branch:x.branch?uuid(x.branch):null,at,id};
}
const cols=[
 'm.id AS ref,m.member_no AS "memberNumber",m.display_name AS name',
 'a.contact_email AS email,a.contact_mobile AS mobile,v.name AS plan,v.category',
 "((m.created_at AT TIME ZONE 'Asia/Kolkata')::date)::text AS \"joinedOn\",t.expires_on::text AS \"expiresOn\"",
 "CASE WHEN m.status<>'ACTIVE' THEN m.status WHEN t.expires_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date THEN 'EXPIRED' ELSE 'ACTIVE' END AS status",
 'a.city,g.display_name AS district,b.name AS branch,m.created_at AS "createdAt"'
].join(",");
const joins=[
 ' FROM member m JOIN membership_application a ON a.root_realm_id=m.root_realm_id AND a.id=m.original_application_id',
 ' JOIN geography_area g ON g.root_realm_id=a.root_realm_id AND g.id=a.district_ref',
 " JOIN LATERAL (SELECT x.* FROM membership_term x WHERE x.root_realm_id=m.root_realm_id AND x.member_id=m.id AND x.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY x.starts_on DESC,x.id DESC LIMIT 1) t ON true",
 ' JOIN membership_tier_version v ON v.root_realm_id=t.root_realm_id AND v.id=t.tier_version_id',
 ' LEFT JOIN branch b ON b.root_realm_id=m.root_realm_id AND b.id=m.branch_ref'
].join("");
const where=[
 ' WHERE m.root_realm_id=$1 AND ($3::boolean OR m.branch_ref=ANY($2::uuid[]))',
 ' AND ($7::uuid IS NULL OR m.branch_ref=$7)',
 " AND ($4='ALL' OR (CASE WHEN m.status<>'ACTIVE' THEN m.status WHEN t.expires_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date THEN 'EXPIRED' ELSE 'ACTIVE' END)=$4)",
 " AND ($5='ALL' OR v.category=$5)",
 " AND ($6='' OR strpos(lower(m.member_no),$6)>0 OR strpos(lower(m.display_name),$6)>0 OR strpos(lower(a.contact_mobile),$6)>0 OR strpos(lower(coalesce(a.contact_email,'')),$6)>0)",
 " AND ($8='ALL' OR ($8='GENERAL' AND t.fee_minor=0) OR ($8='PAID' AND t.fee_minor>0))",
 " AND ($9::date IS NULL OR m.created_at>=($9::date::timestamp AT TIME ZONE 'Asia/Kolkata'))",
 " AND ($10::date IS NULL OR m.created_at < (($10::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata'))"
].join("");
@Injectable()
export class MembershipRosterService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async run<T>(token:string,permission:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>,readOnly:boolean){
  const a=await this.sessions.requireAction(token,permission),tx=await this.db.connect();
  try{await tx.query(readOnly?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertCurrent(tx,a,permission);const v=await fn(tx,a);await tx.query("COMMIT");return v;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async rows(tx:PoolClient,a:Actor,f:Filter,exporting:boolean){
  const scope=await this.branches.projectBranchScope(tx,a),allowed=scope.branches.map(v=>v.value);
  if(f.branch&&!scope.all&&!allowed.includes(f.branch))throw new ForbiddenException("That branch is outside your membership scope.");
  const args=[a.realmId,allowed,scope.all,f.status,f.category,f.q,f.branch,f.feeClass,f.joinedFrom,f.joinedTo];
  const order=" ORDER BY m.created_at DESC,m.id DESC LIMIT "+(exporting?"501":"26");
  const extra=exporting?"":" AND ($11::timestamptz IS NULL OR (m.created_at,m.id)<($11::timestamptz,$12::uuid))";
  const rs=await tx.query<Row>("SELECT "+cols+joins+where+extra+order,exporting?args:[...args,f.at,f.id]);
  const rows=rs.rows.slice(0,exporting?501:25),last=rows.at(-1);
  const nextCursor=!exporting&&rs.rows.length>25&&last?Buffer.from(JSON.stringify({at:last.createdAt,id:last.ref})).toString("base64url"):null;
  return {rows,nextCursor,hasMore:rs.rows.length>25&&!exporting,branchOptions:scope.branches.map(({value,label})=>({value,label}))};
 }
 private async overview(tx:PoolClient,a:Actor){
  const scope=await this.branches.projectBranchScope(tx,a);
  const q=await tx.query<{status:string;category:string;total:number}>([
   "SELECT state.status,v.category,count(*)::integer AS total FROM member m",
   "JOIN LATERAL (SELECT t.* FROM membership_term t WHERE t.root_realm_id=m.root_realm_id AND t.member_id=m.id",
   "AND t.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY t.starts_on DESC,t.id DESC LIMIT 1) term ON true",
   "JOIN membership_tier_version v ON v.root_realm_id=term.root_realm_id AND v.id=term.tier_version_id",
   "CROSS JOIN LATERAL (SELECT CASE WHEN m.status<>'ACTIVE' THEN m.status",
   "WHEN term.expires_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date THEN 'EXPIRED' ELSE 'ACTIVE' END AS status) state",
   "WHERE m.root_realm_id=$1 AND ($2::boolean OR m.branch_ref=ANY($3::uuid[]))",
   "GROUP BY state.status,v.category LIMIT 30"
  ].join(" "),[a.realmId,scope.all,scope.branches.map(x=>x.value)]);
  const byCategory:Record<string,number>={};
  let total=0,active=0,expired=0,cancelled=0,suspended=0;
  for(const item of q.rows){const n=Number(item.total);total+=n;byCategory[item.category]=(byCategory[item.category]??0)+n;
   if(item.status==="ACTIVE")active+=n;
   else if(item.status==="EXPIRED")expired+=n;
   else if(item.status==="CANCELLED")cancelled+=n;
   else if(item.status==="SUSPENDED")suspended+=n;
  }
  return {total,active,expired,cancelled,suspended,byCategory};
 }
 /** MIS scope comes from the owner, not finance or an arbitrary request UUID. */
 async misOptions(token:string){
  return this.run(token,"membership.members.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   return {branches:scope.branches.map(({value,label})=>({ref:value,name:label}))};
  },true);
 }
 /** Aggregate only; original approved enrollment and consent, no private roster rows. */
 async misCounts(token:string,branch?:string,from?:string,to?:string){
  const f=read({branch,joinedFrom:from,joinedTo:to});
  if(Boolean(f.joinedFrom)!==Boolean(f.joinedTo)||f.joinedFrom&&f.joinedTo&&Date.parse(f.joinedTo)-Date.parse(f.joinedFrom)>366*86400000)throw new BadRequestException("Choose a bounded enrollment date range.");
  return this.run(token,"membership.members.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   if(f.branch)await this.branches.projectBranch(tx,a,f.branch);
   const rows=(await tx.query<{status:string;total:number}>(`
    SELECT CASE WHEN m.status<>'ACTIVE' THEN m.status
     WHEN term.expires_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date THEN 'EXPIRED' ELSE 'ACTIVE' END status,count(*)::int total
    FROM member m
    JOIN membership_application app ON app.root_realm_id=m.root_realm_id AND app.id=m.original_application_id
     AND app.applicant_account_ref=m.account_ref AND app.status='APPROVED'
     AND app.consent_version='MEMBERSHIP_V1' AND app.consented_at IS NOT NULL
    JOIN LATERAL (SELECT t.expires_on FROM membership_term t WHERE t.root_realm_id=m.root_realm_id AND t.member_id=m.id
     AND t.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY t.starts_on DESC,t.id DESC LIMIT 1) term ON true
    WHERE m.root_realm_id=$1 AND (($2::boolean AND m.branch_ref IS NULL) OR m.branch_ref=ANY($3::uuid[]))
     AND ($4::uuid IS NULL OR m.branch_ref=$4)
     AND ($5::date IS NULL OR m.created_at>=($5::date::timestamp AT TIME ZONE 'Asia/Kolkata'))
     AND ($6::date IS NULL OR m.created_at<(($6::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata'))
    GROUP BY 1`,[a.realmId,scope.all,scope.branches.map(x=>x.value),f.branch,f.joinedFrom,f.joinedTo])).rows;
   const result={total:0,active:0,expired:0,cancelled:0,suspended:0};
   for(const row of rows){
    const key=row.status.toLowerCase();
    if(!["active","expired","cancelled","suspended"].includes(key)||!Number.isSafeInteger(row.total)||row.total<0)throw Error("Invalid roster count");
    result[key as "active"|"expired"|"cancelled"|"suspended"]+=row.total;result.total+=row.total;
   }
   return {...result,sourceAsOf:(await tx.query<{at:Date}>("SELECT transaction_timestamp() AS at")).rows[0].at.toISOString()};
  },true);
 }
 async list(token:string,raw:unknown){
  const filter=read(raw);
  return this.run(token,"membership.members.view",async(tx,a)=>{
   const page=await this.rows(tx,a,filter,false);
   return {items:page.rows.map(({createdAt,...r})=>r),nextCursor:page.nextCursor,hasMore:page.hasMore,branchOptions:page.branchOptions,overview:await this.overview(tx,a)};
  },true);
 }
 async export(token:string,raw:unknown){
  const filter=read(raw);if(filter.at)throw new BadRequestException("Export the filtered roster without a page cursor.");
  await this.sessions.requireAction(token,"membership.members.view");
  return this.run(token,"membership.members.export",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"membership.members.view");
   const page=await this.rows(tx,a,filter,true);
   if(page.rows.length>500)throw new BadRequestException("More than 500 members. Narrow filters before export.");
   const header=["Member number","Name","Email","Mobile","Plan","Category","Joined","Expires","Status","City","District","Branch"];
   const rows=page.rows.map(x=>[x.memberNumber,x.name,x.email,x.mobile,x.plan,x.category,x.joinedOn,x.expiresOn,x.status,x.city,x.district,x.branch].map(rosterCsvCell).join(","));
   const csv=[header.map(rosterCsvCell).join(","),...rows].join("\r\n");
   const scopeDigest=createHash("sha256").update(JSON.stringify([a.realmId,a.accountId,filter.q,filter.status,filter.category,filter.feeClass,filter.joinedFrom,filter.joinedTo,filter.branch])).digest("hex");
   await tx.query("INSERT INTO membership_member_export_audit(root_realm_id,actor_ref,exported_rows,scope_digest) VALUES($1,$2,$3,$4)",[a.realmId,a.accountId,page.rows.length,scopeDigest]);
   return {csv,rows:page.rows.length};
  },false);
 }
}
