import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
  NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ApprovalDocumentSource} from "../../cg-03-registration-approvals/application/approval-document-source.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {createAccessLetterPdf,templateHash} from "./access-letter-renderer";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Template={
  id:string;version:number;title:string;body:string;
  content_sha256:string;status:"APPROVED"|"WITHDRAWN"
};
type Letter={
  id:string;case_id:string;realm_id:string;proposal_revision:number;
  template_id:string;template_version:number;issue_revision:number;
  issue_key:string;request_digest:string;issued_by:string;state:string;
  source_snapshot:{caseNumber:string;accountName:string;roleName:string;issuedAt:string};
  source_sha256:string;object_key:string;object_version:string|null;
  content_sha256:string|null;created_at:Date;issued_at:Date|null;
  revoked_at:Date|null;attempt_count:number;claim_expires_at:Date|null
};
function fields(input:unknown,allowed:readonly string[]):Record<string,unknown>{
  if(!input||typeof input!=="object"||Array.isArray(input))
    throw new BadRequestException("Check the private letter request");
  const obj=input as Record<string,unknown>;
  if(Object.keys(obj).some(x=>!allowed.includes(x)))
    throw new BadRequestException("Unsupported private letter detail");
  return obj;
}
function isUuid(v:unknown):v is string{
  return typeof v==="string"&&UUID.test(v);
}
function safeTemplate(v:unknown,min:number,max:number):string{
  if(typeof v!=="string"||v.length<min||v.length>max||
    /[\u0000-\u001f\u007f]/.test(v)||/<[\s/]*[a-z][^>]*>/i.test(v))
    throw new BadRequestException("Check the letter heading and body");
  return v.trim();
}
function publicStatus(row:Letter){
  return {documentRef:row.id,state:row.state,
    issueRevision:row.issue_revision,templateVersion:row.template_version,
    issuedAt:row.issued_at?.toISOString()??null,
    canDownload:row.state==="ISSUED"&&row.revoked_at===null,
    canReconcile:["PENDING","VERIFYING","UNKNOWN"].includes(row.state)};
}
@Injectable()
export class PrivateLetterService{
  constructor(
    @Inject(DATABASE) private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly source:ApprovalDocumentSource,
    private readonly objects:PrivateObjectStorage
  ){}
  private actor(bearer:string,capability="documents.letters.issue"){
    return this.sessions.requireAction(bearer,capability);
  }
  async activeTemplate(bearer:string){
    const actor=await this.actor(bearer);
    const rows=await this.db.query<Template>(`
      SELECT id,version,title,body,content_sha256,status
      FROM cg19_document_template
      WHERE realm_id=$1 AND template_kind='PRIVATE_APPROVED_ACCESS_LETTER'
      ORDER BY version DESC LIMIT 1
    `,[actor.realmId]);
    const row=rows.rows[0];
    return row?{configured:true,version:row.version,title:row.title,body:row.body,
      status:row.status}:{configured:false,version:0,status:"NOT_CONFIGURED"};
  }
  async approveTemplate(bearer:string,raw:unknown){
    const input=fields(raw,["title","body","expectedVersion","requestKey","totp"]);
    const title=safeTemplate(input.title,10,100);
    const body=safeTemplate(input.body,20,1200);
    if(!Number.isSafeInteger(input.expectedVersion)||Number(input.expectedVersion)<0||
      !isUuid(input.requestKey)||typeof input.totp!=="string"||
      !/^[0-9]{6}$/.test(input.totp))
      throw new BadRequestException("Check letter template revision and authenticator");
    const expected=Number(input.expectedVersion),key=input.requestKey;
    const actor=await this.actor(bearer);
    const digest=sha(["TEMPLATE_APPROVE",title,body,expected]);
    const client=await this.db.connect();
    let open=false;
    try{
      await this.sessions.limitFoundationRootProof(actor);
      await client.query("BEGIN");open=true;
      const realm=await client.query(`
        SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
      `,[actor.realmId]);
      if(!realm.rowCount)throw new ForbiddenException("Foundation access is unavailable");
      const replay=await client.query<{request_digest:string;version:number}>(`
        SELECT cmd.request_digest,t.version FROM cg19_template_command cmd
        JOIN cg19_document_template t ON t.id=cmd.template_id AND t.realm_id=cmd.realm_id
        WHERE cmd.realm_id=$1 AND cmd.actor_id=$2 AND cmd.request_key=$3
      `,[actor.realmId,actor.accountId,key]);
      if(replay.rowCount){
        if(replay.rows[0].request_digest!==digest)
          throw new ConflictException("The template request has different content");
        await client.query("COMMIT");open=false;
        return {status:"REPLAY_CONFIRMED",version:replay.rows[0].version};
      }
      await this.sessions.requireFreshFoundationRootProof(client,actor,input.totp);
      const prev=await client.query<Template>(`
        SELECT id,version,title,body,content_sha256,status
        FROM cg19_document_template
        WHERE realm_id=$1 AND template_kind='PRIVATE_APPROVED_ACCESS_LETTER'
        ORDER BY version DESC LIMIT 1 FOR UPDATE
      `,[actor.realmId]);
      const old=prev.rows[0];
      if((old?.version??0)!==expected)
        throw new ConflictException({code:"LETTER_TEMPLATE_STALE"});
      if(old&&old.status==="APPROVED"&&old.title===title&&old.body===body)
        throw new BadRequestException("No letter template changes to approve");
      if(old?.status==="APPROVED"){
        await client.query(`
          UPDATE cg19_document_template SET status='WITHDRAWN'
          WHERE id=$1 AND realm_id=$2 AND status='APPROVED'
        `,[old.id,actor.realmId]);
        await client.query(`
          INSERT INTO cg19_template_event(realm_id,template_id,actor_id,action)
          VALUES($1,$2,$3,'WITHDRAWN')
        `,[actor.realmId,old.id,actor.accountId]);
      }
      const created=await client.query<Template>(`
        INSERT INTO cg19_document_template(
          realm_id,template_kind,version,content_sha256,title,body,
          approved_by,status)
        VALUES($1,'PRIVATE_APPROVED_ACCESS_LETTER',$2,$3,$4,$5,$6,'APPROVED')
        RETURNING id,version,title,body,content_sha256,status
      `,[actor.realmId,expected+1,templateHash(title,body),title,body,actor.accountId]);
      await client.query(`
        INSERT INTO cg19_template_command(
          realm_id,actor_id,request_key,request_digest,template_id)
        VALUES($1,$2,$3,$4,$5)
      `,[actor.realmId,actor.accountId,key,digest,created.rows[0].id]);
      await client.query(`
        INSERT INTO cg19_template_event(realm_id,template_id,actor_id,action)
        VALUES($1,$2,$3,'APPROVED')
      `,[actor.realmId,created.rows[0].id,actor.accountId]);
      await client.query("COMMIT");open=false;
      return {status:"APPROVED",version:created.rows[0].version};
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  private async authorizedCase(bearer:string,caseRef:string,revision?:number){
    const source=await this.source.getCurrentCase(bearer,caseRef);
    if(!source.approvedGrantVerified||source.caseStatus!=="OWNER_COMPLETED"||
      (revision!==undefined&&source.proposalRevision!==revision))
      throw new ForbiddenException("The approved access outcome is not verified");
    return source;
  }
  async list(bearer:string,caseRef:string){
    const actor=await this.actor(bearer);
    const source=await this.authorizedCase(bearer,caseRef);
    if(actor.realmId!==source.realmId)throw new ForbiddenException();
    const rows=await this.db.query<Letter>(`
      SELECT * FROM cg19_generated_document
      WHERE realm_id=$1 AND case_id=$2 AND proposal_revision=$3
      ORDER BY issue_revision DESC LIMIT 20
    `,[actor.realmId,caseRef,source.proposalRevision]);
    return {letters:rows.rows.map(publicStatus),caseNumber:source.caseNumber};
  }
  async issue(bearer:string,raw:unknown){
    const data=fields(raw,["caseRef","sourceRevision","requestKey","totp"]);
    if(!isUuid(data.caseRef)||!isUuid(data.requestKey)||
      !Number.isSafeInteger(data.sourceRevision)||Number(data.sourceRevision)<1||
      typeof data.totp!=="string"||!/^[0-9]{6}$/.test(data.totp))
      throw new BadRequestException("Check the private letter request");
    const actor=await this.actor(bearer);
    const source=await this.authorizedCase(bearer,data.caseRef,Number(data.sourceRevision));
    if(source.realmId!==actor.realmId)throw new ForbiddenException();
    const client=await this.db.connect();
    let open=false,row:Letter|undefined;
    try{
      await this.sessions.limitFoundationRootProof(actor);
      await client.query("BEGIN");open=true;
      const root=await client.query(`
        SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
      `,[actor.realmId]);
      if(!root.rowCount)throw new ForbiddenException("Foundation scope is unavailable");
      const current=await client.query<Template>(`
        SELECT id,version,title,body,content_sha256,status
        FROM cg19_document_template
        WHERE realm_id=$1 AND status='APPROVED'
        ORDER BY version DESC LIMIT 1
      `,[actor.realmId]);
      if(!current.rowCount)throw new ServiceUnavailableException(
        "An approved private letter template is required");
      const template=current.rows[0];
      const requestDigest=sha(["LETTER_ISSUE",data.caseRef,source.proposalRevision,
        template.id,template.version]);
      const existing=await client.query<Letter>(`
        SELECT * FROM cg19_generated_document
        WHERE realm_id=$1 AND issued_by=$2 AND issue_key=$3 FOR UPDATE
      `,[actor.realmId,actor.accountId,data.requestKey]);
      if(existing.rowCount){
        if(existing.rows[0].request_digest!==requestDigest)
          throw new ConflictException("This letter request belongs to different content");
        row=existing.rows[0];
        await client.query("COMMIT");open=false;
        return {...publicStatus(row),result:"PREVIOUSLY_CONFIRMED"};
      }
      await this.sessions.requireFreshFoundationRootProof(client,actor,data.totp);
      const active=await client.query(`
        SELECT 1 FROM cg19_generated_document
        WHERE realm_id=$1 AND case_id=$2 AND proposal_revision=$3
          AND state IN('PENDING','VERIFYING','UNKNOWN','ISSUED')
        LIMIT 1
      `,[actor.realmId,data.caseRef,source.proposalRevision]);
      if(active.rowCount)throw new ConflictException(
        "A private letter already exists. Review its status or revoke it before reissuing.");
      const count=await client.query<{next_revision:number}>(`
        SELECT COALESCE(max(issue_revision),0)+1 AS next_revision
        FROM cg19_generated_document
        WHERE realm_id=$1 AND case_id=$2 AND proposal_revision=$3
      `,[actor.realmId,data.caseRef,source.proposalRevision]);
      const issueRevision=Number(count.rows[0].next_revision);
      const id=randomUUID(),objectKey="careganga/private/cg19/"+actor.realmId+
        "/letters/"+id+".pdf";
      const snapshot={caseNumber:source.caseNumber,accountName:source.accountName,
        roleName:source.roleName,issuedAt:new Date().toISOString()};
      const sourceHash=sha(["CG19_LETTER_SOURCE",source.caseRef,
        source.proposalRevision,snapshot]);
      const created=await client.query<Letter>(`
        INSERT INTO cg19_generated_document(
          id,realm_id,case_id,proposal_revision,template_id,template_version,
          issue_revision,source_snapshot,source_sha256,issue_key,request_digest,
          issued_by,state,object_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,'PENDING',$13)
        RETURNING *
      `,[id,actor.realmId,data.caseRef,source.proposalRevision,
        template.id,template.version,issueRevision,JSON.stringify(snapshot),
        sourceHash,data.requestKey,requestDigest,actor.accountId,objectKey]);
      row=created.rows[0];
      await client.query(`
        INSERT INTO cg19_document_event(realm_id,case_id,actor_id,document_id,event_key)
        VALUES($1,$2,$3,$4,'ISSUE_PENDING')
      `,[actor.realmId,data.caseRef,actor.accountId,id]);
      await client.query("COMMIT");open=false;
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
    if(!row)throw new ServiceUnavailableException("The private letter was not recorded");
    return this.reconcile(bearer,row.id);
  }
  async lookupIssue(bearer:string,key:unknown){
    const actor=await this.actor(bearer);
    if(!isUuid(key))throw new BadRequestException("Invalid private letter request");
    const result=await this.db.query<Letter>(`
      SELECT * FROM cg19_generated_document
      WHERE realm_id=$1 AND issued_by=$2 AND issue_key=$3
    `,[actor.realmId,actor.accountId,key]);
    if(!result.rowCount)return {status:"NOT_FOUND",letter:null};
    await this.authorizedCase(bearer,result.rows[0].case_id,
      result.rows[0].proposal_revision);
    return {status:"CONFIRMED",letter:publicStatus(result.rows[0])};
  }
  async reconcile(bearer:string,ref:string){
    if(!isUuid(ref))throw new BadRequestException("Choose a valid private letter");
    const actor=await this.actor(bearer);
    const found=await this.db.query<Letter>(`
      SELECT * FROM cg19_generated_document WHERE id=$1 AND realm_id=$2
    `,[ref,actor.realmId]);
    let row=found.rows[0];
    if(!row)throw new NotFoundException("Private letter unavailable");
    const source=await this.authorizedCase(bearer,row.case_id,row.proposal_revision);
    if(source.realmId!==actor.realmId)throw new ForbiddenException();
    if(row.state==="ISSUED"||row.state==="REVOKED"||row.state==="FAILED")
      return publicStatus(row);
    const claim=randomUUID();
    const claimed=await this.db.query<Letter>(`
      UPDATE cg19_generated_document
      SET state='VERIFYING',claim_token=$3,
        claim_expires_at=now()+interval '2 minutes',
        attempt_count=attempt_count+1
      WHERE id=$1 AND realm_id=$2 AND state IN('PENDING','UNKNOWN','VERIFYING')
        AND attempt_count<5
        AND (claim_expires_at IS NULL OR claim_expires_at<now())
      RETURNING *
    `,[row.id,actor.realmId,claim]);
    if(!claimed.rowCount)return { ...publicStatus(row),
      state:"PENDING_VERIFICATION",canDownload:false,canReconcile:false};
    row=claimed.rows[0];
    try{
      const template=await this.db.query<Template>(`
        SELECT id,version,title,body,content_sha256,status
        FROM cg19_document_template
        WHERE id=$1 AND realm_id=$2 AND version=$3
      `,[row.template_id,actor.realmId,row.template_version]);
      const t=template.rows[0];
      if(!t||t.status!=="APPROVED"||
        t.content_sha256!==templateHash(t.title,t.body))
        throw new ServiceUnavailableException("Approved letter template is unavailable");
      const bytes=await createAccessLetterPdf({...row.source_snapshot,
        issueNumber:row.issue_revision,title:t.title,body:t.body});
      const checksum=createHash("sha256").update(bytes).digest("hex");
      const stored=await this.objects.writeVerifiedPrivateDocument({
        objectKey:row.object_key,bytes,sha256:checksum
      });
      await this.authorizedCase(bearer,row.case_id,row.proposal_revision);
      await this.actor(bearer);
      const client=await this.db.connect();let open=false;
      try{
        await client.query("BEGIN");open=true;
        const updated=await client.query<Letter>(`
          UPDATE cg19_generated_document
          SET state='ISSUED',object_version=$4,content_sha256=$5,
            issued_at=now(),claim_token=NULL,claim_expires_at=NULL
          WHERE id=$1 AND realm_id=$2 AND state='VERIFYING'
            AND claim_token=$3 AND claim_expires_at>now()
          RETURNING *
        `,[row.id,actor.realmId,claim,stored.objectVersion,stored.sha256]);
        if(!updated.rowCount)
          throw new ConflictException("The original letter outcome needs rechecking");
        await client.query(`
          INSERT INTO cg19_document_event(
            realm_id,case_id,actor_id,document_id,event_key)
          VALUES($1,$2,$3,$4,'ISSUED')
        `,[actor.realmId,row.case_id,actor.accountId,row.id]);
        await client.query("COMMIT");open=false;
        return publicStatus(updated.rows[0]);
      }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
      finally{client.release();}
    }catch{
      const client=await this.db.connect();let open=false;
      try{
        await client.query("BEGIN");open=true;
        const unknown=await client.query(`
          UPDATE cg19_generated_document SET state='UNKNOWN',
            claim_token=NULL,claim_expires_at=NULL
          WHERE id=$1 AND realm_id=$2 AND claim_token=$3 AND state='VERIFYING'
          RETURNING id
        `,[row.id,actor.realmId,claim]);
        if(unknown.rowCount){
          await client.query(`
            INSERT INTO cg19_document_event(
              realm_id,case_id,actor_id,document_id,event_key)
            VALUES($1,$2,$3,$4,'ISSUE_UNKNOWN')
          `,[actor.realmId,row.case_id,actor.accountId,row.id]);
        }
        await client.query("COMMIT");open=false;
      }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};}
      finally{client.release();}
      return {documentRef:row.id,state:"UNKNOWN",canDownload:false,
        canReconcile:true,message:"Private letter verification is uncertain; retry the original request."};
    }
  }
  async revoke(bearer:string,ref:string,raw:unknown){
    const body=fields(raw,["totp"]);
    if(!isUuid(ref)||typeof body.totp!=="string"||
      !/^[0-9]{6}$/.test(body.totp))
      throw new BadRequestException("Check letter revocation");
    const actor=await this.actor(bearer,"documents.letters.revoke");
    await this.sessions.limitFoundationRootProof(actor);
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const root=await client.query(`
        SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'
        FOR UPDATE
      `,[actor.realmId]);
      if(!root.rowCount)throw new ForbiddenException();
      const saved=await client.query<Letter>(`
        SELECT * FROM cg19_generated_document
        WHERE realm_id=$1 AND id=$2 FOR UPDATE
      `,[actor.realmId,ref]);
      const row=saved.rows[0];
      if(!row)throw new NotFoundException("Private letter unavailable");
      if(row.state==="REVOKED"){
        await client.query("COMMIT");open=false;
        return publicStatus(row);
      }
      if(row.state!=="ISSUED")throw new ConflictException(
        "Only a confirmed issued letter can be revoked");
      await this.sessions.requireFreshFoundationRootProof(client,actor,body.totp);
      const updated=await client.query<Letter>(`
        UPDATE cg19_generated_document SET state='REVOKED',revoked_at=now()
        WHERE id=$1 AND realm_id=$2 AND state='ISSUED' RETURNING *
      `,[row.id,actor.realmId]);
      if(!updated.rowCount)throw new ConflictException("Letter state changed");
      await client.query(`
        INSERT INTO cg19_document_event(
          realm_id,case_id,actor_id,document_id,event_key)
        VALUES($1,$2,$3,$4,'REVOKED')
      `,[actor.realmId,row.case_id,actor.accountId,row.id]);
      await client.query("COMMIT");open=false;
      return publicStatus(updated.rows[0]);
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  async download(bearer:string,ref:string){
    if(!isUuid(ref))throw new BadRequestException("Choose a valid private letter");
    const actor=await this.actor(bearer,"documents.files.view");
    const rows=await this.db.query<Letter>(`
      SELECT * FROM cg19_generated_document
      WHERE id=$1 AND realm_id=$2 AND state='ISSUED'
        AND revoked_at IS NULL AND object_version IS NOT NULL
        AND content_sha256 IS NOT NULL
    `,[ref,actor.realmId]);
    const row=rows.rows[0];
    if(!row)throw new NotFoundException("Private letter unavailable");
    await this.authorizedCase(bearer,row.case_id,row.proposal_revision);
    const bytes=await this.objects.readVerifiedPrivateObject({
      objectKey:row.object_key,objectVersion:row.object_version!,
      maxBytes:10*1024*1024
    });
    if(!Buffer.isBuffer(bytes)||bytes.length>10*1024*1024||
      createHash("sha256").update(bytes).digest("hex")!==row.content_sha256)
      throw new ServiceUnavailableException("The original private letter is unverified");
    await this.actor(bearer,"documents.files.view");
    await this.authorizedCase(bearer,row.case_id,row.proposal_revision);
    const latest=await this.db.query(`
      SELECT 1 FROM cg19_generated_document WHERE id=$1 AND realm_id=$2
      AND state='ISSUED' AND revoked_at IS NULL
    `,[ref,actor.realmId]);
    if(!latest.rowCount)throw new NotFoundException("Private letter revoked");
    return bytes;
  }
}
