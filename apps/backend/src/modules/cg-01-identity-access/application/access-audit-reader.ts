import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { SessionService } from "./session.service";

export type AuditQuery={limit?:number;cursor?:string;action?:string;from?:string;to?:string;targetRef?:string};
type AuditRow={id:string;occurred_at:Date;actor_display:string|null;target_display:string|null;
  action_key:string;outcome:string;safe_context:unknown};
const labels:Readonly<Record<string,string>>={
  "identity.root.bootstrap":"Protected account created",
  "identity.session.login":"Account signed in",
  "identity.password.recovery":"Password recovered",
  "identity.role.create":"Role created",
  "identity.role.edit":"Role updated",
  "identity.role.copy":"Role copied",
  "identity.role.retire":"Role retired",
  "identity.account.invite":"Staff invited",
  "identity.account.resend":"Invitation renewed",
  "identity.account.assign":"Staff role assigned",
  "identity.account.revoke":"Staff role revoked",
  "identity.account.status":"Account status changed",
  "identity.invitation.accept":"Invitation activated",
  "identity.security-policy.update":"Security policy updated"
};
function cursorKey():Buffer{
  const b=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
  if(b.length!==32)throw new Error("Missing identity protection key");
  return b;
}
function seal(time:Date,id:string):string{
  const nonce=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",cursorKey(),nonce);
  const data=Buffer.concat([
    cipher.update(JSON.stringify({at:time.toISOString(),id}),"utf8"),
    cipher.final()
  ]);
  return Buffer.concat([nonce,cipher.getAuthTag(),data]).toString("base64url");
}
function unseal(token:string):{at:Date;id:string}{
  if(typeof token!=="string"||token.length>300)throw new BadRequestException("Invalid page");
  try{
    const blob=Buffer.from(token,"base64url");
    if(blob.length<29)throw new Error("Invalid cursor");
    const decipher=createDecipheriv("aes-256-gcm",cursorKey(),blob.subarray(0,12));
    decipher.setAuthTag(blob.subarray(12,28));
    const json=Buffer.concat([decipher.update(blob.subarray(28)),decipher.final()])
      .toString("utf8");
    const decoded=JSON.parse(json) as {at:unknown;id:unknown};
    const at=new Date(String(decoded.at));
    if(!Number.isFinite(at.getTime())||
      typeof decoded.id!=="string"||!/^[0-9a-f-]{36}$/i.test(decoded.id))
      throw new Error("Invalid cursor");
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
    if(query.targetRef!==undefined&&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.targetRef))
      throw new BadRequestException("Invalid account reference");
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
        AND ($8::uuid IS NULL OR au.target_account_id=$8::uuid)
      ORDER BY au.occurred_at DESC,au.id DESC LIMIT $7`,
      [actor.realmId,start,end,query.action??null,before?.at??null,before?.id??null,limit+1,query.targetRef??null]);
    const page=result.rows.slice(0,limit);
    return {
      events:page.map(r=>({
        eventRef:createHmac("sha256",cursorKey()).update("event:"+r.id).digest("base64url").slice(0,24),
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
