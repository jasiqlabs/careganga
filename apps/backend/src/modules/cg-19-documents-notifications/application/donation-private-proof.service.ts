import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER=/^CG-DON-[0-9]{8}$/;
const SHA=/^[a-f0-9]{64}$/;
const TYPES=new Set(["application/pdf","image/jpeg","image/png"]);
type Input={donationNumber:string;requestKey:string;mime:string;sizeBytes:number;sha256:string};
type Row={id:string;donation_id:string;requested_by:string;request_key:string;
 request_digest:string;mime:string;size_bytes:string;expected_sha256:string;
 object_key:string;object_version:string|null;state:string;reserved_until:Date};
const input=(raw:unknown):Input=>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
  Object.keys(raw).some(k=>!["donationNumber","requestKey","mime","sizeBytes","sha256"].includes(k)))
  throw new BadRequestException("Check the original A17 donor document.");
 const v=raw as Record<string,unknown>;
 if(typeof v.donationNumber!=="string"||!NUMBER.test(v.donationNumber)||
  typeof v.requestKey!=="string"||!UUID.test(v.requestKey)||
  typeof v.mime!=="string"||!TYPES.has(v.mime)||
  !Number.isSafeInteger(v.sizeBytes)||Number(v.sizeBytes)<1||Number(v.sizeBytes)>5242880||
  typeof v.sha256!=="string"||!SHA.test(v.sha256))
  throw new BadRequestException("Choose a PDF/JPG/PNG up to 5 MB.");
 return v as Input;
};
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
@Injectable()
export class DonationPrivateProofService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly storage:PrivateObjectStorage){}
 private async uploader(token:string){
  const actor=await this.sessions.requireAction(token,"finance.journals.post");
  await this.sessions.requireAction(token,"documents.files.manage");return actor;
 }
 private async scope(tx:PoolClient,a:VerifiedFoundationActor,branch:string|null){
  await this.identity.assertCurrent(tx,a,"finance.journals.post");
  await this.identity.assertCurrent(tx,a,"documents.files.manage");
  if(branch===null)await this.branches.requireFinanceRootScope(tx,a,"finance.journals.post");
  else await this.branches.requireFinanceActiveBranch(tx,a,branch,"finance.journals.post");
 }
 private async original(tx:PoolClient,a:VerifiedFoundationActor,number:string){
  const d=(await tx.query<{id:string;branch_ref:string|null;source_status:string}>(
   "SELECT id,branch_ref,source_status FROM donation WHERE root_realm_id=$1 "+
   "AND donation_number=$2 FOR SHARE",[a.realmId,number])).rows[0];
  if(!d)throw new NotFoundException("Original donation is not accessible.");
  await this.scope(tx,a,d.branch_ref);
  return d;
 }
 async initiate(token:string,raw:unknown){
  const v=input(raw),a=await this.uploader(token);
  const fingerprint=hash(["CG19_DONATION_PROOF",v.donationNumber,v.mime,v.sizeBytes,v.sha256]);
  const tx=await this.db.connect();let row:Row;
  try{
   await tx.query("BEGIN");
   const d=await this.original(tx,a,v.donationNumber);
   if(d.source_status!=="REQUESTED")
    throw new ConflictException("Original A17 donation is no longer awaiting verification.");
   const existing=(await tx.query<{count:string}>(
    "SELECT count(*)::text AS count FROM cg19_donation_private_proof "+
    "WHERE root_realm_id=$1 AND donation_id=$2 AND state IN('RESERVED','VALIDATED','UNKNOWN')",
    [a.realmId,d.id])).rows[0];
   const previous=(await tx.query<Row>(
    "SELECT * FROM cg19_donation_private_proof WHERE root_realm_id=$1 "+
    "AND requested_by=$2 AND request_key=$3 FOR SHARE",
    [a.realmId,a.accountId,v.requestKey])).rows[0];
   if(previous){
    if(previous.donation_id!==d.id||previous.request_digest!==fingerprint)
     throw new ConflictException("The original file upload request changed.");
    row=previous;
   }else{
    if(BigInt(existing?.count??"0")>=5n)throw new ConflictException("Maximum five private donor proofs per donation.");
    row=(await tx.query<Row>(
     "INSERT INTO cg19_donation_private_proof(root_realm_id,donation_id,requested_by,"+
     "request_key,request_digest,mime,size_bytes,expected_sha256,object_key) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
     [a.realmId,d.id,a.accountId,v.requestKey,fingerprint,v.mime,v.sizeBytes,v.sha256,
      "careganga/private/cg19/"+a.realmId+"/donor-proofs/"+randomUUID()])).rows[0];
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(row.state==="VALIDATED")return {proofRef:row.id,status:"VALIDATED",cleanVerified:true};
  if(row.reserved_until.getTime()<=Date.now()||row.state==="REJECTED")
   return {proofRef:row.id,status:"UNAVAILABLE",cleanVerified:false};
  try{
   const signed=await this.storage.reservePrivateUpload({
    objectKey:row.object_key,requestKey:row.request_key,mime:row.mime,
    sizeBytes:Number(row.size_bytes),sha256:row.expected_sha256,
    expiresAt:row.reserved_until.toISOString()});
   const expiry=Date.parse(signed.expiresAt);
   if(!signed.url.startsWith("https://")||!signed.reservationRef||
    signed.reservationRef.length>160||!Number.isFinite(expiry)||
    expiry<=Date.now()||expiry>row.reserved_until.getTime()||
    signed.headers["Content-Type"]!==row.mime||
    !Object.entries(signed.headers).every(([k,value])=>
     ["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&
      typeof value==="string"&&value.length<=160))
    throw new ServiceUnavailableException("CG19 private proof storage reservation unavailable.");
   return {proofRef:row.id,status:"UPLOAD_READY",uploadUrl:signed.url,
    uploadHeaders:signed.headers,expiresAt:signed.expiresAt,cleanVerified:false};
  }catch{
   await this.db.query("UPDATE cg19_donation_private_proof SET state='UNKNOWN',updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state='RESERVED'",
    [a.realmId,row.id]).catch(()=>undefined);
   return {proofRef:row.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};
  }
 }
 async confirm(token:string,proofRef:string){
  if(!UUID.test(proofRef))throw new BadRequestException("Invalid original proof.");
  const a=await this.uploader(token);
  const found=(await this.db.query<Row & {donation_number:string;branch_ref:string|null}>(
   "SELECT p.*,d.donation_number,d.branch_ref FROM cg19_donation_private_proof p "+
   "JOIN donation d ON d.root_realm_id=p.root_realm_id AND d.id=p.donation_id "+
   "WHERE p.root_realm_id=$1 AND p.id=$2 AND p.requested_by=$3",
   [a.realmId,proofRef,a.accountId])).rows[0];
  if(!found)throw new NotFoundException("Private donor evidence is unavailable.");
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");await this.original(tx,a,found.donation_number);
   await tx.query("COMMIT");}catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(found.state==="VALIDATED")return {status:"VALIDATED",cleanVerified:true};
  if(found.state==="REJECTED"||found.reserved_until.getTime()<=Date.now())
   return {status:"UNAVAILABLE",cleanVerified:false};
  let verification;
  try{
   verification=await this.storage.verifyPrivateObject({
    objectKey:found.object_key,mime:found.mime,
    sizeBytes:Number(found.size_bytes),sha256:found.expected_sha256});
  }catch{return {status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const ts=Date.parse(verification.verifiedAt);
  const clean=verification.state==="CLEAN_VERIFIED"&&verification.mime===found.mime&&
   verification.sha256===found.expected_sha256&&
   verification.sizeBytes===Number(found.size_bytes)&&
   verification.objectVersion.length>0&&verification.objectVersion.length<=160&&
   verification.scanProofRef.length>=8&&verification.scanProofRef.length<=160&&
   Number.isFinite(ts)&&ts<=Date.now()+60000&&Date.now()-ts<900000;
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   const original=await this.original(client,a,found.donation_number);
   if(original.id!==found.donation_id||original.source_status!=="REQUESTED")
    throw new ConflictException("Original donation no longer accepts new proof.");
   const row=(await client.query<Row>(
    "SELECT * FROM cg19_donation_private_proof WHERE root_realm_id=$1 AND id=$2 "+
    "AND requested_by=$3 FOR UPDATE",[a.realmId,proofRef,a.accountId])).rows[0];
   if(!row||row.state==="REJECTED"||row.reserved_until.getTime()<=Date.now())
    throw new ConflictException("Proof upload expired or changed.");
   if(row.state!=="VALIDATED"){
    await client.query("UPDATE cg19_donation_private_proof SET state=$3,"+
     "object_version=$4,scan_proof_ref=$5,scanned_at=$6,updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2 AND state IN('RESERVED','UNKNOWN')",
     [a.realmId,proofRef,clean?"VALIDATED":"REJECTED",
      clean?verification.objectVersion:null,clean?verification.scanProofRef:null,
      clean?verification.verifiedAt:null]);
   }
   await client.query("COMMIT");
   return {status:clean?"VALIDATED":"REJECTED",cleanVerified:clean};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async list(token:string,number:string){
  if(!NUMBER.test(number))throw new BadRequestException("Choose a donation.");
  const actor=await this.sessions.requireAction(token,"finance.reports.view");
  await this.sessions.requireAction(token,"documents.files.view");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const d=(await tx.query<{id:string;branch_ref:string|null}>(
    "SELECT id,branch_ref FROM donation WHERE root_realm_id=$1 "+
    "AND donation_number=$2 FOR SHARE",[actor.realmId,number])).rows[0];
   if(!d)throw new NotFoundException("Current donation not available.");
   if(d.branch_ref===null)await this.branches.requireFinanceRootScope(tx,actor,"finance.reports.view");
   else await this.branches.requireFinanceActiveBranch(tx,actor,d.branch_ref,"finance.reports.view");
   const files=await tx.query<{mime:string;status:string;verifiedAt:Date|null}>(
    "SELECT mime,state AS status,scanned_at AS \"verifiedAt\" "+
    "FROM cg19_donation_private_proof WHERE root_realm_id=$1 AND donation_id=$2 "+
    "ORDER BY created_at DESC,id DESC LIMIT 6",[actor.realmId,d.id]);
   await tx.query("COMMIT");
   return {proofs:files.rows.map(x=>({...x,verifiedAt:x.verifiedAt?.toISOString()??null,
    verified:x.status==="VALIDATED"}))};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
}
