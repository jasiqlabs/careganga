import {Inject,Injectable,ForbiddenException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HrAttendanceCorrectionApprovalService} from "../../cg-03-registration-approvals/application/hr-attendance-correction-approval.service";
import {HrAttendanceCorrectionSourceFacade,parseAttendanceCorrection} from "./hr-attendance-correction-source.facade";
@Injectable()
export class HrAttendanceCorrectionService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly source:HrAttendanceCorrectionSourceFacade,private readonly approvals:HrAttendanceCorrectionApprovalService){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   const out=await fn(tx);await tx.query("COMMIT");return out;
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async history(token:string,employeeReference:unknown){
  const actor=employeeReference!==undefined?await this.sessions.requireAction(token,"hr.attendance.correct"):await this.sessions.verifySession(token);
  return this.run(tx=>this.source.history(tx,actor,employeeReference));
 }
 async submit(token:string,body:unknown){
  const form=parseAttendanceCorrection(body);
  const actor=form.employeeReference?await this.sessions.requireAction(token,"hr.attendance.correct"):await this.sessions.verifySession(token);
  return this.run(async tx=>{
   const root=await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[actor.realmId]);
   if(!root.rowCount)throw new ForbiddenException("Foundation attendance correction unavailable");
   const s=await this.source.prepare(tx,actor,body);
   if(s.replay){const c=await this.approvals.current(tx,actor,s.caseRef,s.requestRef);
    return {submitted:true,reference:c.reference,caseStatus:c.status,replayed:true};}
   const c=await this.approvals.create(tx,actor,s);
   await this.source.link(tx,actor.realmId,s.requestRef,c.caseRef);
   return {submitted:true,reference:c.reference,caseStatus:c.status,replayed:false};
  });
 }
}
