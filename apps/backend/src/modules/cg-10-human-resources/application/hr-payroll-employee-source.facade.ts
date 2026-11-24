import {ForbiddenException,Injectable,NotFoundException,BadRequestException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
type Employee={id:string;name:string;employee_code:string;designation:string;branch_ref:string;assignment_ref:string;assignment_version:number;status_version:number;status:string};
function id(v:unknown){if(typeof v!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))throw new BadRequestException("Choose an existing employee or branch");return v.toLowerCase();}
/** Original CG10 read-only employee and effective assignment projection for payroll. */
@Injectable()
export class HrPayrollEmployeeSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 async employee(tx:PoolClient,a:Actor,employee:string,forDate:string|null=null){
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const e=(await tx.query<Employee>(`SELECT e.id,e.employee_code,app.legal_name AS name,a.designation,a.branch_ref,a.id AS assignment_ref,a.assignment_version,e.status_version,e.status
   FROM hr_employee e JOIN hr_employee_application app ON app.root_realm_id=e.root_realm_id AND app.id=e.application_id
   JOIN hr_employment_assignment a ON a.root_realm_id=e.root_realm_id AND a.employee_id=e.id
   WHERE e.root_realm_id=$1 AND e.id=$2 AND a.valid_from<=COALESCE($3::date,(now() AT TIME ZONE 'Asia/Kolkata')::date)
   AND (a.valid_to IS NULL OR a.valid_to>COALESCE($3::date,(now() AT TIME ZONE 'Asia/Kolkata')::date)) FOR SHARE OF e,a`,[a.realmId,id(employee),forDate])).rows;
  if(e.length!==1)throw new NotFoundException("Employee not available");
  const current=await this.branches.projectBranchScope(tx,a);
  if(!current.branches.some(b=>b.value===e[0].branch_ref))throw new NotFoundException("Employee not available");
  await this.branches.projectBranch(tx,a,e[0].branch_ref);
  return e[0];
 }
 async options(tx:PoolClient,a:Actor,branchInput:unknown,qInput:unknown){
  const branch=branchInput?id(branchInput):null,q=typeof qInput==="string"?qInput.trim().toLowerCase().slice(0,80):"";
   await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
   const scope=await this.branches.projectBranchScope(tx,a);
   if(branch&&!scope.branches.some(b=>b.value===branch))throw new ForbiddenException("Branch unavailable");
   const rows=(await tx.query(`SELECT e.id AS ref,e.employee_code AS reference,app.legal_name AS name,h.designation,h.branch_ref AS "branchRef",e.status
    FROM hr_employee e JOIN hr_employee_application app ON app.root_realm_id=e.root_realm_id AND app.id=e.application_id
    JOIN hr_employment_assignment h ON h.root_realm_id=e.root_realm_id AND h.employee_id=e.id
    WHERE e.root_realm_id=$1 AND e.status IN('ACTIVE','PROBATION') AND h.branch_ref=ANY($2::uuid[])
    AND ($3::uuid IS NULL OR h.branch_ref=$3) AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date
    AND (h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date)
    AND ($4='' OR strpos(lower(app.legal_name),$4)>0 OR strpos(lower(e.employee_code),$4)>0)
    ORDER BY app.legal_name,e.id LIMIT 101`,[a.realmId,scope.branches.map(b=>b.value),branch,q])).rows;
   return {branches:scope.branches.map(({value,label})=>({value,label})),items:rows.slice(0,100),hasMore:rows.length>100};
 }
}
