import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
  NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
export const HEALTH_FILES=[
  "HEALTH_PROVIDER_REGISTRATION","HEALTH_CENTER_LICENSE","HEALTH_BANK_PROOF"
] as const;
type Classification=typeof HEALTH_FILES[number];
type Input={providerRef:string;centerRef:string|null;sourceVersion:number;
  classification:Classification;requestKey:string;mime:string;sizeBytes:number;sha256:string};
type Intent={id:string;realm_id:string;health_provider_id:string;health_center_id:string|null;
  health_source_version:number;classification:Classification;requested_by:string;
  request_key:string;request_digest:string;mime:string;size_bytes:string;
  expected_sha256:string;status:string;object_key:string;reserved_until:Date};
type FileRow={id:string;realm_id:string;health_provider_id:string;health_center_id:string|null;
  health_source_version:number;original_mime:string;verified_size_bytes:string;
  verified_sha256:string;object_key:string;object_version:string;scan_status:string;
  scan_proof_ref:string;scanned_at:Date;revoked_at:Date|null;revision:number;
  classification:Classification;intent_status:string};
const id=(x:unknown,field:string)=>{
  if(typeof x!=="string"||!UUID.test(x))
    throw new BadRequestException({code:"HEALTH_EVIDENCE_INVALID",field});
  return x;
};
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function parse(value:unknown):Input{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new BadRequestException({code:"HEALTH_EVIDENCE_INVALID"});
  const x=value as Record<string,unknown>;
  if(Object.keys(x).some(k=>!["providerRef","centerRef","sourceVersion","classification",
    "requestKey","mime","sizeBytes","sha256"].includes(k))||
    !Number.isSafeInteger(x.sourceVersion)||Number(x.sourceVersion)<1||
    !HEALTH_FILES.includes(x.classification as Classification)||
    typeof x.mime!=="string"||!MIME.has(x.mime)||
    !Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||
    Number(x.sizeBytes)>10485760||typeof x.sha256!=="string"||!SHA.test(x.sha256))
    throw new BadRequestException({code:"HEALTH_EVIDENCE_INVALID"});
  const classification=x.classification as Classification;
  const center=x.centerRef?id(x.centerRef,"centerRef"):null;
  if((classification==="HEALTH_CENTER_LICENSE")!==Boolean(center))
    throw new BadRequestException({code:"HEALTH_EVIDENCE_INVALID",field:"centerRef"});
  return {providerRef:id(x.providerRef,"providerRef"),centerRef:center,
    sourceVersion:Number(x.sourceVersion),classification,requestKey:id(x.requestKey,"requestKey"),
    mime:x.mime,sizeBytes:Number(x.sizeBytes),sha256:x.sha256};
}
@Injectable()
export class HealthDraftEvidenceService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identity:FoundationStructureIdentityFacade,
    private readonly objects:PrivateObjectStorage){}
  private permission(classification:Classification,mutate:boolean,centerRef:string|null){
    if(classification==="HEALTH_BANK_PROOF")return mutate?"health.providers.manage":"health.providers.finance.view";
    if(centerRef)return mutate?"health.centers.draft.edit":"health.centers.draft.edit";
    return mutate?"health.providers.manage":"health.providers.view";
  }
  private async actorFor(bearer:string,kind:Classification,centerRef:string|null,mutate:boolean){
    // A Foundation provider manager may upload/view any correctly root-scoped
    // center license. Ordinary representatives require exact own-center affiliation.
    if(centerRef){
      try{return {actor:await this.sessions.requireAction(bearer,"health.providers.manage"),
        action:"health.providers.manage" as const,admin:true};}
      catch(e){if(!(e instanceof ForbiddenException))throw e;}
    }
    const action=this.permission(kind,mutate,centerRef);
    return {actor:await this.sessions.requireAction(bearer,action),action,admin:false};
  }
  private async source(client:PoolClient,actor:VerifiedFoundationActor,
    providerRef:string,centerRef:string|null,sourceVersion:number,admin:boolean,action:string){
    await this.identity.assertCurrent(client,actor,action);
    if(centerRef){
      const r=await client.query<{version:number}>(
        "SELECT c.version FROM health_center c "+
        "JOIN health_provider p ON p.id=c.provider_id AND p.root_realm_id=c.root_realm_id "+
        "WHERE c.id=$1 AND c.root_realm_id=$2 AND p.id=$3 "+
        "AND c.status='PENDING' AND p.status='PENDING' FOR SHARE OF c,p",
        [centerRef,actor.realmId,providerRef]);
      if(!r.rows[0])throw new NotFoundException("Current pending center unavailable");
      if(r.rows[0].version!==sourceVersion)
        throw new ConflictException({code:"HEALTH_EVIDENCE_SOURCE_CHANGED"});
      if(!admin){
        const grant=await client.query<{id:string}>(
          "SELECT f.id FROM health_center_account_affiliation f "+
          "WHERE f.root_realm_id=$1 AND f.center_id=$2 AND f.account_ref=$3 "+
          "AND f.status='PENDING_EDIT' FOR SHARE",
          [actor.realmId,centerRef,actor.accountId]);
        if(!grant.rows[0])throw new ForbiddenException("This center is not assigned to you");
      }
    }else{
      const r=await client.query<{version:number}>(
        "SELECT version FROM health_provider WHERE root_realm_id=$1 AND id=$2 "+
        "AND status='PENDING' FOR SHARE",[actor.realmId,providerRef]);
      if(!r.rows[0])throw new NotFoundException("Pending provider unavailable");
      if(r.rows[0].version!==sourceVersion)
        throw new ConflictException({code:"HEALTH_EVIDENCE_SOURCE_CHANGED"});
    }
  }
  private async event(client:PoolClient,actor:VerifiedFoundationActor,
    providerRef:string,kind:string,intentRef:string|null,fileRef:string|null){
    await client.query(
      "INSERT INTO cg19_document_event(realm_id,health_provider_id,actor_id,intent_id,file_id,event_key) "+
      "VALUES($1,$2,$3,$4,$5,$6)",
      [actor.realmId,providerRef,actor.accountId,intentRef,fileRef,kind]);
  }
  private async context(bearer:string,input:Input,mutate:boolean){
    const access=await this.actorFor(bearer,input.classification,input.centerRef,mutate);
    return {...access};
  }
  async initiate(bearer:string,body:unknown){
    const input=parse(body);
    const {actor,action,admin}=await this.context(bearer,input,true);
    const commandDigest=digest(["CG14_DRAFT",input]);
    const objectKey="careganga/private/cg19/"+actor.realmId+"/"+randomUUID();
    const client=await this.db.connect();let tx=false;let intent:Intent;
    try{
      await client.query("BEGIN");tx=true;
      await this.source(client,actor,input.providerRef,input.centerRef,
        input.sourceVersion,admin,action);
      const r=await client.query<Intent>(
        "INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,"+
        "request_key,mime,size_bytes,expected_sha256,request_digest,classification,"+
        "object_key,reserved_until,owner_kind,health_provider_id,health_center_id,health_source_version) "+
        "VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '15 minutes',"+
        "'CG14_DRAFT',$11,$12,$13) "+
        "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
        [actor.realmId,input.sourceVersion,actor.accountId,input.requestKey,input.mime,
        input.sizeBytes,input.sha256,commandDigest,input.classification,objectKey,
        input.providerRef,input.centerRef,input.sourceVersion]);
      if(r.rows[0]){
        intent=r.rows[0];
        await this.event(client,actor,input.providerRef,"UPLOAD_INITIATED",intent.id,null);
      }else{
        const existing=await client.query<Intent>(
          "SELECT * FROM cg19_upload_intent "+
          "WHERE realm_id=$1 AND requested_by=$2 AND request_key=$3 "+
          "AND owner_kind='CG14_DRAFT' FOR SHARE",
          [actor.realmId,actor.accountId,input.requestKey]);
        if(!existing.rows[0]||existing.rows[0].request_digest!==commandDigest)
          throw new ConflictException({code:"HEALTH_EVIDENCE_REPLAY_CONFLICT"});
        intent=existing.rows[0];
      }
      await client.query("COMMIT");tx=false;
    }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{}throw e;}
    finally{client.release();}
    if(["VALIDATED","REJECTED","EXPIRED"].includes(intent.status)||
       intent.reserved_until.getTime()<=Date.now())
      return {uploadRef:intent.id,status:intent.status,message:"Check the original file status."};
    try{
      const permission=await this.objects.reservePrivateUpload({
        objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,
        sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,
        expiresAt:intent.reserved_until.toISOString()
      });
      const expiry=Date.parse(permission.expiresAt);
      if(!permission.url.startsWith("https://")||!Number.isFinite(expiry)||
        expiry<=Date.now()||expiry>intent.reserved_until.getTime()||
        !permission.reservationRef||permission.reservationRef.length>160||
        !permission.headers||permission.headers["Content-Type"]!==intent.mime||
        !Object.entries(permission.headers).every(([name,v])=>
          ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
            "If-None-Match"].includes(name)&&typeof v==="string"&&v.length<=160))
        throw new ServiceUnavailableException("Private upload permission unavailable");
      const updated=await this.db.query(
        "UPDATE cg19_upload_intent SET storage_reservation_ref=$3,status='INITIATED',updated_at=now() "+
        "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_DRAFT' "+
        "AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",
        [intent.id,actor.realmId,permission.reservationRef]);
      if(!updated.rowCount)throw new ConflictException("This upload has expired");
      return {uploadRef:intent.id,status:"UPLOAD_READY",
        uploadUrl:permission.url,uploadHeaders:permission.headers,expiresAt:permission.expiresAt,
        message:"Private upload is ready; verification is still required."};
    }catch{
      await this.db.query(
        "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
        "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_DRAFT' AND status='INITIATED'",
        [intent.id,actor.realmId]);
      return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",
        message:"Secure storage or malware scanning is unavailable; no file was accepted."};
    }
  }
  private async intent(bearer:string,intentRef:string,mutate=false){
    const rows=await this.db.query<Intent>(
      "SELECT * FROM cg19_upload_intent WHERE id=$1 AND owner_kind='CG14_DRAFT'",
      [id(intentRef,"intentRef")]);
    const row=rows.rows[0];
    if(!row)throw new NotFoundException("Private healthcare upload unavailable");
    const access=await this.actorFor(bearer,row.classification,row.health_center_id,mutate);
    if(access.actor.realmId!==row.realm_id)
      throw new NotFoundException("Private healthcare upload unavailable");
    if(!access.admin&&row.requested_by!==access.actor.accountId&&
       !row.health_center_id)
      throw new ForbiddenException("Private file upload not assigned");
    const client=await this.db.connect();
    try{
      await client.query("BEGIN");
      await this.source(client,access.actor,row.health_provider_id,row.health_center_id,
        row.health_source_version,access.admin,access.action);
      await client.query("COMMIT");
    }catch(e){try{await client.query("ROLLBACK");}catch{}throw e;}
    finally{client.release();}
    return {row,...access};
  }
  async status(bearer:string,intentRef:string){
    const {row,actor}=await this.intent(bearer,intentRef);
    const f=await this.db.query<{id:string;revision:number}>(
      "SELECT id,revision FROM cg19_stored_file "+
      "WHERE upload_intent_id=$1 AND realm_id=$2 AND owner_kind='CG14_DRAFT' "+
      "AND revoked_at IS NULL AND scan_status='CLEAN_VERIFIED'",
      [row.id,actor.realmId]);
    return {uploadRef:row.id,status:row.status,
      fileRef:row.status==="VALIDATED"?f.rows[0]?.id??null:null,
      fileVersion:row.status==="VALIDATED"?f.rows[0]?.revision??null:null,
      cleanVerified:row.status==="VALIDATED"&&!!f.rows[0]};
  }
  async confirm(bearer:string,intentRef:string){
    const {row,actor,action,admin}=await this.intent(bearer,intentRef,true);
    if(row.status==="VALIDATED")return this.status(bearer,row.id);
    if(["REJECTED","EXPIRED"].includes(row.status)||
       row.reserved_until.getTime()<=Date.now())
      return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
    let verified:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
    try{
      verified=await this.objects.verifyPrivateObject({
        objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),
        sha256:row.expected_sha256
      });
    }catch{
      await this.db.query(
        "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
        "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_DRAFT' "+
        "AND status IN('INITIATED','VERIFYING')",[row.id,actor.realmId]);
      return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
    }
    const scanAt=Date.parse(verified.verifiedAt);
    const clean=verified.state==="CLEAN_VERIFIED"&&verified.sha256===row.expected_sha256&&
      verified.sizeBytes===Number(row.size_bytes)&&verified.mime===row.mime&&
      typeof verified.objectVersion==="string"&&
      verified.objectVersion.length>=1&&verified.objectVersion.length<=160&&
      typeof verified.scanProofRef==="string"&&verified.scanProofRef.length>=8&&
      verified.scanProofRef.length<=160&&Number.isFinite(scanAt)&&
      scanAt<=Date.now()+60000&&Date.now()-scanAt<900000;
    const client=await this.db.connect();let tx=false;
    try{
      await client.query("BEGIN");tx=true;
      const locked=await client.query<Intent>(
        "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
        "AND owner_kind='CG14_DRAFT' FOR UPDATE",[row.id,actor.realmId]);
      if(!locked.rows[0]||["REJECTED","EXPIRED"].includes(locked.rows[0].status)||
        locked.rows[0].reserved_until.getTime()<=Date.now())
        throw new ConflictException("The original upload has expired");
      await this.source(client,actor,row.health_provider_id,row.health_center_id,
        row.health_source_version,admin,action);
      if(locked.rows[0].status!=="VALIDATED"){
        await client.query(
          "UPDATE cg19_upload_intent SET status=$3,updated_at=now() "+
          "WHERE id=$1 AND realm_id=$2",[row.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
        if(clean)await client.query(
          "INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,"+
          "original_mime,verified_sha256,verified_size_bytes,object_key,object_version,"+
          "scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,"+
          "health_provider_id,health_center_id,health_source_version) "+
          "VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,'CLEAN_VERIFIED',$9,$10,$11,"+
          "'CG14_DRAFT',$12,$13,$14) ON CONFLICT(upload_intent_id) DO NOTHING",
          [actor.realmId,row.id,row.health_source_version,row.mime,row.expected_sha256,
           row.size_bytes,row.object_key,verified.objectVersion,verified.scanProofRef,
           new Date(verified.verifiedAt),actor.accountId,row.health_provider_id,
           row.health_center_id,row.health_source_version]);
        await this.event(client,actor,row.health_provider_id,
          clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED",row.id,null);
      }
      await client.query("COMMIT");tx=false;
    }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{}throw e;}
    finally{client.release();}
    return this.status(bearer,row.id);
  }
  /** CG-14 uses this original CG-19 proof IN its transaction before recording
   * restricted finance reference or declaring onboarding documentation eligible.
   */
  async prove(client:PoolClient,actor:VerifiedFoundationActor,providerRef:string,
    centerRef:string|null,fileRef:string,expected:Classification){
    const f=await client.query<{id:string;health_source_version:number;classification:string}>(
      "SELECT f.id,f.health_source_version,i.classification FROM cg19_stored_file f "+
      "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
      "WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG14_DRAFT' "+
      "AND f.health_provider_id=$3 AND f.health_center_id IS NOT DISTINCT FROM $4::uuid "+
      "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
      "AND i.status='VALIDATED' FOR SHARE OF f,i",
      [id(fileRef,"fileRef"),actor.realmId,providerRef,centerRef]);
    if(!f.rows[0]||f.rows[0].classification!==expected)
      throw new BadRequestException({code:"HEALTH_EVIDENCE_NOT_VERIFIED",field:"fileRef"});
    return f.rows[0];
  }
  async list(bearer:string,providerRef:string,centerRef?:string){
    const ref=id(providerRef,"providerRef"),center=centerRef?id(centerRef,"centerRef"):null;
    const kind=center?"HEALTH_CENTER_LICENSE":"HEALTH_PROVIDER_REGISTRATION";
    const {actor,action,admin}=await this.actorFor(bearer,kind,center,false);
    const client=await this.db.connect();
    try{
      await client.query("BEGIN");
      const current=await client.query<{version:number}>(
        center?"SELECT version FROM health_center WHERE root_realm_id=$1 AND id=$2 AND provider_id=$3 AND status='PENDING'":
          "SELECT version FROM health_provider WHERE root_realm_id=$1 AND id=$3 AND status='PENDING'",
        [actor.realmId,center,ref]);
      if(!current.rows[0])throw new NotFoundException("Pending source unavailable");
      await this.source(client,actor,ref,center,current.rows[0].version,admin,action);
      const r=await client.query<FileRow>(
        "SELECT f.*,i.classification,i.status AS intent_status FROM cg19_stored_file f "+
        "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
        "WHERE f.realm_id=$1 AND f.owner_kind='CG14_DRAFT' "+
        "AND f.health_provider_id=$2 AND f.health_center_id IS NOT DISTINCT FROM $3::uuid "+
        "ORDER BY f.created_at DESC,f.id DESC LIMIT 50",[actor.realmId,ref,center]);
      await client.query("COMMIT");
      return {files:r.rows.filter(f=>f.classification!=="HEALTH_BANK_PROOF").map(f=>({
        fileRef:f.id,classification:f.classification,
        status:f.revoked_at?"REVOKED":f.intent_status,
        currentVersion:f.health_source_version===current.rows[0].version,
        fileVersion:f.revision
      }))};
    }catch(e){try{await client.query("ROLLBACK");}catch{}throw e;}
    finally{client.release();}
  }
  async download(bearer:string,fileRef:string){
    const r=await this.db.query<FileRow>(
      "SELECT f.*,i.classification,i.status AS intent_status FROM cg19_stored_file f "+
      "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
      "WHERE f.id=$1 AND f.owner_kind='CG14_DRAFT' AND f.revoked_at IS NULL "+
      "AND f.scan_status='CLEAN_VERIFIED' AND i.status='VALIDATED'",
      [id(fileRef,"fileRef")]);
    const file=r.rows[0];
    if(!file)throw new NotFoundException("Private file unavailable");
    const {actor,action,admin}=await this.actorFor(bearer,file.classification,file.health_center_id,false);
    if(actor.realmId!==file.realm_id)throw new NotFoundException("Private file unavailable");
    const check=async()=>{
      const client=await this.db.connect();
      try{
        await client.query("BEGIN");
        await this.source(client,actor,file.health_provider_id,file.health_center_id,
          file.health_source_version,admin,action);
        await client.query("COMMIT");
      }catch(e){try{await client.query("ROLLBACK");}catch{}throw e;}
      finally{client.release();}
    };
    await check();
    const bytes=await this.objects.readVerifiedPrivateObject({
      objectKey:file.object_key,objectVersion:file.object_version,
      maxBytes:Math.min(Number(file.verified_size_bytes),10485760)
    });
    if(!Buffer.isBuffer(bytes)||bytes.length!==Number(file.verified_size_bytes)||
       createHash("sha256").update(bytes).digest("hex")!==file.verified_sha256)
      throw new ServiceUnavailableException("Private document could not be verified");
    await check();
    const current=await this.db.query(
      "SELECT id FROM cg19_stored_file WHERE id=$1 AND realm_id=$2 "+
      "AND owner_kind='CG14_DRAFT' AND revision=$3 AND revoked_at IS NULL",
      [file.id,actor.realmId,file.revision]);
    if(!current.rows[0])throw new NotFoundException("Private file was withdrawn");
    return {data:bytes,mime:file.original_mime};
  }
  async revoke(bearer:string,fileRef:string,expectedRevision:unknown){
    if(!Number.isSafeInteger(expectedRevision)||Number(expectedRevision)<1)
      throw new BadRequestException({code:"HEALTH_EVIDENCE_INVALID",field:"expectedRevision"});
    const result=await this.db.query<FileRow>(
      "SELECT f.*,i.classification,i.status AS intent_status FROM cg19_stored_file f "+
      "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
      "WHERE f.id=$1 AND f.owner_kind='CG14_DRAFT'",[id(fileRef,"fileRef")]);
    const row=result.rows[0];
    if(!row)throw new NotFoundException("Private file unavailable");
    const {actor,action,admin}=await this.actorFor(bearer,row.classification,row.health_center_id,true);
    if(actor.realmId!==row.realm_id)throw new NotFoundException("Private file unavailable");
    const client=await this.db.connect();let tx=false;
    try{
      await client.query("BEGIN");tx=true;
      await this.source(client,actor,row.health_provider_id,row.health_center_id,
        row.health_source_version,admin,action);
      const locked=await client.query<{id:string;revision:number;revoked_at:Date|null}>(
        "SELECT id,revision,revoked_at FROM cg19_stored_file "+
        "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_DRAFT' FOR UPDATE",
        [row.id,actor.realmId]);
      if(!locked.rows[0]||locked.rows[0].revision!==Number(expectedRevision))
        throw new ConflictException({code:"HEALTH_EVIDENCE_SOURCE_CHANGED"});
      if(!locked.rows[0].revoked_at){
        await client.query(
          "UPDATE cg19_stored_file SET revoked_at=now(),revision=revision+1 "+
          "WHERE id=$1 AND realm_id=$2",[row.id,actor.realmId]);
        await this.event(client,actor,row.health_provider_id,"FILE_REVOKED",null,row.id);
      }
      await client.query("COMMIT");tx=false;
      return {revoked:true,version:locked.rows[0].revoked_at?Number(expectedRevision):Number(expectedRevision)+1};
    }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{}throw e;}
    finally{client.release();}
  }
}
