import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SAFE_MESSAGE_CATALOG,editableErrorKeys} from "../../../core/http/safe-error-copy";
import {SessionService} from "../../cg-01-identity-access/application/session.service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** CG-21 owns copy, not the backend rules which produce these keys. */
@Injectable()
export class SafeErrorMessagesService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService){}
 async list(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"platform.settings.view");
  const rows=await this.db.query<{message_key:string;safe_message:string;revision:number}>(`
   SELECT message_key,safe_message,revision FROM platform_error_message
   WHERE foundation_realm_id=$1 ORDER BY message_key LIMIT 500`,[actor.realmId]);
  const overrides=new Map(rows.rows.map(r=>[r.message_key,r]));
  return {messages:editableErrorKeys().map(key=>{
   const row=overrides.get(key);
   return {key,defaultMessage:SAFE_MESSAGE_CATALOG[key],
    effectiveMessage:row?.safe_message??SAFE_MESSAGE_CATALOG[key],
    revision:row?.revision??0,customized:Boolean(row)};
  })};
 }
 async update(bearer:string,body:unknown){
  if(!body||typeof body!=="object"||Array.isArray(body))
   throw new BadRequestException({code:"PLATFORM_COPY_FORM_INVALID"});
  const input=body as Record<string,unknown>;
  if(Object.keys(input).some(k=>!["key","message","expectedRevision","requestKey","currentPassword"].includes(k)))
   throw new BadRequestException({code:"PLATFORM_COPY_FORM_INVALID"});
  const key=input.key,msg=input.message,expected=input.expectedRevision,
   req=input.requestKey,password=input.currentPassword;
  if(typeof key!=="string"||!Object.hasOwn(SAFE_MESSAGE_CATALOG,key))
   throw new BadRequestException({code:"PLATFORM_COPY_UNSUPPORTED"});
  if(typeof msg!=="string"||msg.trim().length<16||msg.trim().length>220||
    /[<>\r\n\x00-\x1f]/.test(msg)||!/[.!?]$/.test(msg.trim()))
   throw new BadRequestException({code:"PLATFORM_COPY_WORDING_INVALID"});
  if(!Number.isInteger(expected)||Number(expected)<0||Number(expected)>2147483646)
   throw new BadRequestException({code:"PLATFORM_COPY_STALE"});
  if(typeof req!=="string"||!UUID.test(req)||
    typeof password!=="string"||password.length<8||Buffer.byteLength(password,"utf8")>1024)
   throw new BadRequestException({code:"PLATFORM_COPY_PASSWORD_REQUIRED"});
  const newMessage=msg.trim(),revision=Number(expected);
  const fingerprint=createHash("sha256").update(JSON.stringify([key,newMessage,revision])).digest("hex");
  const actor=await this.sessions.requireAction(bearer,"platform.settings.manage");
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   try{
    await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
      [actor.realmId]);
    const prior=await tx.query<{request_digest:string;result_revision:number}>(`
     SELECT request_digest,result_revision FROM platform_error_message_command
     WHERE foundation_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR SHARE`,
     [actor.realmId,actor.accountId,req]);
    if(prior.rows[0]){
     if(prior.rows[0].request_digest!==fingerprint)
      throw new ConflictException({code:"PLATFORM_COPY_REPLAY_CONFLICT"});
     await tx.query("COMMIT");
     return {status:"REPLAY_CONFIRMED",key,revision:prior.rows[0].result_revision};
    }
    await this.sessions.requireFreshFoundationRootProof(tx,actor,password);
    const old=await tx.query<{id:string;safe_message:string;revision:number}>(`
     SELECT id,safe_message,revision FROM platform_error_message
     WHERE foundation_realm_id=$1 AND message_key=$2 FOR UPDATE`,
     [actor.realmId,key]);
    const previous=old.rows[0];
    if(revision!==(previous?.revision??0))
     throw new ConflictException({code:"PLATFORM_STALE"});
    if(newMessage===(previous?.safe_message??SAFE_MESSAGE_CATALOG[key]))
     throw new BadRequestException({code:"PLATFORM_COPY_NO_CHANGE"});
    const next=revision+1;
    let messageId:string;
    if(previous){
     await tx.query(`
      UPDATE platform_error_message SET safe_message=$1,revision=$2,
      updated_by=$3,updated_at=now() WHERE id=$4`,
      [newMessage,next,actor.accountId,previous.id]);
     messageId=previous.id;
    }else{
     const created=await tx.query<{id:string}>(`
      INSERT INTO platform_error_message(foundation_realm_id,message_key,
       safe_message,updated_by) VALUES($1,$2,$3,$4) RETURNING id`,
      [actor.realmId,key,newMessage,actor.accountId]);
     messageId=created.rows[0].id;
    }
    await tx.query(`
     INSERT INTO platform_error_message_revision(message_id,revision,safe_message,actor_ref)
     VALUES($1,$2,$3,$4)`,[messageId,next,newMessage,actor.accountId]);
    await tx.query(`
     INSERT INTO platform_error_message_command(foundation_realm_id,actor_ref,
      message_key,request_key,request_digest,result_revision)
     VALUES($1,$2,$3,$4,$5,$6)`,
     [actor.realmId,actor.accountId,key,req,fingerprint,next]);
    await tx.query(`
     INSERT INTO platform_operation_audit(foundation_realm_id,actor_account_id,
      action_key,resource_ref,outcome,safe_context,correlation_ref)
     VALUES($1,$2,'platform.message.update',$3,'SUCCESS',$4::jsonb,$5)`,
     [actor.realmId,actor.accountId,messageId,JSON.stringify({messageKey:key}),req]);
    await tx.query("COMMIT");
    return {status:"SAVED",key,revision:next,message:newMessage};
   }catch(e){await tx.query("ROLLBACK");throw e;}
  }finally{tx.release();}
 }
}
