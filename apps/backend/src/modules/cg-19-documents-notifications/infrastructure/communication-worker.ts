import {
  Inject,Injectable,OnModuleDestroy,OnModuleInit
} from "@nestjs/common";
import type {Pool,PoolClient,Notification} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {NotificationService} from "../application/notification.service";
import {DeliveryService} from "../application/delivery.service";

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
    private readonly delivery:DeliveryService){}
  async onModuleInit(){
    this.stopped=false;
    // One LISTEN connection and one bounded due-index sweep per process.
    // No per-account timers or outbound requests when the queue is empty.
    const sub=await this.db.connect();
    try{
      await sub.query("LISTEN cg19_decision_committed");
      this.subscription=sub;
      sub.on("notification",(event:Notification)=>{
        if(event.channel==="cg19_decision_committed"&&
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
        const result=await this.source.captureCommittedDecisions(realm);
        if(!result.more)break;
      }
      await this.periodic();
    }catch{/* Durable replay cursor and due rows retain recovery state. */}
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
      sub.release();
    }
  }
}
