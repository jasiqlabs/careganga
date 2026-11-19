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
 async options(bearer:string){
  // A receptionist needs the intake permission, not center draft editing.
  // Current association and verified+enabled provider are used for choices;
  // the write still rechecks all CG14 source conditions under transaction.
  const actor=await this.sessions.requireAction(bearer,"health.patients.intake");
  const rows=await this.db.query<{
   center_ref:string;center_name:string;provider_name:string
  }>(
   "SELECT DISTINCT c.id AS center_ref,c.display_name AS center_name,"+
   "p.legal_name AS provider_name FROM health_center_account_affiliation a "+
   "JOIN health_center c ON c.root_realm_id=a.root_realm_id AND c.id=a.center_id "+
   "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
   "WHERE a.root_realm_id=$1 AND a.account_ref=$2 AND a.status='ACTIVE' "+
   "AND c.status='VERIFIED' AND c.access_state='ENABLED' AND p.status='VERIFIED' "+
   "ORDER BY c.display_name,c.id,p.legal_name LIMIT 40",
   [actor.realmId,actor.accountId]);
  return {centers:rows.rows.map(x=>({
   centerRef:x.center_ref,centerName:x.center_name,providerName:x.provider_name
  }))};
 }
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
 /** Clinic staff may attest an in-person document check ONLY with a
  * current code issued by this authenticated patient's own CG01 account.
  * Phone numbers and display IDs alone never authorize an identity claim.
  */
 /** Clinic-created, still-unclaimed patient: only the issuing receptionist
  * can hand a verified person a short-lived claim code. This cannot transfer
  * ownership by shared family number or Virtual Patient ID alone.
  */
 async issueClaim(bearer:string,centerRaw:string,input:unknown){
  const actor=await this.sessions.verifySession(bearer);
  const centerRef=uuid(centerRaw,"centerRef"),v=body(input);
  if(Object.keys(v).some(k=>!["requestKey","virtualPatientId",
   "identityCheckedInPerson"].includes(k))||
   typeof v.virtualPatientId!=="string"||
   !/^CGP-[A-F0-9]{16}$/.test(v.virtualPatientId)||
   v.identityCheckedInPerson!==true)
   throw new BadRequestException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
  const key=uuid(v.requestKey),display=v.virtualPatientId;
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,centerRef);
   const source=await tx.query<{id:string;patient_id:string;profile_status:string}>(
    "SELECT i.id,i.patient_id,p.profile_status FROM cg15_patient_center_intake i "+
    "JOIN cg15_patient p ON p.root_realm_id=i.root_realm_id AND p.id=i.patient_id "+
    "WHERE i.root_realm_id=$1 AND i.center_id=$2 "+
    "AND i.created_by_account=$3 AND p.virtual_display_id=$4 "+
    "FOR UPDATE OF i,p",
    [actor.realmId,centerRef,actor.accountId,display]);
   const patient=source.rows[0];
   if(!patient||patient.profile_status!=="PROVISIONAL")
    throw new NotFoundException({code:"CG15_PATIENT_INTAKE_NOT_FOUND"});
   const owner=await tx.query(
    "SELECT 1 FROM cg15_patient_account_link WHERE root_realm_id=$1 "+
    "AND patient_id=$2 AND revoked_at IS NULL LIMIT 1",
    [actor.realmId,patient.patient_id]);
   if(owner.rowCount)throw new ConflictException({code:"CG15_PATIENT_ALREADY_REGISTERED"});
   const previous=await tx.query<{patient_id:string}>(
    "SELECT patient_id FROM cg15_patient_center_claim WHERE root_realm_id=$1 "+
    "AND issued_by_account=$2 AND request_key=$3",
    [actor.realmId,actor.accountId,key]);
   if(previous.rows[0]){
    if(previous.rows[0].patient_id!==patient.patient_id)
     throw new ConflictException({code:"CG15_PATIENT_REQUEST_CONFLICT"});
    await tx.query("COMMIT");active=false;
    return {status:"ALREADY_ISSUED",virtualPatientId:display,
     message:"The prior code was issued but cannot be redisplayed. If it was lost, request a new code with a fresh request key."};
   }
   await tx.query(
    "UPDATE cg15_patient_center_claim SET revoked_at=now() "+
    "WHERE root_realm_id=$1 AND patient_id=$2 AND claimed_at IS NULL AND revoked_at IS NULL",
    [actor.realmId,patient.patient_id]);
   const code="CGC-"+randomBytes(12).toString("hex").toUpperCase();
   const digest=createHash("sha256").update(code).digest("hex");
   const inserted=await tx.query<{expires_at:Date}>(
    "INSERT INTO cg15_patient_center_claim(root_realm_id,intake_id,patient_id,"+
    "center_id,issued_by_account,request_key,claim_digest,"+
    "identity_checked_in_person,expires_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,true,now()+interval '15 minutes') RETURNING expires_at",
    [actor.realmId,patient.id,patient.patient_id,centerRef,actor.accountId,key,digest]);
   await tx.query("COMMIT");active=false;
   return {status:"ISSUED",virtualPatientId:display,claimCode:code,
    expiresAt:inserted.rows[0].expires_at.toISOString(),
    message:"Give the code only to this verified person. They must sign in to their own account, accept current patient-care consent, and claim within 15 minutes."};
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }

 async verifyIdentity(bearer:string,centerRaw:string,input:unknown){
  const actor=await this.sessions.verifySession(bearer);
  const centerRef=uuid(centerRaw,"centerRef"),v=body(input);
  if(Object.keys(v).some(k=>!["requestKey","virtualPatientId",
    "verificationCode","identityCheckedInPerson"].includes(k)))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const key=uuid(v.requestKey);
  if(typeof v.virtualPatientId!=="string"||
    !/^CGP-[A-F0-9]{16}$/.test(v.virtualPatientId)||
    typeof v.verificationCode!=="string"||
    !/^CGI-[A-F0-9]{24}$/.test(v.verificationCode)||
    v.identityCheckedInPerson!==true)
   throw new BadRequestException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
  const display=v.virtualPatientId,tokenDigest=createHash("sha256")
   .update(v.verificationCode).digest("hex");
  const signature=hash({centerRef,display,tokenDigest,identityCheckedInPerson:true});
  const tx=await this.db.connect();let active=false;
  try{
   await tx.query("BEGIN");active=true;
   await this.scope(tx,actor,centerRef);
   const prior=await tx.query<{request_digest:string;virtual_display_id:string}>(
    "SELECT e.request_digest,p.virtual_display_id "+
    "FROM cg15_patient_identity_event e JOIN cg15_patient p "+
    "ON p.root_realm_id=e.root_realm_id AND p.id=e.patient_id "+
    "WHERE e.root_realm_id=$1 AND e.center_id=$2 "+
    "AND e.verified_by_account=$3 AND e.request_key=$4",
    [actor.realmId,centerRef,actor.accountId,key]);
   if(prior.rows[0]){
    if(prior.rows[0].request_digest!==signature)
     throw new ConflictException({code:"CG15_PATIENT_REQUEST_CONFLICT"});
    await tx.query("COMMIT");active=false;
    return {virtualPatientId:prior.rows[0].virtual_display_id,
     profileStatus:"VERIFIED",message:"Original identity verification already recorded."};
   }
   const source=await tx.query<{
    id:string;revision:number;profile_status:string;challenge_id:string
   }>(
    "SELECT p.id,p.revision,p.profile_status,c.id AS challenge_id "+
    "FROM cg15_patient_identity_challenge c "+
    "JOIN cg15_patient p ON p.root_realm_id=c.root_realm_id AND p.id=c.patient_id "+
    "JOIN cg15_patient_account_link l ON l.root_realm_id=p.root_realm_id "+
    "AND l.patient_id=p.id AND l.account_id=c.issued_by_account AND l.revoked_at IS NULL "+
    "JOIN account a ON a.id=l.account_id AND a.realm_id=l.root_realm_id "+
    "JOIN LATERAL (SELECT pc.granted FROM cg15_patient_consent pc "+
    "WHERE pc.root_realm_id=p.root_realm_id AND pc.patient_id=p.id "+
    "AND pc.purpose='PATIENT_CARE' ORDER BY pc.revision_no DESC LIMIT 1) consent ON true "+
    "WHERE p.root_realm_id=$1 AND p.virtual_display_id=$2 "+
    "AND c.token_digest=$3 AND c.used_at IS NULL AND c.expires_at>now() "+
    "AND a.status='ACTIVE' AND a.contact_phone_verified_at IS NOT NULL "+
    "AND consent.granted=true FOR UPDATE OF p,c",
    [actor.realmId,display,tokenDigest]);
   const patient=source.rows[0];
   if(!patient||patient.profile_status!=="PROVISIONAL")
    throw new ConflictException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
   await tx.query(
    "UPDATE cg15_patient_identity_challenge SET used_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND used_at IS NULL",
    [actor.realmId,patient.challenge_id]);
   await tx.query(
    "UPDATE cg15_patient SET profile_status='VERIFIED',revision=revision+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,patient.id]);
   await tx.query(
    "INSERT INTO cg15_patient_identity_event(root_realm_id,patient_id,center_id,"+
    "challenge_id,verified_by_account,request_key,request_digest,identity_checked_in_person) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,true)",
    [actor.realmId,patient.id,centerRef,patient.challenge_id,actor.accountId,key,signature]);
   await tx.query(
    "INSERT INTO cg15_patient_change_event(root_realm_id,patient_id,"+
    "revision_no,action,actor_account_id) VALUES($1,$2,$3,'IDENTITY_VERIFIED',$4)",
    [actor.realmId,patient.id,patient.revision+1,actor.accountId]);
   await tx.query("COMMIT");active=false;
   return {virtualPatientId:display,profileStatus:"VERIFIED",
    message:"In-person identity check recorded for the authenticated patient."};
  }catch(e){if(active)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
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
