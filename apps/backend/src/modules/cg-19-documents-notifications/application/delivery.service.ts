import {
  BadRequestException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,createHmac,createVerify,timingSafeEqual} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {CommunicationRecipientSource} from "../../cg-01-identity-access/application/communication-recipient-source.service";
import {CommunicationProviders} from "../infrastructure/channel-providers";
import {NotificationService} from "./notification.service";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type DeliveryRow={
  id:string;realm_id:string;source_kind:string;recipient_id:string;notice_id:string|null;
  channel:"EMAIL"|"SMS";purpose:"TRANSACTIONAL"|"PROMOTIONAL";
  subject_snapshot:string;body_snapshot:string;state:string;
  expires_at:Date;attempt_count:number;claim_token:string;
};
type Provider="SENDGRID"|"TWILIO";
type ReceiptState="DELIVERED"|"BOUNCED"|"UNDELIVERED"|"ACCEPTED"|"UNKNOWN";
@Injectable()
export class DeliveryService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly people:CommunicationRecipientSource,
    private readonly notifications:NotificationService,
    private readonly providers:CommunicationProviders){}
  private async providerReady(realm:string,channel:"EMAIL"|"SMS"){
    const provider=channel==="EMAIL"?"sendgrid":"twilio";
    const purpose=channel.toLowerCase();
    const secret=process.env[channel==="EMAIL"?
      "CG19_SENDGRID_SECRET_REF":"CG19_TWILIO_SECRET_REF"]?.trim();
    if(!secret||!/^secretref:[A-Za-z0-9/_-]{10,230}$/.test(secret))
      return false;
    const verified=await this.db.query(`
      SELECT 1 FROM integration_connection
      WHERE foundation_realm_id=$1 AND scope_kind='FOUNDATION'
        AND provider=$2 AND purpose=$3
        AND secret_reference=$4 AND verification_status='VERIFIED'
        AND credential_revision=last_checked_credential_revision
        AND last_result_class='CHECK_ACCEPTED'
        AND last_checked_at>now()-interval '24 hours'
    `,[realm,provider,purpose,secret]);
    return !!verified.rowCount;
  }
  /** One fixed-size indexed due scan per deployment-level tick, never per
   * recipient/realm. All network sends happen after durable claim/attempt TX.
   */
  private async claimOne():Promise<DeliveryRow|null>{
    const rows=await this.db.query<DeliveryRow>(`
      WITH selected AS (
        SELECT n.id FROM cg19_notification n
        LEFT JOIN cg19_notice notice ON notice.id=n.notice_id AND notice.realm_id=n.realm_id
        WHERE n.channel IN ('EMAIL','SMS')
          AND n.state IN('QUEUED','PROVIDER_UNAVAILABLE','RETRY_DUE')
          AND n.due_at<=now() AND n.expires_at>now()
          AND n.attempt_count<5
          AND (n.claimed_until IS NULL OR n.claimed_until<now())
          AND (n.notice_id IS NULL OR
            (notice.state='ACTIVE' AND notice.expires_at>now()))
        ORDER BY n.due_at,n.id LIMIT 1 FOR UPDATE OF n SKIP LOCKED
      )
      UPDATE cg19_notification n SET
        claim_token=gen_random_uuid(),claimed_until=now()+interval '45 seconds',
        attempt_count=attempt_count+1,updated_at=now()
      WHERE n.id IN (SELECT id FROM selected)
      RETURNING n.*
    `);
    return rows.rows[0]??null;
  }
  private async markSuppressed(row:DeliveryRow,why:"SUPPRESSED"|"EXPIRED"){
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const applied=await client.query(`
        UPDATE cg19_notification SET state=$3,due_at=NULL,
          claimed_until=NULL,claim_token=NULL,updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND claim_token=$4 RETURNING id
      `,[row.id,row.realm_id,why,row.claim_token]);
      if(applied.rowCount)await client.query(`
        INSERT INTO cg19_communication_event(realm_id,notification_id,kind)
        VALUES($1,$2,'SUPPRESSED')
      `,[row.realm_id,row.id]);
      await client.query("COMMIT");open=false;
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  private async releaseUnavailable(row:DeliveryRow){
    // No provider call was attempted. Do not charge this as a retry.
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const applied=await client.query(`
        UPDATE cg19_notification
        SET state='PROVIDER_UNAVAILABLE',attempt_count=attempt_count-1,
          claim_token=NULL,claimed_until=NULL,due_at=NULL,updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND claim_token=$3 RETURNING id
      `,[row.id,row.realm_id,row.claim_token]);
      if(applied.rowCount)await client.query(`
        INSERT INTO cg19_communication_event(realm_id,notification_id,kind)
        VALUES($1,$2,'PROVIDER_UNAVAILABLE')
      `,[row.realm_id,row.id]);
      await client.query("COMMIT");open=false;
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  async tick():Promise<{activated:number;expired:number;claimed:number}>{
    // Requeue only when a channel becomes genuinely configured; with zero
    // providers there is no periodic per-recipient due work or egress.
    for(const channel of ["EMAIL","SMS"] as const){
      if(!this.providers.configured(channel))continue;
      await this.db.query(`
        WITH ready AS (
          SELECT n.id FROM cg19_notification n
          JOIN integration_connection ic
            ON ic.foundation_realm_id=n.realm_id
            AND ic.scope_kind='FOUNDATION'
            AND ic.provider=$2 AND ic.purpose=$3
            AND ic.verification_status='VERIFIED'
            AND ic.credential_revision=ic.last_checked_credential_revision
            AND ic.last_result_class='CHECK_ACCEPTED'
            AND ic.last_checked_at>now()-interval '24 hours'
            AND ic.secret_reference=$4
          WHERE n.state='PROVIDER_UNAVAILABLE' AND n.channel=$1
            AND n.expires_at>now()
          ORDER BY n.created_at,n.id LIMIT 25 FOR UPDATE OF n SKIP LOCKED
        )
        UPDATE cg19_notification SET state='QUEUED',due_at=now(),
          updated_at=now() WHERE id IN(SELECT id FROM ready)
      `,[channel,channel==="EMAIL"?"sendgrid":"twilio",
        channel.toLowerCase(),process.env[channel==="EMAIL"?
          "CG19_SENDGRID_SECRET_REF":"CG19_TWILIO_SECRET_REF"]??""]);
    }
    // A single indexed global query per tick; no tenant/user polling.
    const activated=await this.db.query<{id:string}>(`
      WITH due AS (
        SELECT id FROM cg19_notice WHERE state='SCHEDULED'
          AND scheduled_at<=now() AND expires_at>now()
        ORDER BY scheduled_at,id LIMIT 25 FOR UPDATE SKIP LOCKED
      )
      UPDATE cg19_notice SET state='ACTIVE',revision=revision+1,
        updated_at=now() WHERE id IN (SELECT id FROM due) RETURNING id
    `);
    const expired=await this.db.query<{id:string}>(`
      WITH due AS (
        SELECT id FROM cg19_notice
        WHERE state IN('ACTIVE','SCHEDULED') AND expires_at<=now()
        ORDER BY expires_at,id LIMIT 25 FOR UPDATE SKIP LOCKED
      )
      UPDATE cg19_notice SET state='EXPIRED',revision=revision+1,
        updated_at=now() WHERE id IN (SELECT id FROM due) RETURNING id
    `);
    await this.db.query(`
      WITH old AS (
        SELECT id FROM cg19_notification
        WHERE state IN('QUEUED','PROVIDER_UNAVAILABLE','RETRY_DUE','UNKNOWN_PROVIDER')
          AND expires_at<=now()
        ORDER BY expires_at,id LIMIT 50 FOR UPDATE SKIP LOCKED
      )
      UPDATE cg19_notification SET state='EXPIRED',due_at=NULL,
        claimed_until=NULL,claim_token=NULL,updated_at=now()
      WHERE id IN (SELECT id FROM old)
    `);
    // If the network outcome was lost while CLAIMED, a later worker must
    // never start a new provider attempt. Keep the original attempt identity
    // for a signed callback/manual provider-side reconciliation.
    await this.db.query(`
      WITH expired_claims AS (
        SELECT n.id FROM cg19_notification n
        JOIN cg19_delivery_attempt attempt ON attempt.notification_id=n.id
          AND attempt.attempt_no=n.attempt_count
          AND attempt.result='CLAIMED'
        WHERE n.channel IN('EMAIL','SMS') AND n.claimed_until<now()
          AND n.state IN('QUEUED','PROVIDER_UNAVAILABLE','RETRY_DUE')
        ORDER BY n.claimed_until,n.id LIMIT 25
        FOR UPDATE OF n SKIP LOCKED
      )
      UPDATE cg19_notification n SET
        state='UNKNOWN_PROVIDER',due_at=NULL,claim_token=NULL,
        claimed_until=NULL,updated_at=now()
      WHERE n.id IN(SELECT id FROM expired_claims)
    `);
    let claimed=0;
    for(let i=0;i<10;i++){
      const row=await this.claimOne();if(!row)break;
      claimed++;
      await this.deliverOne(row);
    }
    return {activated:activated.rowCount??0,expired:expired.rowCount??0,claimed};
  }
  private async deliverOne(row:DeliveryRow){
    if(row.expires_at.getTime()<=Date.now()){
      await this.markSuppressed(row,"EXPIRED");return;
    }
    const client=await this.db.connect();
    let to:string|null=null;let permitted=false;
    try{
      const current=await this.people.get(client,row.realm_id,row.recipient_id);
      const verified=row.channel==="EMAIL"?current?.email:current?.mobile;
      to=current?.active?verified??null:null;
      permitted=Boolean(to)&&await this.notifications.hasConsent(client,
        row.realm_id,row.recipient_id,row.channel,row.purpose);
      // Appointment notices have a SECOND consent check immediately before
      // any external provider attempt, not just at original outbox capture.
      if(row.source_kind==="CG11_PAYSLIP_READY"){
        const own=await client.query("SELECT 1 FROM cg19_notification n WHERE n.realm_id=$1 AND n.id=$2 AND n.recipient_id=$3 AND cg19_payroll_notice_matches(n.realm_id,n.payroll_payslip_ref,n.recipient_id)",[row.realm_id,row.id,row.recipient_id]);
        if(!own.rowCount)permitted=false;
      }
      if(row.source_kind==="CG10_DOCUMENT_READY"){
        const own=await client.query("SELECT 1 FROM cg19_notification n WHERE n.realm_id=$1 AND n.id=$2 AND n.recipient_id=$3 AND cg19_hr_document_notice_matches(n.realm_id,n.hr_document_ref,n.recipient_id)",[row.realm_id,row.id,row.recipient_id]);
        if(!own.rowCount)permitted=false;
      }
      if(row.source_kind==="CG15_APPOINTMENT"){
        const own=await client.query(
         "SELECT 1 FROM cg19_notification n "+
         "JOIN cg15_appointment_event e ON e.root_realm_id=n.realm_id "+
         "AND e.id=n.cg15_appointment_event_id "+
         "JOIN cg15_consultation_appointment ap ON ap.root_realm_id=e.root_realm_id "+
         "AND ap.id=e.appointment_id "+
         "JOIN cg15_patient p ON p.root_realm_id=ap.root_realm_id "+
         "AND p.id=ap.patient_id "+
         "JOIN cg15_patient_account_link l ON l.root_realm_id=p.root_realm_id "+
         "AND l.patient_id=p.id AND l.account_id=n.recipient_id "+
         "AND l.revoked_at IS NULL "+
         "WHERE n.realm_id=$1 AND n.id=$2 AND n.recipient_id=$3 "+
         "AND p.profile_status='VERIFIED' "+
         "AND (SELECT consent.granted FROM cg15_patient_consent consent "+
         "WHERE consent.root_realm_id=p.root_realm_id "+
         "AND consent.patient_id=p.id AND consent.purpose='PATIENT_CARE' "+
         "ORDER BY consent.revision_no DESC LIMIT 1)=true",
         [row.realm_id,row.id,row.recipient_id]);
        if(!own.rowCount)permitted=false;
      }
      // Lab notices only say 'check your private report'. Verify the
      // original CG16 release, CG19 file and CURRENT patient ownership/consent
      // immediately before any SendGrid/Twilio call.
      if(row.source_kind==="CG16_LAB_RELEASE"){
        const allowed=await client.query(
         "SELECT 1 FROM cg19_notification n "+
         "JOIN cg16_lab_report_release release ON "+
         "release.root_realm_id=n.realm_id "+
         "AND release.id=n.cg16_lab_report_release_id "+
         "JOIN cg19_lab_result_file file ON "+
         "file.root_realm_id=release.root_realm_id "+
         "AND file.id=release.original_cg19_file_ref "+
         "AND file.scan_status='CLEAN_VERIFIED' "+
         "AND file.revoked_at IS NULL "+
         "JOIN cg15_patient patient ON "+
         "patient.root_realm_id=release.root_realm_id "+
         "AND patient.id=release.patient_ref "+
         "AND patient.profile_status='VERIFIED' "+
         "JOIN cg15_patient_account_link link ON "+
         "link.root_realm_id=patient.root_realm_id "+
         "AND link.patient_id=patient.id "+
         "AND link.account_id=n.recipient_id "+
         "AND link.revoked_at IS NULL "+
         "WHERE n.realm_id=$1 AND n.id=$2 AND n.recipient_id=$3 "+
         "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
         "WHERE proof.root_realm_id=patient.root_realm_id "+
         "AND proof.patient_id=patient.id) "+
         "AND (SELECT consent.granted FROM cg15_patient_consent consent "+
         "WHERE consent.root_realm_id=patient.root_realm_id "+
         "AND consent.patient_id=patient.id "+
         "AND consent.purpose='PATIENT_CARE' "+
         "ORDER BY consent.revision_no DESC LIMIT 1)=true",
         [row.realm_id,row.id,row.recipient_id]);
        if(!allowed.rowCount)permitted=false;
      }
      if(row.notice_id){
        const notice=await client.query<{state:string;expires_at:Date}>(`
          SELECT state,expires_at FROM cg19_notice WHERE realm_id=$1 AND id=$2
        `,[row.realm_id,row.notice_id]);
        if(notice.rows[0]?.state!=="ACTIVE"||
          notice.rows[0].expires_at.getTime()<=Date.now())
          permitted=false;
      }
    }finally{client.release();}
    if(!permitted||!to){
      await this.markSuppressed(row,"SUPPRESSED");return;
    }
    if(!this.providers.configured(row.channel,row.purpose)||
      !await this.providerReady(row.realm_id,row.channel)){
      await this.releaseUnavailable(row);return;
    }
    const provider:Provider=row.channel==="EMAIL"?"SENDGRID":"TWILIO";
    // The attempt identity is committed first and reused in any provider
    // callback. Duplicate claims cannot create another attempt ordinal.
    const attempt=await this.db.query<{id:string}>(`
      INSERT INTO cg19_delivery_attempt(
        realm_id,notification_id,attempt_no,claim_token,provider,result)
      VALUES($1,$2,$3,$4,$5,'CLAIMED') RETURNING id
    `,[row.realm_id,row.id,row.attempt_count,row.claim_token,provider]);
    const attemptRef=attempt.rows[0].id;
    const response=await this.providers.send({
      notificationRef:row.id,attemptRef,channel:row.channel,to,
      subject:row.subject_snapshot,body:row.body_snapshot,purpose:row.purpose
    });
    const state=response.state==="ACCEPTED"?"SENT_TO_PROVIDER":
      response.state==="UNAVAILABLE"?"PROVIDER_UNAVAILABLE":
      response.state==="UNKNOWN"?"UNKNOWN_PROVIDER":"FAILED";
    const client2=await this.db.connect();let open=false;
    try{
      await client2.query("BEGIN");open=true;
      // A valid early provider webhook may have already marked DELIVERED.
      // Never downgrade a confirmed terminal delivery or bounce.
      await client2.query(`
        UPDATE cg19_delivery_attempt SET result=$3,
          provider_ref=$4,updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND result='CLAIMED'
      `,[attemptRef,row.realm_id,
        response.state==="ACCEPTED"?"ACCEPTED":
        response.state==="UNKNOWN"?"UNKNOWN":"FAILED",response.providerRef]);
      await client2.query(`
        UPDATE cg19_notification SET state=$4,
          provider_message_ref=$5,provider_kind=$6,
          due_at=NULL,
          claim_token=NULL,claimed_until=NULL,updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND claim_token=$3
          AND state NOT IN('DELIVERED','FAILED','SUPPRESSED','EXPIRED')
      `,[row.id,row.realm_id,row.claim_token,state,response.providerRef,
        response.provider]);
      await client2.query(`
        INSERT INTO cg19_communication_event(realm_id,notification_id,kind)
        VALUES($1,$2,$3)
      `,[row.realm_id,row.id,response.state==="ACCEPTED"?"PROVIDER_ACCEPTED":
        response.state==="UNKNOWN"?"PROVIDER_UNKNOWN":"PROVIDER_FAILED"]);
      await client2.query("COMMIT");open=false;
    }catch(e){if(open)try{await client2.query("ROLLBACK");}catch{};throw e;}
    finally{client2.release();}
  }
  async readiness(bearer:string){
    const actor=await this.sessions.requireAction(bearer,"communications.delivery.view");
    const channels=[] as Array<{channel:string;provider:string;configured:boolean;state:string}>;
    for(const channel of ["EMAIL","SMS"] as const){
      const configured=this.providers.configured(channel);
      const verified=configured&&await this.providerReady(actor.realmId,channel);
      channels.push({channel,provider:channel==="EMAIL"?"SENDGRID":"TWILIO",
        configured:verified,state:verified?"VERIFIED_PROVIDER_READY":
          configured?"CONFIGURED_NOT_VERIFIED":"UNAVAILABLE"});
    }
    return {channels,deliveryProof:
      "Provider callbacks are required; setup alone is not delivery"};
  }
  async process(bearer:string){
    const actor=await this.sessions.requireAction(bearer,"communications.delivery.process");
    // Verified Foundation admin can manually trigger recovery after a
    // maintenance/worker outage. No secret/cross-tenant status is returned.
    const own=await this.db.query(`
      SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'
    `,[actor.realmId]);
    if(!own.rowCount)throw new ForbiddenException();
    const result=await this.tick();
    return {status:"RECOVERED_SOURCE_ONLY",...result};
  }
  async receipt(provider:Provider,attemptRef:string,eventId:string,state:ReceiptState,
    providerRef:string|null){
    if(!UUID.test(attemptRef)||eventId.length<4||eventId.length>160)
      throw new BadRequestException("Invalid callback identifier");
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const attempt=await client.query<{realm_id:string;notification_id:string;
        provider_ref:string|null;result:string}>(`
        SELECT realm_id,notification_id,provider_ref,result
        FROM cg19_delivery_attempt WHERE id=$1 AND provider=$2 FOR UPDATE
      `,[attemptRef,provider]);
      const row=attempt.rows[0];
      if(!row)throw new NotFoundException("Delivery attempt unavailable");
      if(provider==="TWILIO"&&row.provider_ref&&providerRef&&
        row.provider_ref!==providerRef)
        throw new ForbiddenException("Provider message reference changed");
      const incoming=await client.query<{id:string}>(`
        INSERT INTO cg19_delivery_receipt(realm_id,attempt_id,provider_event_id,received_status)
        VALUES($1,$2,$3,$4)
        ON CONFLICT(attempt_id,provider_event_id) DO NOTHING RETURNING id
      `,[row.realm_id,attemptRef,eventId,state]);
      if(incoming.rowCount){
        const target=state==="DELIVERED"?"DELIVERED":
          state==="BOUNCED"||state==="UNDELIVERED"?"FAILED":
          state==="ACCEPTED"?"SENT_TO_PROVIDER":"UNKNOWN_PROVIDER";
        await client.query(`
          UPDATE cg19_delivery_attempt SET result=$3,
            provider_ref=COALESCE(provider_ref,$4),updated_at=now()
          WHERE id=$1 AND realm_id=$2 AND
            result NOT IN('DELIVERED','BOUNCED','UNDELIVERED')
        `,[attemptRef,row.realm_id,state,providerRef]);
        await client.query(`
          UPDATE cg19_notification SET state=$3,
            provider_message_ref=COALESCE(provider_message_ref,$4),
            provider_kind=$5,claim_token=NULL,claimed_until=NULL,due_at=NULL,
            updated_at=now()
          WHERE id=$1 AND realm_id=$2 AND state NOT IN(
            'DELIVERED','FAILED','EXPIRED','SUPPRESSED')
        `,[row.notification_id,row.realm_id,target,providerRef,provider]);
        await client.query(`
          INSERT INTO cg19_communication_event(realm_id,notification_id,kind)
          VALUES($1,$2,'PROVIDER_RECEIPT')
        `,[row.realm_id,row.notification_id]);
      }
      await client.query("COMMIT");open=false;
      return {accepted:true,duplicate:!incoming.rowCount};
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  verifySendGrid(raw:Buffer,signature:string,timestamp:string):boolean{
    const pem=process.env.CG19_SENDGRID_WEBHOOK_PUBLIC_KEY?.replace(/\\n/g,"\n")??"";
    if(!pem.includes("BEGIN PUBLIC KEY")||!signature||
       !/^\d{10}$/.test(timestamp)||!raw||raw.length>65536||
       Math.abs(Date.now()-Number(timestamp)*1000)>300_000)return false;
    try{
      const verify=createVerify("sha256");
      verify.update(Buffer.concat([Buffer.from(timestamp,"utf8"),raw]));
      verify.end();
      return verify.verify(pem,Buffer.from(signature,"base64"));
    }catch{return false;}
  }
  verifyTwilio(params:Record<string,string>,signature:string,actualAttempt:string){
    const expected=process.env.CG19_TWILIO_STATUS_URL?.trim()??"";
    const token=process.env.CG19_TWILIO_AUTH_TOKEN?.trim()??"";
    if(!expected.startsWith("https://")||!token||!signature||!UUID.test(actualAttempt))
      return false;
    const full=expected+"?attempt="+encodeURIComponent(actualAttempt);
    const payload=full+Object.keys(params).sort().map(k=>k+params[k]).join("");
    const computed=createHmac("sha1",token).update(payload).digest("base64");
    const a=Buffer.from(computed),z=Buffer.from(signature);
    return a.length===z.length&&timingSafeEqual(a,z);
  }
}
