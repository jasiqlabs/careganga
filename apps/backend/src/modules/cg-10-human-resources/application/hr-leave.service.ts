import {Inject,Injectable,ForbiddenException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HrLeaveApprovalService} from "../../cg-03-registration-approvals/application/hr-leave-approval.service";
import {HrLeaveSourceFacade} from "./hr-leave-source.facade";
@Injectable()
export class HrLeaveService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly source:HrLeaveSourceFacade,private readonly approvals:HrLeaveApprovalService){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   const out=await fn(tx);await tx.query("COMMIT");return out;
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async mine(token:string,year:unknown){
  const actor=await this.sessions.verifySession(token);
  return this.run(tx=>this.source.mine(tx,actor,year));
 }
 async ownReason(token:string,reference:string){
  const actor=await this.sessions.verifySession(token);
  return this.run(tx=>this.source.ownReason(tx,actor,reference));
 }
 async withdraw(token:string,reference:string,body:unknown){
  const actor=await this.sessions.verifySession(token);
  return this.run(async tx=>{
   const root=await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR SHARE",[actor.realmId]);
   if(!root.rowCount)throw new ForbiddenException("Foundation leave access unavailable");
   return this.approvals.withdraw(tx,actor,reference,body);
  });
 }
 async submit(token:string,body:unknown){
  const actor=await this.sessions.verifySession(token);
  return this.run(async tx=>{
   const root=await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[actor.realmId]);
   if(!root.rowCount)throw new ForbiddenException("Foundation leave access unavailable");
   const submitted=await this.source.prepare(tx,actor,body);
   if(submitted.replay){
    const c=await this.approvals.current(tx,actor,submitted.caseRef,submitted.requestRef);
    return {submitted:true,reference:c.reference,caseStatus:c.status,replayed:true};
   }
   const c=await this.approvals.create(tx,actor,submitted);
   await this.source.link(tx,actor.realmId,submitted.requestRef,c.caseRef);
   return {submitted:true,reference:c.reference,caseStatus:c.status,replayed:false};
  });
 }
}
