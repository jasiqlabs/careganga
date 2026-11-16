import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable
} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {CommunicationRecipientSource} from "../../cg-01-identity-access/application/communication-recipient-source.service";
import {CommittedDecisionSource} from "../../cg-03-registration-approvals/application/committed-decision-source.service";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Channel="IN_APP"|"EMAIL"|"SMS";
type Template={id:string;version:number;subject:string;body:string};
const textByChannel:Record<Channel,{subject:string;body:string}>={
  IN_APP:{subject:"Application decision recorded",
    body:"A decision was recorded on your Foundation application. Sign in to view its current status."},
  EMAIL:{subject:"CareGanga application update",
    body:"A decision was recorded on your CareGanga Foundation application. Sign in to your account for the current status."},
  SMS:{subject:"Foundation application update",
    body:"CareGanga: Your Foundation application has an update. Sign in to view details."}
};
function needUuid(value:unknown):string{
  if(typeof value!=="string"||!UUID.test(value))
    throw new BadRequestException("Choose a valid notification");
  return value;
}
@Injectable()
export class NotificationService{
  constructor(
    @Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly people:CommunicationRecipientSource,
    private readonly decisions:CommittedDecisionSource
  ){}
  private async ensureTemplate(client:PoolClient,realm:string,channel:Channel):
    Promise<Template>{
    const message=textByChannel[channel];
    // Code-defined generic event copy is identified as SYSTEM, not represented
    // as a human approved marketing template.
    await client.query(`
      INSERT INTO cg19_message_template(
        realm_id,kind,channel,version,subject,body,status,origin,approved_by)
      VALUES($1,'CG03_DECISION',$2,1,$3,$4,'APPROVED','SYSTEM',NULL)
      ON CONFLICT(realm_id,kind,channel,version) DO NOTHING
    `,[realm,channel,message.subject,message.body]);
    const t=await client.query<Template>(`
      SELECT id,version,subject,body FROM cg19_message_template
      WHERE realm_id=$1 AND kind='CG03_DECISION' AND channel=$2
        AND status='APPROVED' ORDER BY version DESC LIMIT 1
    `,[realm,channel]);
    if(!t.rowCount)throw new ConflictException("Current notification copy is unavailable");
    return t.rows[0];
  }
  async hasConsent(client:PoolClient,realm:string,account:string,
    channel:Channel,purpose:"TRANSACTIONAL"|"PROMOTIONAL"){
    if(channel==="IN_APP")return true;
    const c=await client.query(`
      SELECT 1 FROM cg19_channel_preference
      WHERE realm_id=$1 AND account_id=$2 AND channel=$3
        AND purpose=$4 AND opted_in
    `,[realm,account,channel,purpose]);
    return !!c.rowCount;
  }
  /** Bounded source recovery. PG timestamp is transmitted as exact text so
   * sub-millisecond committed events cannot be silently skipped or re-read.
   * The cursor and inserts commit atomically, with one row lock per root.
   */
  async captureCommittedDecisions(realm:string):Promise<{processed:number;more:boolean}>{
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const root=await client.query(`
        SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'
      `,[realm]);
      if(!root.rowCount)throw new ForbiddenException("Foundation scope unavailable");
      await client.query(`
        INSERT INTO cg19_decision_cursor(realm_id)
        VALUES($1) ON CONFLICT(realm_id) DO NOTHING
      `,[realm]);
      const pointer=await client.query<{
        last_created_at:string;last_decision_id:string
      }>(`
        SELECT last_created_at::text AS last_created_at,last_decision_id
        FROM cg19_decision_cursor WHERE realm_id=$1 FOR UPDATE
      `,[realm]);
      const cursor=pointer.rows[0];
      const events=await this.decisions.after(client,realm,cursor.last_created_at,
        cursor.last_decision_id,25);
      const templates=new Map<Channel,Template>();
      for(const event of events){
        const person=await this.people.get(client,realm,event.recipientRef);
        if(person?.active){
          const channels:Channel[]=["IN_APP"];
          if(person.emailVerified&&await this.hasConsent(client,realm,person.accountRef,"EMAIL","TRANSACTIONAL"))
            channels.push("EMAIL");
          if(person.mobileVerified&&await this.hasConsent(client,realm,person.accountRef,"SMS","TRANSACTIONAL"))
            channels.push("SMS");
          for(const channel of channels){
            let template=templates.get(channel);
            if(!template){template=await this.ensureTemplate(client,realm,channel);
              templates.set(channel,template);}
            const inserted=await client.query<{id:string}>(`
              INSERT INTO cg19_notification(
                realm_id,source_kind,source_key,decision_id,case_id,
                recipient_id,template_id,template_version,channel,
                subject_snapshot,body_snapshot,purpose,state,due_at,expires_at)
              VALUES($1,'CG03_DECISION',$2,$2,$3,$4,$5,$6,$7,$8,$9,
                'TRANSACTIONAL',$10,
                CASE WHEN $7='IN_APP' THEN NULL ELSE now() END,
                now()+interval '7 days')
              ON CONFLICT DO NOTHING RETURNING id
            `,[realm,event.eventRef,event.caseRef,person.accountRef,
              template.id,template.version,channel,template.subject,template.body,
              channel==="IN_APP"?"IN_APP":"QUEUED"]);
            if(inserted.rowCount){
              await client.query(`
                INSERT INTO cg19_communication_event(realm_id,notification_id,kind)
                VALUES($1,$2,'SOURCE_CAPTURED')
              `,[realm,inserted.rows[0].id]);
            }
          }
        }
        // Source authority is the immutable CG-03 decision, never a callback
        // payload or a new fabricated event ID. Update precision in DB.
        await client.query(`
          UPDATE cg19_decision_cursor
          SET last_created_at=(SELECT created_at FROM cg03_case_decision
            WHERE realm_id=$1 AND id=$2),
            last_decision_id=$2,updated_at=now()
          WHERE realm_id=$1
        `,[realm,event.eventRef]);
      }
      await client.query("COMMIT");open=false;
      return {processed:events.length,more:events.length===25};
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  async recover(bearer:string){
    const actor=await this.sessions.requireAction(bearer,"communications.delivery.process");
    return this.captureCommittedDecisions(actor.realmId);
  }
  async inbox(bearer:string,limitInput:unknown=20){
    const actor=await this.sessions.requireAction(bearer,"communications.notifications.view");
    const limit=Number(limitInput);
    if(!Number.isInteger(limit)||limit<1||limit>30)
      throw new BadRequestException("Choose a smaller notice page");
    const rows=await this.db.query<{
      id:string;subject_snapshot:string;body_snapshot:string;state:string;
      channel:Channel;created_at:Date;read_at:Date|null
    }>(`
      SELECT n.id,n.subject_snapshot,n.body_snapshot,n.state,n.channel,
        n.created_at,rd.read_at
      FROM cg19_notification n
      LEFT JOIN cg19_notice notice ON notice.id=n.notice_id
        AND notice.realm_id=n.realm_id
      LEFT JOIN cg19_notification_read rd ON rd.notification_id=n.id
        AND rd.recipient_id=n.recipient_id AND rd.realm_id=n.realm_id
      JOIN account person ON person.id=n.recipient_id AND person.realm_id=n.realm_id
      WHERE n.realm_id=$1 AND n.recipient_id=$2 AND person.status='ACTIVE'
        AND n.expires_at>now()
        AND (n.notice_id IS NULL OR
          (notice.state='ACTIVE' AND
           (notice.scheduled_at IS NULL OR notice.scheduled_at<=now())))
      ORDER BY n.created_at DESC,n.id DESC LIMIT $3
    `,[actor.realmId,actor.accountId,limit]);
    return {items:rows.rows.map(row=>({
      notificationRef:row.id,title:row.subject_snapshot,
      body:row.body_snapshot,channel:row.channel,status:row.state,
      receivedAt:row.created_at.toISOString(),read:!!row.read_at
    }))};
  }
  async read(bearer:string,rawRef:unknown){
    const actor=await this.sessions.requireAction(bearer,"communications.notifications.view");
    const ref=needUuid(rawRef);
    const result=await this.db.query<{id:string}>(`
      INSERT INTO cg19_notification_read(realm_id,recipient_id,notification_id)
      SELECT n.realm_id,n.recipient_id,n.id FROM cg19_notification n
      LEFT JOIN cg19_notice notice ON notice.id=n.notice_id AND notice.realm_id=n.realm_id
      JOIN account a ON a.id=n.recipient_id AND a.realm_id=n.realm_id
      WHERE n.id=$1 AND n.realm_id=$2 AND n.recipient_id=$3
        AND n.expires_at>now() AND a.status='ACTIVE'
        AND (n.notice_id IS NULL OR
          (notice.state='ACTIVE' AND
           (notice.scheduled_at IS NULL OR notice.scheduled_at<=now())))
      ON CONFLICT(recipient_id,notification_id) DO NOTHING RETURNING notification_id AS id
    `,[ref,actor.realmId,actor.accountId]);
    const exists=await this.db.query(`
      SELECT 1 FROM cg19_notification WHERE id=$1 AND realm_id=$2
        AND recipient_id=$3 AND expires_at>now()
    `,[ref,actor.realmId,actor.accountId]);
    if(!exists.rowCount)throw new ForbiddenException("Notification unavailable");
    return {read:true,changed:!!result.rowCount};
  }
  async preferences(bearer:string){
    const actor=await this.sessions.requireAction(bearer,"communications.notifications.view");
    const client=await this.db.connect();
    try{
      const person=await this.people.get(client,actor.realmId,actor.accountId);
      if(!person?.active)throw new ForbiddenException();
      const rows=await client.query<{channel:"EMAIL"|"SMS";purpose:string;
        opted_in:boolean;revision:number}>(`
        SELECT channel,purpose,opted_in,revision FROM cg19_channel_preference
        WHERE realm_id=$1 AND account_id=$2
      `,[actor.realmId,actor.accountId]);
      return {available:{email:person.emailVerified,sms:person.mobileVerified},
        preferences:rows.rows};
    }finally{client.release();}
  }
  async setPreference(bearer:string,payload:unknown){
    const actor=await this.sessions.requireAction(bearer,"communications.notifications.view");
    if(!payload||typeof payload!=="object"||Array.isArray(payload))
      throw new BadRequestException("Check notification preference");
    const v=payload as Record<string,unknown>;
    if(Object.keys(v).some(x=>!["channel","purpose","optedIn","expectedRevision"].includes(x))||
      !["EMAIL","SMS"].includes(String(v.channel))||
      !["TRANSACTIONAL","PROMOTIONAL"].includes(String(v.purpose))||
      typeof v.optedIn!=="boolean"||
      !Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0)
      throw new BadRequestException("Check notification preference");
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const person=await this.people.get(client,actor.realmId,actor.accountId);
      if(!person?.active)throw new ForbiddenException();
      if(v.optedIn&&(v.channel==="EMAIL"?!person.emailVerified:!person.mobileVerified))
        throw new BadRequestException("Verify this contact with Foundation identity first");
      const saved=await client.query<{revision:number;opted_in:boolean}>(`
        SELECT revision,opted_in FROM cg19_channel_preference
        WHERE realm_id=$1 AND account_id=$2 AND channel=$3 AND purpose=$4
        FOR UPDATE
      `,[actor.realmId,actor.accountId,v.channel,v.purpose]);
      const old=saved.rows[0];
      if((old?.revision??0)!==v.expectedRevision)
        throw new ConflictException("Notification preference changed");
      const changed=await client.query<{revision:number}>(`
        INSERT INTO cg19_channel_preference(
          realm_id,account_id,channel,purpose,opted_in,revision)
        VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(realm_id,account_id,channel,purpose)
        DO UPDATE SET opted_in=EXCLUDED.opted_in,revision=EXCLUDED.revision,
          updated_at=now()
        RETURNING revision
      `,[actor.realmId,actor.accountId,v.channel,v.purpose,v.optedIn,
        (old?.revision??0)+1]);
      await client.query("COMMIT");open=false;
      return {status:"SAVED",revision:changed.rows[0].revision};
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
}
