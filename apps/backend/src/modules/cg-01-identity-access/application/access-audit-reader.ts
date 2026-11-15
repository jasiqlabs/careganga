import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { SessionService } from "./session.service";

export type AuditQuery={limit?:number;cursor?:string;action?:string;from?:string;to?:string};
type AuditRow={id:string;occurred_at:Date;actor_display:string|null;target_display:string|null;
  action_key:string;outcome:string;safe_context:unknown};
const labels:Readonly<Record<string,string>>={
  "identity.root.bootstrap":"Protected account created",
  "identity.session.login":"Account signed in",
  "identity.password.recovery":"Password recovered",
  "identity.role.create":"Role created",
  "identity.role.edit":"Role updated",
  "identity.role.copy":"Role copied",
  "identity.role.retire":"Role retired"
};
function cursorKey():Buffer{
  const b=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
  if(b.length!==32)throw new Error("Missing identity protection key");
  return b;
}
function seal(time:Date,id:string):string{
  const payload=Buffer.from(JSON.stringify({at:time.toISOString(),id}),"utf8").toString("base64url");
  const signature=createHmac("sha256",cursorKey()).update(payload).digest("base64url");
  return payload+"."+signature;
}
function unseal(token:string):{at:Date;id:string}{
  if(typeof token!=="string"||token.length>300)throw new BadRequestException("Invalid page");
  const [body,mac,...extra]=token.split(".");
  if(extra.length||!body||!mac)throw new BadRequestException("Invalid page");
  const received=Buffer.from(mac,"base64url");
  const expected=createHmac("sha256",cursorKey()).update(body).digest();
  if(received.length!==expected.length||!timingSafeEqual(received,expected))
    throw new BadRequestException("Invalid page");
  try{
    const decoded=JSON.parse(Buffer.from(body,"base64url").toString("utf8")) as {at:unknown;id:unknown};
    const at=new Date(String(decoded.at));
    if(!Number.isFinite(at.getTime())||
      typeof decoded.id!=="string"||!/^[0-9a-f-]{36}$/i.test(decoded.id))
      throw new Error("bad cursor");
    return {at,id:decoded.id};
  }catch{throw new BadRequestException("Invalid page");}
}
function parseRange(from?:string,to?:string):{start:Date;end:Date}{
  const end=to?new Date(to):new Date();
  const start=from?new Date(from):new Date(end.getTime()-30*24*60*60*1000);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
    start>end||end.getTime()-start.getTime()>90*24*60*60*1000)
    throw new BadRequestException("Invalid date range");
  return {start,end};
}
function displayTarget(context:unknown,fallback:string|null):string{
  if(context&&typeof context==="object"&&!Array.isArray(context)&&"targetDisplay" in context){
    const val=(context as {targetDisplay:unknown}).targetDisplay;
    if(typeof val==="string"&&val.length<=80)return val;
  }
  return fallback??"Protected record";
}
@Injectable()
export class AccessAuditReader {
  constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService){}
  async listAccessAudit(bearer:string,query:AuditQuery={}){
    const actor=await this.sessions.requireAction(bearer,"access.audit.view");
    const limit=query.limit??20;
    if(!Number.isInteger(limit)||limit<1||limit>50)throw new BadRequestException();
    if(query.action!==undefined&&!Object.hasOwn(labels,query.action))
      throw new BadRequestException("Invalid history filter");
    const {start,end}=parseRange(query.from,query.to);
    const before=query.cursor?unseal(query.cursor):null;
    const result=await this.db.query<AuditRow>(`
      SELECT au.id,au.occurred_at,au.action_key,au.outcome,au.safe_context,
        actor.display_name AS actor_display,target.display_name AS target_display
      FROM access_audit au
      LEFT JOIN account actor ON actor.id=au.actor_account_id
      LEFT JOIN account target ON target.id=au.target_account_id
      WHERE au.realm_id=$1 AND au.occurred_at >=$2 AND au.occurred_at <=$3
        AND ($4::text IS NULL OR au.action_key=$4)
        AND ($5::timestamptz IS NULL OR (au.occurred_at,au.id)<($5::timestamptz,$6::uuid))
      ORDER BY au.occurred_at DESC,au.id DESC LIMIT $7`,
      [actor.realmId,start,end,query.action??null,before?.at??null,before?.id??null,limit+1]);
    const page=result.rows.slice(0,limit);
    return {
      events:page.map(r=>({
        occurredAt:r.occurred_at.toISOString(),
        actorDisplay:r.actor_display??"System",
        actionLabel:labels[r.action_key]??"Account security event",
        targetDisplay:displayTarget(r.safe_context,r.target_display),
        outcome:r.outcome==="SUCCESS"?"Confirmed":r.outcome==="DENIED"?"Denied":"Pending",
        source:"CG-01" as const
      })),
      nextCursor:result.rows.length>limit&&page.length
        ?seal(page[page.length-1].occurred_at,page[page.length-1].id):null,
      coverage:"COMPLETE" as const
    };
  }
}
