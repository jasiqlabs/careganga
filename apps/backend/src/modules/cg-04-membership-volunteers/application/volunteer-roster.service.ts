import {BadRequestException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {object,pick,plain,uuid} from "../domain/tier-input";
import {rosterCsvCell} from "../domain/roster-csv-cell";
const states=["ALL","ACTIVE","INACTIVE","SUSPENDED"] as const;
const windows=["ALL","FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"] as const;
type Filter={q:string;status:string;availability:string;branch:string|null;department:string|null};
type Row={ref:string;volunteerNumber:string;name:string;mobile:string;email:string|null;branch:string|null;department:string;availability:string;
 joinedOn:string;status:string;city:string;district:string;skills:string[]};
function parse(raw:unknown):Filter{
 const x=object(raw,["q","status","availability","branch","department"]);
 return {q:plain(x.q??"",0,100,"search").toLowerCase(),
  status:pick(x.status??"ALL",states,"volunteer status"),
  availability:pick(x.availability??"ALL",windows,"availability"),
  branch:x.branch?uuid(x.branch):null,department:x.department?uuid(x.department):null};
}
@Injectable()
export class VolunteerRosterService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async run<T>(token:string,capability:string,fn:(tx:PoolClient,a:Actor)=>Promise<T>,read=true){
  const a=await this.sessions.requireAction(token,capability),tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertCurrent(tx,a,capability);
   const value=await fn(tx,a);await tx.query("COMMIT");return value;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async listRows(tx:PoolClient,a:Actor,filter:Filter,max:number,offset:number){
  const scope=await this.branches.projectBranchScope(tx,a),branches=scope.branches.map(x=>x.value);
  if(filter.branch&&!scope.all&&!branches.includes(filter.branch))
   throw new ForbiddenException("The selected volunteer branch is outside your permitted scope.");
  const rows=await tx.query<Row>(`SELECT v.id AS ref,v.volunteer_no AS "volunteerNumber",v.display_name AS name,
    applicant.contact_mobile AS mobile,applicant.contact_email AS email,b.name AS branch,
    d.name AS department,v.availability,v.status,v.skills,
    (v.created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS "joinedOn",
    app.city,area.display_name AS district
   FROM volunteer v
   JOIN volunteer_application app ON app.root_realm_id=v.root_realm_id AND app.id=v.original_application_id
   JOIN geography_area area ON area.root_realm_id=app.root_realm_id AND area.id=app.district_ref
   JOIN department d ON d.root_realm_id=v.root_realm_id AND d.id=v.department_ref
   JOIN account applicant ON applicant.realm_id=v.root_realm_id AND applicant.id=v.account_ref
   LEFT JOIN branch b ON b.root_realm_id=v.root_realm_id AND b.id=v.branch_ref
   WHERE v.root_realm_id=$1 AND ($2::boolean OR v.branch_ref=ANY($3::uuid[]))
    AND ($4::uuid IS NULL OR v.branch_ref=$4)
    AND ($5::uuid IS NULL OR v.department_ref=$5)
    AND ($6='ALL' OR v.status=$6)
    AND ($7='ALL' OR v.availability=$7)
    AND ($8='' OR strpos(lower(v.volunteer_no),$8)>0 OR strpos(lower(v.display_name),$8)>0
      OR strpos(lower(applicant.contact_mobile),$8)>0 OR strpos(lower(coalesce(applicant.contact_email,'')),$8)>0)
   ORDER BY v.created_at DESC,v.id DESC LIMIT $9 OFFSET $10`,
   [a.realmId,scope.all,branches,filter.branch,filter.department,filter.status,filter.availability,filter.q,max,offset]);
  return {items:rows.rows,branchOptions:scope.branches};
 }
 async list(token:string,raw:unknown){
  const x=object(raw,["q","status","availability","branch","department","offset"]);
  const filter=parse(Object.fromEntries(Object.entries(x).filter(([k])=>k!=="offset")));
  const offset=x.offset===undefined?0:Number(x.offset);
  if(!Number.isSafeInteger(offset)||offset<0||offset>5000)throw new BadRequestException("Choose a valid volunteer roster page.");
  return this.run(token,"volunteers.view",async(tx,a)=>{
   const page=await this.listRows(tx,a,filter,26,offset);
   const scope=await this.branches.projectBranchScope(tx,a);
   const overview=(await tx.query<{total:string;active:string;inactive:string;suspended:string}>(`SELECT count(*)::text AS total,
     count(*) FILTER(WHERE status='ACTIVE')::text AS active,
     count(*) FILTER(WHERE status='INACTIVE')::text AS inactive,
     count(*) FILTER(WHERE status='SUSPENDED')::text AS suspended
     FROM volunteer WHERE root_realm_id=$1 AND ($2::boolean OR branch_ref=ANY($3::uuid[]))`,
     [a.realmId,scope.all,scope.branches.map(x=>x.value)])).rows[0];
   return {items:page.items.slice(0,25),hasMore:page.items.length>25,offset,
    branchOptions:page.branchOptions,overview:{
     total:Number(overview?.total??0),active:Number(overview?.active??0),
     inactive:Number(overview?.inactive??0),suspended:Number(overview?.suspended??0)}
   };
  });
 }
 async export(token:string,raw:unknown){
  const filter=parse(raw);
  await this.sessions.requireAction(token,"volunteers.view");
  return this.run(token,"volunteers.export",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"volunteers.view");
   const page=await this.listRows(tx,a,filter,501,0);
   if(page.items.length>500)throw new BadRequestException("Narrow the volunteer filters before exporting more than 500 records.");
   const header=["Volunteer number","Name","Mobile","Email","Branch","Department","Availability","Status","Joined","City","District"];
   const rows=page.items.map(row=>[row.volunteerNumber,row.name,row.mobile,row.email,row.branch,row.department,row.availability,row.status,row.joinedOn,row.city,row.district].map(rosterCsvCell).join(","));
   const digest=createHash("sha256").update(JSON.stringify([a.realmId,a.accountId,filter])).digest("hex");
   await tx.query("INSERT INTO volunteer_roster_export_audit(root_realm_id,actor_ref,exported_rows,scope_digest) VALUES($1,$2,$3,$4)",
    [a.realmId,a.accountId,page.items.length,digest]);
   return {csv:[header.map(rosterCsvCell).join(","),...rows].join("\r\n"),rows:page.items.length};
  },false);
 }
}
