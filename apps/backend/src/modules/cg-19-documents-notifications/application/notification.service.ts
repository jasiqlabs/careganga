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
  /** CG19-owned V1 appointment transport: source rows are transactionally
   * committed by CG15 immutable event trigger, then claimed only when due.
   * No booking request awaits SendGrid/Twilio or fabricates SENT status.
   */
  private async appointmentTemplate(client:PoolClient,realm:string,channel:Channel):
    Promise<Template>{
    const copy:Record<Channel,{subject:string;body:string}>={
      IN_APP:{subject:"Consultation appointment updated",
        body:"Your CareGanga appointment has a status update. Sign in to view the current details."},
      EMAIL:{subject:"Your CareGanga consultation was updated",
        body:"Your CareGanga appointment has a status update. Sign in to your account to review its current status."},
      SMS:{subject:"CareGanga appointment update",
        body:"CareGanga: An appointment update is available. Sign in to your account to view details."}
    };
    const chosen=copy[channel];
    await client.query(
      "INSERT INTO cg19_message_template("+
      "realm_id,kind,channel,version,subject,body,status,origin,approved_by) "+
      "VALUES($1,'CG15_APPOINTMENT',$2,1,$3,$4,'APPROVED','SYSTEM',NULL) "+
      "ON CONFLICT(realm_id,kind,channel,version) DO NOTHING",
      [realm,channel,chosen.subject,chosen.body]);
    const current=await client.query<Template>(
      "SELECT id,version,subject,body FROM cg19_message_template "+
      "WHERE realm_id=$1 AND kind='CG15_APPOINTMENT' AND channel=$2 "+
      "AND status='APPROVED' ORDER BY version DESC LIMIT 1",
      [realm,channel]);
    if(!current.rows[0])
      throw new ConflictException("Appointment notification source is unavailable");
    return current.rows[0];
  }
  async captureCommittedAppointments(realm:string):
    Promise<{processed:number;more:boolean}>{
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const root=await client.query(
       "SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'",
       [realm]);
      if(!root.rowCount)
       throw new ForbiddenException("Foundation appointment source unavailable");
      // Only durable due rows; PG locks avoid duplicate capture across hosts.
      const events=await client.query<{event_id:string;patient_id:string}>(
       "SELECT ob.event_id,a.patient_id FROM cg19_appointment_event_outbox ob "+
       "JOIN cg15_appointment_event e ON e.root_realm_id=ob.realm_id "+
       "AND e.id=ob.event_id "+
       "JOIN cg15_consultation_appointment a ON a.root_realm_id=e.root_realm_id "+
       "AND a.id=e.appointment_id "+
       "WHERE ob.realm_id=$1 AND ob.state='PENDING' "+
       "ORDER BY ob.recorded_at,ob.event_id LIMIT 25 FOR UPDATE OF ob SKIP LOCKED",
       [realm]);
      const templates=new Map<Channel,Template>();
      for(const event of events.rows){
       // No patient profile, phone, symptom, care note or medical file leaves
       // the CG15/CG01 source. Stop on revoked identity/care consent.
       const link=await client.query<{account_id:string}>(
        "SELECT l.account_id FROM cg15_patient_account_link l "+
        "JOIN account a ON a.realm_id=l.root_realm_id AND a.id=l.account_id "+
        "JOIN cg15_patient p ON p.root_realm_id=l.root_realm_id "+
        "AND p.id=l.patient_id "+
        "WHERE l.root_realm_id=$1 AND l.patient_id=$2 "+
        "AND l.revoked_at IS NULL AND "+
        "l.proof_type='CG01_VERIFIED_ACCOUNT_CONTACT' "+
        "AND a.status='ACTIVE' "+
        "AND p.profile_status='VERIFIED' "+
        "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
        "WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) "+
        "AND (SELECT consent.granted FROM cg15_patient_consent consent "+
        "WHERE consent.root_realm_id=p.root_realm_id AND consent.patient_id=p.id "+
        "AND consent.purpose='PATIENT_CARE' "+
        "ORDER BY consent.revision_no DESC LIMIT 1)=true LIMIT 1",
        [realm,event.patient_id]);
       const account=link.rows[0]?.account_id;
       const person=account?await this.people.get(client,realm,account):null;
       if(person?.active){
        const channels:Channel[]=["IN_APP"];
        if(person.emailVerified&&await this.hasConsent(client,realm,account,"EMAIL","TRANSACTIONAL"))
         channels.push("EMAIL");
        if(person.mobileVerified&&await this.hasConsent(client,realm,account,"SMS","TRANSACTIONAL"))
         channels.push("SMS");
        for(const channel of channels){
         let template=templates.get(channel);
         if(!template){template=await this.appointmentTemplate(client,realm,channel);
          templates.set(channel,template);}
         const inserted=await client.query<{id:string}>(
          "INSERT INTO cg19_notification("+
          "realm_id,source_kind,source_key,cg15_appointment_event_id,"+
          "recipient_id,template_id,template_version,channel,"+
          "subject_snapshot,body_snapshot,purpose,state,due_at,expires_at) "+
          "VALUES($1,'CG15_APPOINTMENT',$2,$2,$3,$4,$5,$6,$7,$8,"+
          "'TRANSACTIONAL',$9,CASE WHEN $6='IN_APP' THEN NULL ELSE now() END,"+
          "now()+interval '7 days') "+
          "ON CONFLICT DO NOTHING RETURNING id",
          [realm,event.event_id,account,template.id,template.version,channel,
           template.subject,template.body,
           channel==="IN_APP"?"IN_APP":"QUEUED"]);
         if(inserted.rows[0])
          await client.query(
           "INSERT INTO cg19_communication_event(realm_id,notification_id,kind) "+
           "VALUES($1,$2,'SOURCE_CAPTURED')",
           [realm,inserted.rows[0].id]);
        }
       }
       // Even when care consent is absent, the source row is durably consumed.
       // No later unsafe replay after the patient withdraws care consent.
       await client.query(
        "UPDATE cg19_appointment_event_outbox SET state='CAPTURED',"+
        "captured_at=now() WHERE realm_id=$1 AND event_id=$2 AND state='PENDING'",
        [realm,event.event_id]);
      }
      await client.query("COMMIT");open=false;
      return {processed:events.rows.length,more:events.rows.length===25};
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  async recover(bearer:string){
    const actor=await this.sessions.requireAction(bearer,"communications.delivery.process");
    const decisions=await this.captureCommittedDecisions(actor.realmId);
    const appointments=await this.captureCommittedAppointments(actor.realmId);
    // Preserve original CG03 recovery fields for existing clients.
    return {...decisions,appointments};
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
        AND (n.source_kind<>'CG15_APPOINTMENT' OR EXISTS(
          SELECT 1 FROM cg15_appointment_event appointment_event
          JOIN cg15_consultation_appointment appointment
            ON appointment.root_realm_id=appointment_event.root_realm_id
           AND appointment.id=appointment_event.appointment_id
          JOIN cg15_patient patient
            ON patient.root_realm_id=appointment.root_realm_id
           AND patient.id=appointment.patient_id
          JOIN cg15_patient_account_link owned
            ON owned.root_realm_id=patient.root_realm_id
           AND owned.patient_id=patient.id
           AND owned.account_id=n.recipient_id
           AND owned.revoked_at IS NULL
          WHERE appointment_event.root_realm_id=n.realm_id
            AND appointment_event.id=n.cg15_appointment_event_id
            AND patient.profile_status='VERIFIED'
            AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof
              WHERE proof.root_realm_id=patient.root_realm_id
                AND proof.patient_id=patient.id)
            AND (SELECT consent.granted FROM cg15_patient_consent consent
              WHERE consent.root_realm_id=patient.root_realm_id
                AND consent.patient_id=patient.id
                AND consent.purpose='PATIENT_CARE'
              ORDER BY consent.revision_no DESC LIMIT 1)=true
        ))
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
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const exists=await client.query(`
        SELECT 1 FROM cg19_notification n
        JOIN account a ON a.id=n.recipient_id AND a.realm_id=n.realm_id
        LEFT JOIN cg19_notice notice ON notice.id=n.notice_id
          AND notice.realm_id=n.realm_id
        WHERE n.id=$1 AND n.realm_id=$2
          AND n.recipient_id=$3 AND n.expires_at>now()
          AND a.status='ACTIVE' AND (n.notice_id IS NULL OR
            (notice.state='ACTIVE' AND
             (notice.scheduled_at IS NULL OR notice.scheduled_at<=now())))
        AND (n.source_kind<>'CG15_APPOINTMENT' OR EXISTS(
          SELECT 1 FROM cg15_appointment_event appointment_event
          JOIN cg15_consultation_appointment appointment
            ON appointment.root_realm_id=appointment_event.root_realm_id
           AND appointment.id=appointment_event.appointment_id
          JOIN cg15_patient patient
            ON patient.root_realm_id=appointment.root_realm_id
           AND patient.id=appointment.patient_id
          JOIN cg15_patient_account_link owned
            ON owned.root_realm_id=patient.root_realm_id
           AND owned.patient_id=patient.id
           AND owned.account_id=n.recipient_id
           AND owned.revoked_at IS NULL
          WHERE appointment_event.root_realm_id=n.realm_id
            AND appointment_event.id=n.cg15_appointment_event_id
            AND patient.profile_status='VERIFIED'
            AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof
              WHERE proof.root_realm_id=patient.root_realm_id
                AND proof.patient_id=patient.id)
            AND (SELECT consent.granted FROM cg15_patient_consent consent
              WHERE consent.root_realm_id=patient.root_realm_id
                AND consent.patient_id=patient.id
                AND consent.purpose='PATIENT_CARE'
              ORDER BY consent.revision_no DESC LIMIT 1)=true
        ))
        FOR SHARE OF n,a
      `,[ref,actor.realmId,actor.accountId]);
      if(!exists.rowCount)throw new ForbiddenException("Notification unavailable");
      const applied=await client.query(`
        INSERT INTO cg19_notification_read(realm_id,recipient_id,notification_id)
        VALUES($1,$2,$3) ON CONFLICT(recipient_id,notification_id)
        DO NOTHING RETURNING notification_id
      `,[actor.realmId,actor.accountId,ref]);
      if(applied.rowCount)await client.query(`
        INSERT INTO cg19_communication_event(realm_id,actor_id,notification_id,kind)
        VALUES($1,$2,$3,'NOTIFICATION_READ')
      `,[actor.realmId,actor.accountId,ref]);
      await client.query("COMMIT");open=false;
      return {read:true,changed:!!applied.rowCount};
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
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
      const changed=old?
        await client.query<{revision:number}>(`
          UPDATE cg19_channel_preference
          SET opted_in=$5,revision=revision+1,updated_at=now()
          WHERE realm_id=$1 AND account_id=$2 AND channel=$3 AND purpose=$4
            AND revision=$6 RETURNING revision
        `,[actor.realmId,actor.accountId,v.channel,v.purpose,v.optedIn,
          old.revision]):
        await client.query<{revision:number}>(`
          INSERT INTO cg19_channel_preference(
            realm_id,account_id,channel,purpose,opted_in,revision)
          VALUES($1,$2,$3,$4,$5,1)
          ON CONFLICT(realm_id,account_id,channel,purpose) DO NOTHING
          RETURNING revision
        `,[actor.realmId,actor.accountId,v.channel,v.purpose,v.optedIn]);
      if(!changed.rowCount)
        throw new ConflictException("Notification preference changed concurrently");
      await client.query("COMMIT");open=false;
      return {status:"SAVED",revision:changed.rows[0].revision};
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
}
