import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {RecoveryFacility} from "../infrastructure/recovery-facility";
type RecoveryRow={id:string;requested_by:string;status:string;version:number;request_digest:string;
  backup_reference:string;requested_at:Date;updated_at:Date};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const BACKUP=/^backupref:[A-Za-z0-9/_-]{6,170}$/;
@Injectable()
export class RecoveryService{
  constructor(
    @Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly facility:RecoveryFacility
  ){}
  private async actor(bearer:string,action="platform.recovery.view"){
    return this.sessions.requireAction(bearer,action);
  }
  async availability(bearer:string){
    await this.actor(bearer);
    const status=await this.facility.availability().catch(()=>({
      status:"NOT_AVAILABLE" as const,
      message:"Backup readiness cannot currently be verified."
    }));
    return status.status==="AVAILABLE"?{
      status:"AVAILABLE" as const,
      message:"A secured backup facility is registered. Restoration still requires separate approval and proof."
    }:{status:"NOT_AVAILABLE" as const,message:status.message};
  }
  async list(bearer:string){
    const actor=await this.actor(bearer);
    const rows=await this.db.query<RecoveryRow>(`
      SELECT id,requested_by,status,version,backup_reference,requested_at,updated_at,request_digest
      FROM recovery_operation WHERE foundation_realm_id=$1
      ORDER BY requested_at DESC,id DESC LIMIT 30
    `,[actor.realmId]);
    return {operations:rows.rows.map(row=>({
      operationRef:row.id,status:row.status,version:row.version,
      backupReferencePresent:Boolean(row.backup_reference),
      requestedAt:row.requested_at.toISOString(),updatedAt:row.updated_at.toISOString()
    }))};
  }
  private requestDigest(backupReference:string,expectedVersion:number){
    return createHash("sha256").update(JSON.stringify([
      "RESTORE_REQUEST",backupReference,expectedVersion
    ])).digest("hex");
  }
  private async existing(client:PoolClient,actor:VerifiedFoundationActor,
    requestKey:string,expectedDigest:string){
    const row=await client.query<RecoveryRow>(`
      SELECT id,requested_by,status,version,backup_reference,requested_at,updated_at,request_digest
      FROM recovery_operation
      WHERE foundation_realm_id=$1 AND request_key=$2 FOR SHARE
    `,[actor.realmId,requestKey]);
    const previous=row.rows[0];
    if(previous&&(previous.requested_by!==actor.accountId||
      previous.request_digest!==expectedDigest))
      throw new ConflictException({code:"PLATFORM_REPLAY_CONFLICT"});
    return previous??null;
  }
  async request(bearer:string,body:unknown,correlationRef:string){
    const actor=await this.actor(bearer,"platform.recovery.request");
    if(!body||typeof body!=="object"||Array.isArray(body))
      throw new BadRequestException("Check the recovery request");
    const p=body as Record<string,unknown>;
    if(Object.keys(p).some(key=>!["backupReference","expectedVersion","requestKey","totp"].includes(key))||
       typeof p.backupReference!=="string"||!BACKUP.test(p.backupReference)||
       typeof p.requestKey!=="string"||!UUID.test(p.requestKey)||
       p.expectedVersion!==0||typeof p.totp!=="string"||!/^[0-9]{6}$/.test(p.totp))
      throw new BadRequestException("Check recovery reference and fresh authenticator code");
    const backupRef=p.backupReference,requestKey=p.requestKey;
    const digest=this.requestDigest(backupRef,0);
    // A committed response can be resolved after a provider becomes unavailable.
    const saved=await this.db.query<RecoveryRow>(`
      SELECT id,requested_by,status,version,backup_reference,requested_at,updated_at,request_digest
      FROM recovery_operation WHERE foundation_realm_id=$1 AND request_key=$2
    `,[actor.realmId,requestKey]);
    if(saved.rowCount){
      if(saved.rows[0].requested_by!==actor.accountId||
        saved.rows[0].request_digest!==digest)
        throw new ConflictException({code:"PLATFORM_REPLAY_CONFLICT"});
      return {status:"REPLAY_CONFIRMED",operationRef:saved.rows[0].id,
        version:saved.rows[0].version};
    }
    // Never trust UI/admin toggle or an unverified secret reference as backup proof.
    const evidence=await this.facility.inspectBackup(backupRef).catch(()=>null);
    if(!evidence||evidence.backupReference!==backupRef||
      !evidence.facilityRef||!Number.isFinite(Date.parse(evidence.verifiedAt))||
      Date.now()-Date.parse(evidence.verifiedAt)>15*60*1000||
      Date.parse(evidence.verifiedAt)>Date.now()+60000)
      return {status:"NOT_AVAILABLE",
        message:"A verified secured backup is not available. No restore was requested."};
    await this.sessions.limitFoundationRootProof(actor);
    const client=await this.db.connect();
    let open=false;
    try{
      await client.query("BEGIN");open=true;
      // Root row lock serializes duplicate and protected request decisions.
      const root=await client.query(`
        SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
      `,[actor.realmId]);
      if(!root.rowCount)throw new ForbiddenException("Root scope unavailable");
      const previous=await this.existing(client,actor,requestKey,digest);
      if(previous){
        await client.query("COMMIT");open=false;
        return {status:"REPLAY_CONFIRMED",operationRef:previous.id,version:previous.version};
      }
      await this.sessions.requireFreshFoundationRootProof(client,actor,String(p.totp));
      const created=await client.query<{id:string;version:number}>(`
        INSERT INTO recovery_operation(foundation_realm_id,operation_type,backup_reference,
          requested_by,status,request_key,request_digest)
        VALUES($1,'RESTORE_REQUEST',$2,$3,'REQUESTED',$4,$5)
        RETURNING id,version
      `,[actor.realmId,backupRef,actor.accountId,requestKey,digest]);
      await client.query(`
        INSERT INTO platform_operation_audit(foundation_realm_id,actor_account_id,
          action_key,resource_ref,outcome,safe_context,correlation_ref)
        VALUES($1,$2,'platform.recovery.request',$3,'SUCCESS',$4::jsonb,$5)
      `,[actor.realmId,actor.accountId,created.rows[0].id,
        JSON.stringify({result:"REQUESTED",backupReferencePresent:true}),correlationRef]);
      await client.query("COMMIT");open=false;
      return {status:"REQUESTED",operationRef:created.rows[0].id,
        version:created.rows[0].version,
        message:"A request was recorded. No recovery has been executed."};
    }catch(error){
      if(open){try{await client.query("ROLLBACK");}catch{}}
      if(error&&typeof error==="object"&&"code" in error&&error.code==="23505")
        throw new ConflictException({code:"PLATFORM_REPLAY_CONFLICT"});
      throw error;
    }finally{client.release();}
  }
  /** Records a separate root authorization only for an already verified backup.
   *  This has NO provider execute/restore side effect and cannot mark success.
   */
  async authorizeRecovery(bearer:string,operationInput:unknown,body:unknown,
      correlationRef:string){
    const actor=await this.actor(bearer,"platform.recovery.authorize");
    if(typeof operationInput!=="string"||!UUID.test(operationInput)||
      !body||typeof body!=="object"||Array.isArray(body))
      throw new BadRequestException("Check recovery authorization");
    const p=body as Record<string,unknown>;
    if(Object.keys(p).some(key=>!["requestKey","expectedVersion","totp"].includes(key))||
       typeof p.requestKey!=="string"||!UUID.test(p.requestKey)||
       !Number.isSafeInteger(p.expectedVersion)||Number(p.expectedVersion)<1||
       typeof p.totp!=="string"||!/^[0-9]{6}$/.test(p.totp))
      throw new BadRequestException("Enter a fresh authenticator proof and current recovery version");
    const key=p.requestKey,revision=Number(p.expectedVersion);
    const payloadDigest=createHash("sha256")
      .update(JSON.stringify(["RECOVERY_AUTHORIZE",operationInput,revision])).digest("hex");
    const original=await this.db.query<{
      actor_account_id:string;recovery_operation_id:string;
      request_digest:string;result_version:number
    }>(`
      SELECT actor_account_id,recovery_operation_id,request_digest,result_version
      FROM recovery_authorization_command
      WHERE foundation_realm_id=$1 AND request_key=$2
    `,[actor.realmId,key]);
    if(original.rowCount){
      const prev=original.rows[0];
      if(prev.actor_account_id!==actor.accountId||prev.recovery_operation_id!==operationInput||
         prev.request_digest!==payloadDigest)
        throw new ConflictException({code:"PLATFORM_REPLAY_CONFLICT"});
      return {status:"REPLAY_CONFIRMED",version:prev.result_version};
    }
    const current=await this.db.query<{status:string;version:number;backup_reference:string}>(`
      SELECT status,version,backup_reference FROM recovery_operation
      WHERE foundation_realm_id=$1 AND id=$2
    `,[actor.realmId,operationInput]);
    if(!current.rowCount)throw new ForbiddenException("Recovery operation is unavailable");
    if(current.rows[0].version!==revision||current.rows[0].status!=="REQUESTED")
      throw new ConflictException({code:"PLATFORM_STALE"});
    const backup=current.rows[0].backup_reference;
    // A current real backup inspection is required again, never an old checkbox.
    const evidence=await this.facility.inspectBackup(backup).catch(()=>null);
    if(!evidence||evidence.backupReference!==backup||!evidence.facilityRef||
      !Number.isFinite(Date.parse(evidence.verifiedAt))||
      Date.now()-Date.parse(evidence.verifiedAt)>15*60*1000||
      Date.parse(evidence.verifiedAt)>Date.now()+60000)
      return {status:"NOT_AVAILABLE",message:
        "Backup readiness could not be independently verified. No authorization was recorded."};
    await this.sessions.limitFoundationRootProof(actor);
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const root=await client.query(`
        SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
      `,[actor.realmId]);
      if(!root.rowCount)throw new ForbiddenException("Root scope unavailable");
      const replay=await client.query<{
        actor_account_id:string;recovery_operation_id:string;
        request_digest:string;result_version:number
      }>(`
        SELECT actor_account_id,recovery_operation_id,request_digest,result_version
        FROM recovery_authorization_command
        WHERE foundation_realm_id=$1 AND request_key=$2 FOR SHARE
      `,[actor.realmId,key]);
      if(replay.rowCount){
        const prior=replay.rows[0];
        if(prior.actor_account_id!==actor.accountId||
           prior.recovery_operation_id!==operationInput||
           prior.request_digest!==payloadDigest)
          throw new ConflictException({code:"PLATFORM_REPLAY_CONFLICT"});
        await client.query("COMMIT");open=false;
        return {status:"REPLAY_CONFIRMED",version:prior.result_version};
      }
      await this.sessions.requireFreshFoundationRootProof(client,actor,String(p.totp));
      const updated=await client.query<{version:number}>(`
        UPDATE recovery_operation
        SET status='PRIVILEGED_AUTHORIZED',authorized_by=$3,
          version=version+1,updated_at=now()
        WHERE foundation_realm_id=$1 AND id=$2 AND status='REQUESTED' AND version=$4
        RETURNING version
      `,[actor.realmId,operationInput,actor.accountId,revision]);
      if(!updated.rowCount)throw new ConflictException({code:"PLATFORM_STALE"});
      await client.query(`
        INSERT INTO recovery_authorization_command(foundation_realm_id,
          recovery_operation_id,actor_account_id,request_key,request_digest,result_version)
        VALUES($1,$2,$3,$4,$5,$6)
      `,[actor.realmId,operationInput,actor.accountId,key,payloadDigest,updated.rows[0].version]);
      await client.query(`
        INSERT INTO platform_operation_audit(foundation_realm_id,actor_account_id,
          action_key,resource_ref,outcome,safe_context,correlation_ref)
        VALUES($1,$2,'platform.recovery.authorize',$3,'SUCCESS',$4::jsonb,$5)
      `,[actor.realmId,actor.accountId,operationInput,
        JSON.stringify({status:"PRIVILEGED_AUTHORIZED",restorationStarted:false}),correlationRef]);
      await client.query("COMMIT");open=false;
      return {status:"PRIVILEGED_AUTHORIZED",version:updated.rows[0].version,
        message:"Authorization recorded. Restoration has not started."};
    }catch(error){
      if(open){try{await client.query("ROLLBACK");}catch{}}
      if(error&&typeof error==="object"&&"code" in error&&error.code==="23505")
        throw new ConflictException({code:"PLATFORM_REPLAY_CONFLICT"});
      throw error;
    }finally{client.release();}
  }
  async lookupAuthorization(bearer:string,keyInput:unknown){
    const actor=await this.actor(bearer,"platform.recovery.authorize");
    if(typeof keyInput!=="string"||!UUID.test(keyInput))
      throw new BadRequestException("Invalid recovery authorization");
    const rows=await this.db.query<{result_version:number}>(`
      SELECT result_version FROM recovery_authorization_command
      WHERE foundation_realm_id=$1 AND actor_account_id=$2 AND request_key=$3
    `,[actor.realmId,actor.accountId,keyInput]);
    return rows.rowCount?{status:"CONFIRMED",version:rows.rows[0].result_version}:
      {status:"NOT_FOUND",version:null};
  }
  async lookup(bearer:string,requestKey:unknown){
    const actor=await this.actor(bearer,"platform.recovery.request");
    if(typeof requestKey!=="string"||!UUID.test(requestKey))
      throw new BadRequestException("Invalid recovery request");
    const rows=await this.db.query<{id:string;status:string;version:number}>(`
      SELECT id,status,version FROM recovery_operation
      WHERE foundation_realm_id=$1 AND request_key=$2 AND requested_by=$3
    `,[actor.realmId,requestKey,actor.accountId]);
    return rows.rowCount?
      {status:"CONFIRMED",operationRef:rows.rows[0].id,
        operationStatus:rows.rows[0].status,version:rows.rows[0].version}:
      {status:"NOT_FOUND",operationRef:null};
  }
}
