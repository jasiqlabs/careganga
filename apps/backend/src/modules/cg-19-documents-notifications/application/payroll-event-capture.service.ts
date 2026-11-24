import {ConflictException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {CommunicationRecipientSource} from "../../cg-01-identity-access/application/communication-recipient-source.service";
import {NotificationService} from "./notification.service";
import {PayrollPayslipService} from "./payroll-payslip.service";
type Event={id:string;realm_id:string;recipient_ref:string|null;line_ref:string;event_kind:"GENERATED"|"PAID"|"FAILED"|"DELAYED";claim_token:string;attempt_count:number};
@Injectable()
export class PayrollEventCaptureService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly people:CommunicationRecipientSource,private readonly notifications:NotificationService,private readonly slips:PayrollPayslipService){}
 /** Bounded indexed global due recovery. Lease is not a staff session. */
 private async claim(){
  return (await this.db.query<Event>(`WITH next AS(
   SELECT id FROM cg19_payroll_event_outbox WHERE state='PENDING' AND due_at<=now() AND attempt_count<5
   AND (claimed_until IS NULL OR claimed_until<=now()) ORDER BY due_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)
   UPDATE cg19_payroll_event_outbox o SET claim_token=gen_random_uuid(),claimed_until=now()+interval '3 minutes',
   attempt_count=attempt_count+1 FROM next WHERE o.id=next.id RETURNING o.*`)).rows[0];
 }
 private async eligible(tx:Pool|PoolClient,e:Event){
  return e.recipient_ref!==null&&!!(await tx.query(`SELECT 1 FROM cg19_payroll_event_outbox WHERE realm_id=$1 AND id=$2 AND state='PENDING' AND claim_token=$3 AND claimed_until>now()
   AND cg19_payroll_event_matches(realm_id,id,recipient_ref)`,[e.realm_id,e.id,e.claim_token])).rowCount;
 }
 private async finish(e:Event,doc:string|null){
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const lock=await tx.query("SELECT 1 FROM cg19_payroll_event_outbox WHERE realm_id=$1 AND id=$2 AND state='PENDING' AND claim_token=$3 AND claimed_until>now() FOR UPDATE",[e.realm_id,e.id,e.claim_token]);
   if(!lock.rowCount){await tx.query("ROLLBACK");return;}
   const person=e.recipient_ref&&await this.eligible(tx,e)?await this.people.get(tx,e.realm_id,e.recipient_ref):null;
   if(!person?.active){
    await tx.query("UPDATE cg19_payroll_event_outbox SET state='SUPPRESSED',claim_token=NULL,claimed_until=NULL WHERE realm_id=$1 AND id=$2",[e.realm_id,e.id]);
    await tx.query("COMMIT");return;
   }
   if(e.event_kind==="GENERATED"&&!doc)throw new ConflictException("Original private salary statement unavailable");
   await tx.query("UPDATE cg19_payroll_event_outbox SET state='CAPTURED',doc_ref=$3,claim_token=NULL,claimed_until=NULL WHERE realm_id=$1 AND id=$2",[e.realm_id,e.id,doc]);
   const channels:("IN_APP"|"EMAIL")[]=["IN_APP"];
   if(person.emailVerified&&person.email&&await this.notifications.hasConsent(tx,e.realm_id,person.accountRef,"EMAIL","TRANSACTIONAL"))channels.push("EMAIL");
   for(const channel of channels){
    await tx.query(`INSERT INTO cg19_message_template(realm_id,kind,channel,version,subject,body,status,origin)
    SELECT $1,code,$2,1,subject,body,'APPROVED','SYSTEM' FROM cg19_payroll_event_copy($3) ON CONFLICT(realm_id,kind,channel,version) DO NOTHING`,[e.realm_id,channel,e.event_kind]);
    const saved=await tx.query<{id:string}>(`INSERT INTO cg19_notification(realm_id,source_kind,source_key,payroll_event_ref,recipient_id,template_id,template_version,channel,subject_snapshot,body_snapshot,purpose,state,due_at,expires_at)
     SELECT $1,'CG11_PAYROLL_EVENT',$2,$2,$3,t.id,t.version,$4,t.subject,t.body,'TRANSACTIONAL',CASE WHEN $4='EMAIL' THEN 'QUEUED' ELSE 'IN_APP' END,CASE WHEN $4='EMAIL' THEN now() ELSE NULL END,now()+interval '30 days'
     FROM cg19_message_template t CROSS JOIN cg19_payroll_event_copy($5) fixed
     WHERE t.realm_id=$1 AND t.channel=$4 AND t.kind=fixed.code AND t.version=1 AND t.status='APPROVED' AND t.subject=fixed.subject AND t.body=fixed.body
     ON CONFLICT DO NOTHING RETURNING id`,[e.realm_id,e.id,person.accountRef,channel,e.event_kind]);
    if(!saved.rowCount)throw new ConflictException("Original salary notice unavailable");
    await tx.query("INSERT INTO cg19_communication_event(realm_id,notification_id,kind) VALUES($1,$2,'SOURCE_CAPTURED')",[e.realm_id,saved.rows[0].id]);
   }
   await tx.query("COMMIT");
  }catch(err){await tx.query("ROLLBACK");throw err;}finally{tx.release();}
 }
 async tick(){
  // Crash at the fifth attempt cannot leave a permanently claimed job.
  await this.db.query(`WITH expired AS(SELECT id FROM cg19_payroll_event_outbox WHERE state='PENDING' AND due_at<=now() AND attempt_count=5 AND (claimed_until IS NULL OR claimed_until<=now()) ORDER BY due_at,id LIMIT 25 FOR UPDATE SKIP LOCKED)
    UPDATE cg19_payroll_event_outbox o SET state='FAILED',claim_token=NULL,claimed_until=NULL FROM expired WHERE o.id=expired.id`);
  for(let n=0;n<5;n++){
   const e=await this.claim();if(!e)break;
   try{
    let doc:string|null=null;
    if(e.event_kind==="GENERATED"&&await this.eligible(this.db,e)){
     const issued=await this.slips.issueApprovedEvent(e.realm_id,e.id,e.claim_token);
     if(!issued.confirmed)throw new ConflictException("Original private document unavailable");
     doc=issued.documentRef;
    }
    await this.finish(e,doc);
   }catch{
    await this.db.query(`UPDATE cg19_payroll_event_outbox SET state=CASE WHEN attempt_count>=5 THEN 'FAILED' ELSE 'PENDING' END,
     due_at=now()+make_interval(mins=>least(60,2^attempt_count::int)::int),claim_token=NULL,claimed_until=NULL
     WHERE realm_id=$1 AND id=$2 AND state='PENDING' AND claim_token=$3`,[e.realm_id,e.id,e.claim_token]);
   }
  }
 }
}
