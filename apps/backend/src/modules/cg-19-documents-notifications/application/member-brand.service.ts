import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {object,plain,uuid} from "../../cg-04-membership-volunteers/domain/tier-input";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

export type BrandAsset={id:string;root_realm_id:string;kind:"SIGNATURE"|"SEAL"|"LOGO";mime:string;size_bytes:string;expected_sha256:string;object_key:string;object_version:string|null;scan_proof_ref:string|null;status:string;reserved_until:Date;verified_at:Date|null;requested_by:string;request_key:string};
export type BrandConfig={root_realm_id:string;version:number;display_name:string;signatory_name:string;signature_asset_id:string;seal_asset_id:string;logo_asset_id:string;status:string;approved_at:Date;request_digest:string};
const checksum=(data:unknown)=>createHash("sha256").update(JSON.stringify(data)).digest("hex");
const safe=()=>new ConflictException("Verified Foundation branding changed. Refresh and review the actual approved assets.");
@Injectable()
export class MemberBrandService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly objects:PrivateObjectStorage){}
 async actor(token:string){
  const a=await this.sessions.requireAction(token,"membership.documents.issue");
  await this.sessions.limitFoundationRootProof(a);return a;
 }
 private async run<T>(a:Actor,work:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   await this.identity.assertCurrent(tx,a,"membership.documents.issue");
   if(!(await tx.query("SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT'",[a.realmId])).rowCount)throw new ForbiddenException("Foundation document authority unavailable.");
   const result=await work(tx);await tx.query("COMMIT");return result;
  }catch(e){try{await tx.query("ROLLBACK");}catch{};throw e;}finally{tx.release();}
 }
 private info(row:BrandAsset){
  return {assetRef:row.id,kind:row.kind,status:row.status==="INITIATED"&&row.reserved_until.getTime()<Date.now()?"EXPIRED":row.status,verified:row.status==="VALIDATED"};
 }
 async initiate(token:string,raw:unknown){
  const a=await this.actor(token),x=object(raw,["kind","requestKey","mime","sizeBytes","sha256"]),key=uuid(x.requestKey);
  if(!["LOGO","SIGNATURE","SEAL"].includes(String(x.kind))||!["image/png","image/jpeg"].includes(String(x.mime))||typeof x.sha256!=="string"||!/^[a-f0-9]{64}$/.test(x.sha256)||!Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||Number(x.sizeBytes)>2097152)
   throw new BadRequestException("Select a PNG or JPG approved Foundation brand image under 2 MB.");
  const kind=x.kind as BrandAsset["kind"],mime=x.mime as string,bytes=Number(x.sizeBytes),sha=x.sha256;
  const original=await this.run(a,async tx=>{
   const prior=(await tx.query<BrandAsset>("SELECT * FROM cg19_member_brand_asset WHERE root_realm_id=$1 AND requested_by=$2 AND request_key=$3 FOR SHARE",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.kind!==kind||prior.mime!==mime||Number(prior.size_bytes)!==bytes||prior.expected_sha256!==sha)throw safe();return prior;}
   const row=(await tx.query<BrandAsset>(`INSERT INTO cg19_member_brand_asset(root_realm_id,kind,requested_by,request_key,mime,size_bytes,expected_sha256,object_key,reserved_until)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '15 minutes') RETURNING *`,
    [a.realmId,kind,a.accountId,key,mime,bytes,sha,"careganga/private/cg19/"+a.realmId+"/member-brand/"+randomUUID()])).rows[0];
   await tx.query("INSERT INTO cg19_member_brand_event(root_realm_id,actor_ref,asset_id,action) VALUES($1,$2,$3,'UPLOAD_INITIATED')",[a.realmId,a.accountId,row.id]);
   return row;
  });
  if(original.status==="VALIDATED")return this.info(original);
  if(original.status!=="INITIATED"||original.reserved_until.getTime()<=Date.now())return this.info(original);
  try{
   const grant=await this.objects.reservePrivateUpload({objectKey:original.object_key,requestKey:key,mime,sizeBytes:bytes,sha256:sha,expiresAt:original.reserved_until.toISOString()});
   const url=new URL(grant.url),expiry=Date.parse(grant.expiresAt);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||!Number.isFinite(expiry)||expiry<=Date.now()||expiry>original.reserved_until.getTime()||
    grant.headers["Content-Type"]!==mime||!Object.entries(grant.headers).every(([k,v])=>["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))
    throw Error("Private upload reservation invalid");
   return {...this.info(original),status:"UPLOAD_READY",uploadUrl:grant.url,uploadHeaders:grant.headers};
  }catch{return {...this.info(original),status:"STORAGE_UNAVAILABLE"};}
 }
 async assetStatus(token:string,ref:string){
  const a=await this.actor(token),id=uuid(ref);
  return this.run(a,async tx=>{
   const asset=(await tx.query<BrandAsset>("SELECT * FROM cg19_member_brand_asset WHERE root_realm_id=$1 AND id=$2",[a.realmId,id])).rows[0];
   if(!asset)throw new NotFoundException("Foundation branding asset is unavailable.");
   return this.info(asset);
  });
 }
 async confirm(token:string,ref:string){
  const a=await this.actor(token),id=uuid(ref);
  const row=await this.run(a,async tx=>{
   const asset=(await tx.query<BrandAsset>("SELECT * FROM cg19_member_brand_asset WHERE root_realm_id=$1 AND id=$2",[a.realmId,id])).rows[0];
   if(!asset)throw new NotFoundException("Foundation branding asset is unavailable.");return asset;
  });
  if(row.status!=="INITIATED")return this.info(row);
  if(row.reserved_until.getTime()<Date.now())return {...this.info(row),status:"EXPIRED"};
  let proof:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{proof=await this.objects.verifyPrivateObject({objectKey:row.object_key,mime:row.mime,sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256});}
  catch{return {...this.info(row),status:"VERIFICATION_UNAVAILABLE"};}
  const at=Date.parse(proof.verifiedAt);
  const valid=proof.state==="CLEAN_VERIFIED"&&proof.sha256===row.expected_sha256&&proof.mime===row.mime&&proof.sizeBytes===Number(row.size_bytes)&&proof.objectVersion.length>0&&proof.objectVersion.length<=160&&proof.scanProofRef.length>=8&&proof.scanProofRef.length<=160&&Number.isFinite(at)&&at<=Date.now()+60000&&Date.now()-at<900000;
  return this.run(a,async tx=>{
   const locked=(await tx.query<BrandAsset>("SELECT * FROM cg19_member_brand_asset WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,row.id])).rows[0];
   if(!locked)throw new NotFoundException("Foundation asset unavailable.");
   if(locked.status!=="INITIATED")return this.info(locked);
   if(locked.reserved_until.getTime()<=Date.now())throw safe();
   const updated=(await tx.query<BrandAsset>(`UPDATE cg19_member_brand_asset
    SET status=$3,object_version=$4,scan_proof_ref=$5,verified_at=$6
    WHERE root_realm_id=$1 AND id=$2 AND status='INITIATED' RETURNING *`,
    [a.realmId,row.id,valid?"VALIDATED":"REJECTED",valid?proof.objectVersion:null,valid?proof.scanProofRef:null,valid?new Date(proof.verifiedAt):null])).rows[0];
   await tx.query("INSERT INTO cg19_member_brand_event(root_realm_id,actor_ref,asset_id,action) VALUES($1,$2,$3,$4)",
    [a.realmId,a.accountId,row.id,valid?"UPLOAD_VERIFIED":"UPLOAD_REJECTED"]);
   return this.info(updated);
  });
 }
 async current(token:string){
  const a=await this.actor(token);
  return this.run(a,async tx=>{
   const row=(await tx.query<BrandConfig>("SELECT * FROM cg19_member_brand_config WHERE root_realm_id=$1 AND status='APPROVED'",[a.realmId])).rows[0];
   return row?{configured:true,version:row.version,displayName:row.display_name,signatoryName:row.signatory_name}:{configured:false,version:0};
  });
 }
 async approve(token:string,raw:unknown){
  const a=await this.actor(token),x=object(raw,["displayName","signatoryName","signatureAssetRef","sealAssetRef","logoAssetRef","expectedVersion","requestKey","currentPassword"]);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024||
   !Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<0||Number(x.expectedVersion)>2147483645)
   throw new BadRequestException("Confirm the current Foundation password and branding version.");
  const name=plain(x.displayName,3,120,"Foundation display name"),signatory=plain(x.signatoryName,2,120,"authorized signatory");
  const signature=uuid(x.signatureAssetRef),seal=uuid(x.sealAssetRef),logo=uuid(x.logoAssetRef),key=uuid(x.requestKey);
  if(new Set([signature,seal,logo]).size!==3)throw new BadRequestException("Choose three distinct verified logo, signature and seal images.");
  const expected=Number(x.expectedVersion),digest=checksum([name,signatory,signature,seal,logo,expected]);
  return this.run(a,async tx=>{
   await this.sessions.requireFreshFoundationRootProof(tx,a,x.currentPassword as string);
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   const replay=(await tx.query<BrandConfig>("SELECT * FROM cg19_member_brand_config WHERE root_realm_id=$1 AND approved_by=$2 AND request_key=$3",[a.realmId,a.accountId,key])).rows[0];
   if(replay){if(replay.request_digest!==digest)throw safe();return {configured:replay.status==="APPROVED",version:replay.version,replayed:true};}
   const previous=(await tx.query<BrandConfig>("SELECT * FROM cg19_member_brand_config WHERE root_realm_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE",[a.realmId])).rows[0];
   if((previous?.version??0)!==expected)throw safe();
   const matched=await tx.query(`SELECT 1 FROM cg19_member_brand_asset sig
    JOIN cg19_member_brand_asset seal ON seal.root_realm_id=sig.root_realm_id AND seal.id=$3 AND seal.kind='SEAL' AND seal.status='VALIDATED'
    JOIN cg19_member_brand_asset logo ON logo.root_realm_id=sig.root_realm_id AND logo.id=$4 AND logo.kind='LOGO' AND logo.status='VALIDATED'
    WHERE sig.root_realm_id=$1 AND sig.id=$2 AND sig.kind='SIGNATURE' AND sig.status='VALIDATED'
    FOR SHARE OF sig,seal,logo`,[a.realmId,signature,seal,logo]);
   if(!matched.rowCount)throw new ConflictException("All three original Foundation brand images must pass secure verification first.");
   if(previous?.status==="APPROVED"){
    await tx.query("UPDATE cg19_member_brand_config SET status='WITHDRAWN' WHERE root_realm_id=$1 AND version=$2",[a.realmId,previous.version]);
    await tx.query("INSERT INTO cg19_member_brand_event(root_realm_id,actor_ref,brand_version,action) VALUES($1,$2,$3,'BRAND_WITHDRAWN')",[a.realmId,a.accountId,previous.version]);
   }
   await tx.query(`INSERT INTO cg19_member_brand_config(root_realm_id,version,display_name,signatory_name,signature_asset_id,seal_asset_id,logo_asset_id,approved_by,request_key,request_digest,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'APPROVED')`,
    [a.realmId,expected+1,name,signatory,signature,seal,logo,a.accountId,key,digest]);
   await tx.query("INSERT INTO cg19_member_brand_event(root_realm_id,actor_ref,brand_version,action) VALUES($1,$2,$3,'BRAND_APPROVED')",[a.realmId,a.accountId,expected+1]);
   return {configured:true,version:expected+1,replayed:false};
  });
 }
}
