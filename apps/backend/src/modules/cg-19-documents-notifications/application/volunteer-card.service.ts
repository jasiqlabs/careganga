import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,createHmac,randomUUID} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {object,uuid} from "../../cg-04-membership-volunteers/domain/tier-input";
import type {BrandConfig,BrandAsset} from "./member-brand.service";
import {renderVolunteerCard,type VolunteerCardSource,type VerifiedVolunteerBrand} from "./volunteer-card-renderer";
const hash=(s:Buffer|string)=>createHash("sha256").update(s).digest("hex");
const conflict=()=>new ConflictException("Original approved volunteer, Foundation branding or official card changed. Refresh the current record.");
const key=()=>{
 const secret=Buffer.from(process.env.CG19_MEMBER_QR_KEY??"","base64");
 if(secret.length!==32)throw new ServiceUnavailableException("Official volunteer verification is not configured.");
 return secret;
};
const makeToken=(root:string,cardId:string,digest:string)=>
 "CGV-"+createHmac("sha256",key()).update("CAREGANGA-VOLUNTEER-V1:"+root+":"+cardId+":"+digest).digest("hex").slice(0,24).toUpperCase();
type Source=VolunteerCardSource&{volunteerId:string;volunteerVersion:number;rootRealmId:string};
type Card={id:string;root_realm_id:string;volunteer_id:string;brand_version:number;issue_revision:number;issue_key:string;
 issued_by:string;source_snapshot:Source;source_digest:string;qr_token_digest:string;state:string;
 claim_token:string|null;claim_expires_at:Date|null;attempt_count:number;object_key:string;
 object_version:string|null;content_sha256:string|null;created_at:Date;issued_at:Date|null};
type Brand={config:BrandConfig;assets:Record<"SIGNATURE"|"SEAL"|"LOGO",BrandAsset>};
const outward=(v:Card)=>({cardRef:v.id,status:v.state,revision:v.issue_revision,issuedAt:v.issued_at?.toISOString()??null,canDownload:v.state==="ISSUED",canRetry:["PENDING","UNKNOWN"].includes(v.state)});
@Injectable()
export class VolunteerCardService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
 private readonly identity:FoundationStructureIdentityFacade,private readonly objects:PrivateObjectStorage){}
 private async run<T>(work:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");const result=await work(tx);await tx.query("COMMIT");return result;}
  catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async issuer(token:string){
  const actor=await this.sessions.requireAction(token,"volunteers.documents.issue");
  await this.sessions.limitFoundationRootProof(actor);
  return actor;
 }
 private async authorized(tx:PoolClient,a:Actor){
  await this.identity.assertCurrent(tx,a,"volunteers.documents.issue");
  if(!(await tx.query("SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'",[a.realmId])).rowCount)
   throw new ForbiddenException("Protected Foundation volunteer card authority unavailable.");
 }
 private async source(tx:PoolClient,realm:string,volunteerId:string):Promise<Source>{
  const v=(await tx.query<{volunteerId:string;volunteerVersion:number;volunteerNumber:string;name:string;
   branch:string|null;department:string;joinedOn:string}>(`SELECT v.id AS "volunteerId",v.version AS "volunteerVersion",
    v.volunteer_no AS "volunteerNumber",v.display_name AS name,b.name AS branch,d.name AS department,
    (v.created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS "joinedOn"
   FROM volunteer v
   JOIN volunteer_application app ON app.root_realm_id=v.root_realm_id AND app.id=v.original_application_id AND app.status='APPROVED'
   JOIN volunteer_approval_effect effect ON effect.root_realm_id=v.root_realm_id AND effect.volunteer_id=v.id AND effect.application_id=app.id
   JOIN cg03_case review ON review.realm_id=effect.root_realm_id AND review.id=effect.case_id AND review.case_kind='VOLUNTEER_APPLICATION' AND review.status='OWNER_COMPLETED'
   JOIN account actor ON actor.realm_id=v.root_realm_id AND actor.id=v.account_ref AND actor.status='ACTIVE' AND actor.contact_phone_verified_at IS NOT NULL
    AND actor.contact_phone=app.contact_mobile AND actor.normalized_email IS NOT DISTINCT FROM app.contact_email
   JOIN department d ON d.root_realm_id=v.root_realm_id AND d.id=v.department_ref AND d.active AND d.kind='DEPARTMENT'
   LEFT JOIN branch b ON b.root_realm_id=v.root_realm_id AND b.id=v.branch_ref AND b.status='ACTIVE'
   WHERE v.root_realm_id=$1 AND v.id=$2 AND v.status='ACTIVE'
    AND (v.branch_ref IS NULL OR b.id IS NOT NULL)
    AND ((d.scope_kind='FOUNDATION' AND (v.branch_ref IS NULL OR EXISTS(
       SELECT 1 FROM branch_department_link link WHERE link.root_realm_id=v.root_realm_id AND link.branch_id=v.branch_ref
        AND link.foundation_department_id=d.id AND link.ended_at IS NULL)))
      OR (d.scope_kind='BRANCH' AND d.branch_id=v.branch_ref))
    AND EXISTS(SELECT 1 FROM cg19_volunteer_private_file proof
      JOIN volunteer_review_file frozen ON frozen.root_realm_id=proof.realm_id AND frozen.file_id=proof.id
      JOIN cg03_case cg03 ON cg03.realm_id=frozen.root_realm_id AND cg03.volunteer_review_ref=frozen.snapshot_id
      WHERE proof.realm_id=v.root_realm_id AND proof.application_id=app.id AND cg03.id=review.id
       AND frozen.classification='VOLUNTEER_IDENTITY_PROOF' AND proof.scan_status='CLEAN_VERIFIED'
       AND proof.revoked_at IS NULL AND proof.revision=frozen.file_version AND proof.sha256=frozen.sha256)
   LIMIT 1`,[realm,volunteerId])).rows[0];
  if(!v)throw conflict();
  return {...v,rootRealmId:realm};
 }
 private async brand(tx:PoolClient,root:string):Promise<Brand>{
  const config=(await tx.query<BrandConfig>("SELECT * FROM cg19_member_brand_config WHERE root_realm_id=$1 AND status='APPROVED'",[root])).rows[0];
  if(!config)throw new ConflictException("A genuine Foundation logo, signature and seal must be approved before issuing volunteer cards.");
  const items=(await tx.query<BrandAsset>("SELECT * FROM cg19_member_brand_asset WHERE root_realm_id=$1 AND id=ANY($2::uuid[]) AND status='VALIDATED' FOR SHARE",[root,[config.logo_asset_id,config.signature_asset_id,config.seal_asset_id]])).rows;
  const lookup=new Map(items.map(v=>[v.id,v]));
  const logo=lookup.get(config.logo_asset_id),signature=lookup.get(config.signature_asset_id),seal=lookup.get(config.seal_asset_id);
  if(!logo||!signature||!seal||logo.kind!=="LOGO"||signature.kind!=="SIGNATURE"||seal.kind!=="SEAL")
   throw conflict();
  return {config,assets:{LOGO:logo,SIGNATURE:signature,SEAL:seal}};
 }
 private async actual(tx:PoolClient,root:string,ref:string,lock=false){
  const c=(await tx.query<Card>("SELECT * FROM cg19_volunteer_card WHERE root_realm_id=$1 AND id=$2"+(lock?" FOR UPDATE":""),[root,uuid(ref)])).rows[0];
  if(!c)throw new NotFoundException("Official volunteer card unavailable.");
  return c;
 }
 private async check(tx:PoolClient,c:Card){
  const v=await this.source(tx,c.root_realm_id,c.volunteer_id),brand=await this.brand(tx,c.root_realm_id);
  if(brand.config.version!==c.brand_version||hash(JSON.stringify([v,brand.config.version]))!==c.source_digest)throw conflict();
  return {v,brand};
 }
 private async present(tx:PoolClient,c:Card){
  const status=outward(c);
  if(!["ISSUED","PENDING","UNKNOWN"].includes(c.state))return status;
  try{await this.check(tx,c);return status;}
  catch(e){
   // The historical card remains ISSUED/PENDING; current eligibility must never be implied by its status.
   if(e instanceof ConflictException)return {...status,canDownload:false,canRetry:false};
   throw e;
  }
 }
 private async asset(row:BrandAsset){
  if(row.status!=="VALIDATED"||!row.object_version)throw conflict();
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:row.object_key,objectVersion:row.object_version,maxBytes:2097152});
  if(bytes.length!==Number(row.size_bytes)||hash(bytes)!==row.expected_sha256)
   throw new ServiceUnavailableException("Original approved Foundation brand bytes could not be verified.");
  return {bytes,mime:row.mime};
 }
 async issue(token:string,ref:string,raw:unknown){
  const a=await this.issuer(token),volunteerId=uuid(ref),x=object(raw,["requestKey","currentPassword"]),requestKey=uuid(x.requestKey);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)
   throw new BadRequestException("Enter your current Foundation password before issuing an original volunteer card.");
  key();
  const p=await this.run(async tx=>{
   await this.authorized(tx,a);await this.sessions.requireFreshFoundationRootProof(tx,a,x.currentPassword as string);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG19:VOLUNTEERCARD:"+a.realmId+":"+volunteerId]);
   const source=await this.source(tx,a.realmId,volunteerId),brand=await this.brand(tx,a.realmId);
   const digest=hash(JSON.stringify([source,brand.config.version]));
   const replay=(await tx.query<Card>("SELECT * FROM cg19_volunteer_card WHERE root_realm_id=$1 AND issued_by=$2 AND issue_key=$3 FOR UPDATE",[a.realmId,a.accountId,requestKey])).rows[0];
   if(replay){if(replay.volunteer_id!==volunteerId||replay.source_digest!==digest)throw conflict();return replay;}
   const prior=(await tx.query<Card>("SELECT * FROM cg19_volunteer_card WHERE root_realm_id=$1 AND volunteer_id=$2 ORDER BY issue_revision DESC LIMIT 1 FOR UPDATE",[a.realmId,volunteerId])).rows[0];
   if(prior&&prior.state!=="REVOKED")throw new ConflictException("The original volunteer card already exists; refresh its issued status before retrying.");
   const cardId=randomUUID(),revision=(prior?.issue_revision??0)+1,qr=makeToken(a.realmId,cardId,digest);
   const row=(await tx.query<Card>(`INSERT INTO cg19_volunteer_card(root_realm_id,id,volunteer_id,brand_version,issue_revision,issue_key,issued_by,
    source_snapshot,source_digest,qr_token_digest,object_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) RETURNING *`,
    [a.realmId,cardId,volunteerId,brand.config.version,revision,requestKey,a.accountId,JSON.stringify(source),digest,hash(qr),
     "careganga/private/cg19/"+a.realmId+"/volunteer-cards/"+cardId+"/CARD"])).rows[0];
   await tx.query("INSERT INTO cg19_volunteer_card_event(root_realm_id,card_id,actor_ref,action) VALUES($1,$2,$3,'PENDING')",[a.realmId,cardId,a.accountId]);
   return row;
  });
  return this.reconcile(token,p.id);
 }
 async status(token:string,ref:string){
  const a=await this.issuer(token),id=uuid(ref);
  return this.run(async tx=>{await this.authorized(tx,a);
   if(!(await tx.query("SELECT 1 FROM volunteer WHERE root_realm_id=$1 AND id=$2",[a.realmId,id])).rowCount)
    throw new NotFoundException("Volunteer unavailable.");
   const p=(await tx.query<Card>("SELECT * FROM cg19_volunteer_card WHERE root_realm_id=$1 AND volunteer_id=$2 ORDER BY issue_revision DESC LIMIT 1",[a.realmId,id])).rows[0];
   return {card:p?await this.present(tx,p):null};
  });
 }
 async info(token:string,ref:string){
  const a=await this.issuer(token);
  return this.run(async tx=>{await this.authorized(tx,a);return this.present(tx,await this.actual(tx,a.realmId,ref));});
 }
 async mine(token:string){
  const a=await this.sessions.verifySession(token);
  return this.run(async tx=>{
   await this.identity.verifiedCommunityApplicant(tx,a);
   const rows=(await tx.query<Card>(`SELECT card.* FROM cg19_volunteer_card card
    JOIN volunteer v ON v.root_realm_id=card.root_realm_id AND v.id=card.volunteer_id
    WHERE card.root_realm_id=$1 AND v.account_ref=$2 ORDER BY card.created_at DESC,card.id DESC LIMIT 26`,[a.realmId,a.accountId])).rows;
   const items=[];
   for(const card of rows.slice(0,25))items.push(await this.present(tx,card));
   return {items,hasMore:rows.length>25};
  });
 }
 async reconcile(token:string,ref:string){
  const a=await this.issuer(token),id=uuid(ref),claim=randomUUID();
  const state=await this.run(async tx=>{
   await this.authorized(tx,a);
   const p=await this.actual(tx,a.realmId,id,true);
   if(p.state==="REVOKED"||p.state==="ISSUED")return {card:p,claim:false};
   if(p.state==="VERIFYING"&&p.claim_expires_at&&p.claim_expires_at.getTime()>Date.now())return {card:p,claim:false};
   if(p.attempt_count>=5)throw new ConflictException("Official volunteer card issuance needs Foundation support before further attempts.");
   await this.check(tx,p);
   const updated=(await tx.query<Card>(`UPDATE cg19_volunteer_card SET state='VERIFYING',claim_token=$3,claim_expires_at=now()+interval '2 minutes',
    attempt_count=attempt_count+1 WHERE root_realm_id=$1 AND id=$2 RETURNING *`,[a.realmId,id,claim])).rows[0];
   return {card:updated,claim:true};
  });
  if(!state.claim)return this.run(async tx=>{
   await this.authorized(tx,a);
   return this.present(tx,await this.actual(tx,a.realmId,id));
  });
  const p=state.card;
  try{
   const proof=await this.run(async tx=>{
    await this.authorized(tx,a);
    const c=await this.actual(tx,a.realmId,p.id);
    if(c.claim_token!==claim||c.state!=="VERIFYING")throw conflict();
    return this.check(tx,c);
   });
   const [logo,signature,seal]=await Promise.all([
    this.asset(proof.brand.assets.LOGO),this.asset(proof.brand.assets.SIGNATURE),this.asset(proof.brand.assets.SEAL)]);
   const brand:VerifiedVolunteerBrand={displayName:proof.brand.config.display_name,signatoryName:proof.brand.config.signatory_name,
    logo,signature,seal};
   const qr=makeToken(p.root_realm_id,p.id,p.source_digest);
   const subject="CG19-VOLUNTEER:"+p.id+":"+p.source_digest+":CARD";
   let verified:{objectVersion:string;sha256:string}|null=null;
   try{
    const existing=await this.objects.reconcileIssuedPrivateDocument({objectKey:p.object_key,maxBytes:10485760});
    const bytes=await this.objects.readVerifiedPrivateObject({objectKey:p.object_key,objectVersion:existing.objectVersion,maxBytes:10485760});
    const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
    if(hash(bytes)!==existing.sha256||pdf.getSubject()!==subject)throw conflict();
    verified=existing;
   }catch(e){if(e instanceof ConflictException)throw e;}
   if(!verified){
    const bytes=await renderVolunteerCard({source:p.source_snapshot,brand,code:qr,cardRef:p.id,sourceDigest:p.source_digest,createdAt:p.created_at});
    const sha=hash(bytes);
    try{
     const stored=await this.objects.writeVerifiedPrivateDocument({objectKey:p.object_key,bytes,sha256:sha});
     if(stored.sha256!==sha||!stored.objectVersion)throw conflict();
     verified=stored;
    }catch{
     const recovered=await this.objects.reconcileIssuedPrivateDocument({objectKey:p.object_key,maxBytes:10485760});
     const old=await this.objects.readVerifiedPrivateObject({objectKey:p.object_key,objectVersion:recovered.objectVersion,maxBytes:10485760});
     const pdf=await PDFDocument.load(old,{updateMetadata:false});
     if(recovered.sha256!==hash(old)||pdf.getSubject()!==subject)throw conflict();
     verified=recovered;
    }
   }
   if(!verified)throw conflict();
   const verifiedDocument=verified;
   return this.run(async tx=>{
    await this.authorized(tx,a);
    const current=await this.actual(tx,a.realmId,p.id,true);
    if(current.state!=="VERIFYING"||current.claim_token!==claim||!current.claim_expires_at||current.claim_expires_at.getTime()<=Date.now())throw conflict();
    await this.check(tx,current);
    const done=(await tx.query<Card>(`UPDATE cg19_volunteer_card SET state='ISSUED',issued_at=now(),object_version=$3,content_sha256=$4,
     claim_token=NULL,claim_expires_at=NULL WHERE root_realm_id=$1 AND id=$2 AND state='VERIFYING' RETURNING *`,
     [a.realmId,p.id,verifiedDocument.objectVersion,verifiedDocument.sha256])).rows[0];
    await tx.query("INSERT INTO cg19_volunteer_card_event(root_realm_id,card_id,actor_ref,action) VALUES($1,$2,$3,'ISSUED')",[a.realmId,p.id,a.accountId]);
    return outward(done);
   });
  }catch{
   return this.run(async tx=>{
    await this.authorized(tx,a);
    const latest=(await tx.query<Card>(`UPDATE cg19_volunteer_card SET state='UNKNOWN',claim_token=NULL,claim_expires_at=NULL
     WHERE root_realm_id=$1 AND id=$2 AND state='VERIFYING' AND claim_token=$3 RETURNING *`,[a.realmId,p.id,claim])).rows[0];
    if(latest){await tx.query("INSERT INTO cg19_volunteer_card_event(root_realm_id,card_id,actor_ref,action) VALUES($1,$2,$3,'UNKNOWN')",[a.realmId,p.id,a.accountId]);return outward(latest);}
    return outward(await this.actual(tx,a.realmId,p.id));
   });
  }
 }
 async revoke(token:string,ref:string,raw:unknown){
  const a=await this.issuer(token),x=object(raw,["currentPassword"]),id=uuid(ref);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)
   throw new BadRequestException("Enter current Foundation password to revoke original volunteer card.");
  return this.run(async tx=>{
   await this.authorized(tx,a);await this.sessions.requireFreshFoundationRootProof(tx,a,x.currentPassword as string);
   const p=await this.actual(tx,a.realmId,id,true);
   if(p.state==="REVOKED")return outward(p);
   if(p.state==="VERIFYING"&&p.claim_expires_at&&p.claim_expires_at.getTime()>Date.now())throw new ConflictException("Original card verification is underway; check current status.");
   const done=(await tx.query<Card>(`UPDATE cg19_volunteer_card SET state='REVOKED',revoked_at=now(),claim_token=NULL,claim_expires_at=NULL
    WHERE root_realm_id=$1 AND id=$2 RETURNING *`,[a.realmId,id])).rows[0];
   await tx.query("INSERT INTO cg19_volunteer_card_event(root_realm_id,card_id,actor_ref,action) VALUES($1,$2,$3,'REVOKED')",[a.realmId,id,a.accountId]);
   return outward(done);
  });
 }
 async download(token:string,ref:string){
  const actor=await this.sessions.verifySession(token),id=uuid(ref);
  const current=async()=>{
   return this.run(async tx=>{
    const p=await this.actual(tx,actor.realmId,id);
    if(!p.object_version||!p.content_sha256||p.state!=="ISSUED")throw new NotFoundException("Official volunteer card was not issued.");
    let own=false;
    try{await this.identity.verifiedCommunityApplicant(tx,actor);own=true;}catch{}
    if(own){
     if(!(await tx.query("SELECT 1 FROM volunteer WHERE root_realm_id=$1 AND id=$2 AND account_ref=$3",[actor.realmId,p.volunteer_id,actor.accountId])).rowCount)
      throw new NotFoundException("Official volunteer card unavailable.");
    }else await this.authorized(tx,actor);
    await this.check(tx,p);return p;
   });
  };
  const before=await current();
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:before.object_key,objectVersion:before.object_version!,maxBytes:10485760});
  if(hash(bytes)!==before.content_sha256)throw new ServiceUnavailableException("Original issued volunteer card bytes changed.");
  const after=await current();
  if(after.object_version!==before.object_version||after.content_sha256!==before.content_sha256)throw conflict();
  return bytes;
 }
 async verify(code:string){
  if(!/^CGV-[A-F0-9]{24}$/.test(code))return {valid:false,status:"NOT_VALID"};
  key(); // An unavailable QR signing key is a service outage, not an invalid volunteer.
  const digest=hash(code);
  try{
   const valid=await this.run(async tx=>{
    const card=(await tx.query<Card>("SELECT * FROM cg19_volunteer_card WHERE qr_token_digest=$1 AND state='ISSUED' LIMIT 1",[digest])).rows[0];
    if(!card||makeToken(card.root_realm_id,card.id,card.source_digest)!==code)return false;
    await this.check(tx,card);
    return !!card.object_version&&!!card.content_sha256;
   });
   return valid?{valid:true,status:"ACTIVE"}:{valid:false,status:"NOT_VALID"};
  }catch(e){
   if(e instanceof ConflictException||e instanceof NotFoundException)return {valid:false,status:"NOT_VALID"};
   throw new ServiceUnavailableException("Current official volunteer verification is temporarily unavailable.");
  }
 }
}
