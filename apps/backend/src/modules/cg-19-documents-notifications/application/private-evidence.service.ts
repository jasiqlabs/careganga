import {
  BadRequestException,ConflictException,ForbiddenException,Inject,
  Injectable,NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ApprovalDocumentSource} from "../../cg-03-registration-approvals/application/approval-document-source.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const TYPES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const MAX_SIZE=10*1024*1024;
type IntentRow={
  id:string;realm_id:string;case_id:string;proposal_revision:number;
  requested_by:string;request_key:string;request_digest:string;mime:string;
  size_bytes:string;expected_sha256:string;status:string;
  object_key:string;reserved_until:Date
};
type StoredFileRow={
  id:string;case_id:string;proposal_revision:number;
  original_mime:string;verified_size_bytes:string;verified_sha256:string;object_key:string;
  object_version:string;revoked_at:Date|null;revision:number;
  created_at:Date
};
type NewUpload={
  caseRef:string;sourceRevision:number;requestKey:string;
  mime:string;sizeBytes:number;sha256:string
};
function requireRecord(input:unknown):NewUpload{
  if(!input||typeof input!=="object"||Array.isArray(input))
    throw new BadRequestException("Check your file selection");
  const obj=input as Record<string,unknown>;
  if(Object.keys(obj).some(x=>
    !["caseRef","sourceRevision","requestKey","mime","sizeBytes","sha256"].includes(x))||
    typeof obj.caseRef!=="string"||!UUID.test(obj.caseRef)||
    !Number.isSafeInteger(obj.sourceRevision)||Number(obj.sourceRevision)<1||
    typeof obj.requestKey!=="string"||!UUID.test(obj.requestKey)||
    typeof obj.mime!=="string"||!TYPES.has(obj.mime)||
    !Number.isSafeInteger(obj.sizeBytes)||Number(obj.sizeBytes)<1||
    Number(obj.sizeBytes)>MAX_SIZE||typeof obj.sha256!=="string"||
    !SHA.test(obj.sha256))
    throw new BadRequestException("Choose a supported file under 10 MB");
  return obj as NewUpload;
}
function digestOf(input:NewUpload){
  return createHash("sha256").update(JSON.stringify([
    "CG19_CASE_EVIDENCE_V1",input.caseRef,input.sourceRevision,
    input.mime,input.sizeBytes,input.sha256
  ])).digest("hex");
}
@Injectable()
export class PrivateEvidenceService{
  constructor(
    @Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly cases:ApprovalDocumentSource,
    private readonly objects:PrivateObjectStorage
  ){}
  private async scope(bearer:string,action:"documents.files.view"|"documents.files.manage",
    caseRef:string,expectedRevision?:number){
    const actor=await this.sessions.requireAction(bearer,action);
    const source=await this.cases.getCurrentCase(bearer,caseRef);
    if(actor.realmId!==source.realmId||
       (expectedRevision!==undefined&&source.proposalRevision!==expectedRevision))
      throw new ForbiddenException("The application or document version changed");
    return {actor,source};
  }
  async initiate(bearer:string,payload:unknown){
    const input=requireRecord(payload);
    const {actor,source}=await this.scope(bearer,"documents.files.manage",
      input.caseRef,input.sourceRevision);
    const digest=digestOf(input);
    const id=randomUUID();
    const privateKey="careganga/private/cg19/"+actor.realmId+"/"+randomUUID();
    const client=await this.db.connect();
    let intent:IntentRow;let transaction=true;
    try{
      await client.query("BEGIN");
      const inserted=await client.query<IntentRow>(`
        INSERT INTO cg19_upload_intent(
          id,realm_id,case_id,proposal_revision,requested_by,request_key,
          mime,size_bytes,expected_sha256,request_digest,classification,
          object_key,reserved_until)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()+interval '15 minutes')
        ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING
        RETURNING *
      `,[id,actor.realmId,input.caseRef,input.sourceRevision,actor.accountId,
        input.requestKey,input.mime,input.sizeBytes,input.sha256,digest,
        source.archivalOnly?"PRIVATE_CASE_ARCHIVE":"PRIVATE_CASE_EVIDENCE",privateKey]);
      if(inserted.rowCount){
        intent=inserted.rows[0];
        await client.query(`
          INSERT INTO cg19_document_event(
            realm_id,case_id,actor_id,intent_id,event_key,safe_context)
          VALUES($1,$2,$3,$4,'UPLOAD_INITIATED',$5::jsonb)
        `,[actor.realmId,input.caseRef,actor.accountId,id,
          JSON.stringify({classification:source.archivalOnly?"Archive":"Current case evidence"})]);
      }else{
        const found=await client.query<IntentRow>(`
          SELECT * FROM cg19_upload_intent
          WHERE realm_id=$1 AND requested_by=$2 AND request_key=$3
          FOR SHARE
        `,[actor.realmId,actor.accountId,input.requestKey]);
        if(!found.rowCount||found.rows[0].request_digest!==digest)
          throw new ConflictException("A different file already uses this request");
        intent=found.rows[0];
      }
      await client.query("COMMIT");transaction=false;
    }catch(error){
      if(transaction){try{await client.query("ROLLBACK");}catch{}}
      throw error;
    }finally{client.release();}
    if(intent.status==="VALIDATED"||intent.status==="REJECTED"||
      intent.status==="EXPIRED"||intent.reserved_until.getTime()<=Date.now()){
      return {uploadRef:intent.id,status:intent.status==="INITIATED"?"EXPIRED":intent.status,
        message:"Check the original upload status before starting another."};
    }
    try{
      // External I/O is strictly after the durable intent transaction.
      // Storage must issue a nonpublic short-lived permission bound to these
      // exact bytes; it must not claim that bytes already exist.
      const reservation=await this.objects.reservePrivateUpload({
        objectKey:intent.object_key,requestKey:intent.request_key,
        mime:intent.mime,sizeBytes:Number(intent.size_bytes),
        sha256:intent.expected_sha256,expiresAt:intent.reserved_until.toISOString()
      });
      const expires=new Date(reservation.expiresAt).getTime();
      const uploadHeaders=reservation.headers;
      if(!reservation.url.startsWith("https://")||
        !Number.isFinite(expires)||expires<=Date.now()||
        expires>intent.reserved_until.getTime()||
        !reservation.reservationRef||reservation.reservationRef.length>160||
        !uploadHeaders||typeof uploadHeaders!=="object"||
        !Object.keys(uploadHeaders).every(name=>
          ["Content-Type","x-goog-if-generation-match",
           "x-amz-checksum-sha256","If-None-Match"].includes(name)&&
          typeof uploadHeaders[name]==="string"&&uploadHeaders[name].length<=160)||
        uploadHeaders["Content-Type"]!==intent.mime)
        throw new ServiceUnavailableException("Secure upload reservation is not verified");
      const recorded=await this.db.query(`
        UPDATE cg19_upload_intent SET
          storage_reservation_ref=$3,status='INITIATED',updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','UNKNOWN')
          AND reserved_until>now()
        RETURNING id
      `,[intent.id,actor.realmId,reservation.reservationRef]);
      if(!recorded.rowCount)
        throw new ConflictException("The original upload intent is no longer valid");
      return {uploadRef:intent.id,status:"UPLOAD_READY" as const,
        uploadUrl:reservation.url,uploadHeaders,expiresAt:reservation.expiresAt,
        message:"Upload permission prepared; the file is not yet verified."};
    }catch{
      await this.db.query(`
        UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND status='INITIATED'
      `,[intent.id,actor.realmId]);
      return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE" as const,
        message:"Secure upload is unavailable. No file has been accepted."};
    }
  }
  private async getIntent(bearer:string,id:string,
    action:"documents.files.view"|"documents.files.manage"){
    if(!UUID.test(id))throw new BadRequestException("Choose a valid file");
    const actor=await this.sessions.requireAction(bearer,action);
    const rows=await this.db.query<IntentRow>(`
      SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2
    `,[id,actor.realmId]);
    const row=rows.rows[0];
    if(!row)throw new NotFoundException("Private file unavailable");
    await this.scope(bearer,action,row.case_id,row.proposal_revision);
    return {actor,row};
  }
  async status(bearer:string,id:string){
    const {actor,row}=await this.getIntent(bearer,id,"documents.files.view");
    const file=await this.db.query<{id:string}>(`
      SELECT id FROM cg19_stored_file
      WHERE realm_id=$1 AND upload_intent_id=$2 AND revoked_at IS NULL
    `,[actor.realmId,row.id]);
    return {uploadRef:row.id,status:row.status,
      fileRef:row.status==="VALIDATED"?file.rows[0]?.id??null:null,
      cleanVerified:row.status==="VALIDATED"&&!!file.rowCount};
  }
  async confirm(bearer:string,id:string){
    const {actor,row}=await this.getIntent(bearer,id,"documents.files.manage");
    if(row.status==="VALIDATED")return this.status(bearer,id);
    if(row.status==="REJECTED"||row.status==="EXPIRED"||
       row.reserved_until.getTime()<=Date.now()){
      return {uploadRef:row.id,status:"EXPIRED_OR_REJECTED",
        cleanVerified:false,message:"This upload cannot be confirmed."};
    }
    let verified;
    try{
      // The adapter must independently HEAD/read the real private bytes and
      // return a current scanner result; client checksum is never trusted.
      verified=await this.objects.verifyPrivateObject({
        objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),
        sha256:row.expected_sha256
      });
    }catch{
      await this.db.query(`
        UPDATE cg19_upload_intent SET status='UNKNOWN',updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND status IN('INITIATED','VERIFYING')
      `,[row.id,actor.realmId]);
      return {uploadRef:row.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false,
        message:"The file and malware scan could not be verified."};
    }
    const scanAt=Date.parse(verified.verifiedAt);
    const exact=verified.state==="CLEAN_VERIFIED"&&
      verified.sha256===row.expected_sha256&&
      verified.mime===row.mime&&verified.sizeBytes===Number(row.size_bytes)&&
      typeof verified.objectVersion==="string"&&
      verified.objectVersion.length>=1&&verified.objectVersion.length<=160&&
      typeof verified.scanProofRef==="string"&&
      verified.scanProofRef.length>=8&&verified.scanProofRef.length<=160&&
      Number.isFinite(scanAt)&&scanAt<=Date.now()+60000&&
      Date.now()-scanAt<15*60*1000;
    const client=await this.db.connect();let transaction=true;
    try{
      await client.query("BEGIN");
      const locked=await client.query<IntentRow>(`
        SELECT * FROM cg19_upload_intent WHERE id=$1 AND realm_id=$2 FOR UPDATE
      `,[row.id,actor.realmId]);
      if(!locked.rows[0]||locked.rows[0].status==="REJECTED"||
         locked.rows[0].status==="EXPIRED"||
         locked.rows[0].reserved_until.getTime()<=Date.now())
        throw new ConflictException("The upload has expired or changed");
      const valid=locked.rows[0].status==="VALIDATED";
      if(!valid){
        await client.query(`
          UPDATE cg19_upload_intent SET status=$3,updated_at=now()
          WHERE id=$1 AND realm_id=$2
        `,[row.id,actor.realmId,exact?"VALIDATED":"REJECTED"]);
        if(exact){
          await client.query(`
            INSERT INTO cg19_stored_file(
              realm_id,upload_intent_id,case_id,proposal_revision,
              original_mime,verified_sha256,verified_size_bytes,object_key,
              object_version,scan_status,scan_proof_ref,scanned_at,created_by)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'CLEAN_VERIFIED',$10,$11,$12)
            ON CONFLICT(upload_intent_id) DO NOTHING
          `,[actor.realmId,row.id,row.case_id,row.proposal_revision,row.mime,
            row.expected_sha256,row.size_bytes,row.object_key,
            verified.objectVersion,verified.scanProofRef,new Date(verified.verifiedAt),
            actor.accountId]);
        }
        await client.query(`
          INSERT INTO cg19_document_event(
            realm_id,case_id,actor_id,intent_id,event_key)
          VALUES($1,$2,$3,$4,$5)
        `,[actor.realmId,row.case_id,actor.accountId,row.id,
          exact?"UPLOAD_VERIFIED":"UPLOAD_REJECTED"]);
      }
      await client.query("COMMIT");transaction=false;
      return this.status(bearer,id);
    }catch(error){
      if(transaction){try{await client.query("ROLLBACK");}catch{}}
      throw error;
    }finally{client.release();}
  }
  async listCase(bearer:string,caseRef:string){
    if(!UUID.test(caseRef))throw new BadRequestException("Choose a valid application");
    const {actor,source}=await this.scope(bearer,"documents.files.view",caseRef);
    const rows=await this.db.query<StoredFileRow>(`
      SELECT id,case_id,proposal_revision,original_mime,verified_size_bytes,
        object_key,object_version,revoked_at,revision,created_at
      FROM cg19_stored_file
      WHERE realm_id=$1 AND case_id=$2 AND proposal_revision=$3
      ORDER BY created_at DESC,id DESC LIMIT 30
    `,[actor.realmId,caseRef,source.proposalRevision]);
    return {files:rows.rows.map(x=>({
      fileRef:x.id,revision:x.revision,mime:x.original_mime,
      sizeBytes:Number(x.verified_size_bytes),
      createdAt:x.created_at.toISOString(),revoked:x.revoked_at!==null
    }))};
  }
  async revoke(bearer:string,fileRef:string,body:unknown){
    if(!UUID.test(fileRef)||!body||typeof body!=="object"||Array.isArray(body))
      throw new BadRequestException("Choose a verified file and its current revision");
    const input=body as Record<string,unknown>;
    if(Object.keys(input).some(k=>k!=="expectedRevision")||
      !Number.isSafeInteger(input.expectedRevision)||
      Number(input.expectedRevision)<1)
      throw new BadRequestException("Check the current file revision");
    const actor=await this.sessions.requireAction(bearer,"documents.files.manage");
    const prior=await this.db.query<StoredFileRow>(`
      SELECT id,case_id,proposal_revision,original_mime,verified_size_bytes,
        object_key,object_version,revoked_at,revision,created_at
      FROM cg19_stored_file WHERE id=$1 AND realm_id=$2
    `,[fileRef,actor.realmId]);
    if(!prior.rowCount)throw new NotFoundException("Private file unavailable");
    await this.scope(bearer,"documents.files.manage",
      prior.rows[0].case_id,prior.rows[0].proposal_revision);
    const client=await this.db.connect();
    let open=false;
    try{
      await client.query("BEGIN");open=true;
      // The row lock serializes revocation with competing operators.
      const locked=await client.query<StoredFileRow>(`
        SELECT id,case_id,proposal_revision,original_mime,verified_size_bytes,
          object_key,object_version,revoked_at,revision,created_at
        FROM cg19_stored_file WHERE id=$1 AND realm_id=$2 FOR UPDATE
      `,[fileRef,actor.realmId]);
      const file=locked.rows[0];
      if(!file)throw new NotFoundException("Private file unavailable");
      if(file.revision!==input.expectedRevision)
        throw new ConflictException("The private file changed. Refresh its state.");
      if(file.revoked_at){
        await client.query("COMMIT");open=false;
        return {revoked:true,revision:file.revision};
      }
      const changed=await client.query<{revision:number}>(`
        UPDATE cg19_stored_file
        SET revoked_at=now(),revision=revision+1
        WHERE id=$1 AND realm_id=$2 AND revision=$3 AND revoked_at IS NULL
        RETURNING revision
      `,[fileRef,actor.realmId,input.expectedRevision]);
      if(!changed.rowCount)throw new ConflictException("The file changed.");
      await client.query(`
        INSERT INTO cg19_document_event(
          realm_id,case_id,actor_id,file_id,event_key)
        VALUES($1,$2,$3,$4,'FILE_REVOKED')
      `,[actor.realmId,file.case_id,actor.accountId,file.id]);
      await client.query("COMMIT");open=false;
      return {revoked:true,revision:changed.rows[0].revision};
    }catch(e){
      if(open)try{await client.query("ROLLBACK");}catch{};
      throw e;
    }finally{client.release();}
  }
  async download(bearer:string,fileRef:string){
    if(!UUID.test(fileRef))throw new BadRequestException("Choose a valid file");
    const actor=await this.sessions.requireAction(bearer,"documents.files.view");
    const rows=await this.db.query<StoredFileRow>(`
      SELECT f.id,f.case_id,f.proposal_revision,f.original_mime,
        f.verified_size_bytes,f.verified_sha256,f.object_key,f.object_version,f.revoked_at
      FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id
        AND i.realm_id=f.realm_id
      WHERE f.id=$1 AND f.realm_id=$2 AND f.scan_status='CLEAN_VERIFIED'
        AND f.revoked_at IS NULL AND i.status='VALIDATED'
    `,[fileRef,actor.realmId]);
    const file=rows.rows[0];
    if(!file)throw new NotFoundException("Private file unavailable");
    await this.scope(bearer,"documents.files.view",file.case_id,file.proposal_revision);
    const bytes=await this.objects.readVerifiedPrivateObject({
      objectKey:file.object_key,objectVersion:file.object_version,
      maxBytes:Math.min(Number(file.verified_size_bytes),MAX_SIZE)
    });
    if(!Buffer.isBuffer(bytes)||bytes.length!==Number(file.verified_size_bytes)||
       createHash("sha256").update(bytes).digest("hex")!==file.verified_sha256)
      throw new ServiceUnavailableException("Private file verification failed");
    // The actor or original file might have been revoked during the storage
    // operation. Return nothing unless both remain authorized at handoff.
    await this.scope(bearer,"documents.files.view",file.case_id,file.proposal_revision);
    const current=await this.db.query<{id:string}>(`
      SELECT id FROM cg19_stored_file
      WHERE id=$1 AND realm_id=$2 AND revoked_at IS NULL
    `,[file.id,actor.realmId]);
    if(!current.rowCount)throw new NotFoundException("Private file unavailable");
    return {data:bytes,mime:file.original_mime};
  }
}
