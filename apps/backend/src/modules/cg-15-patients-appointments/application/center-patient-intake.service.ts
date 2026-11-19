import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException
} from "@nestjs/common";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import type {VerifiedFoundationActor}
 from "../../cg-01-identity-access/public-api";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Intake={request_digest:string;patient_id:string|null;consent_version:string};
type IntakeResult={virtual_display_id:string;first_name:string;last_name:string;
 date_of_birth:string|null;profile_status:string;created_at:Date};
function body(x:unknown):Record<string,unknown>{
 if(!x||typeof x!=="object"||Array.isArray(x))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
 return x as Record<string,unknown>;
}
function uuid(v:unknown,field="requestKey"){
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID",field});
 return v;
}
function part(v:unknown,key:string,min:number){
 if(typeof v!=="string"||v.trim().length<min||v.trim().length>100||
  /[\u0000-\u001f\u007f<>]/.test(v))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID",field:key});
 return v.trim().replace(/\s+/g," ");
}
function date(v:unknown):string|null{
 if(v===undefined||v===null||v==="")return null;
 if(typeof v!=="string"||!DATE.test(v)||
  !Number.isFinite(Date.parse(v+"T00:00:00Z"))||
  new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v||
  v<"1900-01-01"||v>new Date().toISOString().slice(0,10))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID",field:"dateOfBirth"});
 return v;
}
function configuredConsent(){
 const version=process.env.CG15_PATIENT_CONSENT_VERSION?.trim()??"";
 const text=process.env.CG15_PATIENT_CONSENT_TEXT?.trim()??"";
 if(!/^[a-zA-Z0-9._-]{1,32}$/.test(version)||text.length<40||text.length>3000)
  throw new ServiceUnavailableException({code:"CG15_PATIENT_CONSENT_UNAVAILABLE"});
 return version;
}
/** A permitted currently affiliated Center receptionist can record a minimal
 * independently PROVISIONAL registration. This is neither a verified patient
 * identity nor a CG-01 account claim or a grant to all clinical records.
 */
@Injectable()
export class CenterPatientIntakeService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly ownCenter:HealthCenterSupportScopeFacade){}
 private async scope(tx:PoolClient,actor:VerifiedFoundationActor,centerRef:string){
  if(!ID.test(centerRef))throw new NotFoundException({code:"CG15_PATIENT_CENTER_UNAVAILABLE"});
  await this.ownCenter.assertCurrent(tx,actor,centerRef,"health.patients.intake");
 }
 private async result(tx:PoolClient,actor:VerifiedFoundationActor,centerRef:string,key:string){
  const r=await tx.query<IntakeResult>(
   "SELECT p.virtual_display_id,p.first_name,p.last_name,p.date_of_birth::text,"+
   "p.profile_status,i.created_at FROM cg15_patient_center_intake i "+
   "JOIN cg15_patient p ON p.root_realm_id=i.root_realm_id AND p.id=i.patient_id "+
   "WHERE i.root_realm_id=$1 AND i.center_id=$2 "+
   "AND i.created_by_account=$3 AND i.request_key=$4",
   [actor.realmId,centerRef,actor.accountId,key]);
  const found=r.rows[0];
  if(!found)throw new NotFoundException({code:"CG15_PATIENT_INTAKE_NOT_FOUND"});
  return {virtualPatientId:found.virtual_display_id,firstName:found.first_name,
   lastName:found.last_name,dateOfBirth:found.date_of_birth,
   profileStatus:found.profile_status,createdAt:found.created_at.toISOString(),
   message:"Provisional patient intake recorded. Independent identity verification is still required."};
 }
 async get(bearer:string,centerRaw:string,keyRaw:string){
  const actor=await this.sessions.verifySession(bearer);
  const centerRef=uuid(centerRaw,"centerRef"),key=uuid(keyRaw);
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,centerRef);
   const record=await this.result(tx,actor,centerRef,key);
   await tx.query("COMMIT");active=false;
   return record;
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async create(bearer:string,centerRaw:string,input:unknown){
  const actor=await this.sessions.verifySession(bearer);
  const centerRef=uuid(centerRaw,"centerRef"),v=body(input);
  const allowed=["requestKey","firstName","lastName","dateOfBirth",
   "consentVersion","assistedConsentAttested"];
  if(Object.keys(v).some(k=>!allowed.includes(k)))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const requestKey=uuid(v.requestKey),firstName=part(v.firstName,"firstName",2);
  const lastName=part(v.lastName,"lastName",1),dateOfBirth=date(v.dateOfBirth);
  // A successful request-key replay must not depend on newer consent text.
  // First validate the pinned caller version, then check the persisted source.
  const requestedVersion=v.consentVersion;
  if(v.assistedConsentAttested!==true||typeof requestedVersion!=="string"||
   !/^[A-Za-z0-9._-]{1,32}$/.test(requestedVersion))
   throw new BadRequestException({code:"CG15_PATIENT_CONSENT_REQUIRED"});
  const digest=hash({firstName,lastName,dateOfBirth,
   version:requestedVersion,assistedConsentAttested:true});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   // Check current permission, active root, verified provider+center, and exact
   // current own-center affiliation INSIDE this write transaction.
   await this.scope(tx,actor,centerRef);
   // Existing committed command: return its own result even if the approved
   // consent version has since changed; never create a new patient on replay.
   const prior=await tx.query<Intake>(
    "SELECT request_digest,patient_id,consent_version "+
    "FROM cg15_patient_center_intake WHERE root_realm_id=$1 AND center_id=$2 "+
    "AND created_by_account=$3 AND request_key=$4 FOR UPDATE",
    [actor.realmId,centerRef,actor.accountId,requestKey]);
   if(prior.rows[0]){
    if(prior.rows[0].request_digest!==digest)
     throw new ConflictException({code:"CG15_PATIENT_REQUEST_CONFLICT"});
    if(prior.rows[0].patient_id){
     const previous=await this.result(tx,actor,centerRef,requestKey);
     await tx.query("COMMIT");active=false;
     return previous;
    }
   }
   const version=configuredConsent();
   if(requestedVersion!==version)
    throw new BadRequestException({code:"CG15_PATIENT_CONSENT_REQUIRED"});
   await tx.query(
    "INSERT INTO cg15_patient_center_intake("+
    "root_realm_id,center_id,created_by_account,request_key,request_digest,"+
    "assisted_consent_attested,consent_version) "+
    "VALUES($1,$2,$3,$4,$5,true,$6) "+
    "ON CONFLICT(root_realm_id,center_id,created_by_account,request_key) DO NOTHING",
    [actor.realmId,centerRef,actor.accountId,requestKey,digest,version]);
   const exists=await tx.query<Intake>(
    "SELECT request_digest,patient_id,consent_version "+
    "FROM cg15_patient_center_intake WHERE root_realm_id=$1 AND center_id=$2 "+
    "AND created_by_account=$3 AND request_key=$4 FOR UPDATE",
    [actor.realmId,centerRef,actor.accountId,requestKey]);
   const command=exists.rows[0];
   if(!command||command.request_digest!==digest)
    throw new ConflictException({code:"CG15_PATIENT_REQUEST_CONFLICT"});
   if(command.patient_id){
    const previous=await this.result(tx,actor,centerRef,requestKey);
    await tx.query("COMMIT");active=false;
    return previous;
   }
   const patientId=randomUUID(),displayId="CGP-"+randomBytes(8).toString("hex").toUpperCase();
   await tx.query(
    "INSERT INTO cg15_patient(root_realm_id,id,virtual_display_id,first_name,last_name,"+
    "date_of_birth,profile_status,created_by_account) "+
    "VALUES($1,$2,$3,$4,$5,$6,'PROVISIONAL',$7)",
    [actor.realmId,patientId,displayId,firstName,lastName,dateOfBirth,actor.accountId]);
   // Staff attestation is evidence of a limited registration explanation, NOT
   // patient-signed permission to share clinical reports with this center.
   await tx.query(
    "INSERT INTO cg15_patient_consent(root_realm_id,patient_id,revision_no,purpose,"+
    "terms_version,granted,recorded_by_account) "+
    "VALUES($1,$2,1,'PATIENT_CARE',$3,false,$4)",
    [actor.realmId,patientId,version,actor.accountId]);
   await tx.query(
    "INSERT INTO cg15_patient_change_event(root_realm_id,patient_id,revision_no,action,actor_account_id) "+
    "VALUES($1,$2,1,'REGISTERED',$3)",
    [actor.realmId,patientId,actor.accountId]);
   await tx.query(
    "UPDATE cg15_patient_center_intake SET patient_id=$5 "+
    "WHERE root_realm_id=$1 AND center_id=$2 AND created_by_account=$3 AND request_key=$4",
    [actor.realmId,centerRef,actor.accountId,requestKey,patientId]);
   const created=await this.result(tx,actor,centerRef,requestKey);
   await tx.query("COMMIT");active=false;
   return created;
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
}
