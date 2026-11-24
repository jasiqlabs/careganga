import {
  BadRequestException,ForbiddenException,Inject,Injectable,NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {AccessAuditReader} from "../../cg-01-identity-access/application/access-audit-reader";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

type AuditSource="CG-01"|"CG-21";
type Scope="ALL"|AuditSource;
type Position={at:string;id:string};
type Cursor={
  kind:"cursor";v:1;realm:string;actor:string;from:string;to:string;
  pageSize:number;source:Scope;cg01:Position|null;cg21:Position|null
};
type EventToken={kind:"event";v:1;realm:string;actor:string;source:AuditSource;id:string};
type Event={source:AuditSource;ownerEventId:string;occurredAt:string;
  actionLabel:string;actorDisplay:string;targetDisplay:string;outcome:string};
type PlatformAuditRow={id:string;occurred_at:Date;exact_at:string;action_key:string;
  outcome:string;actor_display:string|null;safe_context:unknown};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ACTION_LABELS:Readonly<Record<string,string>>={
  "payroll.source.operation":"Payroll protected operation",
  "platform.setting.save":"Platform setting updated",
  "platform.integration.configure":"Integration reference changed",
  "platform.integration.check":"Integration readiness checked",
  "platform.recovery.request":"Recovery request recorded"
};
function protectionKey():Buffer{
  const root=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
  if(root.length!==32)throw Error("Missing CareGanga identity encryption key");
  return createHash("sha256").update("CareGanga:CG21:scoped-audit-cursor:v1:")
    .update(root).digest();
}
function seal(payload:Cursor|EventToken):string{
  const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",protectionKey(),nonce);
  const body=Buffer.concat([
    cipher.update(JSON.stringify(payload),"utf8"),cipher.final()
  ]);
  return Buffer.concat([nonce,cipher.getAuthTag(),body]).toString("base64url");
}
function unseal(token:unknown):unknown{
  if(typeof token!=="string"||token.length>1300||token.length<35)
    throw new BadRequestException("Invalid audit reference");
  try{
    const raw=Buffer.from(token,"base64url");
    if(raw.length<29)throw Error("Short audit token");
    const decipher=createDecipheriv("aes-256-gcm",protectionKey(),raw.subarray(0,12));
    decipher.setAuthTag(raw.subarray(12,28));
    return JSON.parse(Buffer.concat([
      decipher.update(raw.subarray(28)),decipher.final()
    ]).toString("utf8")) as unknown;
  }catch{throw new BadRequestException("Invalid audit reference");}
}
function isPosition(x:unknown):x is Position{
  if(!x||typeof x!=="object"||Array.isArray(x))return false;
  const p=x as Record<string,unknown>;
  return typeof p.at==="string"&&Number.isFinite(Date.parse(p.at))&&
    typeof p.id==="string"&&UUID.test(p.id);
}
function parseTime(value:unknown,name:string):Date{
  if(typeof value!=="string"||value.length>35||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value))
    throw new BadRequestException("Invalid "+name);
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))throw new BadRequestException("Invalid "+name);
  return date;
}
function displayResource(safeContext:unknown):string{
  if(safeContext&&typeof safeContext==="object"&&!Array.isArray(safeContext)){
    const info=safeContext as Record<string,unknown>;
    if(["POLICY","COMPENSATION","PAYOUT","RUN","ACCESS"].includes(String(info.payrollKind))&&["DRAFT_CREATED","SUBMITTED","APPROVED","RETURNED","REJECTED","READ","DENIED","CONFLICT","INVALID"].includes(String(info.payrollResult)))return "Payroll "+String(info.payrollKind).toLowerCase()+" · "+String(info.payrollResult).toLowerCase().replaceAll("_"," ");
    if(info.setting==="audit.default_page_size")return "Audit page-size setting";
    if(typeof info.provider==="string"&&typeof info.purpose==="string"&&
       info.provider.length<=65&&info.purpose.length<=65)
      return "Integration: "+info.provider+" / "+info.purpose;
  }
  return "Protected platform record";
}
function safeForCsv(value:string):string{
  const normalized=value.replace(/[\u0000-\u001f\u007f]/g," ");
  const safe=/^[\s]*[=+\-@]/.test(normalized)?"'"+normalized:normalized;
  return '"'+safe.replace(/"/g,'""')+'"';
}
@Injectable()
export class PlatformAuditService{
  constructor(@Inject(DATABASE) private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identityAudit:AccessAuditReader){}

  private async authorize(bearer:string,capability="platform.audit.view"){
    return this.sessions.requireAction(bearer,capability);
  }
  private async effectivePageSize(realmId:string){
    const rows=await this.db.query<{typed_value:number}>(`
      SELECT typed_value FROM platform_setting
      WHERE foundation_realm_id=$1 AND setting_key='audit.default_page_size'
    `,[realmId]);
    return rows.rows[0]?.typed_value??25;
  }
  private async platformSource(actor:VerifiedFoundationActor,start:Date,end:Date,
    after:Position|null,limit:number):Promise<Event[]>{
    const rows=await this.db.query<PlatformAuditRow>(`
      SELECT au.id,au.occurred_at,au.action_key,au.outcome,au.safe_context,
        to_char(au.occurred_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS exact_at,
        a.display_name AS actor_display
      FROM platform_operation_audit au
      LEFT JOIN account a ON a.id=au.actor_account_id AND a.realm_id=au.foundation_realm_id
      WHERE au.foundation_realm_id=$1 AND au.occurred_at>=$2 AND au.occurred_at<=$3
        AND ($4::timestamptz IS NULL OR
          (au.occurred_at,au.id)<($4::timestamptz,$5::uuid))
      ORDER BY au.occurred_at DESC,au.id DESC LIMIT $6
    `,[actor.realmId,start,end,after?.at??null,after?.id??null,limit]);
    return rows.rows.map(x=>({
      source:"CG-21" as const,ownerEventId:x.id,occurredAt:x.exact_at,
      actionLabel:ACTION_LABELS[x.action_key]??"Platform operation",
      actorDisplay:x.actor_display??"Foundation operator",
      targetDisplay:displayResource(x.safe_context),
      outcome:x.outcome==="SUCCESS"?"Confirmed":x.outcome==="UNAVAILABLE"?"Unavailable":"Pending"
    }));
  }
  async list(bearer:string,query:{
    cursor?:unknown;limit?:unknown;source?:unknown;from?:unknown;to?:unknown
  }={}){
    const actor=await this.authorize(bearer);
    let source:Scope="ALL";
    if(query.source!==undefined){
      if(query.source!=="ALL"&&query.source!=="CG-01"&&query.source!=="CG-21")
        throw new BadRequestException("Invalid audit source");
      source=query.source;
    }
    const defaultSize=await this.effectivePageSize(actor.realmId);
    const size=query.limit===undefined?defaultSize:Number(query.limit);
    if(query.limit!==undefined&&
      (typeof query.limit!=="string"||!/^[1-9]\d{0,2}$/.test(query.limit))||
      !Number.isSafeInteger(size)||size<1||size>100)
      throw new BadRequestException("Audit page size must be 1 to 100");
    let start:Date,end:Date;
    let cursor:Cursor|null=null;
    if(query.cursor!==undefined){
      if(query.from!==undefined||query.to!==undefined||query.source!==undefined||
         query.limit!==undefined)throw new BadRequestException("Use the existing audit page");
      const decoded=unseal(query.cursor);
      if(!decoded||typeof decoded!=="object"||Array.isArray(decoded))
        throw new BadRequestException("Invalid audit page");
      const p=decoded as Record<string,unknown>;
      if(p.kind!=="cursor"||p.v!==1||p.realm!==actor.realmId||p.actor!==actor.accountId||
         !Number.isSafeInteger(p.pageSize)||Number(p.pageSize)<1||Number(p.pageSize)>100||
         !["ALL","CG-01","CG-21"].includes(String(p.source))||
         !(p.cg01===null||isPosition(p.cg01))||
         !(p.cg21===null||isPosition(p.cg21)))
        throw new BadRequestException("Invalid audit page");
      start=parseTime(p.from,"audit page");end=parseTime(p.to,"audit page");
      cursor=p as Cursor;
    }else{
      end=query.to===undefined?new Date():parseTime(query.to,"end date");
      start=query.from===undefined?new Date(end.getTime()-30*86400000):
        parseTime(query.from,"start date");
    }
    if(start>end||end.getTime()-start.getTime()>90*86400000||
       end.getTime()>Date.now()+60000)
      throw new BadRequestException("Invalid audit date range");
    const pageSize=cursor?.pageSize??size,selection=cursor?.source??source;
    // Request at most 101 rows per owner, regardless of Foundation size.
    // Never scan future business-module audit feeds or schedule idle scans.
    const results=await Promise.allSettled([
      selection==="CG-21"?Promise.resolve([] as Event[]):
        this.identityAudit.listPlatformProjection(bearer,{
          from:start,to:end,after:cursor?.cg01??null,limit:pageSize+1
        }),
      selection==="CG-01"?Promise.resolve([] as Event[]):
        this.platformSource(actor,start,end,cursor?.cg21??null,pageSize+1)
    ]);
    const unavailable:AuditSource[]=[];
    if(results[0].status==="rejected"&&selection!=="CG-21")unavailable.push("CG-01");
    if(results[1].status==="rejected"&&selection!=="CG-01")unavailable.push("CG-21");
    if(unavailable.length===2)throw new ServiceUnavailableException(
      "Both audit sources are currently unavailable");
    const first=results[0].status==="fulfilled"?results[0].value:[];
    const second=results[1].status==="fulfilled"?results[1].value:[];
    const merged:Event[]=[...first,...second].sort((a,c)=>{
      const time=c.occurredAt.localeCompare(a.occurredAt);
      return time||a.source.localeCompare(c.source)||
        c.ownerEventId.localeCompare(a.ownerEventId);
    });
    const page=merged.slice(0,pageSize);
    const hasMore=merged.length>pageSize;
    let cg01=cursor?.cg01??null,cg21=cursor?.cg21??null;
    const events=page.map(row=>{
      if(row.source==="CG-01")cg01={at:row.occurredAt,id:row.ownerEventId};
      else cg21={at:row.occurredAt,id:row.ownerEventId};
      return {
        eventRef:seal({kind:"event",v:1,source:row.source,id:row.ownerEventId,
          realm:actor.realmId,actor:actor.accountId}),
        source:row.source,occurredAt:row.occurredAt,
        actionLabel:row.actionLabel,actorDisplay:row.actorDisplay,
        targetDisplay:row.targetDisplay,outcome:row.outcome
      };
    });
    const coverage=unavailable.length?"PARTIAL":"COMPLETE";
    const nextCursor=coverage==="COMPLETE"&&hasMore&&page.length?
      seal({kind:"cursor",v:1,realm:actor.realmId,actor:actor.accountId,
        from:start.toISOString(),to:end.toISOString(),
        pageSize,source:selection,cg01,cg21}):null;
    return {events,nextCursor,coverage,unavailableSources:unavailable,
      limit:pageSize,source:selection,from:start.toISOString(),to:end.toISOString()};
  }
  async detail(bearer:string,token:unknown){
    const actor=await this.authorize(bearer);
    const raw=unseal(token);
    if(!raw||typeof raw!=="object"||Array.isArray(raw))
      throw new BadRequestException("Invalid audit event");
    const ref=raw as Record<string,unknown>;
    if(ref.kind!=="event"||ref.v!==1||ref.realm!==actor.realmId||
       ref.actor!==actor.accountId||!UUID.test(String(ref.id))||
       (ref.source!=="CG-01"&&ref.source!=="CG-21"))
      throw new ForbiddenException("Audit event is unavailable");
    if(ref.source==="CG-01"){
      const row=await this.identityAudit.readPlatformProjectionEvent(bearer,String(ref.id));
      if(!row)throw new NotFoundException("Audit event unavailable");
      return row;
    }
    const rows=await this.db.query<PlatformAuditRow>(`
      SELECT au.id,au.occurred_at,au.action_key,au.outcome,au.safe_context,
        to_char(au.occurred_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS exact_at,
        a.display_name actor_display
      FROM platform_operation_audit au
      LEFT JOIN account a ON a.id=au.actor_account_id AND a.realm_id=au.foundation_realm_id
      WHERE au.foundation_realm_id=$1 AND au.id=$2
    `,[actor.realmId,ref.id]);
    const row=rows.rows[0];
    if(!row)throw new NotFoundException("Audit event unavailable");
    return {source:"CG-21",occurredAt:row.exact_at,
      actionLabel:ACTION_LABELS[row.action_key]??"Platform operation",
      actorDisplay:row.actor_display??"Foundation operator",
      targetDisplay:displayResource(row.safe_context),
      outcome:row.outcome==="SUCCESS"?"Confirmed":row.outcome==="UNAVAILABLE"?"Unavailable":"Pending"};
  }
  async export(bearer:string,filters:{source?:unknown;from?:unknown;to?:unknown}={}){
    await this.authorize(bearer,"platform.audit.export");
    const page=await this.list(bearer,{...filters,limit:"100"});
    if(page.coverage!=="COMPLETE")throw new ServiceUnavailableException(
      "Audit export cannot be verified while a source is unavailable");
    const columns=["Date (UTC)","Source","Action","Actor","Target","Outcome"];
    const lines=[columns.map(safeForCsv).join(","),...page.events.map(e=>
      [e.occurredAt,e.source,e.actionLabel,e.actorDisplay,e.targetDisplay,e.outcome]
        .map(safeForCsv).join(","))];
    return {filename:"careganga-foundation-audit.csv",csv:lines.join("\r\n"),
      rows:page.events.length,coverage:"COMPLETE" as const,
      truncated:page.nextCursor!==null};
  }
}
