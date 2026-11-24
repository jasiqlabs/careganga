import {createHash} from "node:crypto";
import {Injectable,ForbiddenException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

export type HrEditorialPerson={sourceRef:string;proof:string;name:string;designation:string};
type Row={sourceRef:string;name:string;designation:string;branchRef:string;assignmentRef:string;
 assignmentVersion:number;statusVersion:number;consentVersion:number;accountRef:string};
/** The original CG10 self-consent explicitly covers name and designation ONLY.
 * Never release branch geography, portrait, biography, contact or staff IDs. */
@Injectable()
export class HrPublicBioEditorialSource{
 constructor(private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async rows(db:Pool|PoolClient,root:string,refs:string[]|null,branches:string[]|null,lock=false){
  const q=await db.query<Row>(`SELECT e.id AS "sourceRef",app.legal_name AS name,a.designation,
   a.branch_ref AS "branchRef",a.id AS "assignmentRef",a.assignment_version AS "assignmentVersion",
   e.status_version AS "statusVersion",c.consent_version AS "consentVersion",e.account_ref AS "accountRef"
   FROM hr_employee e JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
   JOIN hr_public_bio_consent c ON c.root_realm_id=e.root_realm_id AND c.employee_id=e.id
    AND c.account_ref=e.account_ref AND c.consent_status='GRANTED'
   JOIN account acc ON acc.id=e.account_ref AND acc.realm_id=e.root_realm_id AND acc.status='ACTIVE'
   JOIN hr_employment_assignment a ON a.root_realm_id=e.root_realm_id AND a.employee_id=e.id
    AND a.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date
    AND (a.valid_to IS NULL OR a.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date)
   JOIN branch b ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id AND b.status='ACTIVE'
   WHERE e.root_realm_id=$1 AND e.status IN ('ACTIVE','PROBATION')
    AND ($2::uuid[] IS NULL OR e.id=ANY($2::uuid[]))
    AND ($3::uuid[] IS NULL OR a.branch_ref=ANY($3::uuid[]))
   ORDER BY app.legal_name,e.id LIMIT 101`+(lock?" FOR SHARE OF e,app,c,acc,a,b":""),[root,refs,branches]);
  // Ambiguous effective assignments are never selectable or public.
  return q.rows.filter((r,_,all)=>all.filter(x=>x.sourceRef===r.sourceRef).length===1&&
   r.name.trim().length>0&&r.name.length<=160&&r.designation.trim().length>0&&r.designation.length<=120&&
   !/[<>\u0000-\u001f\u007f]/.test(r.name+r.designation));
 }
 private card(root:string,r:Row):HrEditorialPerson{
  const proof=createHash("sha256").update(JSON.stringify([root,r.sourceRef,r.accountRef,r.consentVersion,
   r.statusVersion,r.assignmentRef,r.assignmentVersion,r.branchRef,r.name,r.designation])).digest("hex");
  return {sourceRef:r.sourceRef,proof,name:r.name,designation:r.designation};
 }
 async choices(tx:PoolClient,actor:VerifiedFoundationActor,refs:string[]|null=null){
  await this.identity.assertCurrent(tx,actor,"hr.employees.view");
  const scope=await this.branches.projectBranchScope(tx,actor);
  const rows=await this.rows(tx,actor.realmId,refs,scope.branches.map(b=>b.value),true);
  if(rows.length>100)throw new ForbiddenException("Narrow the current employee source scope.");
  return rows.map(r=>this.card(actor.realmId,r));
 }
 async currentCards(db:Pool|PoolClient,root:string,selected:readonly HrEditorialPerson[],lock=false){
  if(!selected.length)return [];
  const current=await this.rows(db,root,selected.map(x=>x.sourceRef),null,lock);
  const byRef=new Map(current.map(r=>[r.sourceRef,this.card(root,r)]));
  return selected.flatMap(x=>{
   const c=byRef.get(x.sourceRef);
   return c&&c.proof===x.proof&&c.name===x.name&&c.designation===x.designation?[c]:[];
  });
 }
}
