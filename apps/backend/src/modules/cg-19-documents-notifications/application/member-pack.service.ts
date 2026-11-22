import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,createHmac,randomUUID} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {object,uuid} from "../../cg-04-membership-volunteers/domain/tier-input";
import {MemberBrandService,type BrandAsset,type BrandConfig} from "./member-brand.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {renderMemberPackDocument,type MemberDocumentKind,type MemberPackSource,type VerifiedMemberBrand} from "./member-pack-renderer";

const hash=(input:string|Buffer)=>createHash("sha256").update(input).digest("hex");
const kinds=["CARD","CERTIFICATE","WELCOME"] as const;
const changed=()=>new ConflictException("The original membership eligibility or approved documents changed. Refresh before continuing.");
type MemberSource=MemberPackSource&{memberId:string;termId:string;memberVersion:number;realmId:string};
type Pack={id:string;root_realm_id:string;member_id:string;term_id:string;brand_version:number;issue_revision:number;issue_key:string;issued_by:string;source_snapshot:MemberSource;source_digest:string;qr_token_digest:string;state:string;claim_token:string|null;claim_expires_at:Date|null;attempt_count:number;created_at:Date;issued_at:Date|null};
type Document={kind:MemberDocumentKind;object_key:string;object_version:string|null;content_sha256:string|null;state:string};
type BrandRow=BrandConfig&{signature:BrandAsset;seal:BrandAsset;logo:BrandAsset};
type BrandProof={config:BrandConfig;assets:Record<"SIGNATURE"|"SEAL"|"LOGO",BrandAsset>};
const qrKey=()=>{
 const key=Buffer.from(process.env.CG19_MEMBER_QR_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException("Official member card verification has not been configured.");
 return key;
};
const makeToken=(realm:string,packId:string,digest:string)=>{
 return "CGV-"+createHmac("sha256",qrKey()).update("CAREGANGA-MEMBER-V1:"+realm+":"+packId+":"+digest).digest("hex").slice(0,24).toUpperCase();
};
const outward=(p:Pack)=>({packRef:p.id,status:p.state,issueRevision:p.issue_revision,issuedAt:p.issued_at?.toISOString()??null,canDownload:p.state==="ISSUED",canRetry:["PENDING","UNKNOWN"].includes(p.state)});

@Injectable()
export class MemberPackService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly brandService:MemberBrandService,
  private readonly objects:PrivateObjectStorage){}
 private async transaction<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");const result=await fn(tx);await tx.query("COMMIT");return result;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async issuer(token:string){
  const actor=await this.brandService.actor(token);
  return actor;
 }
 private async authorizedIssuer(tx:PoolClient,a:Actor){
  await this.identity.assertCurrent(tx,a,"membership.documents.issue");
  if(!(await tx.query("SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'",[a.realmId])).rowCount)
   throw new ForbiddenException("Authorized Foundation documents are not available.");
 }
 private async source(tx:PoolClient,realm:string,memberId:string):Promise<MemberSource>{
  const row=(await tx.query<{
   memberId:string;termId:string;memberVersion:number;memberNumber:string;name:string;
   branch:string|null;plan:string;category:string;feeMinor:string;currency:"INR";
   startsOn:string;expiresOn:string|null;
  }>([
   'SELECT m.id AS "memberId",t.id AS "termId",m.version AS "memberVersion",m.member_no AS "memberNumber",',
   'm.display_name AS name,b.name AS branch,v.name AS plan,v.category,t.fee_minor::text AS "feeMinor",',
   't.currency,t.starts_on::text AS "startsOn",t.expires_on::text AS "expiresOn"',
   'FROM member m',
   'JOIN membership_term t ON t.root_realm_id=m.root_realm_id AND t.member_id=m.id',
   'JOIN membership_tier_version v ON v.root_realm_id=t.root_realm_id AND v.id=t.tier_version_id',
   'JOIN membership_application_effect eff ON eff.root_realm_id=t.root_realm_id AND eff.term_id=t.id AND eff.member_id=m.id',
   "JOIN cg03_case c ON c.realm_id=eff.root_realm_id AND c.id=eff.case_id AND c.status='OWNER_COMPLETED'",
   'LEFT JOIN branch b ON b.root_realm_id=m.root_realm_id AND b.id=m.branch_ref',
   "WHERE m.root_realm_id=$1 AND m.id=$2 AND m.status='ACTIVE'",
   "AND t.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date",
   "AND (t.expires_on IS NULL OR t.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date)",
   "AND (t.fee_minor=0 OR EXISTS(SELECT 1 FROM finance_membership_verified_collection paid",
   "WHERE paid.root_realm_id=t.root_realm_id AND paid.application_id=t.original_application_id AND paid.amount_minor=t.fee_minor))",
   "AND NOT EXISTS(SELECT 1 FROM finance_membership_verified_refund refund",
   "WHERE refund.root_realm_id=t.root_realm_id AND refund.application_id=t.original_application_id)",
   "ORDER BY t.starts_on DESC,t.id DESC LIMIT 1"
  ].join(" "),[realm,memberId])).rows[0];
  if(!row)throw changed();
  return {...row,realmId:realm};
 }
 private async brand(tx:PoolClient,realm:string):Promise<BrandProof>{
  const b=(await tx.query<BrandConfig>(
   "SELECT * FROM cg19_member_brand_config WHERE root_realm_id=$1 AND status='APPROVED'",
   [realm])).rows[0];
  if(!b)throw new ConflictException("Approve genuine Foundation logo, signature and seal before issuing documents.");
  const list=(await tx.query<BrandAsset>(
   "SELECT * FROM cg19_member_brand_asset WHERE root_realm_id=$1 AND id=ANY($2::uuid[]) AND status='VALIDATED' FOR SHARE",
   [realm,[b.signature_asset_id,b.seal_asset_id,b.logo_asset_id]])).rows;
  const lookup=new Map(list.map(row=>[row.id,row]));
  const signature=lookup.get(b.signature_asset_id),seal=lookup.get(b.seal_asset_id),logo=lookup.get(b.logo_asset_id);
  if(!signature||!seal||!logo||signature.kind!=="SIGNATURE"||seal.kind!=="SEAL"||logo.kind!=="LOGO")
   throw new ConflictException("The approved Foundation brand assets are not verified.");
  return {config:b,assets:{SIGNATURE:signature,SEAL:seal,LOGO:logo}};
 }
 private async pack(tx:PoolClient,realm:string,ref:string,lock=false):Promise<Pack>{
  const p=(await tx.query<Pack>(
   "SELECT * FROM cg19_member_pack WHERE root_realm_id=$1 AND id=$2"+(lock?" FOR UPDATE":""),
   [realm,uuid(ref)])).rows[0];
  if(!p)throw new NotFoundException("Official member document is unavailable.");
  return p;
 }
 private async checkCurrent(tx:PoolClient,p:Pack){
  const source=await this.source(tx,p.root_realm_id,p.member_id);
  const brand=await this.brand(tx,p.root_realm_id);
  if(source.termId!==p.term_id||brand.config.version!==p.brand_version||hash(JSON.stringify([source,brand.config.version]))!==p.source_digest)
   throw changed();
  return {source,brand};
 }
 async issue(token:string,ref:string,raw:unknown){
  const a=await this.issuer(token),id=uuid(ref),x=object(raw,["requestKey","currentPassword"]),key=uuid(x.requestKey);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)
   throw new BadRequestException("Enter your current Foundation password to issue official documents.");
  qrKey();
  const pack=await this.transaction(async tx=>{
   await this.authorizedIssuer(tx,a);
   await this.sessions.requireFreshFoundationRootProof(tx,a,x.currentPassword as string);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG19:MEMBERPACK:"+a.realmId+":"+id]);
   const member=await this.source(tx,a.realmId,id),brand=await this.brand(tx,a.realmId);
   const digest=hash(JSON.stringify([member,brand.config.version]));
   const existing=(await tx.query<Pack>(
    "SELECT * FROM cg19_member_pack WHERE root_realm_id=$1 AND issued_by=$2 AND issue_key=$3 FOR UPDATE",
    [a.realmId,a.accountId,key])).rows[0];
   if(existing){if(existing.member_id!==id||existing.source_digest!==digest)throw changed();return existing;}
   const previous=(await tx.query<Pack>(
    "SELECT * FROM cg19_member_pack WHERE root_realm_id=$1 AND member_id=$2 AND term_id=$3 ORDER BY issue_revision DESC LIMIT 1 FOR UPDATE",
    [a.realmId,id,member.termId])).rows[0];
   if(previous&&previous.state!=="REVOKED")throw new ConflictException("An original member document pack already exists. Open or retry the current issue instead.");
   const rev=(previous?.issue_revision??0)+1,packId=randomUUID();
   const tokenQr=makeToken(a.realmId,packId,digest);
   const row=(await tx.query<Pack>(
    'INSERT INTO cg19_member_pack(root_realm_id,id,member_id,term_id,brand_version,issue_revision,issue_key,issued_by,source_snapshot,source_digest,qr_token_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) RETURNING *',
    [a.realmId,packId,id,member.termId,brand.config.version,rev,key,a.accountId,JSON.stringify(member),digest,hash(tokenQr)])).rows[0];
   for(const kind of kinds)await tx.query(
    'INSERT INTO cg19_member_pack_document(root_realm_id,pack_id,kind,object_key) VALUES($1,$2,$3,$4)',
    [a.realmId,packId,kind,"careganga/private/cg19/"+a.realmId+"/member-packs/"+packId+"/"+kind]);
   await tx.query("INSERT INTO cg19_member_pack_event(root_realm_id,pack_id,actor_ref,action) VALUES($1,$2,$3,'PENDING')",[a.realmId,packId,a.accountId]);
   return row;
  });
  return this.reconcile(token,pack.id);
 }
 async info(token:string,ref:string){
  const a=await this.issuer(token);
  return this.transaction(async tx=>{await this.authorizedIssuer(tx,a);const p=await this.pack(tx,a.realmId,ref);return outward(p);});
 }
 async memberStatus(token:string,ref:string){
  const a=await this.issuer(token),id=uuid(ref);
  return this.transaction(async tx=>{
   await this.authorizedIssuer(tx,a);
   if(!(await tx.query("SELECT 1 FROM member WHERE root_realm_id=$1 AND id=$2",[a.realmId,id])).rowCount)
    throw new NotFoundException("Member unavailable.");
   const p=(await tx.query<Pack>(
    "SELECT * FROM cg19_member_pack WHERE root_realm_id=$1 AND member_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1",
    [a.realmId,id])).rows[0];
   return {pack:p?outward(p):null};
  });
 }
 async mine(token:string){
  const a=await this.sessions.verifySession(token);
  return this.transaction(async tx=>{
   await this.identity.verifiedCommunityApplicant(tx,a);
   const rows=(await tx.query<Pack>(
    "SELECT p.* FROM cg19_member_pack p JOIN member m ON m.root_realm_id=p.root_realm_id AND m.id=p.member_id WHERE p.root_realm_id=$1 AND m.account_ref=$2 ORDER BY p.created_at DESC,p.id DESC LIMIT 26",
    [a.realmId,a.accountId])).rows;
   return {items:rows.slice(0,25).map(outward),hasMore:rows.length>25};
  });
 }
 private async readAsset(row:BrandAsset){
  if(row.status!=="VALIDATED"||!row.object_version)throw changed();
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:row.object_key,objectVersion:row.object_version,maxBytes:2097152});
  if(bytes.length!==Number(row.size_bytes)||hash(bytes)!==row.expected_sha256)throw new ServiceUnavailableException("Approved Foundation branding bytes changed.");
  return {bytes,mime:row.mime};
 }
 async reconcile(token:string,ref:string){
  const a=await this.issuer(token),id=uuid(ref),claim=randomUUID();
  const state=await this.transaction(async tx=>{
   await this.authorizedIssuer(tx,a);
   const p=await this.pack(tx,a.realmId,id,true);
   if(p.state==="REVOKED"||p.state==="ISSUED")return {p,claimed:false};
   if(p.state==="VERIFYING"&&p.claim_expires_at&&p.claim_expires_at.getTime()>Date.now())return {p,claimed:false};
   if(p.attempt_count>=5)throw new ConflictException("Official document needs Foundation support review before further retries.");
   await this.checkCurrent(tx,p);
   const updated=(await tx.query<Pack>(
    "UPDATE cg19_member_pack SET state='VERIFYING',claim_token=$3,claim_expires_at=now()+interval '2 minutes',attempt_count=attempt_count+1 WHERE root_realm_id=$1 AND id=$2 RETURNING *",
    [a.realmId,id,claim])).rows[0];
   return {p:updated,claimed:true};
  });
  if(!state.claimed)return outward(state.p);
  const p=state.p;
  try{
   const proof=await this.transaction(async tx=>{
    await this.authorizedIssuer(tx,a);const current=await this.pack(tx,a.realmId,p.id);
    if(current.claim_token!==claim||current.state!=="VERIFYING")throw changed();
    const {brand}=await this.checkCurrent(tx,current);
    const docs=(await tx.query<Document>(
     "SELECT kind,object_key,object_version,content_sha256,state FROM cg19_member_pack_document WHERE root_realm_id=$1 AND pack_id=$2 ORDER BY kind",
     [a.realmId,p.id])).rows;
    if(docs.length!==3||kinds.some(k=>!docs.some(d=>d.kind===k)))throw changed();
    return {brand,docs};
   });
   const logo=await this.readAsset(proof.brand.assets.LOGO),signature=await this.readAsset(proof.brand.assets.SIGNATURE),seal=await this.readAsset(proof.brand.assets.SEAL);
   const source=p.source_snapshot;
   const visible:MemberPackSource={memberNumber:source.memberNumber,name:source.name,plan:source.plan,category:source.category,branch:source.branch,startsOn:source.startsOn,expiresOn:source.expiresOn,feeMinor:source.feeMinor,currency:source.currency};
   const brand:VerifiedMemberBrand={displayName:proof.brand.config.display_name,signatoryName:proof.brand.config.signatory_name,logo,signature,seal};
   const tokenQr=makeToken(a.realmId,p.id,p.source_digest);
   if(hash(tokenQr)!==p.qr_token_digest)throw changed();
   const output:Array<{kind:MemberDocumentKind;objectVersion:string;sha256:string}>=[];
   for(const kind of kinds){
    const doc=proof.docs.find(d=>d.kind===kind)!;
    const subject="CG19-MEMBER:"+p.id+":"+p.source_digest+":"+kind;
    let verified:{objectVersion:string;sha256:string;sizeBytes?:number}|null=null;
    try{
     const prior=await this.objects.reconcileIssuedPrivateDocument({objectKey:doc.object_key,maxBytes:10485760});
     const bytes=await this.objects.readVerifiedPrivateObject({objectKey:doc.object_key,objectVersion:prior.objectVersion,maxBytes:10485760});
     const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
     if(prior.sha256!==hash(bytes)||pdf.getSubject()!==subject)throw changed();
     verified=prior;
    }catch(e){if(e instanceof ConflictException)throw e;}
    if(!verified){
     const bytes=await renderMemberPackDocument({kind,source:visible,brand,token:tokenQr,packRef:p.id,sourceDigest:p.source_digest,issueRevision:p.issue_revision,createdAt:p.created_at});
     const digest=hash(bytes);
     try{const written=await this.objects.writeVerifiedPrivateDocument({objectKey:doc.object_key,bytes,sha256:digest});
      if(written.sha256!==digest||!written.objectVersion)throw changed();
      verified=written;
     }catch{
      const recovered=await this.objects.reconcileIssuedPrivateDocument({objectKey:doc.object_key,maxBytes:10485760});
      const data=await this.objects.readVerifiedPrivateObject({objectKey:doc.object_key,objectVersion:recovered.objectVersion,maxBytes:10485760});
      const pdf=await PDFDocument.load(data,{updateMetadata:false});
      if(recovered.sha256!==hash(data)||pdf.getSubject()!==subject)throw changed();
      verified=recovered;
     }
    }
    output.push({kind,objectVersion:verified.objectVersion,sha256:verified.sha256});
   }
   return await this.transaction(async tx=>{
    await this.authorizedIssuer(tx,a);const current=await this.pack(tx,a.realmId,p.id,true);
    if(current.state!=="VERIFYING"||current.claim_token!==claim||!current.claim_expires_at||current.claim_expires_at.getTime()<=Date.now())throw changed();
    await this.checkCurrent(tx,current);
    for(const proof of output)await tx.query(
     "UPDATE cg19_member_pack_document SET state='ISSUED',object_version=$4,content_sha256=$5 WHERE root_realm_id=$1 AND pack_id=$2 AND kind=$3 AND state='PENDING'",
     [a.realmId,p.id,proof.kind,proof.objectVersion,proof.sha256]);
    const count=(await tx.query<{n:string}>("SELECT count(*)::text AS n FROM cg19_member_pack_document WHERE root_realm_id=$1 AND pack_id=$2 AND state='ISSUED'",[a.realmId,p.id])).rows[0];
    if(Number(count.n)!==3)throw changed();
    const done=(await tx.query<Pack>(
     "UPDATE cg19_member_pack SET state='ISSUED',issued_at=now(),claim_token=NULL,claim_expires_at=NULL WHERE root_realm_id=$1 AND id=$2 RETURNING *",
     [a.realmId,p.id])).rows[0];
    await tx.query("INSERT INTO cg19_member_pack_event(root_realm_id,pack_id,actor_ref,action) VALUES($1,$2,$3,'ISSUED')",[a.realmId,p.id,a.accountId]);
    return outward(done);
   });
  }catch{
   return this.transaction(async tx=>{
    await this.authorizedIssuer(tx,a);
    const updated=(await tx.query<Pack>(
     "UPDATE cg19_member_pack SET state='UNKNOWN',claim_token=NULL,claim_expires_at=NULL WHERE root_realm_id=$1 AND id=$2 AND state='VERIFYING' AND claim_token=$3 RETURNING *",
     [a.realmId,p.id,claim])).rows[0];
    if(updated){await tx.query("INSERT INTO cg19_member_pack_event(root_realm_id,pack_id,actor_ref,action) VALUES($1,$2,$3,'UNKNOWN')",[a.realmId,p.id,a.accountId]);return outward(updated);}
    return outward(await this.pack(tx,a.realmId,p.id));
   });
  }
 }
 async revoke(token:string,ref:string,raw:unknown){
  const a=await this.issuer(token),id=uuid(ref),x=object(raw,["currentPassword"]);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)throw new BadRequestException("Enter your current password.");
  return this.transaction(async tx=>{
   await this.authorizedIssuer(tx,a);await this.sessions.requireFreshFoundationRootProof(tx,a,x.currentPassword as string);
   const p=await this.pack(tx,a.realmId,id,true);
   if(p.state==="REVOKED")return outward(p);
   if(p.state==="VERIFYING"&&p.claim_expires_at&&p.claim_expires_at.getTime()>Date.now())throw new ConflictException("An official issue is being verified. Refresh before revoking.");
   const updated=(await tx.query<Pack>("UPDATE cg19_member_pack SET state='REVOKED',revoked_at=now(),claim_token=NULL,claim_expires_at=NULL WHERE root_realm_id=$1 AND id=$2 RETURNING *",[a.realmId,p.id])).rows[0];
   await tx.query("INSERT INTO cg19_member_pack_event(root_realm_id,pack_id,actor_ref,action) VALUES($1,$2,$3,'REVOKED')",[a.realmId,p.id,a.accountId]);
   return outward(updated);
  });
 }
 async download(token:string,ref:string,rawKind:string){
  const id=uuid(ref);
  if(!kinds.includes(rawKind as MemberDocumentKind))throw new NotFoundException("Official document unavailable.");
  const kind=rawKind as MemberDocumentKind,actor=await this.sessions.verifySession(token);
  const fetchProof=async()=>{
   return this.transaction(async tx=>{
    let own=false;
    try{await this.identity.verifiedCommunityApplicant(tx,actor);own=true;}catch{}
    if(!own)await this.authorizedIssuer(tx,actor);
    const p=await this.pack(tx,actor.realmId,id);
    if(own){
     if(!(await tx.query("SELECT 1 FROM member WHERE root_realm_id=$1 AND id=$2 AND account_ref=$3",[actor.realmId,p.member_id,actor.accountId])).rowCount)
      throw new NotFoundException("Official document unavailable.");
    }
    if(p.state!=="ISSUED")throw new NotFoundException("Official document not issued.");
    await this.checkCurrent(tx,p);
    const doc=(await tx.query<Document>("SELECT kind,object_key,object_version,content_sha256,state FROM cg19_member_pack_document WHERE root_realm_id=$1 AND pack_id=$2 AND kind=$3",[actor.realmId,id,kind])).rows[0];
    if(!doc||doc.state!=="ISSUED"||!doc.object_version||!doc.content_sha256)throw new NotFoundException("Verified official document unavailable.");
    return doc;
   });
  };
  const doc=await fetchProof();
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:doc.object_key,objectVersion:doc.object_version!,maxBytes:10485760});
  if(hash(bytes)!==doc.content_sha256)throw new ServiceUnavailableException("Official document bytes could not be verified.");
  const latest=await fetchProof();
  if(latest.content_sha256!==doc.content_sha256||latest.object_version!==doc.object_version)throw changed();
  return bytes;
 }
 async verify(rawToken:string){
  if(!/^CGV-[A-F0-9]{24}$/.test(rawToken))return {valid:false,status:"NOT_VALID"};
  const digest=hash(rawToken);
  try{
   const value=await this.transaction(async tx=>{
    const p=(await tx.query<Pack>(
     "SELECT * FROM cg19_member_pack WHERE qr_token_digest=$1 AND state='ISSUED' LIMIT 1",
     [digest])).rows[0];
    if(!p||makeToken(p.root_realm_id,p.id,p.source_digest)!==rawToken)return false;
    // Current source checks include the genuine current term, protected approval,
    // original verified fee and absence of a verified refund, plus active branding.
    await this.checkCurrent(tx,p);
    const docs=(await tx.query<{count:string}>(
     "SELECT count(*)::text AS count FROM cg19_member_pack_document WHERE root_realm_id=$1 AND pack_id=$2 AND state='ISSUED'",
     [p.root_realm_id,p.id])).rows[0];
    return Number(docs?.count)===3;
   });
   return value?{valid:true,status:"ACTIVE"}:{valid:false,status:"NOT_VALID"};
  }catch{return {valid:false,status:"NOT_VALID"};}
 }
}
