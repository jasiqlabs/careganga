import {Inject,Injectable,Logger,OnModuleInit,OnModuleDestroy} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {HrEmploymentChangeApprovalService} from "../../cg-03-registration-approvals/application/hr-employment-change-approval.service";
/** Bounded due-only worker, no employee scan and no new approval authority. */
@Injectable()
export class HrEmploymentChangeDueWorker implements OnModuleInit,OnModuleDestroy{
 private readonly log=new Logger(HrEmploymentChangeDueWorker.name);
 private timer:ReturnType<typeof setInterval>|undefined;private busy=false;
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly approval:HrEmploymentChangeApprovalService){}
 onModuleInit(){this.timer=setInterval(()=>void this.tick(),60000);this.timer.unref?.();void this.tick();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async tick(){
  if(this.busy)return;this.busy=true;
  try{
   const due=await this.db.query<{id:string;root_realm_id:string;case_ref:string}>(`SELECT h.id,h.root_realm_id,h.case_ref FROM hr_employment_change h
    WHERE h.status='APPROVED_PENDING_EFFECT' AND h.effective_date<=CURRENT_DATE AND (h.next_effect_attempt_at IS NULL OR h.next_effect_attempt_at<=now())
    AND (h.kind NOT IN('RESIGNATION','EXIT') OR (SELECT count(*) FROM hr_exit_clearance ec WHERE ec.root_realm_id=h.root_realm_id AND ec.change_id=h.id)=3)
    ORDER BY h.next_effect_attempt_at NULLS FIRST,h.effective_date,h.id LIMIT 10`);
   for(const item of due.rows){
    const tx=await this.db.connect();try{
     await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");await tx.query("SET LOCAL statement_timeout='10s'");
     const root=await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE SKIP LOCKED",[item.root_realm_id]);
     if(!root.rowCount){await tx.query("ROLLBACK");continue;}
     const row=await tx.query("SELECT id FROM hr_employment_change WHERE root_realm_id=$1 AND id=$2 AND case_ref=$3 AND status='APPROVED_PENDING_EFFECT' AND effective_date<=CURRENT_DATE AND (next_effect_attempt_at IS NULL OR next_effect_attempt_at<=now()) FOR UPDATE",[item.root_realm_id,item.id,item.case_ref]);
     if(!row.rowCount){await tx.query("ROLLBACK");continue;}
     await tx.query("SAVEPOINT effect");
     try{await this.approval.applyDue(tx,item.root_realm_id,item.case_ref);await tx.query("SET CONSTRAINTS ALL IMMEDIATE");await tx.query("RELEASE SAVEPOINT effect");}
     catch{
      await tx.query("ROLLBACK TO SAVEPOINT effect");
      await tx.query(`UPDATE hr_employment_change SET effect_attempt_count=effect_attempt_count+1,
       next_effect_attempt_at=now()+make_interval(mins=>LEAST(60,2+effect_attempt_count*5)),updated_at=now()
       WHERE root_realm_id=$1 AND id=$2 AND status='APPROVED_PENDING_EFFECT'`,[item.root_realm_id,item.id]);
      this.log.warn("Approved employment change remains pending; application not confirmed");
     }
     await tx.query("COMMIT");
    }catch{await tx.query("ROLLBACK").catch(()=>undefined);this.log.warn("Employment change transaction not confirmed");}
    finally{tx.release();}
   }
  }catch{this.log.warn("Employment change due check unavailable");}
  finally{this.busy=false;}
 }
}
