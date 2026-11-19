import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException,
 ServiceUnavailableException,ForbiddenException
} from "@nestjs/common";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

type PersonRow={
 id:string;virtual_display_id:string;first_name:string;last_name:string;
 date_of_birth:string|null;profile_status:string;revision:number;
 consent_granted:boolean|null;consent_version:string|null;
};
type AccountRow={status:string;contact_phone_verified_at:Date|null};
type CommandRow={request_digest:string;patient_id:string|null};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const VERSION=/^[A-Za-z0-9._-]{1,32}$/;
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function record(v:unknown):Record<string,unknown>{
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
 return v as Record<string,unknown>;
}
function only(v:Record<string,unknown>,names:readonly string[]){
 if(Object.keys(v).some(k=>!names.includes(k)))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
}
function reqKey(v:unknown){
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID",field:"requestKey"});
 return v;
}
function name(v:unknown,field:string,minimum:number){
 if(typeof v!=="string"||v.trim().length<minimum||v.trim().length>100||
  /[\u0000-\u001f\u007f<>]/.test(v))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID",field});
 return v.trim().replace(/\s+/g," ");
}
function birthDate(v:unknown):string|null{
 if(v===null||v===undefined||v==="")return null;
 if(typeof v!=="string"||!DATE.test(v)||!Number.isFinite(Date.parse(v+"T00:00:00Z"))||
  new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v||
  v>"2100-01-01"||v<"1900-01-01"||v>new Date().toISOString().slice(0,10))
  throw new BadRequestException({code:"CG15_PATIENT_INVALID",field:"dateOfBirth"});
 return v;
}
function revision(v:unknown){
 if(!Number.isSafeInteger(v)||Number(v)<1||Number(v)>2147483645)
  throw new BadRequestException({code:"CG15_PATIENT_INVALID",field:"expectedVersion"});
 return Number(v);
}
function policy(){
 const version=process.env.CG15_PATIENT_CONSENT_VERSION?.trim()??"";
 const text=process.env.CG15_PATIENT_CONSENT_TEXT?.trim()??"";
 return {available:VERSION.test(version)&&text.length>=40&&text.length<=3000,
  version,text};
}
/** Own-patient profile only. Uses the real CG-01 password session and its
 * verified mobile-contact proof. Never guesses patient identity from a shared
 * phone, never auto-merges two people, and grants no Center access.
 */
@Injectable()
export class PatientProfileService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly identity:SessionService){}
 consentPolicy(){
  const p=policy();
  return {available:p.available,version:p.available?p.version:null,
   text:p.available?p.text:null};
 }
 private async activeAccount(c:PoolClient,actor:VerifiedFoundationActor,proof:boolean){
  const r=await c.query<AccountRow>(
   "SELECT a.status,a.contact_phone_verified_at FROM account a "+
   "JOIN access_realm ar ON ar.id=a.realm_id AND ar.realm_key='FOUNDATION_ROOT' "+
   "WHERE a.id=$1 AND a.realm_id=$2 FOR UPDATE OF a",
   [actor.accountId,actor.realmId]);
  if(r.rows[0]?.status!=="ACTIVE")throw new ForbiddenException({code:"CG15_PATIENT_FORBIDDEN"});
  if(proof&&!r.rows[0].contact_phone_verified_at)
   throw new ForbiddenException({code:"CG15_PATIENT_CONTACT_UNVERIFIED"});
 }
 private async owned(c:PoolClient,actor:VerifiedFoundationActor,lock=false){
  const r=await c.query<PersonRow>(
   "SELECT p.id,p.virtual_display_id,p.first_name,p.last_name,"+
   "p.date_of_birth::text,p.profile_status,p.revision,"+
   "(SELECT pc.granted FROM cg15_patient_consent pc "+
   "WHERE pc.root_realm_id=p.root_realm_id AND pc.patient_id=p.id "+
   "AND pc.purpose='PATIENT_CARE' ORDER BY pc.revision_no DESC LIMIT 1) AS consent_granted,"+
   "(SELECT pc.terms_version FROM cg15_patient_consent pc "+
   "WHERE pc.root_realm_id=p.root_realm_id AND pc.patient_id=p.id "+
   "AND pc.purpose='PATIENT_CARE' ORDER BY pc.revision_no DESC LIMIT 1) AS consent_version "+
   "FROM cg15_patient_account_link l "+
   "JOIN cg15_patient p ON p.root_realm_id=l.root_realm_id AND p.id=l.patient_id "+
   "WHERE l.root_realm_id=$1 AND l.account_id=$2 AND l.revoked_at IS NULL "+
   (lock?"FOR UPDATE OF p":""),
   [actor.realmId,actor.accountId]);
  return r.rows[0]??null;
 }
 private present(row:PersonRow){
  return {virtualPatientId:row.virtual_display_id,
   firstName:row.first_name,lastName:row.last_name,
   dateOfBirth:row.date_of_birth,profileStatus:row.profile_status,
   version:row.revision,consentGranted:row.consent_granted===true,
   consentVersion:row.consent_version};
 }
 async me(bearer:string){
  const actor=await this.identity.verifySession(bearer);
  const c=await this.db.connect();
  try{
   const p=await this.owned(c,actor);
   if(!p)throw new NotFoundException({code:"CG15_PATIENT_NOT_REGISTERED"});
   return this.present(p);
  }finally{c.release();}
 }
 async register(bearer:string,input:unknown){
  const actor=await this.identity.verifySession(bearer);
  const v=record(input);
  only(v,["requestKey","firstName","lastName","dateOfBirth",
   "consentVersion","consentAccepted"]);
  const requestKey=reqKey(v.requestKey),firstName=name(v.firstName,"firstName",2);
  const lastName=name(v.lastName,"lastName",1);
  const dateOfBirth=birthDate(v.dateOfBirth);
  const submittedVersion=v.consentVersion;
  if(v.consentAccepted!==true||typeof submittedVersion!=="string"||
    !VERSION.test(submittedVersion))
   throw new BadRequestException({code:"CG15_PATIENT_CONSENT_REQUIRED",field:"consentAccepted"});
  const signature=digest({firstName,lastName,dateOfBirth,consentVersion:submittedVersion,
   consentAccepted:true});
  const c=await this.db.connect();let tx=false;
  try{
   await c.query("BEGIN");tx=true;
   await this.activeAccount(c,actor,false);
   // Replay of an already committed request must remain safe when the consent
   // version/contact proof changes after the first response was lost.
   const oldCommand=await c.query<CommandRow>(
    "SELECT request_digest,patient_id FROM cg15_patient_registration_command "+
    "WHERE root_realm_id=$1 AND account_id=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,requestKey]);
   if(oldCommand.rows[0]){
    if(oldCommand.rows[0].request_digest!==signature)
     throw new ConflictException({code:"CG15_PATIENT_REQUEST_CONFLICT"});
    if(oldCommand.rows[0].patient_id){
     const existing=await this.owned(c,actor,true);
     if(!existing||existing.id!==oldCommand.rows[0].patient_id)
      throw new ConflictException({code:"CG15_PATIENT_REQUEST_CONFLICT"});
     await c.query("COMMIT");tx=false;
     return this.present(existing);
    }
   }
   const terms=policy();
   if(!terms.available)
    throw new ServiceUnavailableException({code:"CG15_PATIENT_CONSENT_UNAVAILABLE"});
   if(submittedVersion!==terms.version)
    throw new BadRequestException({code:"CG15_PATIENT_CONSENT_REQUIRED",field:"consentAccepted"});
   await this.activeAccount(c,actor,true);
   await c.query(
    "INSERT INTO cg15_patient_registration_command(root_realm_id,account_id,request_key,request_digest) "+
    "VALUES($1,$2,$3,$4) ON CONFLICT(root_realm_id,account_id,request_key) DO NOTHING",
    [actor.realmId,actor.accountId,requestKey,signature]);
   const cmd=await c.query<CommandRow>(
    "SELECT request_digest,patient_id FROM cg15_patient_registration_command "+
    "WHERE root_realm_id=$1 AND account_id=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,requestKey]);
   if(cmd.rows[0]?.request_digest!==signature)
    throw new ConflictException({code:"CG15_PATIENT_REQUEST_CONFLICT"});
   const prior=await this.owned(c,actor,true);
   if(prior){
    if(prior.id!==cmd.rows[0].patient_id)
     throw new ConflictException({code:"CG15_PATIENT_ALREADY_REGISTERED"});
    await c.query("COMMIT");tx=false;
    return this.present(prior);
   }
   if(cmd.rows[0].patient_id)
    throw new ConflictException({code:"CG15_PATIENT_REQUEST_CONFLICT"});
   const patientId=randomUUID(),display="CGP-"+randomBytes(8).toString("hex").toUpperCase();
   await c.query(
    "INSERT INTO cg15_patient(root_realm_id,id,virtual_display_id,first_name,last_name,"+
    "date_of_birth,profile_status,created_by_account) "+
    "VALUES($1,$2,$3,$4,$5,$6,'PROVISIONAL',$7)",
    [actor.realmId,patientId,display,firstName,lastName,dateOfBirth,actor.accountId]);
   await c.query(
    "INSERT INTO cg15_patient_account_link(root_realm_id,patient_id,account_id,proof_type) "+
    "VALUES($1,$2,$3,'CG01_VERIFIED_ACCOUNT_CONTACT')",
    [actor.realmId,patientId,actor.accountId]);
   await c.query(
    "INSERT INTO cg15_patient_consent(root_realm_id,patient_id,revision_no,purpose,"+
    "terms_version,granted,recorded_by_account) "+
    "VALUES($1,$2,1,'PATIENT_CARE',$3,true,$4)",
    [actor.realmId,patientId,terms.version,actor.accountId]);
   await c.query(
    "INSERT INTO cg15_patient_change_event(root_realm_id,patient_id,revision_no,action,actor_account_id) "+
    "VALUES($1,$2,1,'REGISTERED',$3)",[actor.realmId,patientId,actor.accountId]);
   await c.query(
    "UPDATE cg15_patient_registration_command SET patient_id=$4 "+
    "WHERE root_realm_id=$1 AND account_id=$2 AND request_key=$3",
    [actor.realmId,actor.accountId,requestKey,patientId]);
   await c.query("COMMIT");tx=false;
   return {virtualPatientId:display,firstName,lastName,dateOfBirth,
    profileStatus:"PROVISIONAL",version:1,consentGranted:true,consentVersion:terms.version};
  }catch(e){if(tx)await c.query("ROLLBACK");throw e;}
  finally{c.release();}
 }
 /** Existing clinic provisional intake is claimed ONLY with a staff-
  * issued, person-specific one-time proof and the patient's own verified CG01
  * account + freshly accepted consent. Never match by phone or name.
  */
 async claimCenterIntake(bearer:string,input:unknown){
  const actor=await this.identity.verifySession(bearer);
  const v=record(input);
  only(v,["virtualPatientId","claimCode","consentAccepted","consentVersion"]);
  if(typeof v.virtualPatientId!=="string"||
    !/^CGP-[A-F0-9]{16}$/.test(v.virtualPatientId)||
    typeof v.claimCode!=="string"||
    !/^CGC-[A-F0-9]{24}$/.test(v.claimCode)||
    v.consentAccepted!==true||
    typeof v.consentVersion!=="string"||!VERSION.test(v.consentVersion))
   throw new BadRequestException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
  const display=v.virtualPatientId,claimDigest=createHash("sha256")
   .update(v.claimCode).digest("hex");
  const c=await this.db.connect();let active=false;
  try{
   await c.query("BEGIN");active=true;
   await this.activeAccount(c,actor,true);
   const linked=await this.owned(c,actor,true);
   const rows=await c.query<{
    id:string;patient_id:string;center_id:string;issued_by_account:string;
    request_key:string;claimed_at:Date|null;claimed_by_account:string|null;
    revoked_at:Date|null;expires_at:Date;profile_status:string;revision:number
   }>(
    "SELECT cl.id,cl.patient_id,cl.center_id,cl.issued_by_account,"+
    "cl.request_key,cl.claimed_at,cl.claimed_by_account,cl.revoked_at,"+
    "cl.expires_at,p.profile_status,p.revision "+
    "FROM cg15_patient_center_claim cl "+
    "JOIN cg15_patient p ON p.root_realm_id=cl.root_realm_id AND p.id=cl.patient_id "+
    "WHERE cl.root_realm_id=$1 AND p.virtual_display_id=$2 AND cl.claim_digest=$3 "+
    "FOR UPDATE OF cl,p",
    [actor.realmId,display,claimDigest]);
   const source=rows.rows[0];
   if(!source)
    throw new ConflictException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
   if(source.claimed_at){
    if(!linked||source.claimed_by_account!==actor.accountId||linked.id!==source.patient_id)
     throw new ConflictException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
    await c.query("COMMIT");active=false;
    return this.present(linked);
   }
   if(linked)
    throw new ConflictException({code:"CG15_PATIENT_ALREADY_REGISTERED"});
   const terms=policy();
   if(!terms.available||v.consentVersion!==terms.version)
    throw new BadRequestException({code:"CG15_PATIENT_CONSENT_REQUIRED"});
   if(source.revoked_at||source.expires_at.getTime()<=Date.now()||
    source.profile_status!=="PROVISIONAL")
    throw new ConflictException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
   // The center and issuing receptionist must still be current/authorized
   // within this transaction; a suspended location may not bind new patients.
   const staff=await c.query(
    "SELECT 1 FROM health_center center_source "+
    "JOIN health_provider provider_source ON provider_source.root_realm_id=center_source.root_realm_id "+
    "AND provider_source.id=center_source.provider_id "+
    "JOIN health_center_account_affiliation affiliation "+
    "ON affiliation.root_realm_id=center_source.root_realm_id "+
    "AND affiliation.center_id=center_source.id AND affiliation.account_ref=$3 "+
    "JOIN account reviewer ON reviewer.realm_id=affiliation.root_realm_id "+
    "AND reviewer.id=affiliation.account_ref "+
    "WHERE center_source.root_realm_id=$1 AND center_source.id=$2 "+
    "AND center_source.status='VERIFIED' AND center_source.access_state='ENABLED' "+
    "AND provider_source.status='VERIFIED' AND affiliation.status='ACTIVE' "+
    "AND reviewer.status='ACTIVE' "+
    "AND EXISTS(SELECT 1 FROM account_role staff_role "+
    "JOIN role assigned ON assigned.id=staff_role.role_id AND assigned.active=true "+
    "WHERE staff_role.account_id=reviewer.id AND staff_role.realm_id=reviewer.realm_id "+
    "AND staff_role.revoked_at IS NULL AND "+
    "(assigned.is_protected OR EXISTS(SELECT 1 FROM role_grant grant_source "+
    "WHERE grant_source.role_id=assigned.id "+
    "AND grant_source.capability_key='health.patients.intake'))) LIMIT 1",
    [actor.realmId,source.center_id,source.issued_by_account]);
   if(!staff.rowCount)
    throw new ConflictException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
   await c.query(
    "INSERT INTO cg15_patient_account_link(root_realm_id,patient_id,account_id,proof_type) "+
    "VALUES($1,$2,$3,'CG01_VERIFIED_ACCOUNT_CONTACT')",
    [actor.realmId,source.patient_id,actor.accountId]);
   await c.query(
    "INSERT INTO cg15_patient_consent(root_realm_id,patient_id,revision_no,purpose,"+
    "terms_version,granted,recorded_by_account) "+
    "VALUES($1,$2,$3,'PATIENT_CARE',$4,true,$5)",
    [actor.realmId,source.patient_id,source.revision+1,terms.version,actor.accountId]);
   const tokenDigest=createHash("sha256").update(randomBytes(32)).digest("hex");
   const proof=await c.query<{id:string}>(
    "INSERT INTO cg15_patient_identity_challenge(root_realm_id,patient_id,"+
    "issued_by_account,token_digest,expires_at,used_at) "+
    "VALUES($1,$2,$3,$4,now()+interval '15 minutes',now()) RETURNING id",
    [actor.realmId,source.patient_id,actor.accountId,tokenDigest]);
   await c.query(
    "INSERT INTO cg15_patient_identity_event(root_realm_id,patient_id,center_id,"+
    "challenge_id,verified_by_account,request_key,request_digest,identity_checked_in_person) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,true)",
    [actor.realmId,source.patient_id,source.center_id,proof.rows[0].id,
     source.issued_by_account,source.request_key,
     createHash("sha256").update(source.id+":"+claimDigest).digest("hex")]);
   const saved=await c.query<PersonRow>(
    "UPDATE cg15_patient SET profile_status='VERIFIED',revision=revision+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2 RETURNING id",
    [actor.realmId,source.patient_id]);
   if(!saved.rowCount)throw new ConflictException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
   await c.query(
    "INSERT INTO cg15_patient_change_event(root_realm_id,patient_id,revision_no,"+
    "action,actor_account_id) VALUES($1,$2,$3,'IDENTITY_VERIFIED',$4)",
    [actor.realmId,source.patient_id,source.revision+1,source.issued_by_account]);
   await c.query(
    "UPDATE cg15_patient_center_claim SET claimed_at=now(),claimed_by_account=$3 "+
    "WHERE root_realm_id=$1 AND id=$2 AND claimed_at IS NULL AND revoked_at IS NULL",
    [actor.realmId,source.id,actor.accountId]);
   const own=await this.owned(c,actor);
   if(!own)throw new ConflictException({code:"CG15_PATIENT_IDENTITY_PROOF_REQUIRED"});
   await c.query("COMMIT");active=false;
   return this.present(own);
  }catch(e){if(active)await c.query("ROLLBACK");throw e;}
  finally{c.release();}
 }

 async beginIdentityVerification(bearer:string){
  const actor=await this.identity.verifySession(bearer);
  const c=await this.db.connect();let tx=false;
  try{
   await c.query("BEGIN");tx=true;
   await this.activeAccount(c,actor,true);
   const patient=await this.owned(c,actor,true);
   if(!patient||patient.profile_status!=="PROVISIONAL"||
     patient.consent_granted!==true)
    throw new ForbiddenException({code:"CG15_PATIENT_IDENTITY_NOT_READY"});
   const last=await c.query<{created_at:Date}>(
    "SELECT created_at FROM cg15_patient_identity_challenge "+
    "WHERE root_realm_id=$1 AND patient_id=$2 AND used_at IS NULL "+
    "ORDER BY created_at DESC LIMIT 1",
    [actor.realmId,patient.id]);
   if(last.rows[0]&&Date.now()-last.rows[0].created_at.getTime()<60_000)
    throw new ConflictException({code:"CG15_PATIENT_IDENTITY_TOO_SOON"});
   // One currently issued code per patient. A new code invalidates all
   // older challenges; the raw code is never persisted or logged.
   await c.query(
    "UPDATE cg15_patient_identity_challenge SET used_at=now() "+
    "WHERE root_realm_id=$1 AND patient_id=$2 AND used_at IS NULL",
    [actor.realmId,patient.id]);
   const token="CGI-"+randomBytes(12).toString("hex").toUpperCase();
   const tokenDigest=createHash("sha256").update(token).digest("hex");
   const created=await c.query<{expires_at:Date}>(
    "INSERT INTO cg15_patient_identity_challenge("+
    "root_realm_id,patient_id,issued_by_account,token_digest,expires_at) "+
    "VALUES($1,$2,$3,$4,now()+interval '15 minutes') RETURNING expires_at",
    [actor.realmId,patient.id,actor.accountId,tokenDigest]);
   await c.query("COMMIT");tx=false;
   return {virtualPatientId:patient.virtual_display_id,verificationCode:token,
    expiresAt:created.rows[0].expires_at.toISOString(),
    message:"Show this code and a valid identity document to authorized center staff in person. The code expires in 15 minutes."};
  }catch(e){if(tx)await c.query("ROLLBACK");throw e;}
  finally{c.release();}
 }

 /** Signed-in, fully verified patient grants a single center one
  * short-lived receptionist booking authorization. It is not identity or
  * financial consent and cannot be used at any other center.
  */
 async beginAssistedBooking(bearer:string,input:unknown){
  const actor=await this.identity.verifySession(bearer),v=record(input);
  only(v,["centerRef"]);
  if(typeof v.centerRef!=="string"||!ID.test(v.centerRef))
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const center=v.centerRef;
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await this.activeAccount(c,actor,true);
   const patient=await this.owned(c,actor,true);
   if(!patient||patient.profile_status!=="VERIFIED"||!patient.consent_granted)
    throw new ForbiddenException({code:"CG15_PATIENT_IDENTITY_NOT_READY"});
   const proof=await c.query(
    "SELECT 1 FROM cg15_patient_identity_event WHERE root_realm_id=$1 "+
    "AND patient_id=$2 LIMIT 1",[actor.realmId,patient.id]);
   if(!proof.rowCount)
    throw new ForbiddenException({code:"CG15_PATIENT_IDENTITY_NOT_READY"});
   const current=await c.query(
    "SELECT 1 FROM health_center hc JOIN health_provider hp "+
    "ON hp.root_realm_id=hc.root_realm_id AND hp.id=hc.provider_id "+
    "WHERE hc.root_realm_id=$1 AND hc.id=$2 AND "+
    "hc.status='VERIFIED' AND hc.access_state='ENABLED' "+
    "AND hp.status='VERIFIED' LIMIT 1",[actor.realmId,center]);
   if(!current.rowCount)
    throw new NotFoundException({code:"CG15_PATIENT_CENTER_UNAVAILABLE"});
   const old=await c.query<{created_at:Date}>(
    "SELECT created_at FROM cg15_patient_assisted_booking_code "+
    "WHERE root_realm_id=$1 AND patient_id=$2 AND "+
    "consumed_at IS NULL AND revoked_at IS NULL "+
    "ORDER BY created_at DESC LIMIT 1",[actor.realmId,patient.id]);
   if(old.rows[0]&&Date.now()-old.rows[0].created_at.getTime()<60_000)
    throw new ConflictException({code:"CG15_PATIENT_IDENTITY_TOO_SOON"});
   await c.query(
    "UPDATE cg15_patient_assisted_booking_code SET revoked_at=now() "+
    "WHERE root_realm_id=$1 AND patient_id=$2 AND consumed_at IS NULL AND revoked_at IS NULL",
    [actor.realmId,patient.id]);
   const code="CGB-"+randomBytes(12).toString("hex").toUpperCase();
   const codeDigest=createHash("sha256").update(code).digest("hex");
   const saved=await c.query<{expires_at:Date}>(
    "INSERT INTO cg15_patient_assisted_booking_code("+
    "root_realm_id,patient_id,account_id,center_id,code_digest,expires_at) "+
    "VALUES($1,$2,$3,$4,$5,now()+interval '15 minutes') RETURNING expires_at",
    [actor.realmId,patient.id,actor.accountId,center,codeDigest]);
   await c.query("COMMIT");open=false;
   return {virtualPatientId:patient.virtual_display_id,centerRef:center,
    authorizationCode:code,expiresAt:saved.rows[0].expires_at.toISOString(),
    message:"Give this code only to assigned staff at your chosen healthcare center. One hold may be made during the next 15 minutes."};
  }catch(e){if(open)await c.query("ROLLBACK");throw e;}
  finally{c.release();}
 }

 async update(bearer:string,input:unknown){
  const actor=await this.identity.verifySession(bearer);
  const v=record(input);
  only(v,["expectedVersion","firstName","lastName","dateOfBirth"]);
  const expected=revision(v.expectedVersion);
  if(v.firstName===undefined&&v.lastName===undefined&&v.dateOfBirth===undefined)
   throw new BadRequestException({code:"CG15_PATIENT_INVALID"});
  const c=await this.db.connect();let tx=false;
  try{
   await c.query("BEGIN");tx=true;
   await this.activeAccount(c,actor,false);
   const old=await this.owned(c,actor,true);
   if(!old)throw new NotFoundException({code:"CG15_PATIENT_NOT_REGISTERED"});
   if(old.revision!==expected)throw new ConflictException({code:"CG15_PATIENT_CHANGED"});
   if(!["VERIFIED","PROVISIONAL"].includes(old.profile_status))
    throw new ForbiddenException({code:"CG15_PATIENT_FORBIDDEN"});
   const firstName=v.firstName===undefined?old.first_name:name(v.firstName,"firstName",2);
   const lastName=v.lastName===undefined?old.last_name:name(v.lastName,"lastName",1);
   const dateOfBirth=v.dateOfBirth===undefined?old.date_of_birth:birthDate(v.dateOfBirth);
   await c.query(
    "UPDATE cg15_patient SET first_name=$3,last_name=$4,date_of_birth=$5,"+
    "revision=revision+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,old.id,firstName,lastName,dateOfBirth]);
   await c.query(
    "INSERT INTO cg15_patient_change_event(root_realm_id,patient_id,revision_no,action,actor_account_id) "+
    "VALUES($1,$2,$3,'PROFILE_UPDATED',$4)",
    [actor.realmId,old.id,expected+1,actor.accountId]);
   await c.query("COMMIT");tx=false;
   return { ...this.present(old),firstName,lastName,dateOfBirth,version:expected+1};
  }catch(e){if(tx)await c.query("ROLLBACK");throw e;}finally{c.release();}
 }
 async consent(bearer:string,input:unknown){
  const actor=await this.identity.verifySession(bearer);
  const v=record(input);
  only(v,["expectedVersion","granted","consentVersion"]);
  const expected=revision(v.expectedVersion);
  if(typeof v.granted!=="boolean")
   throw new BadRequestException({code:"CG15_PATIENT_INVALID",field:"granted"});
  const terms=policy();
  if(v.granted&&(!terms.available||v.consentVersion!==terms.version))
   throw new BadRequestException({code:"CG15_PATIENT_CONSENT_REQUIRED"});
  const c=await this.db.connect();let tx=false;
  try{
   await c.query("BEGIN");tx=true;
   await this.activeAccount(c,actor,false);
   const old=await this.owned(c,actor,true);
   if(!old)throw new NotFoundException({code:"CG15_PATIENT_NOT_REGISTERED"});
   if(old.revision!==expected)throw new ConflictException({code:"CG15_PATIENT_CHANGED"});
   if(!["VERIFIED","PROVISIONAL"].includes(old.profile_status))
    throw new ForbiddenException({code:"CG15_PATIENT_FORBIDDEN"});
   const currentVersion=v.granted?terms.version:old.consent_version;
   if(!currentVersion)
    throw new BadRequestException({code:"CG15_PATIENT_CONSENT_REQUIRED"});
   await c.query(
    "UPDATE cg15_patient SET revision=revision+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2",[actor.realmId,old.id]);
   await c.query(
    "INSERT INTO cg15_patient_consent(root_realm_id,patient_id,revision_no,purpose,"+
    "terms_version,granted,recorded_by_account) "+
    "VALUES($1,$2,$3,'PATIENT_CARE',$4,$5,$6)",
    [actor.realmId,old.id,expected+1,currentVersion,v.granted,actor.accountId]);
   await c.query(
    "INSERT INTO cg15_patient_change_event(root_realm_id,patient_id,revision_no,action,actor_account_id) "+
    "VALUES($1,$2,$3,$4,$5)",[actor.realmId,old.id,expected+1,
     v.granted?"CONSENT_GRANTED":"CONSENT_WITHDRAWN",actor.accountId]);
   await c.query("COMMIT");tx=false;
   return {...this.present(old),version:expected+1,consentGranted:v.granted,
    consentVersion:currentVersion};
  }catch(e){if(tx)await c.query("ROLLBACK");throw e;}finally{c.release();}
 }
}
