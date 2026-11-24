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
 /** Historical read: current/last real assignment only, same authorized active branch. */
 async employeeForHistory(tx:PoolClient,a:Actor,employee:string){
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const row=(await tx.query<Employee>(`SELECT e.id,e.employee_code,app.legal_name AS name,h.designation,h.branch_ref,h.id AS assignment_ref,h.assignment_version,e.status_version,e.status
    FROM hr_employee e JOIN hr_employee_application app ON app.root_realm_id=e.root_realm_id AND app.id=e.application_id
    JOIN LATERAL (SELECT h.* FROM hr_employment_assignment h WHERE h.root_realm_id=e.root_realm_id AND h.employee_id=e.id AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY h.valid_from DESC,h.id DESC LIMIT 1) h ON true
    WHERE e.root_realm_id=$1 AND e.id=$2 AND (e.status='EXITED' OR h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date) FOR SHARE OF e`,[a.realmId,id(employee)])).rows[0];
  if(!row)throw new NotFoundException("Employee not available");
  const scope=await this.branches.projectBranchScope(tx,a);
  if(!scope.branches.some(b=>b.value===row.branch_ref))throw new NotFoundException("Employee not available");
  await this.branches.projectBranch(tx,a,row.branch_ref);return row;
 }
 /** Typed, reusable owner-side directory scope. No payroll data read by HR. */
 async directoryScope(tx:PoolClient,a:Actor,branchInput:unknown,qInput:unknown,filters:{department?:unknown;employmentType?:unknown;employmentStatus?:unknown}={}){
  const branch=branchInput?id(branchInput):null,q=typeof qInput==="string"?qInput.trim().toLowerCase().slice(0,80):"";
  await this.identity.assertCurrent(tx,a,"payroll.compensation.view");
  const scope=await this.branches.projectBranchScope(tx,a);
  if(branch&&!scope.branches.some(b=>b.value===branch))throw new ForbiddenException("Branch unavailable");
  const department=filters.department?id(filters.department):null;
  const type=filters.employmentType??"",status=filters.employmentStatus??"";
  if(typeof type!=="string"||!["","FULL_TIME","PART_TIME","CONTRACT","VOLUNTEER_STAFF"].includes(type)||typeof status!=="string"||!["","ACTIVE","PROBATION","ON_HOLD","PENDING_ACCESS","EXITED"].includes(status))throw new BadRequestException("Invalid employment filter");
  const refs=scope.branches.map(b=>b.value);
  const departments=(await tx.query<{value:string;label:string}>(`SELECT DISTINCT d.id AS value,d.name AS label FROM hr_employment_assignment h JOIN department d ON d.root_realm_id=h.root_realm_id AND d.id=h.department_ref WHERE h.root_realm_id=$1 AND h.branch_ref=ANY($2::uuid[]) AND ($3::uuid IS NULL OR h.branch_ref=$3) ORDER BY label,value LIMIT 200`,[a.realmId,refs,branch])).rows;
  if(department&&!departments.some(d=>d.value===department))throw new ForbiddenException("Department unavailable");
  let canViewDocuments=false;try{await this.identity.assertCurrent(tx,a,"hr.documents.manage");canViewDocuments=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
  return {canViewDocuments,branches:scope.branches.map(({value,label})=>({value,label})),departments,canManageFoundationPolicy:scope.all,params:[a.realmId,refs,branch,q,department,type,status]};
 }
}
 /** Original CG10 scoped current or last employment projection; parameters are validated by directoryScope. */
export const payrollEmployeeDirectorySql=`SELECT e.id AS ref,e.employee_code AS reference,app.legal_name AS name,h.designation,h.branch_ref AS "branchRef",e.status,h.employment_type AS "employmentType",d.name AS department,to_char(app.hire_date,'YYYY-MM-DD') AS "hireDate"
 FROM hr_employee e JOIN hr_employee_application app ON app.root_realm_id=e.root_realm_id AND app.id=e.application_id
 JOIN LATERAL (SELECT h.* FROM hr_employment_assignment h WHERE h.root_realm_id=e.root_realm_id AND h.employee_id=e.id AND h.valid_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY h.valid_from DESC,h.id DESC LIMIT 1) h ON true
 LEFT JOIN department d ON d.root_realm_id=h.root_realm_id AND d.id=h.department_ref
 WHERE e.root_realm_id=$1 AND h.branch_ref=ANY($2::uuid[]) AND ($3::uuid IS NULL OR h.branch_ref=$3)
 AND (e.status='EXITED' OR h.valid_to IS NULL OR h.valid_to>(now() AT TIME ZONE 'Asia/Kolkata')::date)
 AND ($4='' OR strpos(lower(app.legal_name),$4)>0 OR strpos(lower(e.employee_code),$4)>0 OR strpos(lower(COALESCE(d.name,'')),$4)>0)
 AND ($5::uuid IS NULL OR h.department_ref=$5) AND ($6='' OR h.employment_type=$6) AND ($7='' OR e.status=$7)`;
