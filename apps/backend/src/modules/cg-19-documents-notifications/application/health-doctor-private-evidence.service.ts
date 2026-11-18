import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
  NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const MAX_SIZE=10485760;
type Input={doctorRef:string;sourceVersion:number;requestKey:string;
  mime:string;sizeBytes:number;sha256:string;
  classification:"HEALTH_DOCTOR_LICENSE"|"HEALTH_DOCTOR_PORTRAIT"};
type IntentRow={id:string;realm_id:string;health_doctor_id:string;
  health_source_version:number;requested_by:string;request_key:string;
  request_digest:string;mime:string;size_bytes:string;
  expected_sha256:string;status:string;object_key:string;reserved_until:Date;
  classification:"HEALTH_DOCTOR_LICENSE"|"HEALTH_DOCTOR_PORTRAIT"};
type FileRow={id:string;realm_id:string;health_doctor_id:string;
  health_source_version:number;original_mime:string;verified_size_bytes:string;
  verified_sha256:string;object_key:string;object_version:string;scan_status:string;
  revoked_at:Date|null;revision:number;intent_status:string};
const validId=(value:unknown,field:string)=>{
  if(typeof value!=="string"||!UUID.test(value))
    throw new BadRequestException({code:"HEALTH_DOCTOR_EVIDENCE_INVALID",field});
  return value;
};
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function parse(body:unknown):Input{
  if(!body||typeof body!=="object"||Array.isArray(body))
    throw new BadRequestException({code:"HEALTH_DOCTOR_EVIDENCE_INVALID"});
  const x=body as Record<string,unknown>;
  if(Object.keys(x).some(k=>!["doctorRef","sourceVersion","requestKey",
    "mime","sizeBytes","sha256","classification"].includes(k))||
    !Number.isSafeInteger(x.sourceVersion)||Number(x.sourceVersion)<1||
    !Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||
    Number(x.sizeBytes)>MAX_SIZE||
    typeof x.mime!=="string"||!MIME.has(x.mime)||
    (x.classification!==undefined&&
      !["HEALTH_DOCTOR_LICENSE","HEALTH_DOCTOR_PORTRAIT"].includes(String(x.classification)))||
    (x.classification==="HEALTH_DOCTOR_PORTRAIT"&&x.mime==="application/pdf")||
    typeof x.sha256!=="string"||!SHA.test(x.sha256))
    throw new BadRequestException({code:"HEALTH_DOCTOR_EVIDENCE_INVALID"});
  return {doctorRef:validId(x.doctorRef,"doctorRef"),
    sourceVersion:Number(x.sourceVersion),requestKey:validId(x.requestKey,"requestKey"),
    mime:x.mime,sizeBytes:Number(x.sizeBytes),sha256:x.sha256,
    classification:x.classification==="HEALTH_DOCTOR_PORTRAIT"?
      "HEALTH_DOCTOR_PORTRAIT":"HEALTH_DOCTOR_LICENSE"};
}

@Injectable()
export class HealthDoctorPrivateEvidenceService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identity:FoundationStructureIdentityFacade,
    private readonly objects:PrivateObjectStorage,
    private readonly protectedOwner:ProtectedAccessOwnerService){}
  private async source(tx:PoolClient,actor:VerifiedFoundationActor,
    doctorRef:string,sourceVersion:number,
    classification:"HEALTH_DOCTOR_LICENSE"|"HEALTH_DOCTOR_PORTRAIT"="HEALTH_DOCTOR_LICENSE"){
    await this.identity.assertCurrent(tx,actor,"health.doctors.manage");
    const doctor=await tx.query<{version:number;portrait_rights_status:string}>(
      "SELECT version,portrait_rights_status FROM health_doctor "+
      "WHERE root_realm_id=$1 AND id=$2 AND status='PENDING' FOR SHARE",
      [actor.realmId,doctorRef]);
    if(!doctor.rows[0])throw new NotFoundException({code:"HEALTH_DOCTOR_NOT_PENDING"});
    if(doctor.rows[0].version!==sourceVersion)
      throw new ConflictException({code:"HEALTH_DOCTOR_EVIDENCE_SOURCE_CHANGED"});
    if(classification==="HEALTH_DOCTOR_PORTRAIT"&&
      doctor.rows[0].portrait_rights_status!=="CONSENT_PENDING")
      throw new BadRequestException({code:"HEALTH_DOCTOR_EVIDENCE_INVALID",field:"classification"});
  }
  private async event(tx:PoolClient,actor:VerifiedFoundationActor,
    doctorRef:string,kind:string,intentRef:string|null,fileRef:string|null){
    await tx.query("INSERT INTO cg19_document_event(realm_id,health_doctor_id,"+
      "actor_id,intent_id,file_id,event_key) VALUES($1,$2,$3,$4,$5,$6)",
      [actor.realmId,doctorRef,actor.accountId,intentRef,fileRef,kind]);
  }
  async initiate(bearer:string,body:unknown){
    const input=parse(body);
    const actor=await this.sessions.requireAction(bearer,"health.doctors.manage");
    const inputDigest=digest(["CG14_DOCTOR",input]);
    const key="careganga/private/cg19/"+actor.realmId+"/"+randomUUID();
    const tx=await this.db.connect();let open=false;let intent:IntentRow;
    try{
      await tx.query("BEGIN");open=true;
      await this.source(tx,actor,input.doctorRef,input.sourceVersion,input.classification);
      const created=await tx.query<IntentRow>(
        "INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,"+
        "request_key,mime,size_bytes,expected_sha256,request_digest,classification,"+
        "object_key,reserved_until,owner_kind,health_doctor_id,health_source_version) "+
        "VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,"+
        "now()+interval '15 minutes','CG14_DOCTOR',$11,$12) "+
        "ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *",
        [actor.realmId,input.sourceVersion,actor.accountId,input.requestKey,input.mime,
          input.sizeBytes,input.sha256,inputDigest,input.classification,key,
          input.doctorRef,input.sourceVersion]);
      if(created.rows[0]){
        intent=created.rows[0];
        await this.event(tx,actor,input.doctorRef,"UPLOAD_INITIATED",intent.id,null);
      }else{
        const existing=await tx.query<IntentRow>(
          "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND "+
          "requested_by=$2 AND request_key=$3 AND owner_kind='CG14_DOCTOR' FOR SHARE",
          [actor.realmId,actor.accountId,input.requestKey]);
        if(!existing.rows[0]||existing.rows[0].request_digest!==inputDigest)
          throw new ConflictException({code:"HEALTH_DOCTOR_EVIDENCE_REPLAY_CONFLICT"});
        intent=existing.rows[0];
      }
      await tx.query("COMMIT");open=false;
    }catch(e){if(open)try{await tx.query("ROLLBACK");}catch{}throw e;}
    finally{tx.release();}
    if(["VALIDATED","REJECTED","EXPIRED"].includes(intent.status)||
      intent.reserved_until.getTime()<=Date.now())
      return {uploadRef:intent.id,status:intent.status,
        message:"Check the original secure doctor file status."};
    try{
      const upload=await this.objects.reservePrivateUpload({
        objectKey:intent.object_key,requestKey:intent.request_key,
        mime:intent.mime,sizeBytes:Number(intent.size_bytes),
        sha256:intent.expected_sha256,expiresAt:intent.reserved_until.toISOString()
      });
      const expiry=Date.parse(upload.expiresAt);
      if(!upload.url.startsWith("https://")||!Number.isFinite(expiry)||
         expiry<=Date.now()||expiry>intent.reserved_until.getTime()||
         !upload.reservationRef||upload.reservationRef.length>160||
         !upload.headers||upload.headers["Content-Type"]!==intent.mime||
         !Object.entries(upload.headers).every(([name,value])=>
           ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256",
             "If-None-Match"].includes(name)&&typeof value==="string"&&value.length<=160))
        throw new ServiceUnavailableException("Secure upload permission unavailable");
      const r=await this.db.query(
        "UPDATE cg19_upload_intent SET storage_reservation_ref=$3,"+
        "status='INITIATED',updated_at=now() "+
        "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_DOCTOR' "+
        "AND status IN('INITIATED','UNKNOWN') AND reserved_until>now() RETURNING id",
        [intent.id,actor.realmId,upload.reservationRef]);
      if(!r.rowCount)throw new ConflictException("Original upload has expired");
      return {uploadRef:intent.id,status:"UPLOAD_READY",
        uploadUrl:upload.url,uploadHeaders:upload.headers,expiresAt:upload.expiresAt,
        message:"Doctor proof remains private and requires original malware verification."};
    }catch{
      await this.db.query(
        "UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
        "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_DOCTOR' "+
        "AND status='INITIATED'",[intent.id,actor.realmId]);
      return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",
        message:"Secure storage or scanning is unavailable. No doctor proof was accepted."};
    }
  }
  private async intent(bearer:string,intentRef:string){
    const actor=await this.sessions.requireAction(bearer,"health.doctors.manage");
    const r=await this.db.query<IntentRow>(
      "SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 "+
      "AND owner_kind='CG14_DOCTOR'",
      [actor.realmId,validId(intentRef,"intentRef")]);
    const row=r.rows[0];
    if(!row)throw new NotFoundException("Original doctor upload unavailable");
    if(row.requested_by!==actor.accountId)
      throw new ForbiddenException("This original upload belongs to another staff member");
    const tx=await this.db.connect();
    try{
      await tx.query("BEGIN");
      await this.source(tx,actor,row.health_doctor_id,row.health_source_version,
        row.classification);
      await tx.query("COMMIT");
    }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}
    finally{tx.release();}
    return {actor,row};
  }
  async status(bearer:string,intentRef:string){
    const {actor,row}=await this.intent(bearer,intentRef);
    const r=await this.db.query<{id:string;revision:number}>(
      "SELECT id,revision FROM cg19_stored_file "+
      "WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG14_DOCTOR' "+
      "AND revoked_at IS NULL AND scan_status='CLEAN_VERIFIED'",
      [actor.realmId,row.id]);
    return {uploadRef:row.id,status:row.status,
      fileRef:row.status==="VALIDATED"?r.rows[0]?.id??null:null,
      fileVersion:row.status==="VALIDATED"?r.rows[0]?.revision??null:null,
      cleanVerified:row.status==="VALIDATED"&&!!r.rows[0]};
  }
  async confirm(bearer:string,intentRef:string){
    const {actor,row}=await this.intent(bearer,intentRef);
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
      await this.db.query("UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now() "+
        "WHERE id=$1 AND realm_id=$2 AND owner_kind='CG14_DOCTOR' "+
        "AND status IN('INITIATED','VERIFYING')",[row.id,actor.realmId]);
      return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};
    }
    const scanAt=Date.parse(verified.verifiedAt);
    const clean=verified.state==="CLEAN_VERIFIED"&&
      verified.sha256===row.expected_sha256&&
      verified.sizeBytes===Number(row.size_bytes)&&verified.mime===row.mime&&
      typeof verified.objectVersion==="string"&&
      verified.objectVersion.length>=1&&verified.objectVersion.length<=160&&
      typeof verified.scanProofRef==="string"&&verified.scanProofRef.length>=8&&
      verified.scanProofRef.length<=160&&Number.isFinite(scanAt)&&
      scanAt<=Date.now()+60000&&Date.now()-scanAt<900000;
    const tx=await this.db.connect();let open=false;
    try{
      await tx.query("BEGIN");open=true;
      const locked=await tx.query<IntentRow>(
        "SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 "+
        "AND owner_kind='CG14_DOCTOR' FOR UPDATE",[row.id,actor.realmId]);
      if(!locked.rows[0]||["REJECTED","EXPIRED"].includes(locked.rows[0].status)||
        locked.rows[0].reserved_until.getTime()<=Date.now())
        throw new ConflictException({code:"HEALTH_DOCTOR_EVIDENCE_SOURCE_CHANGED"});
      await this.source(tx,actor,row.health_doctor_id,row.health_source_version,
        row.classification);
      if(locked.rows[0].status!=="VALIDATED"){
        await tx.query(
          "UPDATE cg19_upload_intent SET status=$3,updated_at=now() "+
          "WHERE id=$1 AND realm_id=$2",
          [row.id,actor.realmId,clean?"VALIDATED":"REJECTED"]);
        if(clean)await tx.query(
          "INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,"+
          "original_mime,verified_sha256,verified_size_bytes,object_key,object_version,"+
          "scan_status,scan_proof_ref,scanned_at,created_by,owner_kind,"+
          "health_doctor_id,health_source_version) "+
          "VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,'CLEAN_VERIFIED',$9,$10,$11,"+
          "'CG14_DOCTOR',$12,$13) ON CONFLICT(upload_intent_id) DO NOTHING",
          [actor.realmId,row.id,row.health_source_version,row.mime,
           row.expected_sha256,row.size_bytes,row.object_key,verified.objectVersion,
           verified.scanProofRef,new Date(verified.verifiedAt),actor.accountId,
           row.health_doctor_id,row.health_source_version]);
        await this.event(tx,actor,row.health_doctor_id,
          clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED",row.id,null);
      }
      await tx.query("COMMIT");open=false;
    }catch(e){if(open)try{await tx.query("ROLLBACK");}catch{}throw e;}
    finally{tx.release();}
    return this.status(bearer,row.id);
  }
  /** For the later original CG03 doctor review, in the SAME transaction.
   * This never trusts a client-side 'verified' flag or an applicant uploadRef.
   */
  async prove(tx:PoolClient,actor:VerifiedFoundationActor,
    doctorRef:string,sourceVersion:number,fileRef:string){
    const r=await tx.query<{id:string;revision:number}>(
      "SELECT f.id,f.revision FROM cg19_stored_file f "+
      "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
      "WHERE f.id=$1 AND f.realm_id=$2 AND f.owner_kind='CG14_DOCTOR' "+
      "AND f.health_doctor_id=$3 AND f.health_source_version=$4 "+
      "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
      "AND i.status='VALIDATED' AND i.classification='HEALTH_DOCTOR_LICENSE' "+
      "FOR SHARE OF f,i",
      [validId(fileRef,"fileRef"),actor.realmId,validId(doctorRef,"doctorRef"),
        sourceVersion]);
    if(!r.rows[0])throw new BadRequestException({
      code:"HEALTH_DOCTOR_EVIDENCE_NOT_VERIFIED",field:"fileRef"});
    return r.rows[0];
  }
  async list(bearer:string,doctorRef:string){
    const actor=await this.sessions.requireAction(bearer,"health.doctors.manage");
    const ref=validId(doctorRef,"doctorRef");
    const tx=await this.db.connect();
    try{
      await tx.query("BEGIN");
      const source=await tx.query<{version:number}>(
        "SELECT version FROM health_doctor WHERE root_realm_id=$1 AND id=$2 "+
        "AND status='PENDING' FOR SHARE",[actor.realmId,ref]);
      if(!source.rows[0])throw new NotFoundException({code:"HEALTH_DOCTOR_NOT_PENDING"});
      await this.identity.assertCurrent(tx,actor,"health.doctors.manage");
      const rows=await tx.query<{id:string;health_source_version:number;revision:number;
        revoked_at:Date|null;scan_status:string;intent_status:string;classification:string}>(
        "SELECT f.id,f.health_source_version,f.revision,f.revoked_at,f.scan_status,"+
        "i.status AS intent_status,i.classification FROM cg19_stored_file f "+
        "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
        "WHERE f.realm_id=$1 AND f.health_doctor_id=$2 AND f.owner_kind='CG14_DOCTOR' "+
        "ORDER BY f.created_at DESC,f.id DESC LIMIT 50",
        [actor.realmId,ref]);
      await tx.query("COMMIT");
      return {files:rows.rows.map(f=>({
        fileRef:f.id,fileVersion:f.revision,classification:f.classification,
        status:f.revoked_at?"REVOKED":f.intent_status,
        cleanVerified:!f.revoked_at&&f.scan_status==="CLEAN_VERIFIED"&&
          f.intent_status==="VALIDATED",
        currentVersion:f.health_source_version===source.rows[0].version
      }))};
    }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}
    finally{tx.release();}
  }
  /** Exact-original case reviewer preview only. Never expose a guessed raw
   * doctor document by its file UUID to a general healthcare reader.
   */
  async reviewDownload(bearer:string,caseRef:string){
    const ref=validId(caseRef,"caseRef");
    const actor=await this.sessions.requireAction(bearer,"approvals.review");
    await this.sessions.requireAction(bearer,"health.doctors.verify");
    const check=async()=>{
      const tx=await this.db.connect();
      try{
        await tx.query("BEGIN");
        await this.identity.assertCurrent(tx,actor,"health.doctors.verify");
        await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
        const r=await tx.query<FileRow>(
          "SELECT f.*,i.status AS intent_status FROM cg03_case c "+
          "JOIN health_doctor_revision rev ON rev.id=c.health_doctor_revision_id "+
          "AND rev.root_realm_id=c.realm_id AND rev.doctor_id=c.health_doctor_id "+
          "AND rev.source_digest=c.health_source_digest AND rev.approval_case_ref=c.id "+
          "JOIN health_doctor d ON d.id=rev.doctor_id AND d.root_realm_id=rev.root_realm_id "+
          "JOIN cg19_stored_file f ON f.id=rev.proof_file_ref "+
          "AND f.realm_id=rev.root_realm_id AND f.health_doctor_id=rev.doctor_id "+
          "AND f.health_source_version=rev.source_version AND f.owner_kind='CG14_DOCTOR' "+
          "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
          "WHERE c.id=$1 AND c.realm_id=$2 AND c.proposer_id<>$3 "+
          "AND c.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
          "AND c.status IN('SUBMITTED','IN_REVIEW','PENDING_OWNER','OWNER_COMPLETED') "+
          "AND d.status IN('SUBMITTED','VERIFIED') "+
          "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
          "AND i.status='VALIDATED' AND i.classification='HEALTH_DOCTOR_LICENSE' "+
          "LIMIT 1",[ref,actor.realmId,actor.accountId]);
        if(!r.rows[0])throw new NotFoundException("Original private doctor proof unavailable");
        await tx.query("COMMIT");
        return r.rows[0];
      }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}
      finally{tx.release();}
    };
    const file=await check();
    const bytes=await this.objects.readVerifiedPrivateObject({
      objectKey:file.object_key,objectVersion:file.object_version,
      maxBytes:Math.min(Number(file.verified_size_bytes),MAX_SIZE)
    });
    if(!Buffer.isBuffer(bytes)||bytes.length!==Number(file.verified_size_bytes)||
      createHash("sha256").update(bytes).digest("hex")!==file.verified_sha256)
      throw new ServiceUnavailableException("Private scanned doctor file changed");
    const latest=await check();
    if(latest.id!==file.id||latest.revision!==file.revision||
      latest.object_version!==file.object_version)
      throw new NotFoundException("Private doctor proof was changed or revoked");
    return {data:bytes,mime:file.original_mime};
  }
  async revoke(bearer:string,fileRef:string,expectedRevision:unknown){
    if(!Number.isSafeInteger(expectedRevision)||Number(expectedRevision)<1)
      throw new BadRequestException({code:"HEALTH_DOCTOR_EVIDENCE_INVALID",field:"expectedRevision"});
    const actor=await this.sessions.requireAction(bearer,"health.doctors.manage");
    const ref=validId(fileRef,"fileRef");
    const tx=await this.db.connect();let open=false;
    try{
      await tx.query("BEGIN");open=true;
      const file=await tx.query<{id:string;health_doctor_id:string;
        health_source_version:number;revision:number;revoked_at:Date|null}>(
        "SELECT id,health_doctor_id,health_source_version,revision,revoked_at "+
        "FROM cg19_stored_file WHERE id=$1 AND realm_id=$2 AND "+
        "owner_kind='CG14_DOCTOR' FOR UPDATE",[ref,actor.realmId]);
      const f=file.rows[0];
      if(!f)throw new NotFoundException("Private doctor file unavailable");
      await this.source(tx,actor,f.health_doctor_id,f.health_source_version);
      if(f.revision!==Number(expectedRevision))
        throw new ConflictException({code:"HEALTH_DOCTOR_EVIDENCE_SOURCE_CHANGED"});
      if(!f.revoked_at){
        await tx.query("UPDATE cg19_stored_file SET revoked_at=now(),"+
          "revision=revision+1 WHERE id=$1 AND realm_id=$2",[ref,actor.realmId]);
        await this.event(tx,actor,f.health_doctor_id,"FILE_REVOKED",null,ref);
      }
      await tx.query("COMMIT");open=false;
      return {revoked:true,version:f.revoked_at?f.revision:f.revision+1};
    }catch(e){if(open)try{await tx.query("ROLLBACK");}catch{}throw e;}
    finally{tx.release();}
  }
}
