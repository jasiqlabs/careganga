import {
  BadRequestException,ConflictException,ForbiddenException,HttpException,
  HttpStatus,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,
  timingSafeEqual} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {CommunicationRecipientSource} from "../../cg-01-identity-access/application/communication-recipient-source.service";
import {HealthCenterSupportScopeFacade} from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const sha=(text:string)=>createHash("sha256").update(text).digest("hex");
type CaseRow={id:string;ticket_number:string;realm_id:string;request_key:string;request_digest:string;
  caller_digest:string;receipt_digest:string;receipt_expires_at:Date;request_encrypted:Buffer;
  status:"OPEN"|"ASSIGNED"|"IN_PROGRESS"|"WAITING_FOR_USER"|"ESCALATED"|"REPLIED"|"RESOLVED"|"CLOSED";revision:number;assigned_account_id:string|null;
  latest_inbound_at:Date;created_at:Date;updated_at:Date;closed_at:Date|null;
  source_channel:string;center_id?:string|null};
type FaqRow={id:string;question:string;answer:string;state:string;revision:number;
  created_at:Date;updated_at:Date};
function uuid(value:unknown):string{
  if(typeof value!=="string"||!UUID.test(value))
    throw new BadRequestException("Choose a valid request");
  return value;
}
function input(value:unknown,keys:string[]):Record<string,unknown>{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new BadRequestException("Check the supplied details");
  const record=value as Record<string,unknown>;
  if(Object.keys(record).some(key=>!keys.includes(key)))
    throw new BadRequestException("Unsupported information");
  return record;
}
function clean(value:unknown,min:number,max:number):string{
  if(typeof value!=="string"||value.trim().length<min||value.length>max||
    /[\u0000-\u001f\u007f]/.test(value)||/<[\s/]*[a-z][^>]*>/i.test(value))
    throw new BadRequestException("Check the information and length");
  return value.trim();
}
function revision(value:unknown){
  if(!Number.isSafeInteger(value)||Number(value)<1)
    throw new BadRequestException("Refresh this record first");
  return Number(value);
}
function guestKey(){
  const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
  if(key.length!==32)throw new Error("Protected Foundation key unavailable");
  return key;
}
function scopedKey(purpose:string){
  return createHmac("sha256",guestKey()).update("cg19-support-v1:"+purpose).digest();
}
function hmac(purpose:string,value:string){
  return createHmac("sha256",scopedKey(purpose)).update(value).digest("hex");
}
function seal(details:unknown){
  const iv=randomBytes(12),key=scopedKey("contact-encryption");
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  const data=Buffer.from(JSON.stringify(details),"utf8");
  const encrypted=Buffer.concat([cipher.update(data),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),encrypted]);
}
function open(blob:Buffer):{name:string;contact:string;subject:string;message:string}{
  if(blob.length<29)throw new Error("Protected contact invalid");
  const decipher=createDecipheriv("aes-256-gcm",scopedKey("contact-encryption"),
    blob.subarray(0,12));
  decipher.setAuthTag(blob.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(blob.subarray(28)),
    decipher.final()]).toString("utf8")) as {
      name:string;contact:string;subject:string;message:string};
}
function publicState(status:string){
  return status==="CLOSED"?"CLOSED":
    status==="RESOLVED"?"RESOLVED":
    status==="WAITING_FOR_USER"?"ACTION_REQUIRED":
    status==="REPLIED"?"RESPONDED":
    ["ASSIGNED","IN_PROGRESS","ESCALATED"].includes(status)?"IN_PROGRESS":
    "SUBMITTED";
}
/** Bounded keyed blind-index terms; no plaintext contact/subject enters DB indexes. */
function searchTerms(values:readonly string[]):string[]{
  const terms=new Set<string>();
  for(const value of values){
    const normalized=value.normalize("NFKC").toLocaleLowerCase("en-US").trim();
    if(normalized.length>=3&&normalized.length<=90)terms.add(normalized);
    for(const word of normalized.match(/[\p{L}\p{N}@+._-]{3,90}/gu)??[]){
      terms.add(word);
      for(let length=3;length<=Math.min(word.length,12);length++)
        terms.add(word.slice(0,length));
    }
  }
  return [...terms].slice(0,200);
}
@Injectable()
export class SupportService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly people:CommunicationRecipientSource,
    private readonly centerScope:HealthCenterSupportScopeFacade){}
  private async root(client:PoolClient){
    const found=await client.query<{id:string}>(
      "SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT' LIMIT 1");
    if(!found.rowCount)throw new HttpException("Foundation support unavailable",503);
    return found.rows[0].id;
  }
  private async throttle(address:string,scope:string,limit:number,seconds:number){
    // Raw IP and visitor content are never stored. The backend transport-supplied
    // socket address is used, not an attacker-controlled X-Forwarded-For header.
    const digest=hmac("guest-throttle",scope+":"+(address||"unknown"));
    const count=await this.db.query<{attempt_count:number}>(
      "INSERT INTO cg19_support_guest_throttle(bucket_digest,window_started_at,attempt_count) "+
      "VALUES($1,now(),1) ON CONFLICT(bucket_digest) DO UPDATE SET "+
      "attempt_count=CASE WHEN cg19_support_guest_throttle.window_started_at<"+
      "now()-make_interval(secs=>$2) THEN 1 ELSE LEAST(cg19_support_guest_throttle.attempt_count::bigint+1,2147483647)::integer END,"+
      "window_started_at=CASE WHEN cg19_support_guest_throttle.window_started_at<"+
      "now()-make_interval(secs=>$2) THEN now() ELSE cg19_support_guest_throttle.window_started_at END "+
      "RETURNING attempt_count",[digest,seconds]);
    if(count.rows[0].attempt_count>limit)
      throw new HttpException("Too many requests. Please try again later.",HttpStatus.TOO_MANY_REQUESTS);
    // Opportunistic bounded maintenance, not a tenant-wide idle polling job.
    // Old HMAC buckets are safe to expire; contact/receipt evidence is untouched.
    if(Math.random()<0.02){
      try{await this.db.query(
        "WITH expired AS (SELECT bucket_digest FROM cg19_support_guest_throttle "+
        "WHERE window_started_at<now()-interval '7 days' "+
        "ORDER BY window_started_at LIMIT 200) "+
        "DELETE FROM cg19_support_guest_throttle t USING expired "+
        "WHERE t.bucket_digest=expired.bucket_digest");
      }catch{/* Expiry housekeeping must not erase a genuine contact action. */}
    }
  }
  private async actor(bearer:string,capability:string){
    const actor=await this.sessions.requireAction(bearer,capability);
    const scope=await this.db.query(
      "SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'",[actor.realmId]);
    if(!scope.rowCount)throw new ForbiddenException("Foundation access only");
    return actor;
  }
  async agents(bearer:string,searchInput:unknown=""){
    const actor=await this.actor(bearer,"support.cases.manage");
    await this.sessions.requireAction(bearer,"accounts.select");
    if(typeof searchInput!=="string"||searchInput.length>70)
      throw new BadRequestException("Check operator search");
    const client=await this.db.connect();
    try{return {options:await this.people.supportAgentOptions(
      client,actor.realmId,searchInput,30)};}
    finally{client.release();}
  }
  private async current(client:PoolClient,a:VerifiedFoundationActor,capability:string){
    const status=await client.query(
      "SELECT 1 FROM auth_session s JOIN account account "+
      "ON account.id=s.account_id AND account.realm_id=$2 AND account.status='ACTIVE' "+
      "AND account.access_version=s.account_access_version "+
      "JOIN account_role ar ON ar.account_id=account.id AND ar.realm_id=account.realm_id "+
      "AND ar.revoked_at IS NULL JOIN role r ON r.id=ar.role_id AND r.active "+
      "LEFT JOIN auth_security_policy p ON p.access_realm_id=account.realm_id "+
      "WHERE s.id=$1 AND s.account_id=$3 AND s.revoked_at IS NULL "+
      "AND s.expires_at>now() AND s.password_authenticated_at IS NOT NULL "+
      "AND s.issued_at>now()-make_interval(secs=>COALESCE(p.max_session_age_seconds,28800)) "+
      "AND s.last_seen_at>now()-make_interval(secs=>COALESCE(p.idle_timeout_seconds,1800)) "+
      "AND (r.is_protected OR EXISTS(SELECT 1 FROM role_grant g "+
      "WHERE g.role_id=r.id AND g.capability_key=$4)) "+
      "FOR SHARE OF s,account,ar,r",[a.activeSessionId,a.realmId,a.accountId,capability]);
    if(!status.rowCount)throw new ForbiddenException("Foundation permission changed");
  }
  private async event(client:PoolClient,realm:string,caseId:string,
    actor:string|null,kind:string,metadata:Record<string,unknown>={}){
    await client.query(
      "INSERT INTO cg19_support_event(realm_id,case_id,actor_id,kind,metadata) "+
      "VALUES($1,$2,$3,$4,$5::jsonb)",
      [realm,caseId,actor,kind,JSON.stringify(metadata)]);
  }
  /** Same original guest throttle storage, independently keyed newsletter limits. */
  async newsletterThrottle(address:string,emailDigest:string,phase:"start"|"confirm"){
    await this.throttle(address,"newsletter-"+phase,phase==="start"?12:50,3600);
    await this.throttle(emailDigest,"newsletter-email-"+phase,phase==="start"?3:20,3600);
  }
  async contact(address:string,payload:unknown){
    await this.throttle(address,"contact",12,3600);
    const x=input(payload,["requestKey","name","contact","subject","message"]);
    const requestKey=uuid(x.requestKey);
    const name=clean(x.name,2,90),contact=clean(x.contact,5,120),
      subject=clean(x.subject,5,140),message=clean(x.message,10,2000);
    if(!(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact)||
      /^\+?[0-9()\-\s]{8,20}$/.test(contact)))
      throw new BadRequestException("Use an email address or a valid phone number");
    const digest=sha(JSON.stringify([name,contact,subject,message]));
    // A lost response remains recoverable even if the visitor's connection
    // changes IP. The private opaque request key + exact contact/payload must
    // match; anonymous rate limiting still uses the current socket IP.
    const caller=hmac("source",JSON.stringify([
      name.toLocaleLowerCase("en-US"),contact.toLocaleLowerCase("en-US")
    ]));
    const client=await this.db.connect();let begun=false;
    try{
      await client.query("BEGIN");begun=true;
      const realm=await this.root(client);
      const receipt=createHmac("sha256",scopedKey("receipt"))
        .update(realm+":"+caller+":"+requestKey).digest("base64url");
      const receiptDigest=sha(receipt);
      // Serialize identical anonymous request keys before lookup and insert.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",
        [realm,requestKey]);
      const old=await client.query<CaseRow>(
        "SELECT * FROM cg19_support_case WHERE realm_id=$1 "+
        "AND source_channel='FOUNDATION_PUBLIC' AND request_key=$2 FOR UPDATE",
        [realm,requestKey]);
      if(old.rowCount){
        if(old.rows[0].request_digest!==digest||old.rows[0].caller_digest!==caller)
          throw new ConflictException("The original request key was already used");
        await client.query("COMMIT");begun=false;
        return {receipt,ticketNumber:old.rows[0].ticket_number,
          expiresAt:old.rows[0].receipt_expires_at.toISOString(),
          status:publicState(old.rows[0].status),result:"PREVIOUSLY_CONFIRMED"};
      }
      const created=await client.query<{id:string;ticket_number:string;receipt_expires_at:Date}>(
        "INSERT INTO cg19_support_case(realm_id,request_key,request_digest,"+
        "caller_digest,receipt_digest,receipt_expires_at,request_encrypted) "+
        "VALUES($1,$2,$3,$4,$5,now()+interval '30 days',$6) "+
        "RETURNING id,ticket_number,receipt_expires_at",
        [realm,requestKey,digest,caller,receiptDigest,seal({name,contact,subject,message})]);
      const terms=searchTerms([name,contact,subject]);
      if(terms.length){
        await client.query(
          "INSERT INTO cg19_support_search_token(realm_id,case_id,term_digest) "+
          "SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
          [realm,created.rows[0].id,terms.map(t=>hmac("search",t))]);
      }
      await this.event(client,realm,created.rows[0].id,null,"CONTACT_SUBMITTED");
      await client.query("COMMIT");begun=false;
      return {receipt,ticketNumber:created.rows[0].ticket_number,
        expiresAt:created.rows[0].receipt_expires_at.toISOString(),
        status:"SUBMITTED",result:"CONFIRMED"};
    }catch(e){if(begun)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  /** Original private support receipt and identity-owned verified email are both
   * required; only the source case reference is passed to CG19 payroll capture. */
  async payrollResendTicket(tx:PoolClient,a:VerifiedFoundationActor,receipt:unknown){
    await this.throttle(a.realmId+":"+a.accountId,"payroll-resend-receipt",10,900);
    if(typeof receipt!=="string"||!TOKEN.test(receipt))throw new NotFoundException("Verified support receipt unavailable");
    const candidate=sha(receipt);
    const found=(await tx.query<CaseRow>(`SELECT * FROM cg19_support_case
     WHERE realm_id=$1 AND source_channel='FOUNDATION_PUBLIC' AND receipt_digest=$2 AND receipt_expires_at>now() AND status<>'CLOSED' FOR SHARE`,[a.realmId,candidate])).rows[0];
    const person=await this.people.get(tx,a.realmId,a.accountId);
    if(!found||!person?.active||!person.emailVerified||!person.email||!timingSafeEqual(Buffer.from(candidate,"hex"),Buffer.from(found.receipt_digest,"hex"))||
     open(found.request_encrypted).contact.trim().toLocaleLowerCase("en-US")!==person.email.trim().toLocaleLowerCase("en-US"))
      throw new NotFoundException("Verified support receipt unavailable");
    return found.id;
  }
  async receipt(address:string,payload:unknown){
    await this.throttle(address,"receipt",30,900);
    const x=input(payload,["receipt"]);
    if(typeof x.receipt!=="string"||!TOKEN.test(x.receipt))
      throw new BadRequestException("Enter the original private receipt");
    const candidate=Buffer.from(sha(x.receipt),"hex");
    const rows=await this.db.query<{receipt_digest:string;ticket_number:string;status:string}>(
      "SELECT c.receipt_digest,c.ticket_number,c.status FROM cg19_support_case c "+
      "JOIN access_realm r ON r.id=c.realm_id AND r.realm_key='FOUNDATION_ROOT' "+
      "WHERE c.receipt_digest=$1 AND c.receipt_expires_at>now() LIMIT 1",
      [candidate.toString("hex")]);
    const row=rows.rows[0];
    if(!row||!timingSafeEqual(candidate,Buffer.from(row.receipt_digest,"hex")))
      throw new NotFoundException("Original receipt unavailable or expired");
    return {status:publicState(row.status),ticketNumber:row.ticket_number};
  }
  async cases(bearer:string,rawLimit:unknown=30,filter:unknown="ALL",
    pageCursor:unknown=null,search:unknown="",lastActivity:unknown="ALL",
    startedFrom:unknown="",startedTo:unknown=""){
    const a=await this.actor(bearer,"support.cases.view");
    const limit=Number(rawLimit);
    if(!Number.isInteger(limit)||limit<1||limit>30||
      typeof filter!=="string"||!["ALL","OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_USER",
      "ESCALATED","REPLIED","RESOLVED","CLOSED","ARCHIVED","UNREAD","OPEN_GROUP","CLOSED_GROUP"].includes(filter)||
      typeof search!=="string"||search.length>100)
      throw new BadRequestException("Choose a supported filter");
    const validDate=(v:unknown):v is string=>typeof v==="string"&&(v===""||
      (/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>="0001-01-01"&&Number.isFinite(Date.parse(v))&&
        new Date(v).toISOString().slice(0,10)===v));
    if(typeof lastActivity!=="string"||!["ALL","TODAY","WEEK","MONTH"].includes(lastActivity)||
      !validDate(startedFrom)||!validDate(startedTo)||
      (startedFrom!==""&&startedTo!==""&&startedFrom>startedTo))
      throw new BadRequestException("Choose a valid date range");
    let searchDigests:string[]|null=null;
    if(search.trim()){
      const words=searchTerms([search.trim()]);
      if(!words.length||search.trim().length<3)
        throw new BadRequestException("Enter at least three search characters");
      // Every supplied term must match. Exact full contact or word prefixes
      // work without decryption of unrelated Foundation case records.
      const tokens=search.trim().normalize("NFKC").toLocaleLowerCase("en-US")
        .match(/[\p{L}\p{N}@+._-]{3,90}/gu)??[];
      const unique=[...new Set(tokens)].slice(0,5);
      searchDigests=(unique.length?unique:words.slice(0,1))
        .map(t=>hmac("search",t));
    }
    const dateScope=lastActivity==="ALL"&&!startedFrom&&!startedTo?"":
      JSON.stringify([lastActivity,startedFrom,startedTo]);
    const searchProof=sha((searchDigests??[]).join(",")+(dateScope?"|"+dateScope:""));
    let afterTimestamp:string|null=null,afterId:string|null=null;
    if(pageCursor!==null&&pageCursor!==undefined&&pageCursor!==""){
      if(typeof pageCursor!=="string"||pageCursor.length>400||
        !/^[A-Za-z0-9_-]+$/.test(pageCursor))
        throw new BadRequestException("Refresh the message page");
      try{
        const parsed:unknown=JSON.parse(Buffer.from(pageCursor,"base64url").toString("utf8"));
        if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||
          !("t" in parsed)||!("id" in parsed)||!("filter" in parsed)||
          typeof parsed.t!=="string"||typeof parsed.id!=="string"||
          parsed.filter!==filter||!("searchProof" in parsed)||
          parsed.searchProof!==searchProof||!UUID.test(parsed.id)||
          !/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9:.+-]{10,35}$/.test(parsed.t))
          throw Error("Bad cursor");
        afterTimestamp=parsed.t;afterId=parsed.id;
      }catch{throw new BadRequestException("Refresh the message page");}
    }
    const results=await this.db.query<CaseRow&{last_seen_inbound_at:Date|null;
      archived_at:Date|null;timestamp_text:string}>(
      "SELECT c.*,c.updated_at::text AS timestamp_text,"+
      "rs.last_seen_inbound_at,rs.archived_at FROM cg19_support_case c "+
      "LEFT JOIN cg19_support_read_state rs ON rs.case_id=c.id "+
      "AND rs.realm_id=c.realm_id AND rs.operator_account_id=$2 "+
      "WHERE c.realm_id=$1 AND (($3='ALL' AND rs.archived_at IS NULL) OR "+
      "($3='ARCHIVED' AND rs.archived_at IS NOT NULL) OR "+
      "($3='UNREAD' AND (rs.last_seen_inbound_at IS NULL OR "+
      "rs.last_seen_inbound_at<c.latest_inbound_at) AND rs.archived_at IS NULL) OR "+
      "($3='OPEN_GROUP' AND c.status IN('OPEN','ASSIGNED','IN_PROGRESS','WAITING_FOR_USER','ESCALATED','REPLIED') AND rs.archived_at IS NULL) OR "+
      "($3='CLOSED_GROUP' AND c.status IN('RESOLVED','CLOSED') AND rs.archived_at IS NULL) OR "+
      "(c.status=$3 AND rs.archived_at IS NULL)) "+
      "AND ($7::text[] IS NULL OR (SELECT count(*) "+
      "FROM cg19_support_search_token t WHERE t.realm_id=c.realm_id "+
      "AND t.case_id=c.id AND t.term_digest=ANY($7::text[])) "+
      "=cardinality($7::text[])) "+
      "AND ($8::text='ALL' OR ($8='TODAY' AND c.updated_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') "+
      "OR ($8='WEEK' AND c.updated_at>=now()-interval '7 days') OR ($8='MONTH' AND c.updated_at>=now()-interval '30 days')) "+
      "AND ($9::date IS NULL OR c.created_at>=($9::date::timestamp AT TIME ZONE 'UTC')) "+
      "AND ($10::date IS NULL OR c.created_at<(($10::date+1)::timestamp AT TIME ZONE 'UTC')) "+
      "AND ($5::timestamptz IS NULL OR "+
      " (c.updated_at,c.id)<($5::timestamptz,$6::uuid)) "+
      "ORDER BY c.updated_at DESC,c.id DESC LIMIT $4",
      [a.realmId,a.accountId,filter,limit+1,afterTimestamp,afterId,searchDigests,lastActivity,startedFrom||null,startedTo||null]);
    const shown=results.rows.slice(0,limit);
    const more=results.rows.length>limit;
    const tail=shown.at(-1);
    const nextCursor=more&&tail?Buffer.from(JSON.stringify({
      t:tail.timestamp_text,id:tail.id,filter,searchProof
    })).toString("base64url"):null;
    const counter=await this.db.query<{total:string;open:string;replied:string;
      closed:string;unread:string;archived:string;received_today:string}>(
      "SELECT count(*) AS total,count(*) FILTER(WHERE c.status IN("+
      "'OPEN','ASSIGNED','IN_PROGRESS','WAITING_FOR_USER','ESCALATED',"+
      "'REPLIED')) AS open,"+
      "count(*) FILTER(WHERE c.status='REPLIED') AS replied,"+
      "count(*) FILTER(WHERE c.status IN('RESOLVED','CLOSED')) AS closed,"+
      "count(*) FILTER(WHERE c.created_at>=date_trunc('day',now())) AS received_today,"+
      "count(*) FILTER(WHERE (rs.last_seen_inbound_at IS NULL OR "+
      "rs.last_seen_inbound_at<c.latest_inbound_at) AND rs.archived_at IS NULL) AS unread,"+
      "count(*) FILTER(WHERE rs.archived_at IS NOT NULL) AS archived "+
      "FROM cg19_support_case c LEFT JOIN cg19_support_read_state rs "+
      "ON rs.case_id=c.id AND rs.realm_id=c.realm_id AND rs.operator_account_id=$2 "+
      "WHERE c.realm_id=$1",[a.realmId,a.accountId]);
    return {nextCursor,items:shown.map(row=>{
      const data=open(row.request_encrypted);
      return {caseRef:row.id,ticketNumber:row.ticket_number,
        subject:data.subject,name:data.name,
        contact:data.contact,status:row.status,revision:row.revision,
        assignedAccountRef:row.assigned_account_id,
        createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),
        unread:!row.last_seen_inbound_at||row.last_seen_inbound_at<row.latest_inbound_at,
        archived:!!row.archived_at};
    }),counts:Object.fromEntries(Object.entries(counter.rows[0]??{}).map(([k,v])=>[k,Number(v)]))};
  }
  async detail(bearer:string,rawRef:unknown){
    const a=await this.actor(bearer,"support.cases.view"),ref=uuid(rawRef);
    const found=await this.db.query<CaseRow>(
      "SELECT * FROM cg19_support_case WHERE realm_id=$1 AND id=$2",[a.realmId,ref]);
    if(!found.rowCount)throw new NotFoundException("Case unavailable");
    const row=found.rows[0],request=open(row.request_encrypted);
    const [replies,history,reading,notes]=await Promise.all([
      this.db.query<{id:string;author_account_id:string;body_encrypted:Buffer;
        created_at:Date}>(
        "SELECT id,author_account_id,body_encrypted,created_at "+
        "FROM cg19_support_reply WHERE realm_id=$1 AND case_id=$2 "+
        "ORDER BY created_at,id LIMIT 100",[a.realmId,ref]),
      this.db.query<{kind:string;occurred_at:Date}>(
        "SELECT kind,occurred_at FROM cg19_support_event "+
        "WHERE realm_id=$1 AND case_id=$2 ORDER BY occurred_at,id LIMIT 100",
        [a.realmId,ref]),
      this.db.query<{last_seen_inbound_at:Date|null;archived_at:Date|null}>(
        "SELECT last_seen_inbound_at,archived_at FROM cg19_support_read_state "+
        "WHERE realm_id=$1 AND case_id=$2 AND operator_account_id=$3",
        [a.realmId,ref,a.accountId]),
      this.db.query<{case_revision:number;new_status:string;note_encrypted:Buffer;
        created_at:Date}>(
        "SELECT case_revision,new_status,note_encrypted,created_at "+
        "FROM cg19_support_status_note WHERE realm_id=$1 AND case_id=$2 "+
        "ORDER BY case_revision DESC LIMIT 100",[a.realmId,ref])
    ]);
    const seen=reading.rows[0];
    return {caseRef:row.id,ticketNumber:row.ticket_number,
      sourceChannel:row.source_channel,...request,status:row.status,
      unread:!seen?.last_seen_inbound_at||seen.last_seen_inbound_at<row.latest_inbound_at,
      archived:!!seen?.archived_at,
      revision:row.revision,assignedAccountRef:row.assigned_account_id,
      createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),
      replies:replies.rows.map(reply=>({
        replyRef:reply.id,authorAccountRef:reply.author_account_id,
        body:(open(reply.body_encrypted)).message,
        createdAt:reply.created_at.toISOString()
      })),history:history.rows.map(h=>({kind:h.kind,at:h.occurred_at.toISOString()})),
      statusNotes:notes.rows.map(note=>({
        revision:note.case_revision,status:note.new_status,
        summary:open(note.note_encrypted).message,
        recordedAt:note.created_at.toISOString()
      }))};
  }
  private async mutate(bearer:string,rawRef:unknown,capability:string,
    payload:unknown,action:"ASSIGN"|"REPLY"|"STATUS"|"READ"|"ARCHIVE"){
    const a=await this.actor(bearer,capability),id=uuid(rawRef);
    const x=input(payload,action==="ASSIGN"?
      ["expectedRevision","assignedAccountRef"]:
      action==="REPLY"?["expectedRevision","requestKey","body"]:
      action==="STATUS"?["expectedRevision","status","note"]:
      action==="READ"?[]:["archived"]);
    const expected=action==="READ"||action==="ARCHIVE"?null:revision(x.expectedRevision);
    const client=await this.db.connect();let begun=false;
    try{
      await client.query("BEGIN");begun=true;
      await this.current(client,a,capability);
      const res=await client.query<CaseRow>(
        "SELECT * FROM cg19_support_case WHERE realm_id=$1 AND id=$2 FOR UPDATE",
        [a.realmId,id]);
      if(!res.rowCount)throw new NotFoundException("Case unavailable");
      const c=res.rows[0];
      if(action==="READ"||action==="ARCHIVE"){
        const archived=action==="ARCHIVE"?x.archived:null;
        if(action==="ARCHIVE"&&typeof archived!=="boolean")
          throw new BadRequestException("Choose archive or restore");
        await client.query(
          "INSERT INTO cg19_support_read_state("+
          "realm_id,case_id,operator_account_id,last_seen_inbound_at,archived_at) "+
          "VALUES($1,$2,$3,$4,$5) ON CONFLICT(case_id,operator_account_id) "+
          "DO UPDATE SET last_seen_inbound_at=CASE WHEN $6='READ' "+
          "THEN EXCLUDED.last_seen_inbound_at "+
          "ELSE cg19_support_read_state.last_seen_inbound_at END,"+
          "archived_at=CASE WHEN $6='ARCHIVE' THEN EXCLUDED.archived_at "+
          "ELSE cg19_support_read_state.archived_at END",
          [a.realmId,id,a.accountId,action==="READ"?c.latest_inbound_at:null,
            action==="ARCHIVE"&&archived?new Date():null,action]);
        await this.event(client,a.realmId,id,a.accountId,
          action==="READ"?"READ":archived?"ARCHIVED":"RESTORED");
        await client.query("COMMIT");begun=false;
        return {status:"CONFIRMED",revision:c.revision};
      }
      if(c.revision!==expected){
        // The same immutable reply may already have committed before a lost HTTP
        // response. Reconcile it before returning an optimistic-lock conflict.
        if(action==="REPLY"){
          const key=uuid(x.requestKey),body=clean(x.body,2,2400);
          const prior=await client.query<{body_digest:string}>(
            "SELECT body_digest FROM cg19_support_reply WHERE realm_id=$1 "+
            "AND case_id=$2 AND author_account_id=$3 AND request_key=$4",
            [a.realmId,id,a.accountId,key]);
          if(prior.rowCount){
            if(prior.rows[0].body_digest!==sha(body))
              throw new ConflictException("Original reply key has different content");
            await client.query("COMMIT");begun=false;
            return {status:"PREVIOUSLY_CONFIRMED",revision:c.revision};
          }
        }
        throw new ConflictException("This support case changed. Refresh before retrying.");
      }
      if(action==="ASSIGN"){
        if(["CLOSED","RESOLVED"].includes(c.status))
          throw new ConflictException("Reopen or resume this case before reassigning it.");
        const target=x.assignedAccountRef===null?null:uuid(x.assignedAccountRef);
        if(target){
          // Selection is a distinct CG-01 permission. Backend enforcement does
          // not trust the UI's hidden selector or guessed account reference.
          await this.current(client,a,"accounts.select");
          if(!await this.people.isSupportAgent(client,a.realmId,target))
            throw new ForbiddenException("Eligible support agent unavailable");
        }
        await client.query(
          "UPDATE cg19_support_case SET assigned_account_id=$3,"+
          "status=CASE WHEN status='OPEN' AND $3::uuid IS NOT NULL "+
          "THEN 'ASSIGNED' WHEN status='ASSIGNED' AND $3::uuid IS NULL "+
          "THEN 'OPEN' ELSE status END,revision=revision+1,"+
          "updated_at=now() WHERE realm_id=$1 AND id=$2",
          [a.realmId,id,target]);
        await this.event(client,a.realmId,id,a.accountId,"ASSIGNED",
          {assigned:!!target});
      }else if(action==="REPLY"){
        if(["CLOSED","RESOLVED"].includes(c.status))
          throw new ConflictException("Reopen this case before replying");
        const body=clean(x.body,2,2400),key=uuid(x.requestKey);
        const hash=sha(body);
        const prior=await client.query<{body_digest:string}>(
          "SELECT body_digest FROM cg19_support_reply WHERE realm_id=$1 "+
          "AND case_id=$2 AND author_account_id=$3 AND request_key=$4",
          [a.realmId,id,a.accountId,key]);
        if(prior.rowCount){
          if(prior.rows[0].body_digest!==hash)
            throw new ConflictException("The original reply key has different content");
          await client.query("COMMIT");begun=false;
          return {status:"PREVIOUSLY_CONFIRMED",revision:c.revision};
        }
        await client.query(
          "INSERT INTO cg19_support_reply("+
          "realm_id,case_id,author_account_id,request_key,body_digest,body_encrypted) "+
          "VALUES($1,$2,$3,$4,$5,$6)",
          [a.realmId,id,a.accountId,key,hash,
            seal({name:"",contact:"",subject:"",message:body})]);
        await client.query(
          "UPDATE cg19_support_case SET status='REPLIED',closed_at=NULL,"+
          "revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",
          [a.realmId,id]);
        await this.event(client,a.realmId,id,a.accountId,"REPLIED");
      }else{
        if(!["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_USER",
          "ESCALATED","RESOLVED","CLOSED"].includes(String(x.status)))
          throw new BadRequestException("Choose a supported case status");
        if(c.status===x.status)throw new ConflictException("Case is already in this state");
        if(c.status==="CLOSED"&&x.status!=="OPEN")
          throw new ConflictException("Reopen the closed case before changing its status.");
        if(c.status==="RESOLVED"&&!["OPEN","CLOSED"].includes(String(x.status)))
          throw new ConflictException("Reopen a resolved case before continuing work.");
        if(x.status==="ASSIGNED"&&!c.assigned_account_id)
          throw new ConflictException("Assign an eligible operator before using Assigned status.");
        const mustExplain=["WAITING_FOR_USER","RESOLVED","CLOSED"].includes(String(x.status));
        const explanation=x.note===undefined||x.note===null?null:clean(x.note,8,1200);
        if(mustExplain&&!explanation)
          throw new BadRequestException("Enter a case update or resolution summary (8–1200 characters).");
        await client.query(
          "UPDATE cg19_support_case SET status=$3,closed_at="+
          "CASE WHEN $3='CLOSED' THEN now() ELSE NULL END,"+
          "revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",
          [a.realmId,id,x.status]);
        if(explanation){
          await client.query(
            "INSERT INTO cg19_support_status_note("+
            "realm_id,case_id,actor_account_id,case_revision,new_status,"+
            "note_digest,note_encrypted) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [a.realmId,id,a.accountId,c.revision+1,String(x.status),
              hmac("status-note",a.realmId+":"+id+":"+explanation),
              seal({name:"",contact:"",subject:"",message:explanation})]);
        }
        await this.event(client,a.realmId,id,a.accountId,
          x.status==="CLOSED"?"CLOSED":
            c.status==="CLOSED"?"REOPENED":"STATUS_UPDATED",
          {status:x.status});
      }
      await client.query("COMMIT");begun=false;
      return {status:"CONFIRMED",revision:c.revision+1};
    }catch(e){if(begun)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  assign(token:string,ref:unknown,body:unknown){
    return this.mutate(token,ref,"support.cases.manage",body,"ASSIGN");
  }
  reply(token:string,ref:unknown,body:unknown){
    return this.mutate(token,ref,"support.cases.reply",body,"REPLY");
  }
  change(token:string,ref:unknown,body:unknown){
    return this.mutate(token,ref,"support.cases.manage",body,"STATUS");
  }
  read(token:string,ref:unknown){
    return this.mutate(token,ref,"support.cases.view",{},"READ");
  }
  archive(token:string,ref:unknown,body:unknown){
    return this.mutate(token,ref,"support.cases.view",body,"ARCHIVE");
  }
  /** Real CG-19 case owned by a current CG-14 center. All source validation
   * and case effects share a transaction; the caller cannot choose a root. */
  async createCenterCase(bearer:string,rawCenter:string,payload:unknown){
    const center=uuid(rawCenter),actor=await this.actor(bearer,"health.centers.draft.edit");
    const x=input(payload,["requestKey","subject","message"]);
    const key=uuid(x.requestKey),subject=clean(x.subject,5,140),
      message=clean(x.message,10,2000);
    const digest=sha(JSON.stringify([center,subject,message]));
    const caller=hmac("center-caller",actor.realmId+":"+center+":"+actor.accountId);
    const tx=await this.db.connect();let started=false;
    try{
      await tx.query("BEGIN");started=true;
      await tx.query("SET LOCAL lock_timeout='3s'");
      await this.centerScope.assertCurrent(tx,actor,center);
      const existing=await tx.query<CaseRow>(
        "SELECT * FROM cg19_support_case WHERE realm_id=$1 AND source_channel='CENTER_PORTAL' "+
        "AND center_id=$2 AND request_key=$3 FOR UPDATE",
        [actor.realmId,center,key]);
      if(existing.rows[0]){
        if(existing.rows[0].request_digest!==digest||
          existing.rows[0].caller_digest!==caller)
          throw new ConflictException("This support request key belongs to another message");
        await tx.query("COMMIT");started=false;
        return {caseRef:existing.rows[0].id,
          ticketNumber:existing.rows[0].ticket_number,
          revision:existing.rows[0].revision,
          status:existing.rows[0].status,replayed:true};
      }
      const receipt=createHmac("sha256",scopedKey("center-receipt"))
        .update(actor.realmId+":"+center+":"+key).digest("base64url");
      const result=await tx.query<{id:string;ticket_number:string;revision:number;status:string}>(
        "INSERT INTO cg19_support_case(realm_id,center_id,source_channel,request_key,"+
        "request_digest,caller_digest,receipt_digest,receipt_expires_at,request_encrypted) "+
        "VALUES($1,$2,'CENTER_PORTAL',$3,$4,$5,$6,now()+interval '30 days',$7) "+
        "RETURNING id,ticket_number,revision,status",
        [actor.realmId,center,key,digest,caller,sha(receipt),
          seal({name:"Healthcare center representative",contact:"Center Portal",
            subject,message})]);
      const record=result.rows[0];
      await tx.query(
        "INSERT INTO cg19_support_search_token(realm_id,case_id,term_digest) "+
        "SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
        [actor.realmId,record.id,searchTerms([subject]).map(v=>hmac("search",v))]);
      await this.event(tx,actor.realmId,record.id,actor.accountId,"CONTACT_SUBMITTED");
      await tx.query("COMMIT");started=false;
      return {caseRef:record.id,ticketNumber:record.ticket_number,
        revision:record.revision,status:record.status,replayed:false};
    }catch(e){if(started)try{await tx.query("ROLLBACK");}catch{};throw e;}
    finally{tx.release();}
  }
  async centerCases(bearer:string,rawCenter:string){
    const center=uuid(rawCenter),actor=await this.actor(bearer,"health.centers.draft.edit");
    const tx=await this.db.connect();let started=false;
    try{
      await tx.query("BEGIN");started=true;
      await this.centerScope.assertCurrent(tx,actor,center);
      const data=await tx.query<CaseRow>(
        "SELECT id,ticket_number,realm_id,request_key,request_digest,caller_digest,receipt_digest,"+
        "receipt_expires_at,request_encrypted,status,revision,assigned_account_id,"+
        "latest_inbound_at,created_at,updated_at,closed_at FROM cg19_support_case "+
        "WHERE realm_id=$1 AND source_channel='CENTER_PORTAL' AND center_id=$2 "+
        "ORDER BY updated_at DESC,id DESC LIMIT 50",[actor.realmId,center]);
      await tx.query("COMMIT");started=false;
      return {cases:data.rows.map(c=>({
        caseRef:c.id,ticketNumber:c.ticket_number,
        subject:open(c.request_encrypted).subject,
        status:c.status,revision:c.revision,updatedAt:c.updated_at.toISOString()
      }))};
    }catch(e){if(started)try{await tx.query("ROLLBACK");}catch{};throw e;}
    finally{tx.release();}
  }
  async centerCase(bearer:string,rawCenter:string,rawCase:string){
    const center=uuid(rawCenter),ref=uuid(rawCase),
      actor=await this.actor(bearer,"health.centers.draft.edit");
    const tx=await this.db.connect();let started=false;
    try{
      await tx.query("BEGIN");started=true;
      await this.centerScope.assertCurrent(tx,actor,center);
      const data=await tx.query<CaseRow>(
        "SELECT * FROM cg19_support_case WHERE realm_id=$1 AND center_id=$2 "+
        "AND source_channel='CENTER_PORTAL' AND id=$3",
        [actor.realmId,center,ref]);
      const c=data.rows[0];
      if(!c)throw new NotFoundException("Center support case unavailable");
      const messages=await tx.query<{body_encrypted:Buffer;created_at:Date}>(
        "SELECT body_encrypted,created_at FROM cg19_support_reply "+
        "WHERE realm_id=$1 AND case_id=$2 ORDER BY created_at,id LIMIT 100",
        [actor.realmId,ref]);
      await tx.query("COMMIT");started=false;
      return {caseRef:c.id,ticketNumber:c.ticket_number,
        subject:open(c.request_encrypted).subject,
        message:open(c.request_encrypted).message,status:c.status,
        revision:c.revision,replies:messages.rows.map(m=>({
          message:open(m.body_encrypted).message,createdAt:m.created_at.toISOString()
        }))};
    }catch(e){if(started)try{await tx.query("ROLLBACK");}catch{};throw e;}
    finally{tx.release();}
  }
  async centerReply(bearer:string,rawCenter:string,rawCase:string,payload:unknown){
    const center=uuid(rawCenter),ref=uuid(rawCase),
      actor=await this.actor(bearer,"health.centers.draft.edit");
    const x=input(payload,["requestKey","expectedRevision","message"]);
    const key=uuid(x.requestKey),expected=revision(x.expectedRevision),
      message=clean(x.message,2,2400),bodyDigest=sha(message);
    const tx=await this.db.connect();let started=false;
    try{
      await tx.query("BEGIN");started=true;
      await tx.query("SET LOCAL lock_timeout='3s'");
      await this.centerScope.assertCurrent(tx,actor,center);
      const records=await tx.query<CaseRow>(
        "SELECT * FROM cg19_support_case WHERE realm_id=$1 AND center_id=$2 "+
        "AND source_channel='CENTER_PORTAL' AND id=$3 FOR UPDATE",
        [actor.realmId,center,ref]);
      const c=records.rows[0];
      if(!c)throw new NotFoundException("Center support case unavailable");
      const old=await tx.query<{body_digest:string}>(
        "SELECT body_digest FROM cg19_support_reply WHERE realm_id=$1 AND "+
        "case_id=$2 AND author_account_id=$3 AND request_key=$4",
        [actor.realmId,ref,actor.accountId,key]);
      if(old.rows[0]){
        if(old.rows[0].body_digest!==bodyDigest)
          throw new ConflictException("The original support reply key was used for another message");
        await tx.query("COMMIT");started=false;
        return {status:"PREVIOUSLY_CONFIRMED",revision:c.revision,replayed:true};
      }
      if(c.revision!==expected)
        throw new ConflictException("This case changed. Refresh before replying.");
      if(["CLOSED","RESOLVED"].includes(c.status))
        throw new ConflictException("This case is finalized. Contact the Foundation to reopen it.");
      await tx.query(
        "INSERT INTO cg19_support_reply(realm_id,case_id,author_account_id,"+
        "request_key,body_digest,body_encrypted) VALUES($1,$2,$3,$4,$5,$6)",
        [actor.realmId,ref,actor.accountId,key,bodyDigest,
          seal({name:"",contact:"",subject:"",message})]);
      await tx.query(
        "UPDATE cg19_support_case SET status='REPLIED',revision=revision+1,"+
        "closed_at=NULL,updated_at=now() WHERE realm_id=$1 AND id=$2",
        [actor.realmId,ref]);
      await this.event(tx,actor.realmId,ref,actor.accountId,"REPLIED");
      await tx.query("COMMIT");started=false;
      return {status:"CONFIRMED",revision:c.revision+1,replayed:false};
    }catch(e){if(started)try{await tx.query("ROLLBACK");}catch{};throw e;}
    finally{tx.release();}
  }
  async publicFaqs(){
    const result=await this.db.query<FaqRow>(
      "SELECT f.id,f.question,f.answer,f.state,f.revision,f.created_at,f.updated_at "+
      "FROM cg19_support_faq f JOIN access_realm r ON r.id=f.realm_id "+
      "WHERE r.realm_key='FOUNDATION_ROOT' AND f.state='PUBLISHED' "+
      "ORDER BY f.updated_at DESC,f.id DESC LIMIT 30");
    return {faqs:result.rows.map(f=>({faqRef:f.id,question:f.question,answer:f.answer}))};
  }
  async faqs(token:string){
    const a=await this.actor(token,"support.faq.manage");
    const result=await this.db.query<FaqRow>(
      "SELECT id,question,answer,state,revision,created_at,updated_at "+
      "FROM cg19_support_faq WHERE realm_id=$1 "+
      "ORDER BY updated_at DESC,id DESC LIMIT 60",[a.realmId]);
    return {faqs:result.rows.map(f=>({faqRef:f.id,question:f.question,
      answer:f.answer,state:f.state,revision:f.revision}))};
  }
  async faqCreate(token:string,payload:unknown){
    const a=await this.actor(token,"support.faq.manage");
    const x=input(payload,["question","answer"]),question=clean(x.question,5,200),
      answer=clean(x.answer,10,1600);
    const client=await this.db.connect();let begun=false;
    try{
      await client.query("BEGIN");begun=true;
      await this.current(client,a,"support.faq.manage");
      const saved=await client.query<{id:string}>(
        "INSERT INTO cg19_support_faq("+
        "realm_id,question,normalized_question,answer,created_by,updated_by) "+
        "VALUES($1,$2,$3,$4,$5,$5) RETURNING id",
        [a.realmId,question,question.toLowerCase().replace(/\s+/g," "),answer,a.accountId]);
      await client.query(
        "INSERT INTO cg19_support_faq_revision("+
        "realm_id,faq_id,revision,state,question,answer,actor_id) "+
        "VALUES($1,$2,1,'DRAFT',$3,$4,$5)",
        [a.realmId,saved.rows[0].id,question,answer,a.accountId]);
      await client.query("COMMIT");begun=false;
      return {faqRef:saved.rows[0].id,revision:1,status:"DRAFT"};
    }catch(e){if(begun)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  async faqChange(token:string,rawRef:unknown,payload:unknown){
    const a=await this.actor(token,"support.faq.manage"),id=uuid(rawRef);
    const x=input(payload,["expectedRevision","question","answer","state"]),
      expected=revision(x.expectedRevision);
    const client=await this.db.connect();let begun=false;
    try{
      await client.query("BEGIN");begun=true;
      await this.current(client,a,"support.faq.manage");
      const old=await client.query<FaqRow>(
        "SELECT * FROM cg19_support_faq WHERE realm_id=$1 AND id=$2 FOR UPDATE",
        [a.realmId,id]);
      if(!old.rowCount)throw new NotFoundException("Question unavailable");
      const f=old.rows[0];
      if(f.revision!==expected)throw new ConflictException("Question changed. Refresh.");
      const question=x.question===undefined?f.question:clean(x.question,5,200);
      const answer=x.answer===undefined?f.answer:clean(x.answer,10,1600);
      const state=x.state===undefined?f.state:String(x.state);
      if(!["DRAFT","PUBLISHED","WITHDRAWN"].includes(state)||
        (f.state==="WITHDRAWN"&&state==="PUBLISHED"))
        throw new BadRequestException("Choose a permitted question status");
      const normalized=question.toLowerCase().replace(/\s+/g," ");
      await client.query(
        "UPDATE cg19_support_faq SET question=$3,normalized_question=$4,"+
        "answer=$5,state=$6,revision=revision+1,updated_by=$7,updated_at=now() "+
        "WHERE realm_id=$1 AND id=$2",
        [a.realmId,id,question,normalized,answer,state,a.accountId]);
      await client.query(
        "INSERT INTO cg19_support_faq_revision("+
        "realm_id,faq_id,revision,state,question,answer,actor_id) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7)",
        [a.realmId,id,expected+1,state,question,answer,a.accountId]);
      await client.query("COMMIT");begun=false;
      return {faqRef:id,revision:expected+1,status:state};
    }catch(e){
      if(begun)try{await client.query("ROLLBACK");}catch{}
      // Published questions are unique per Foundation, including concurrent
      // revisions. Reject a second active question as a safe CAS conflict.
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
        throw new ConflictException("This published help question already exists");
      throw e;
    }
    finally{client.release();}
  }
}
