import {ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {CLIENT_EMAIL_SOURCE,type ClientEmailSource} from "./client-email-template-source";
/** Client v2 references: import disabled drafts ONLY. No mail delivery.
 * Source events, recipient proof, document versions and authorization
 * must be wired by the actual owning modules before any future activation.
 */
@Injectable()
export class ClientEmailTemplateService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
   private readonly sessions:SessionService){}
 private digest(t:ClientEmailSource):string{
  return createHash("sha256").update(JSON.stringify([t.code,t.title,t.owner,
   t.trigger,t.recipient,t.subject,t.body,t.attachmentRule,t.placeholders]))
   .digest("hex");
 }
 private async root(client:PoolClient,realm:string){
  const r=await client.query(
   "SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'",
   [realm]);
  if(!r.rowCount)throw new ForbiddenException("Foundation email catalog unavailable");
 }
 async list(token:string){
  const a=await this.sessions.requireAction(token,"communications.notices.manage");
  const c=await this.db.connect();
  try{
   await this.root(c,a.realmId);
   const existing=await c.query<{template_code:string;source_digest:string}>(
    "SELECT template_code,source_digest FROM cg19_client_email_template "+
    "WHERE realm_id=$1 AND version=1",[a.realmId]);
   const byCode=new Map(existing.rows.map(row=>[row.template_code,row.source_digest]));
   return {total:CLIENT_EMAIL_SOURCE.length,deliveryEnabled:false,
    templates:CLIENT_EMAIL_SOURCE.map(t=>({
     code:t.code,title:t.title,owner:t.owner,trigger:t.trigger,
     recipient:t.recipient,subject:t.subject,body:t.body,
     attachmentRule:t.attachmentRule,placeholders:t.placeholders,
     state:!byCode.has(t.code)?"NOT_IMPORTED":
       byCode.get(t.code)!==this.digest(t)?"SOURCE_CHANGED":"SOURCE_DRAFT",
     deliveryEnabled:false
    }))};
  }finally{c.release()}
 }
 async importDrafts(token:string){
  const a=await this.sessions.requireAction(token,"communications.notices.manage");
  const c=await this.db.connect();let started=false;
  try{
   await c.query("BEGIN");started=true;
   await c.query("SET LOCAL lock_timeout='3s'");
   await this.root(c,a.realmId);
   let imported=0;
   for(const t of CLIENT_EMAIL_SOURCE){
    const hash=this.digest(t);
    const added=await c.query<{id:string}>(
     "INSERT INTO cg19_client_email_template("+
     "realm_id,template_code,owner_kind,version,title,trigger_rule,"+
     "recipient_rule,subject,body,attachment_rule,placeholder_names,"+
     "source_digest,imported_by,status,enabled) "+
     "VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,$11,$12,"+
     "'SOURCE_DRAFT',false) "+
     "ON CONFLICT(realm_id,template_code,version) DO NOTHING RETURNING id",
     [a.realmId,t.code,t.owner,t.title,t.trigger,t.recipient,
      t.subject,t.body,t.attachmentRule,t.placeholders,hash,a.accountId]);
    if(added.rows[0]){imported++;continue}
    const prior=await c.query<{source_digest:string;status:string;enabled:boolean}>(
     "SELECT source_digest,status,enabled FROM cg19_client_email_template "+
     "WHERE realm_id=$1 AND template_code=$2 AND version=1",
     [a.realmId,t.code]);
    if(prior.rows[0]?.source_digest!==hash||
       prior.rows[0]?.status!=="SOURCE_DRAFT"||prior.rows[0]?.enabled)
     throw new ConflictException("An earlier client email source version "+
       "requires review before importing again.");
   }
   await c.query("COMMIT");started=false;
   return {status:"SOURCE_DRAFT",total:CLIENT_EMAIL_SOURCE.length,
    imported,alreadyPresent:CLIENT_EMAIL_SOURCE.length-imported,
    deliveryEnabled:false};
  }catch(e){if(started)try{await c.query("ROLLBACK")}catch{};throw e}
  finally{c.release()}
 }
}
