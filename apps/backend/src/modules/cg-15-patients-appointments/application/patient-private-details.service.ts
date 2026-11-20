import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const GROUPS=new Set(["A+","A-","B+","B-","AB+","AB-","O+","O-"]);
type Details={bloodGroup:string|null;emergencyName:string|null;
 emergencyMobile:string|null;medicalInfo:string|null};
type Row={private_ciphertext:Buffer;nonce:Buffer;auth_tag:Buffer;
 key_version:string;revision:number};
function decodeKey(){
 const source=process.env.CG15_PATIENT_DETAILS_KEY_BASE64?.trim()??"";
 if(!/^[A-Za-z0-9+/]{43}=$/.test(source))
  throw new ServiceUnavailableException({code:"CG15_PATIENT_PRIVATE_UNAVAILABLE"});
 const key=Buffer.from(source,"base64");
 if(key.length!==32||key.toString("base64")!==source)
  throw new ServiceUnavailableException({code:"CG15_PATIENT_PRIVATE_UNAVAILABLE"});
 return key;
}
function cleanText(raw:unknown,max:number,field:string){
 if(raw===null||raw===undefined||raw==="")return null;
 if(typeof raw!=="string")throw new BadRequestException({
  code:"CG15_PATIENT_PRIVATE_INVALID",field});
 const value=raw.trim().replace(/\s+/g," ");
 if(value.length<2||value.length>max||
  /[\u0000-\u001f\u007f<>]/.test(value))
  throw new BadRequestException({code:"CG15_PATIENT_PRIVATE_INVALID",field});
 return value;
}
function validate(value:unknown):{expectedVersion:number;details:Details}{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"CG15_PATIENT_PRIVATE_INVALID"});
 const body=value as Record<string,unknown>;
 const allowed=["expectedVersion","bloodGroup","emergencyName",
  "emergencyMobile","medicalInfo"];
 if(Object.keys(body).some(k=>!allowed.includes(k))||
  !Number.isSafeInteger(body.expectedVersion)||
  Number(body.expectedVersion)<0||Number(body.expectedVersion)>2147483644)
  throw new BadRequestException({code:"CG15_PATIENT_PRIVATE_INVALID"});
 const blood=body.bloodGroup===undefined||body.bloodGroup===""||body.bloodGroup===null?
  null:body.bloodGroup;
 if(blood!==null&&(!GROUPS.has(String(blood))||typeof blood!=="string"))
  throw new BadRequestException({code:"CG15_PATIENT_PRIVATE_INVALID",field:"bloodGroup"});
 const emergencyName=cleanText(body.emergencyName,100,"emergencyName");
 const mobile=body.emergencyMobile===undefined||body.emergencyMobile===""||
  body.emergencyMobile===null?null:body.emergencyMobile;
 if(mobile!==null&&(typeof mobile!=="string"||!/^[6-9]\d{9}$/.test(mobile)))
  throw new BadRequestException({code:"CG15_PATIENT_PRIVATE_INVALID",
   field:"emergencyMobile"});
 if(mobile&&!emergencyName)
  throw new BadRequestException({code:"CG15_PATIENT_PRIVATE_INVALID",
   field:"emergencyName"});
 const medicalInfo=cleanText(body.medicalInfo,500,"medicalInfo");
 return {expectedVersion:Number(body.expectedVersion),details:{
  bloodGroup:blood as string|null,emergencyName,
  emergencyMobile:mobile as string|null,medicalInfo}};
}
function additional(realm:string,patient:string){
 return Buffer.from(realm+":"+patient+":CG15_PATIENT_PRIVATE:v1","utf8");
}
function encrypt(key:Buffer,realm:string,patient:string,value:Details){
 const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,nonce);
 cipher.setAAD(additional(realm,patient));
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
 return {ciphertext,nonce,tag:cipher.getAuthTag()};
}
function decrypt(key:Buffer,realm:string,patient:string,record:Row):Details{
 try{
  if(record.key_version!=="v1")throw Error("Unsupported private key version");
  const decipher=createDecipheriv("aes-256-gcm",key,record.nonce);
  decipher.setAAD(additional(realm,patient));decipher.setAuthTag(record.auth_tag);
  const plaintext=Buffer.concat([decipher.update(record.private_ciphertext),
   decipher.final()]).toString("utf8");
  const result=JSON.parse(plaintext) as Details;
  if(!result||typeof result!=="object"||Array.isArray(result)||
    !("bloodGroup" in result)||!("emergencyName" in result)||
    !("emergencyMobile" in result)||!("medicalInfo" in result))
   throw Error("Private format invalid");
  return result;
 }catch{
  // Never expose encrypted bytes, clinical text, crypto exception or key.
  throw new ServiceUnavailableException({code:"CG15_PATIENT_PRIVATE_UNAVAILABLE"});
 }
}
const EMPTY:Details={bloodGroup:null,emergencyName:null,
 emergencyMobile:null,medicalInfo:null};
/** Only the original independently verified patient-account identity owns
 * these fields. No center staff lookup, phone matching, export or clinical
 * report linkage is exposed by this service.
 */
@Injectable()
export class PatientPrivateDetailsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService){}
 private async own(c:PoolClient,actor:VerifiedFoundationActor,write:boolean){
  const r=await c.query<{id:string;consent_granted:boolean|null}>(
   "SELECT p.id,(SELECT x.granted FROM cg15_patient_consent x "+
   "WHERE x.root_realm_id=p.root_realm_id AND x.patient_id=p.id "+
   "AND x.purpose='PATIENT_CARE' ORDER BY x.revision_no DESC LIMIT 1) "+
   "AS consent_granted FROM cg15_patient p "+
   "JOIN cg15_patient_account_link l ON l.root_realm_id=p.root_realm_id "+
   "AND l.patient_id=p.id AND l.revoked_at IS NULL "+
   "JOIN account a ON a.realm_id=l.root_realm_id AND a.id=l.account_id "+
   "WHERE p.root_realm_id=$1 AND l.account_id=$2 AND a.status='ACTIVE' "+
   "AND p.profile_status='VERIFIED' "+
   "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
   "WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) "+
   (write?"FOR UPDATE OF p":"FOR SHARE OF p,l,a"),
   [actor.realmId,actor.accountId]);
  const row=r.rows[0];
  if(!row||(write&&row.consent_granted!==true))
   throw new NotFoundException({code:"CG15_PATIENT_PRIVATE_UNAVAILABLE"});
  return row.id;
 }
 private async transaction<T>(run:(c:PoolClient)=>Promise<T>){
  const c=await this.db.connect();let active=false;
  try{
   await c.query("BEGIN");active=true;
   const value=await run(c);
   await c.query("COMMIT");active=false;return value;
  }catch(e){if(active)await c.query("ROLLBACK");throw e;}
  finally{c.release();}
 }
 async mine(bearer:string){
  const actor=await this.sessions.verifySession(bearer);
  return this.transaction(async tx=>{
   const patient=await this.own(tx,actor,false);
   const row=await tx.query<Row>(
    "SELECT private_ciphertext,nonce,auth_tag,key_version,revision "+
    "FROM cg15_patient_private_details WHERE root_realm_id=$1 AND patient_id=$2",
    [actor.realmId,patient]);
   if(!row.rows[0])return {version:0,...EMPTY};
   return {version:row.rows[0].revision,
    ...decrypt(decodeKey(),actor.realmId,patient,row.rows[0])};
  });
 }
 async save(bearer:string,input:unknown){
  const actor=await this.sessions.verifySession(bearer);
  const {expectedVersion,details}=validate(input);
  const key=decodeKey();
  return this.transaction(async tx=>{
   const patient=await this.own(tx,actor,true);
   const previous=await tx.query<{revision:number}>(
    "SELECT revision FROM cg15_patient_private_details "+
    "WHERE root_realm_id=$1 AND patient_id=$2 FOR UPDATE",
    [actor.realmId,patient]);
   const current=previous.rows[0]?.revision??0;
   if(current!==expectedVersion)
    throw new ConflictException({code:"CG15_PATIENT_PRIVATE_CHANGED"});
   const secured=encrypt(key,actor.realmId,patient,details);
   if(current===0){
    await tx.query(
     "INSERT INTO cg15_patient_private_details("+
     "root_realm_id,patient_id,private_ciphertext,nonce,auth_tag,"+
     "key_version,revision,updated_by_account) "+
     "VALUES($1,$2,$3,$4,$5,'v1',1,$6)",
     [actor.realmId,patient,secured.ciphertext,secured.nonce,
      secured.tag,actor.accountId]);
   }else{
    const applied=await tx.query(
     "UPDATE cg15_patient_private_details SET private_ciphertext=$3,"+
     "nonce=$4,auth_tag=$5,key_version='v1',revision=revision+1,"+
     "updated_by_account=$6,updated_at=now() "+
     "WHERE root_realm_id=$1 AND patient_id=$2 AND revision=$7 RETURNING revision",
     [actor.realmId,patient,secured.ciphertext,secured.nonce,
      secured.tag,actor.accountId,expectedVersion]);
    if(!applied.rowCount)
     throw new ConflictException({code:"CG15_PATIENT_PRIVATE_CHANGED"});
   }
   await tx.query(
    "INSERT INTO cg15_patient_private_details_event("+
    "root_realm_id,patient_id,revision,actor_account_id,action) "+
    "VALUES($1,$2,$3,$4,'UPDATED')",
    [actor.realmId,patient,expectedVersion+1,actor.accountId]);
   return {version:expectedVersion+1,...details};
  });
 }
}
