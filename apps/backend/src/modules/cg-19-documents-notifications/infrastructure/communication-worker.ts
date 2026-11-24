import {
  Inject,Injectable,OnModuleDestroy,OnModuleInit
} from "@nestjs/common";
import type {Pool,PoolClient,Notification} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {NotificationService} from "../application/notification.service";
import {DeliveryService} from "../application/delivery.service";
import {PayrollEventCaptureService} from "../application/payroll-event-capture.service";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
@Injectable()
export class CommunicationWorker implements OnModuleInit,OnModuleDestroy{
  private subscription:PoolClient|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private busy=false;
  private stopped=false;
  private rootRef:string|null=null;
  constructor(
    @Inject(DATABASE)private readonly db:Pool,
    private readonly source:NotificationService,
    private readonly delivery:DeliveryService,private readonly payroll:PayrollEventCaptureService){}
  async onModuleInit(){
    this.stopped=false;
    // One LISTEN connection and one bounded due-index sweep per process.
    // Bounded retry allows cloud compute cold-start / transient DNS blips to resolve without crashing startup.
    let sub: PoolClient | null = null;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3 && !this.stopped; attempt++) {
      try {
        sub = await this.db.connect();
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1) + Math.random() * 500));
        }
      }
    }
    if (!sub) throw lastErr;
    try{
      sub.on("error", () => {
        // Prevent idle client drops from causing unhandled process errors.
        try { sub?.release(); } catch {}
        if (this.subscription === sub) this.subscription = null;
      });
      await sub.query("LISTEN cg19_decision_committed");
      await sub.query("LISTEN cg19_appointment_committed");
      await sub.query("LISTEN cg19_lab_release_committed");
      await sub.query("LISTEN cg19_payroll_committed");
      this.subscription=sub;
      sub.on("notification",(event:Notification)=>{
        if(event.channel==="cg19_payroll_committed"){void this.periodic();return;}
        if((event.channel==="cg19_decision_committed"||
            event.channel==="cg19_appointment_committed"||
            event.channel==="cg19_lab_release_committed")&&
          event.payload&&UUID.test(event.payload))
          void this.wake(event.payload);
      });
      const roots=await this.db.query<{id:string}>(`
        SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT'
        ORDER BY id LIMIT 10
      `);
      // Recovery covers a crash between original CG-03 COMMIT and NOTIFY
      // consumer handling. Monotonic DB cursor is the actual checkpoint.
      this.rootRef=roots.rows[0]?.id??null;
      for(const root of roots.rows)void this.wake(root.id);
      this.timer=setInterval(()=>{void this.periodic();},60000);
      this.timer.unref?.();
    }catch(e){sub.release();throw e;}
  }
  private async wake(realm:string){
    if(this.stopped||!UUID.test(realm))return;
    // DB cursor FOR UPDATE synchronizes parallel instances safely.
    try{
      for(let i=0;i<40&&!this.stopped;i++){
        const decisions=await this.source.captureCommittedDecisions(realm);
        const appointments=await this.source.captureCommittedAppointments(realm);
        const reports=await this.source.captureCommittedLabReleases(realm);
        if(!decisions.more&&!appointments.more&&!reports.more)break;
      }
      await this.periodic();
    }catch{/* Durable replay cursor and due rows retain recovery state. */}
  }
  /**
   * Recover original committed appointments for every Foundation root, not
   * only the first root connected to this worker. Bounded due-only sweeps
   * preserve the existing CG-19 durable cursor and source-key deduplication.
   */
  private async reconcilePendingAppointments(){
    const due=await this.db.query<{realm_id:string}>(`
      SELECT realm_id FROM cg19_appointment_event_outbox
      WHERE state='PENDING'
      ORDER BY recorded_at,realm_id,event_id LIMIT 64
    `);
    const roots=[...new Set(due.rows.map(row=>row.realm_id))].slice(0,8);
    for(const root of roots){
      for(let batch=0;batch<4&&!this.stopped;batch++){
        const captured=await this.source.captureCommittedAppointments(root);
        if(!captured.more)break;
      }
    }
  }
  /** Due-only fallback across Foundation roots for original CG16 releases.
   * Does not poll patient or provider accounts; outbox indexes bound work.
   */
  private async reconcilePendingLabReleases(){
    const due=await this.db.query<{realm_id:string}>(
     "SELECT realm_id FROM cg19_lab_release_outbox "+
     "WHERE state='PENDING' "+
     "ORDER BY recorded_at,realm_id,release_ref LIMIT 64");
    const roots=[...new Set(due.rows.map(row=>row.realm_id))].slice(0,8);
    for(const root of roots){
      for(let batch=0;batch<4&&!this.stopped;batch++){
        const result=await this.source.captureCommittedLabReleases(root);
        if(!result.more)break;
      }
    }
  }
  private async periodic(){
    if(this.busy||this.stopped)return;
    this.busy=true;
    try{
      // One bounded durable source check per minute recovers a lost LISTEN
      // hint or more than 1000 events after a long outage.
      if(this.rootRef){
        for(let batch=0;batch<4&&!this.stopped;batch++){
          const progress=await this.source.captureCommittedDecisions(this.rootRef);
          if(!progress.more)break;
        }
      }
      await this.reconcilePendingAppointments();
      await this.reconcilePendingLabReleases();
      await this.payroll.tick();
      await this.delivery.tick();
    }
    catch{/* Fail closed: no fabricated delivered state or hidden queue success. */}
    finally{this.busy=false;}
  }
  async onModuleDestroy(){
    this.stopped=true;
    if(this.timer){clearInterval(this.timer);this.timer=null;}
    const sub=this.subscription;this.subscription=null;
    if(sub){
      try{await sub.query("UNLISTEN cg19_decision_committed");}catch{}
      try{await sub.query("UNLISTEN cg19_appointment_committed");}catch{}
      try{await sub.query("UNLISTEN cg19_lab_release_committed");}catch{}
      try{await sub.query("UNLISTEN cg19_payroll_committed");}catch{}
      sub.release();
    }
  }
}
