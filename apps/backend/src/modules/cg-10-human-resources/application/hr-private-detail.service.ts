import {BadRequestException,ConflictException,Inject,Injectable,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HrEnrollmentSourceFacade} from "./hr-enrollment-source.facade";
type PrivateFields={contactPhone:string|null;postalAddress:string|null;
 emergencyName:string|null;emergencyPhone:string|null;pan:string|null;
 bankAccount:string|null;bankIfsc:string|null};
type Row={payload_ciphertext:string;payload_nonce:string;payload_tag:string;
 payload_digest:string;record_version:number};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException("Choose an original employee application");
 return v;
};
const digest=(v:string)=>createHash("sha256").update(v).digest("hex");
function key(){
 const source=process.env.CG10_PII_ENCRYPTION_KEY??"";
 let bytes:Buffer;
 try{bytes=Buffer.from(source,"base64");}
 catch{throw new ServiceUnavailableException("Private employee encryption is not configured");}
 if(bytes.length!==32)
  throw new ServiceUnavailableException("Private employee encryption is not configured");
 return bytes;
}
function parse(value:unknown):PrivateFields{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException("Check the protected personal details");
 const x=value as Record<string,unknown>;
 const keys=["contactPhone","postalAddress","emergencyName","emergencyPhone",
   "pan","bankAccount","bankIfsc"];
 if(Object.keys(x).some(k=>!keys.includes(k)))
  throw new BadRequestException("This protected field cannot be changed here");
 const optional=(v:unknown,max:number)=>{
  if(v===null||v===undefined||v==="")return null;
  if(typeof v!=="string"||v.trim().length>max||
    /[\u0000-\u001f\u007f]/.test(v)||v.trim().length<2)
   throw new BadRequestException("Check the protected employee information");
  return v.trim().replace(/\s+/g," ");
 };
 const contactPhone=optional(x.contactPhone,20),
  emergencyPhone=optional(x.emergencyPhone,20),
  pan=optional(x.pan,10)?.toUpperCase()??null,
  bankAccount=optional(x.bankAccount,22),
  bankIfsc=optional(x.bankIfsc,11)?.toUpperCase()??null;
 if([contactPhone,emergencyPhone].some(v=>v&&!/^\+?[0-9]{10,15}$/.test(v))||
   (pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))||
   (bankAccount&&!/^[0-9]{6,22}$/.test(bankAccount))||
   (bankIfsc&&!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc))||
   Boolean(bankAccount)!==Boolean(bankIfsc))
  throw new BadRequestException("Check phone, PAN and bank details");
 return {contactPhone,postalAddress:optional(x.postalAddress,700),
  emergencyName:optional(x.emergencyName,120),emergencyPhone,
  pan,bankAccount,bankIfsc};
}
function encrypt(fields:PrivateFields,realm:string,ref:string,version:number){
 const iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key(),iv);
 cipher.setAAD(Buffer.from(realm+"|"+ref+"|"+version));
 const plaintext=Buffer.from(JSON.stringify(fields),"utf8");
 const value=Buffer.concat([cipher.update(plaintext),cipher.final()]);
 return {ciphertext:value.toString("base64url"),nonce:iv.toString("base64url"),
  tag:cipher.getAuthTag().toString("base64url"),hash:digest(value.toString("base64url"))};
}
function decrypt(row:Row,realm:string,ref:string):PrivateFields{
 try{
  const decipher=createDecipheriv("aes-256-gcm",key(),
   Buffer.from(row.payload_nonce,"base64url"));
  decipher.setAAD(Buffer.from(realm+"|"+ref+"|"+row.record_version));
  decipher.setAuthTag(Buffer.from(row.payload_tag,"base64url"));
  if(digest(row.payload_ciphertext)!==row.payload_digest)
   throw Error("Ciphertext mismatch");
  const clear=Buffer.concat([decipher.update(
   Buffer.from(row.payload_ciphertext,"base64url")),decipher.final()])
   .toString("utf8");
  return parse(JSON.parse(clear));
 }catch{
  // Nothing about source bytes, key, PAN or bank account reaches responses/logs.
  throw new ServiceUnavailableException("Protected employee information is unavailable");
 }
}
@Injectable()
export class HrPrivateDetailService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:HrEnrollmentSourceFacade){}
 async read(token:string,applicationInput:string){
  const actor=await this.sessions.requireAction(token,"hr.employees.private.view");
  const ref=id(applicationInput),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.employees.private.view");
   await this.source.draft(tx,actor,ref,false);
   const q=await tx.query<Row>(
    "SELECT payload_ciphertext,payload_nonce,payload_tag,payload_digest,record_version "+
    "FROM hr_application_private WHERE root_realm_id=$1 AND application_id=$2 FOR SHARE",
    [actor.realmId,ref]);
   const row=q.rows[0];
   const details=row?decrypt(row,actor.realmId,ref):{
     contactPhone:null,postalAddress:null,emergencyName:null,
     emergencyPhone:null,pan:null,bankAccount:null,bankIfsc:null};
   await tx.query(
    "INSERT INTO hr_private_access_audit(root_realm_id,application_id,actor_ref,"+
    "event_type,record_version) VALUES($1,$2,$3,'PRIVATE_READ',$4)",
    [actor.realmId,ref,actor.accountId,row?.record_version??1]);
   await tx.query("COMMIT");
   return {details,revision:row?.record_version??0};
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async update(token:string,applicationInput:string,value:unknown){
  const actor=await this.sessions.requireAction(token,"hr.employees.private.manage");
  const ref=id(applicationInput);
  if(!value||typeof value!=="object"||Array.isArray(value)||
   Object.keys(value as Record<string,unknown>).some(k=>!["expectedRevision","details"].includes(k))||
   !("expectedRevision" in value)||!("details" in value)||
   !Number.isSafeInteger((value as {expectedRevision:unknown}).expectedRevision)||
   Number((value as {expectedRevision:number}).expectedRevision)<0)
   throw new BadRequestException("Refresh the protected employee form");
  const expected=Number((value as {expectedRevision:number}).expectedRevision);
  const data=parse((value as {details:unknown}).details);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.employees.private.manage");
   const app=await this.source.draft(tx,actor,ref);
   if(!["DRAFT","RETURNED"].includes(app.state))
    throw new ConflictException("Submitted employee personal evidence cannot be edited");
   const row=await tx.query<Row>(
    "SELECT payload_ciphertext,payload_nonce,payload_tag,payload_digest,record_version "+
    "FROM hr_application_private WHERE root_realm_id=$1 AND application_id=$2 FOR UPDATE",
    [actor.realmId,ref]);
   const current=row.rows[0]?.record_version??0;
   if(current!==expected)throw new ConflictException(
     "Protected employee information changed. Refresh before saving.");
   const next=current+1,encrypted=encrypt(data,actor.realmId,ref,next);
   const updated=await tx.query(
    "INSERT INTO hr_application_private(application_id,root_realm_id,"+
    "payload_ciphertext,payload_nonce,payload_tag,payload_digest,record_version,"+
    "updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) "+
    "ON CONFLICT(root_realm_id,application_id) DO UPDATE SET "+
    "payload_ciphertext=EXCLUDED.payload_ciphertext,"+
    "payload_nonce=EXCLUDED.payload_nonce,payload_tag=EXCLUDED.payload_tag,"+
    "payload_digest=EXCLUDED.payload_digest,record_version=EXCLUDED.record_version,"+
    "updated_by=EXCLUDED.updated_by,updated_at=now() "+
    "WHERE hr_application_private.record_version=$9",
    [ref,actor.realmId,encrypted.ciphertext,encrypted.nonce,encrypted.tag,
     encrypted.hash,next,actor.accountId,expected]);
   if(!updated.rowCount)
    throw new ConflictException("Protected employee details were changed. Refresh before retrying.");
   await tx.query(
    "INSERT INTO hr_private_access_audit(root_realm_id,application_id,actor_ref,"+
    "event_type,record_version) VALUES($1,$2,$3,'PRIVATE_WRITE',$4)",
    [actor.realmId,ref,actor.accountId,next]);
   await tx.query("COMMIT");
   return {saved:true,revision:next,
    message:"Protected employee details saved. No approval or access permission was granted."};
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
}
