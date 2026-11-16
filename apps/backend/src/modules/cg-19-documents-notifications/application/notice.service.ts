import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {CommunicationRecipientSource} from "../../cg-01-identity-access/application/communication-recipient-source.service";
import {NotificationService} from "./notification.service";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Channel="IN_APP"|"EMAIL"|"SMS";
type NoticeRow={id:string;realm_id:string;author_id:string;title:string;body:string;
  request_digest:string;priority:string;purpose:"TRANSACTIONAL"|"PROMOTIONAL";
  channels:Channel[];audience_kind:"ALL_ACTIVE"|"ROLE"|"INDIVIDUAL";
  audience_ref:string|null;audience_count:number;audience_digest:string;revision:number;
  state:string;scheduled_at:Date|null;expires_at:Date;created_at:Date;target_href:string|null};
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function record(v:unknown,keys:string[]):Record<string,unknown>{
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new BadRequestException("Check notice details");
 const row=v as Record<string,unknown>;
 if(Object.keys(row).some(k=>!keys.includes(k)))
  throw new BadRequestException("Unsupported notice field");
 return row;
}
function valText(value:unknown,min:number,max:number):string{
 if(typeof value!=="string"||value.trim().length<min||value.length>max||
  /[\u0000-\u001f\u007f]/.test(value)||/<[\s/]*[a-z][^>]*>/i.test(value))
  throw new BadRequestException("Check notice title and message");
 return value.trim();
}
function ref(value:unknown):string{
 if(typeof value!=="string"||!UUID.test(value))
  throw new BadRequestException("Choose an available Foundation record");
 return value;
}
function view(row:NoticeRow){
 return {noticeRef:row.id,title:row.title,body:row.body,
   priority:row.priority,purpose:row.purpose,state:row.state,
   audienceKind:row.audience_kind,audienceCount:row.audience_count,
   channels:row.channels,revision:row.revision,targetHref:row.target_href,
   scheduledAt:row.scheduled_at?.toISOString()??null,
   expiresAt:row.expires_at.toISOString(),
   createdAt:row.created_at.toISOString()};
}
@Injectable()
export class NoticeService{
 constructor(@Inject(DATABASE) private readonly db:Pool,
   private readonly sessions:SessionService,
   private readonly recipients:CommunicationRecipientSource,
   private readonly notifications:NotificationService){}
 private async template(client:PoolClient,realm:string,
   channel:Channel,notice:NoticeRow,actor:string){
   const result=await client.query<{id:string;version:number;subject:string;body:string}>(`
    SELECT id,version FROM cg19_message_template
    WHERE realm_id=$1 AND kind='NOTICE' AND channel=$2
    ORDER BY version DESC LIMIT 1
   `,[realm,channel]);
   const version=(result.rows[0]?.version??0)+1;
   const entry=await client.query<{id:string;version:number;subject:string;body:string}>(`
    INSERT INTO cg19_message_template(
      realm_id,kind,channel,version,subject,body,status,origin,approved_by)
    VALUES($1,'NOTICE',$2,$3,$4,$5,'APPROVED','HUMAN',$6)
    RETURNING id,version,subject,body
   `,[realm,channel,version,notice.title,notice.body,actor]);
   return entry.rows[0];
 }
 async draft(bearer:string,body:unknown){
   const a=record(body,["title","body","priority","purpose","channels",
     "audienceKind","audienceRef","scheduledAt","expiresAt","requestKey","targetHref"]);
   const title=valText(a.title,5,120),content=valText(a.body,10,480);
   if(!["NORMAL","IMPORTANT"].includes(String(a.priority))||
      !["TRANSACTIONAL","PROMOTIONAL"].includes(String(a.purpose))||
      !["ALL_ACTIVE","ROLE","INDIVIDUAL"].includes(String(a.audienceKind))||
      !Array.isArray(a.channels)||a.channels.length<1||a.channels.length>3||
      new Set(a.channels).size!==a.channels.length||
      !a.channels.includes("IN_APP")||
      a.channels.some(c=>!["IN_APP","EMAIL","SMS"].includes(String(c))))
     throw new BadRequestException("Choose supported audience and channels");
   const type=a.audienceKind as NoticeRow["audience_kind"];
   const target=a.audienceRef===null||a.audienceRef===undefined?null:ref(a.audienceRef);
   if((type==="ALL_ACTIVE"&&target)||(type!=="ALL_ACTIVE"&&!target))
     throw new BadRequestException("Choose a valid Foundation audience");
   const href=a.targetHref===null||a.targetHref===undefined?null:a.targetHref;
   if(href!==null&&(typeof href!=="string"||
     !/^\/admin\/[a-z0-9/_-]{1,160}$/.test(href)||href.includes("//")))
     throw new BadRequestException("Only CareGanga internal links are accepted");
   const start=a.scheduledAt===null||a.scheduledAt===undefined?
     null:new Date(String(a.scheduledAt));
   const expiry=new Date(String(a.expiresAt));
   if((start&&!Number.isFinite(start.getTime()))||
     !Number.isFinite(expiry.getTime())||expiry.getTime()<Date.now()+60_000||
     expiry.getTime()>Date.now()+90*86400_000||
     (start&&(start.getTime()<Date.now()-60_000||start.getTime()>=expiry.getTime())))
     throw new BadRequestException("Choose an upcoming notice expiry/schedule");
   const requestKey=ref(a.requestKey);
   const actor=await this.sessions.requireAction(bearer,"communications.notices.manage");
   if(type==="ROLE")await this.sessions.requireAction(bearer,"roles.select");
   if(type==="INDIVIDUAL")await this.sessions.requireAction(bearer,"accounts.select");
   const rawChannels=a.channels as Channel[];
   const hash=digest([title,content,a.priority,a.purpose,rawChannels,
     type,target,href,start?.toISOString()??null,expiry.toISOString()]);
   const client=await this.db.connect();let open=false;
   try{
     await client.query("BEGIN");open=true;
     const root=await client.query(`
       SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
     `,[actor.realmId]);
     if(!root.rowCount)throw new ForbiddenException("Foundation scope unavailable");
     const prior=await client.query<NoticeRow>(`
       SELECT * FROM cg19_notice
       WHERE realm_id=$1 AND author_id=$2 AND request_key=$3 FOR SHARE
     `,[actor.realmId,actor.accountId,requestKey]);
     if(prior.rowCount){
       if(prior.rows[0].request_digest!==hash)
         throw new ConflictException("This request key belongs to a different notice");
       await client.query("COMMIT");open=false;
       return {...view(prior.rows[0]),result:"PREVIOUSLY_CONFIRMED"};
     }
     const audience=await this.recipients.audience(client,actor.realmId,type,target,1000);
     const audienceDigest=digest([actor.realmId,audience]);
     const created=await client.query<NoticeRow>(`
       INSERT INTO cg19_notice(
         realm_id,request_key,request_digest,author_id,title,body,priority,purpose,
         channels,audience_kind,audience_ref,audience_digest,audience_count,
         state,scheduled_at,expires_at,target_href)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11,$12,$13,
         'DRAFT',$14,$15,$16) RETURNING *
     `,[actor.realmId,requestKey,hash,actor.accountId,title,content,a.priority,
       a.purpose,rawChannels,type,target,audienceDigest,audience.length,
       start,expiry,href]);
     // Bounded one-statement audience snapshot, never one DB round trip
     // per recipient or later expansion based on mutable roles.
     await client.query(`
       INSERT INTO cg19_notice_recipient(realm_id,notice_id,recipient_id)
       SELECT $1,$2,recipient_id FROM unnest($3::uuid[]) AS recipients(recipient_id)
     `,[actor.realmId,created.rows[0].id,audience]);
     await client.query(`
       INSERT INTO cg19_communication_event(realm_id,actor_id,notice_id,kind,metadata)
       VALUES($1,$2,$3,'NOTICE_DRAFT',$4::jsonb)
     `,[actor.realmId,actor.accountId,created.rows[0].id,
       JSON.stringify({audienceCount:audience.length,channels:rawChannels})]);
     await client.query("COMMIT");open=false;
     return {...view(created.rows[0]),result:"DRAFT"};
   }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
 }
 async decide(bearer:string,rawRef:unknown,payload:unknown){
   const id=ref(rawRef),command=record(payload,
     ["action","expectedRevision","requestKey","totp"]);
   if(!["APPROVE","CANCEL"].includes(String(command.action))||
     !Number.isSafeInteger(command.expectedRevision)||
     Number(command.expectedRevision)<1||
     typeof command.totp!=="string"||!/^[0-9]{6}$/.test(command.totp))
      throw new BadRequestException("Check notice approval");
   const key=ref(command.requestKey);
   const actor=await this.sessions.requireAction(bearer,"communications.notices.approve");
   const hash=digest([command.action,command.expectedRevision]);
   await this.sessions.limitFoundationRootProof(actor);
   const client=await this.db.connect();let open=false;
   try{
     await client.query("BEGIN");open=true;
     const realm=await client.query(`
       SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
     `,[actor.realmId]);
     if(!realm.rowCount)throw new ForbiddenException();
     const notice=await client.query<NoticeRow>(`
       SELECT * FROM cg19_notice WHERE realm_id=$1 AND id=$2 FOR UPDATE
     `,[actor.realmId,id]);
     if(!notice.rowCount)throw new NotFoundException("Notice unavailable");
     const n=notice.rows[0];
     const replay=await client.query<{
       request_digest:string;applied_revision:number
     }>(`
       SELECT request_digest,applied_revision FROM cg19_notice_command
       WHERE realm_id=$1 AND notice_id=$2 AND actor_id=$3 AND request_key=$4
     `,[actor.realmId,id,actor.accountId,key]);
     if(replay.rowCount){
       if(replay.rows[0].request_digest!==hash)
         throw new ConflictException("Previous notice command differed");
       await client.query("COMMIT");open=false;
       return {status:"PREVIOUSLY_CONFIRMED",revision:replay.rows[0].applied_revision};
     }
     if(n.revision!==command.expectedRevision)
       throw new ConflictException("Notice changed. Refresh before approving.");
     if(command.action==="APPROVE"&&(n.state!=="DRAFT"||
       n.expires_at.getTime()<=Date.now()))
       throw new ConflictException("Notice cannot be approved now");
     if(command.action==="CANCEL"&&
       ["CANCELLED","EXPIRED"].includes(n.state))
       throw new ConflictException("Notice is already inactive");
     await this.sessions.requireFreshFoundationRootProof(client,actor,command.totp);
     let state="CANCELLED";
     if(command.action==="APPROVE"){
       state=n.scheduled_at&&n.scheduled_at.getTime()>Date.now()?
         "SCHEDULED":"ACTIVE";
       const members=await client.query<{recipient_id:string}>(`
         SELECT recipient_id FROM cg19_notice_recipient
         WHERE realm_id=$1 AND notice_id=$2 ORDER BY recipient_id
       `,[actor.realmId,n.id]);
       // Source set was frozen on initial draft; never expand to new staff later.
       if(members.rows.length!==n.audience_count||
          digest([actor.realmId,members.rows.map(x=>x.recipient_id)])!==n.audience_digest)
         throw new ConflictException("Frozen audience is unavailable");
       for(const channel of n.channels){
         const template=await this.template(client,actor.realmId,channel,n,actor.accountId);
         // This INSERT resolves only the FROZEN target snapshot. A current
         // CG-01 ACTIVE/verified contact and exact purpose opt-in are required
         // for each external channel. One SQL statement per channel.
         await client.query(`
           WITH inserted AS (
             INSERT INTO cg19_notification(
               realm_id,source_kind,source_key,notice_id,recipient_id,
               template_id,template_version,channel,subject_snapshot,
               body_snapshot,purpose,state,due_at,expires_at)
             SELECT $1,'NOTICE',$2,$2,r.recipient_id,$3,$4,$5,$6,$7,$8,
               CASE WHEN $5='IN_APP' THEN 'IN_APP' ELSE 'QUEUED' END,
               CASE WHEN $5='IN_APP' THEN NULL
                    ELSE COALESCE($9::timestamptz,now()) END,$10
             FROM cg19_notice_recipient r
             JOIN account a
               ON a.id=r.recipient_id AND a.realm_id=r.realm_id
               AND a.status='ACTIVE'
             LEFT JOIN cg19_channel_preference consent
               ON consent.realm_id=r.realm_id AND
                  consent.account_id=r.recipient_id AND
                  consent.channel=$5 AND consent.purpose=$8 AND consent.opted_in
             WHERE r.realm_id=$1 AND r.notice_id=$2
               AND ($5='IN_APP' OR
                 ($5='EMAIL' AND a.email_verified_at IS NOT NULL
                   AND consent.account_id IS NOT NULL) OR
                 ($5='SMS' AND a.contact_phone_verified_at IS NOT NULL
                   AND a.contact_phone IS NOT NULL
                   AND consent.account_id IS NOT NULL))
             ON CONFLICT DO NOTHING
             RETURNING id
           )
           INSERT INTO cg19_communication_event(
             realm_id,notification_id,kind)
           SELECT $1,id,'SOURCE_CAPTURED' FROM inserted
         `,[actor.realmId,n.id,template.id,template.version,channel,
           template.subject,template.body,n.purpose,
           n.scheduled_at,n.expires_at]);
       }
     }else{
       await client.query(`
         UPDATE cg19_notification
         SET state='SUPPRESSED',updated_at=now(),due_at=NULL
         WHERE notice_id=$1 AND realm_id=$2 AND
           state IN('QUEUED','PROVIDER_UNAVAILABLE','RETRY_DUE','UNKNOWN_PROVIDER')
       `,[n.id,actor.realmId]);
     }
     const changed=await client.query<{revision:number}>(`
       UPDATE cg19_notice SET state=$3,revision=revision+1,
         approved_by=CASE WHEN $3='CANCELLED' THEN approved_by ELSE $4 END,
         approved_at=CASE WHEN $3='CANCELLED' THEN approved_at ELSE now() END,
         updated_at=now()
       WHERE realm_id=$1 AND id=$2 AND revision=$5 RETURNING revision
     `,[actor.realmId,n.id,state,actor.accountId,n.revision]);
     if(!changed.rowCount)throw new ConflictException("Notice was modified");
     await client.query(`
       INSERT INTO cg19_notice_command(
         realm_id,notice_id,actor_id,request_key,request_digest,action,applied_revision)
       VALUES($1,$2,$3,$4,$5,$6,$7)
     `,[actor.realmId,n.id,actor.accountId,key,hash,command.action,
       changed.rows[0].revision]);
     await client.query(`
       INSERT INTO cg19_communication_event(realm_id,actor_id,notice_id,kind)
       VALUES($1,$2,$3,$4)
     `,[actor.realmId,actor.accountId,n.id,
       command.action==="APPROVE"?"NOTICE_APPROVED":"NOTICE_CANCELLED"]);
     await client.query("COMMIT");open=false;
     return {status:state,revision:changed.rows[0].revision};
   }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
 }
 async commandStatus(bearer:string,noticeRef:unknown,requestKey:unknown){
   const actor=await this.sessions.requireAction(
     bearer,"communications.notices.approve");
   const id=ref(noticeRef),key=ref(requestKey);
   const q=await this.db.query<{action:string;applied_revision:number}>(`
     SELECT action,applied_revision FROM cg19_notice_command
     WHERE realm_id=$1 AND notice_id=$2 AND actor_id=$3 AND request_key=$4
   `,[actor.realmId,id,actor.accountId,key]);
   return q.rowCount?
     {status:"CONFIRMED",action:q.rows[0].action,
       revision:q.rows[0].applied_revision}:
     {status:"NOT_FOUND",action:null,revision:null};
 }
 async lookupDraft(bearer:string,requestKey:unknown){
   const actor=await this.sessions.requireAction(bearer,"communications.notices.manage");
   const key=ref(requestKey);
   const q=await this.db.query<NoticeRow>(`
     SELECT * FROM cg19_notice
     WHERE realm_id=$1 AND author_id=$2 AND request_key=$3
   `,[actor.realmId,actor.accountId,key]);
   return q.rowCount?{status:"CONFIRMED",notice:view(q.rows[0])}:
     {status:"NOT_FOUND",notice:null};
 }
 async list(bearer:string,limitInput:unknown=20){
   const actor=await this.sessions.requireAction(bearer,"communications.notices.manage");
   const limit=Number(limitInput);
   if(!Number.isInteger(limit)||limit<1||limit>30)
     throw new BadRequestException("Choose a valid page size");
   const out=await this.db.query<NoticeRow>(`
     SELECT * FROM cg19_notice WHERE realm_id=$1
     ORDER BY created_at DESC,id DESC LIMIT $2
   `,[actor.realmId,limit]);
   return {notices:out.rows.map(view)};
 }
 async deliveryCounts(bearer:string,noticeRef:unknown){
   const actor=await this.sessions.requireAction(bearer,"communications.delivery.view");
   const id=ref(noticeRef);
   const rows=await this.db.query<{channel:Channel;state:string;count:string}>(`
     SELECT channel,state,count(*)::text AS count
     FROM cg19_notification WHERE realm_id=$1 AND notice_id=$2
     GROUP BY channel,state ORDER BY channel,state
   `,[actor.realmId,id]);
   return {counts:rows.rows.map(row=>({
     channel:row.channel,status:row.state,count:Number(row.count)
   }))};
 }
}
