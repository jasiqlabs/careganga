import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable
} from "@nestjs/common";
import { createHash,randomUUID } from "node:crypto";
import type { Pool,PoolClient } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { SessionService } from "../../cg-01-identity-access/application/session.service";
import type { VerifiedFoundationActor } from "../../cg-01-identity-access/public-api";
import {checkCommunicationReadiness} from "../infrastructure/communication-readiness";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER=/^[a-z][a-z0-9_-]{1,62}$/;
const SECRET_REF=/^secretref:[A-Za-z0-9/_-]{10,230}$/;
const KEY="audit.default_page_size" as const;
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const conflict=(code:string)=>new ConflictException({code});
type SettingRow={id:string;typed_value:number;revision:number;updated_at:Date};
type IntegrationRow={
  id:string;provider:string;purpose:string;revision:number;credential_revision:number;
  secret_reference:string;verification_status:string;last_checked_at:Date|null;last_checked_credential_revision:number|null;
};
type CommandRow={request_digest:string;resource_ref:string;result_revision:number};
type SaveSetting={key:unknown;value:unknown;expectedRevision:unknown;requestKey:unknown;currentPassword:unknown};
type Configure={provider:unknown;purpose:unknown;secretReference:unknown;
  expectedRevision:unknown;requestKey:unknown;currentPassword:unknown};
function uuid(v:unknown):string{
  if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Check request reference");
  return v;
}
function expected(v:unknown):number{
  if(!Number.isInteger(v)||Number(v)<0||Number(v)>2147483646)
    throw new BadRequestException("Refresh the current revision before saving");
  return Number(v);
}
function textKey(v:unknown):string{
  if(typeof v!=="string"||!PROVIDER.test(v))
    throw new BadRequestException("Choose a supported integration label");
  return v;
}
function strictBody(input:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!input||typeof input!=="object"||Array.isArray(input))
    throw new BadRequestException("Check the requested changes");
  const body=input as Record<string,unknown>;
  if(Object.keys(body).some(key=>!keys.includes(key)))
    throw new BadRequestException("This setting is not available here");
  return body;
}
/** One business source for CG-21's own settings. No CG-01 policy or owner-audit writes. */
@Injectable()
export class PlatformSettingsService {
  constructor(
    @Inject(DATABASE) private readonly db:Pool,
    private readonly sessions:SessionService
  ){}

  private async authorize(bearer:string,action:string):Promise<VerifiedFoundationActor>{
    return this.sessions.requireAction(bearer,action);
  }
  private async lockRoot(client:PoolClient,actor:VerifiedFoundationActor):Promise<void>{
    const root=await client.query(`
      SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
    `,[actor.realmId]);
    if(!root.rowCount)throw new ForbiddenException("Foundation access unavailable");
  }
  private async oldCommand(client:PoolClient,actor:VerifiedFoundationActor,
    action:"SETTING_SAVE"|"INTEGRATION_REFERENCE",requestKey:string,payloadDigest:string){
    const prior=await client.query<CommandRow>(`
      SELECT request_digest,resource_ref,result_revision FROM platform_command
      WHERE actor_account_id=$1 AND action=$2 AND request_key=$3 FOR SHARE
    `,[actor.accountId,action,requestKey]);
    if(!prior.rowCount)return null;
    const row=prior.rows[0];
    if(row.request_digest!==payloadDigest)throw conflict("PLATFORM_REPLAY_CONFLICT");
    return row;
  }
  private async record(client:PoolClient,actor:VerifiedFoundationActor,
    action:"SETTING_SAVE"|"INTEGRATION_REFERENCE",requestKey:string,requestDigest:string,
    target:string,revision:number,correlationRef:string,actionKey:string,safeContext:object){
    await client.query(`
      INSERT INTO platform_command(foundation_realm_id,actor_account_id,action,
        request_key,request_digest,resource_ref,result_revision)
      VALUES($1,$2,$3,$4,$5,$6,$7)
    `,[actor.realmId,actor.accountId,action,requestKey,requestDigest,target,revision]);
    await client.query(`
      INSERT INTO platform_operation_audit(foundation_realm_id,actor_account_id,action_key,
        resource_ref,outcome,safe_context,correlation_ref)
      VALUES($1,$2,$3,$4,'SUCCESS',$5::jsonb,$6)
    `,[actor.realmId,actor.accountId,actionKey,target,JSON.stringify(safeContext),correlationRef]);
  }
  async setting(bearer:string){
    const actor=await this.authorize(bearer,"platform.settings.view");
    const rows=await this.db.query<SettingRow>(`
      SELECT id,typed_value,revision,updated_at FROM platform_setting
      WHERE foundation_realm_id=$1 AND setting_key=$2
    `,[actor.realmId,KEY]);
    const p=rows.rows[0];
    return {key:KEY,value:p?.typed_value??25,revision:p?.revision??0,
      updatedAt:p?.updated_at.toISOString()??null};
  }
  async history(bearer:string,limitInput:unknown=20,offsetInput:unknown=0){
    const actor=await this.authorize(bearer,"platform.settings.view");
    if(!Number.isInteger(limitInput)||Number(limitInput)<1||Number(limitInput)>30||
       !Number.isInteger(offsetInput)||Number(offsetInput)<0||Number(offsetInput)>500)
      throw new BadRequestException("Check the history page");
    const rows=await this.db.query<{
      revision:number;safe_value:number;changed_at:Date;actor_display:string
    }>(`
      SELECT h.revision,h.safe_value,h.changed_at,a.display_name actor_display
      FROM platform_setting_revision h
      JOIN platform_setting s ON s.id=h.setting_id
      JOIN account a ON a.id=h.actor_account_id AND a.realm_id=s.foundation_realm_id
      WHERE s.foundation_realm_id=$1 AND s.setting_key=$2
      ORDER BY h.revision DESC LIMIT $3 OFFSET $4
    `,[actor.realmId,KEY,limitInput,offsetInput]);
    return {events:rows.rows.map(x=>({revision:x.revision,value:x.safe_value,
      changedAt:x.changed_at.toISOString(),changedBy:x.actor_display})),
      limit:Number(limitInput),offset:Number(offsetInput)};
  }
  async saveSetting(bearer:string,body:unknown,correlationRef:string){
    const input=strictBody(body,["key","value","expectedRevision","requestKey","currentPassword"]) as SaveSetting;
    if(input.key!==KEY||!Number.isInteger(input.value)||Number(input.value)<10||Number(input.value)>100
      ||typeof input.currentPassword!=="string"||(input.currentPassword.length<8||Buffer.byteLength(input.currentPassword,"utf8")>1024))
      throw new BadRequestException("Choose a page size between 10 and 100");
    const value=Number(input.value),revision=expected(input.expectedRevision),requestKey=uuid(input.requestKey);
    const payloadDigest=digest([KEY,value,revision]);
    const actor=await this.authorize(bearer,"platform.settings.manage");
    // A replay is read-only and must not consume a current password confirmation.
    const replay=await this.db.query<CommandRow>(`
      SELECT request_digest,resource_ref,result_revision FROM platform_command
      WHERE actor_account_id=$1 AND action='SETTING_SAVE' AND request_key=$2
    `,[actor.accountId,requestKey]);
    if(replay.rowCount){
      if(replay.rows[0].request_digest!==payloadDigest)throw conflict("PLATFORM_REPLAY_CONFLICT");
      return {status:"REPLAY_CONFIRMED",key:KEY,revision:replay.rows[0].result_revision};
    }
    await this.sessions.limitFoundationRootProof(actor);
    const client=await this.db.connect();
    let started=false;
    try{
      await client.query("BEGIN");started=true;
      await this.lockRoot(client,actor);
      const previous=await this.oldCommand(client,actor,"SETTING_SAVE",requestKey,payloadDigest);
      if(previous){
        await client.query("COMMIT");started=false;
        return {status:"REPLAY_CONFIRMED",key:KEY,revision:previous.result_revision};
      }
      await this.sessions.requireFreshFoundationRootProof(client,actor,String(input.currentPassword));
      const state=await client.query<SettingRow>(`
        SELECT id,typed_value,revision,updated_at FROM platform_setting
        WHERE foundation_realm_id=$1 AND setting_key=$2 FOR UPDATE
      `,[actor.realmId,KEY]);
      const current=state.rows[0];
      if(revision!==(current?.revision??0))throw conflict("PLATFORM_STALE");
      if(value===(current?.typed_value??25))
        throw new BadRequestException("Choose a different page size");
      let id:string,nextRevision:number;
      if(current){
        nextRevision=current.revision+1;
        const saved=await client.query<{id:string}>(`
          UPDATE platform_setting SET typed_value=$2,revision=$3,updated_by=$4,updated_at=now()
          WHERE id=$1 RETURNING id
        `,[current.id,value,nextRevision,actor.accountId]);
        id=saved.rows[0].id;
      }else{
        nextRevision=1;
        const saved=await client.query<{id:string}>(`
          INSERT INTO platform_setting(foundation_realm_id,setting_key,typed_value,updated_by)
          VALUES($1,$2,$3,$4) RETURNING id
        `,[actor.realmId,KEY,value,actor.accountId]);
        id=saved.rows[0].id;
      }
      await client.query(`
        INSERT INTO platform_setting_revision(setting_id,revision,safe_value,
          actor_account_id,correlation_ref) VALUES($1,$2,$3,$4,$5)
      `,[id,nextRevision,value,actor.accountId,correlationRef]);
      await this.record(client,actor,"SETTING_SAVE",requestKey,payloadDigest,
        id,nextRevision,correlationRef,"platform.setting.save",{setting:KEY});
      await client.query("COMMIT");started=false;
      return {status:"SAVED",key:KEY,revision:nextRevision,value};
    }catch(e){
      if(started){try{await client.query("ROLLBACK");}catch{}}
      throw e;
    }finally{client.release();}
  }
  async connections(bearer:string){
    const actor=await this.authorize(bearer,"platform.integrations.view");
    const rows=await this.db.query<IntegrationRow>(`
      SELECT id,provider,purpose,revision,credential_revision,verification_status,
        last_checked_at,last_checked_credential_revision
      FROM integration_connection WHERE foundation_realm_id=$1 AND scope_kind='FOUNDATION'
      ORDER BY provider,purpose LIMIT 50
    `,[actor.realmId]);
    return {connections:rows.rows.map(row=>({
      provider:row.provider,purpose:row.purpose,revision:row.revision,
      credentialRevision:row.credential_revision,
      status:row.verification_status==="VERIFIED"&&
        row.last_checked_credential_revision!==row.credential_revision
          ?"CONFIGURED_NOT_VERIFIED":row.verification_status,
      lastCheckedAt:row.last_checked_at?.toISOString()??null,
      // Intentionally do not return internal DB ID or external secret pointer.
      referencePresent:true
    }))};
  }
  async configureConnection(bearer:string,body:unknown,correlationRef:string){
    const input=strictBody(body,["provider","purpose","secretReference",
      "expectedRevision","requestKey","currentPassword"]) as Configure;
    const provider=textKey(input.provider),purpose=textKey(input.purpose);
    if(typeof input.secretReference!=="string"||input.secretReference.length>240||
       !SECRET_REF.test(input.secretReference)||typeof input.currentPassword!=="string"||
       (input.currentPassword.length<8||Buffer.byteLength(input.currentPassword,"utf8")>1024))
      throw new BadRequestException("Provide a secured reference, not a credential");
    const revision=expected(input.expectedRevision),requestKey=uuid(input.requestKey);
    const pointer=input.secretReference;
    // Hash contains a secret-store *reference*, not a provider credential;
    // never log the digest input or echo reference values in any response.
    const payloadDigest=digest([provider,purpose,pointer,revision]);
    const actor=await this.authorize(bearer,"platform.integrations.manage");
    // Use a one-shot pool query for replay so failures cannot leak a borrowed
    // connection. A fresh write obtains its own short transaction below.
    const already=await this.db.query<CommandRow>(`
      SELECT request_digest,resource_ref,result_revision FROM platform_command
      WHERE actor_account_id=$1 AND action='INTEGRATION_REFERENCE' AND request_key=$2
    `,[actor.accountId,requestKey]);
    if(already.rowCount){
      if(already.rows[0].request_digest!==payloadDigest)throw conflict("PLATFORM_REPLAY_CONFLICT");
      return {status:"REPLAY_CONFIRMED",revision:already.rows[0].result_revision};
    }
    await this.sessions.limitFoundationRootProof(actor);
    const tx=await this.db.connect();
    let started=false;
    try{
      await tx.query("BEGIN");started=true;
      await this.lockRoot(tx,actor);
      const replay=await this.oldCommand(tx,actor,"INTEGRATION_REFERENCE",requestKey,payloadDigest);
      if(replay){
        await tx.query("COMMIT");started=false;
        return {status:"REPLAY_CONFIRMED",revision:replay.result_revision};
      }
      await this.sessions.requireFreshFoundationRootProof(tx,actor,String(input.currentPassword));
      const previous=await tx.query<IntegrationRow>(`
        SELECT id,provider,purpose,revision,credential_revision,verification_status,
          last_checked_at,last_checked_credential_revision
        FROM integration_connection
        WHERE foundation_realm_id=$1 AND scope_kind='FOUNDATION'
          AND provider=$2 AND purpose=$3 FOR UPDATE
      `,[actor.realmId,provider,purpose]);
      const old=previous.rows[0];
      if(revision!==(old?.revision??0))throw conflict("PLATFORM_STALE");
      let id:string,newRev:number;
      if(old){
        newRev=old.revision+1;
        const next=await tx.query<{id:string}>(`
          UPDATE integration_connection SET secret_reference=$2,
            credential_revision=credential_revision+1,revision=$3,
            verification_status='CONFIGURED_NOT_VERIFIED',
            last_checked_at=NULL,last_checked_credential_revision=NULL,last_result_class=NULL,
            updated_by=$4,updated_at=now()
          WHERE id=$1 RETURNING id
        `,[old.id,pointer,newRev,actor.accountId]);
        id=next.rows[0].id;
      }else{
        newRev=1;
        const next=await tx.query<{id:string}>(`
          INSERT INTO integration_connection(foundation_realm_id,scope_kind,provider,purpose,
            secret_reference,updated_by) VALUES($1,'FOUNDATION',$2,$3,$4,$5)
          RETURNING id
        `,[actor.realmId,provider,purpose,pointer,actor.accountId]);
        id=next.rows[0].id;
      }
      await this.record(tx,actor,"INTEGRATION_REFERENCE",requestKey,payloadDigest,
        id,newRev,correlationRef,"platform.integration.configure",{provider,purpose});
      await tx.query("COMMIT");started=false;
      return {status:"CONFIGURED_NOT_VERIFIED",provider,purpose,revision:newRev,
        message:"Reference saved. No provider verification has been performed."};
    }catch(e){
      if(started){try{await tx.query("ROLLBACK");}catch{}}
      throw e;
    }finally{tx.release();}
  }
  async checkConnection(bearer:string,providerInput:unknown,purposeInput:unknown){
    const actor=await this.authorize(bearer,"platform.integrations.manage");
    const provider=textKey(providerInput),purpose=textKey(purposeInput);
    const saved=await this.db.query<IntegrationRow>(`
      SELECT id,provider,purpose,revision,credential_revision,secret_reference,
        verification_status,last_checked_at,last_checked_credential_revision
      FROM integration_connection WHERE foundation_realm_id=$1
        AND scope_kind='FOUNDATION' AND provider=$2 AND purpose=$3
    `,[actor.realmId,provider,purpose]);
    const item=saved.rows[0];
    if(!item)return {status:"NOT_CONFIGURED",provider,purpose,verified:false};
    // This is a real, bounded provider-side read, not a fabricated test send.
    // A successful sender/service lookup proves readiness, not a delivery.
    const proof=await checkCommunicationReadiness(
      provider,purpose,item.secret_reference,actor.realmId);
    const status=proof.result==="CHECK_ACCEPTED"?"VERIFIED":
      proof.result==="CHECK_FAILED"?"FAILED":"UNAVAILABLE";
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const updated=await client.query(`
        UPDATE integration_connection SET verification_status=$5,
          last_checked_at=now(),last_checked_credential_revision=$4,
          last_result_class=$6,updated_at=now()
        WHERE id=$1 AND foundation_realm_id=$2
          AND credential_revision=$4 AND secret_reference=$3
        RETURNING id
      `,[item.id,actor.realmId,item.secret_reference,
        item.credential_revision,status,proof.result]);
      if(!updated.rowCount)throw conflict("STALE_INTEGRATION_CONFIGURATION");
      await client.query(`
        INSERT INTO platform_operation_audit(foundation_realm_id,
          actor_account_id,action_key,resource_ref,outcome,safe_context,
          correlation_ref)
        VALUES($1,$2,'platform.integration.check',$3,$4,$5::jsonb,$6)
      `,[actor.realmId,actor.accountId,item.id,
        status==="VERIFIED"?"SUCCESS":"UNAVAILABLE",
        JSON.stringify({provider,purpose,reason:proof.reason}),
        randomUUID()]);
      await client.query("COMMIT");open=false;
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
    return {status,provider,purpose,verified:status==="VERIFIED",
      credentialRevision:item.credential_revision,
      message:status==="VERIFIED"?
        "The configured service credentials were confirmed. No message or payment was initiated.":
        "The configured channel could not be verified. No sending permission was granted."};
  }
  async lookup(bearer:string,actionInput:unknown,requestKeyInput:unknown){
    const action=actionInput==="SETTING_SAVE"?"SETTING_SAVE":
      actionInput==="INTEGRATION_REFERENCE"?"INTEGRATION_REFERENCE":null;
    if(!action)throw new BadRequestException("Unknown operation");
    const actor=await this.authorize(bearer,
      action==="SETTING_SAVE"?"platform.settings.manage":"platform.integrations.manage");
    const requestKey=uuid(requestKeyInput);
    const result=await this.db.query<CommandRow>(`
      SELECT request_digest,resource_ref,result_revision FROM platform_command
      WHERE actor_account_id=$1 AND action=$2 AND request_key=$3
    `,[actor.accountId,action,requestKey]);
    return result.rowCount
      ?{status:"CONFIRMED",revision:result.rows[0].result_revision}
      :{status:"NOT_FOUND",revision:null};
  }
}
