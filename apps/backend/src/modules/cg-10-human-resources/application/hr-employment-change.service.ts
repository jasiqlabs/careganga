import {BadRequestException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {RolesService} from "../../cg-01-identity-access/application/roles.service";
import {HrEmploymentChangeApprovalService} from "../../cg-03-registration-approvals/application/hr-employment-change-approval.service";
import {HrEmploymentChangeSourceFacade,parseEmploymentChangeDraft} from "./hr-employment-change-source.facade";
@Injectable()
export class HrEmploymentChangeService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly roles:RolesService,
  private readonly source:HrEmploymentChangeSourceFacade,private readonly approval:HrEmploymentChangeApprovalService){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>,realm?:string){
  const tx=await this.db.connect();try{
   await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   if(realm&&!(await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[realm])).rowCount)
    throw new ForbiddenException("Foundation employment changes unavailable");
   const out=await fn(tx);await tx.query("COMMIT");return out;
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async create(token:string,body:unknown){
  const x=parseEmploymentChangeDraft(body),a=x.employeeReference?await this.sessions.requireAction(token,"hr.changes.manage"):await this.sessions.verifySession(token);
  return this.run(tx=>this.source.create(tx,a,body),a.realmId);
 }
 async edit(token:string,ref:string,body:unknown){
  const x=parseEmploymentChangeDraft(body,true),a=x.employeeReference?await this.sessions.requireAction(token,"hr.changes.manage"):await this.sessions.verifySession(token);
  return this.run(tx=>this.source.edit(tx,a,ref,body),a.realmId);
 }
 async submit(token:string,ref:string,body:unknown){
  const a=await this.sessions.verifySession(token);
  return this.run(async tx=>{
   const s=await this.source.prepareSubmit(tx,a,ref,body);
   if(s.replay)return {...this.source.summary(s.row),replayed:true};
   const caseRef=await this.approval.create(tx,a,s.submission);
   await this.source.link(tx,a,s.row,s.submission,caseRef,s.commandDigest);
   return {...this.source.summary(await this.source.original(tx,a.realmId,s.row.id)),replayed:false};
  },a.realmId);
 }
 async withdraw(token:string,ref:string,body:unknown){
  const a=await this.sessions.verifySession(token);
  return this.run(tx=>this.approval.withdraw(tx,a,ref,body),a.realmId);
 }
 async mine(token:string){
  const a=await this.sessions.verifySession(token);return this.run(tx=>this.source.myHistory(tx,a));
 }
 async ownDetail(token:string,ref:string){
  const a=await this.sessions.verifySession(token);return this.run(tx=>this.source.ownDetail(tx,a,ref));
 }
 async list(token:string,offsetInput:unknown){
  const a=await this.sessions.requireAction(token,"hr.changes.manage"),offset=Number(offsetInput??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
  return this.run(tx=>this.source.staffHistory(tx,a,offset));
 }
 async detail(token:string,ref:string){
  const a=await this.sessions.requireAction(token,"hr.changes.manage");return this.run(tx=>this.source.staffDetail(tx,a,ref));
 }
 async clearance(token:string,ref:string,body:unknown){
  const a=await this.sessions.requireAction(token,"hr.changes.manage");return this.run(tx=>this.source.recordClearance(tx,a,ref,body),a.realmId);
 }
 async employees(token:string,search=""){
  const a=await this.sessions.requireAction(token,"hr.changes.manage");
  if(typeof search!=="string"||search.length>80)throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
  return this.run(tx=>this.source.employeeOptions(tx,a,search.trim()));
 }
 async branches(token:string){
  const a=await this.sessions.requireAction(token,"hr.changes.manage");return this.run(tx=>this.source.branchOptions(tx,a));
 }
 async destination(token:string,branch:string){
  const a=await this.sessions.requireAction(token,"hr.changes.manage");return this.run(tx=>this.source.destinationOptions(tx,a,branch));
 }
 async roleOptions(token:string,search=""){
  await this.sessions.requireAction(token,"hr.changes.manage");await this.sessions.requireAction(token,"roles.select");return this.roles.options(token,search);
 }
}
