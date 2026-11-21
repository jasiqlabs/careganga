import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=(x:unknown)=>{
 if(typeof x!=="string"||!UUID.test(x))
  throw new BadRequestException({code:"HEALTH_CLINICIAN_INVALID"});
 return x;
};
function body(raw:unknown,names:string[]){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"HEALTH_CLINICIAN_INVALID"});
 const value=raw as Record<string,unknown>;
 if(Object.keys(value).some(x=>!names.includes(x)))
  throw new BadRequestException({code:"HEALTH_CLINICIAN_INVALID"});
 return value;
}
type Link={id:string;doctor_id:string;account_id:string;status:string;revision:number};
/** CG14 owns the ONLY verified professional-account relationship.
 * An independent Foundation reviewer proposes, the authenticated individual
 * accepts; neither matching phone/name nor assigning a CG01 capability can
 * by itself make a receptionist into a clinician.
 */
@Injectable()
export class HealthClinicianIdentityService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly current:FoundationStructureIdentityFacade){}
 private async transaction<T>(run:(c:PoolClient)=>Promise<T>){
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   const result=await run(c);
   await c.query("COMMIT");open=false;return result;
  }catch(e){if(open)await c.query("ROLLBACK");throw e;}
  finally{c.release();}
 }
 /** Search only currently active CG01 staff login candidates. The reviewer
  * selects a real named person; internal IDs are never displayed to users.
  */
 async accountOptions(bearer:string,search=""){
  const actor=await this.sessions.requireAction(bearer,"health.doctors.verify");
  if(typeof search!=="string"||search.trim().length>80||
    /[\u0000-\u001f\u007f]/.test(search))
   throw new BadRequestException({code:"HEALTH_CLINICIAN_INVALID"});
  const term=search.trim().toLowerCase().replace(/[\\%_]/g,character=>"\\"+character);
  const r=await this.db.query<{id:string;display_name:string}>(
   "SELECT DISTINCT a.id,a.display_name FROM account a "+
   "JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id "+
   "AND ar.revoked_at IS NULL "+
   "JOIN role r ON r.id=ar.role_id AND r.active=true AND r.is_protected=false "+
   "JOIN role_grant visits ON visits.role_id=r.id "+
   "AND visits.capability_key='health.visits.manage' "+
   "JOIN role_grant clinical ON clinical.role_id=r.id "+
   "AND clinical.capability_key='health.visits.clinical.manage' "+
   "WHERE a.realm_id=$1 AND a.status='ACTIVE' AND a.id<>$2 "+
   "AND ($3='' OR lower(a.display_name) LIKE $3 ESCAPE '\\') "+
   "AND NOT EXISTS(SELECT 1 FROM health_doctor_account_link link "+
   "WHERE link.root_realm_id=a.realm_id AND link.account_id=a.id "+
   "AND link.status IN('PENDING','ACTIVE')) "+
   "ORDER BY a.display_name,a.id LIMIT 25",
   [actor.realmId,actor.accountId,term?"%"+term+"%":""]);
  return {options:r.rows.map(x=>({accountRef:x.id,displayName:x.display_name}))};
 }
 async doctorLink(bearer:string,doctorRaw:string){
  const actor=await this.sessions.requireAction(bearer,"health.doctors.verify");
  const doctor=id(doctorRaw);
  const r=await this.db.query<{id:string;status:string;display_name:string}>(
   "SELECT l.id,l.status,a.display_name FROM health_doctor_account_link l "+
   "JOIN account a ON a.id=l.account_id AND a.realm_id=l.root_realm_id "+
   "WHERE l.root_realm_id=$1 AND l.doctor_id=$2 "+
   "AND l.status IN('PENDING','ACTIVE') LIMIT 1",
   [actor.realmId,doctor]);
  return {link:r.rows[0]?{linkRef:r.rows[0].id,
   status:r.rows[0].status,accountName:r.rows[0].display_name}:null};
 }
 async propose(bearer:string,doctorRaw:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"health.doctors.verify");
  const doctor=id(doctorRaw),v=body(raw,["accountRef"]);
  const account=id(v.accountRef);
  if(account===actor.accountId)
   throw new ForbiddenException({code:"HEALTH_CLINICIAN_INDEPENDENT_REVIEW"});
  return this.transaction(async c=>{
   await this.current.assertCurrent(c,actor,"health.doctors.verify");
   const d=await c.query(
    "SELECT id FROM health_doctor WHERE root_realm_id=$1 AND id=$2 "+
    "AND status='VERIFIED' FOR SHARE",
    [actor.realmId,doctor]);
   if(!d.rowCount)throw new NotFoundException({code:"HEALTH_CLINICIAN_NOT_VERIFIED"});
   const a=await c.query(
    "SELECT a.id FROM account a WHERE a.realm_id=$1 AND a.id=$2 "+
    "AND a.status='ACTIVE' AND EXISTS("+
    "SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
    "AND r.active=true AND r.is_protected=false "+
    "JOIN role_grant visits ON visits.role_id=r.id "+
    "AND visits.capability_key='health.visits.manage' "+
    "JOIN role_grant clinical ON clinical.role_id=r.id "+
    "AND clinical.capability_key='health.visits.clinical.manage' "+
    "WHERE ar.account_id=a.id AND ar.realm_id=a.realm_id "+
    "AND ar.revoked_at IS NULL) FOR SHARE OF a",
    [actor.realmId,account]);
   if(!a.rowCount)throw new NotFoundException({code:"HEALTH_CLINICIAN_ACCOUNT_UNAVAILABLE"});
   // A pending/active proposal is unique for BOTH source identities. A
   // reviewer cannot silently replace a professional or reassign a login.
   const linkRef=randomUUID();
   const inserted=await c.query<{id:string}>(
    "INSERT INTO health_doctor_account_link("+
    "root_realm_id,id,doctor_id,account_id,proposed_by) "+
    "VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id",
    [actor.realmId,linkRef,doctor,account,actor.accountId]);
   if(!inserted.rowCount)
    throw new ConflictException({code:"HEALTH_CLINICIAN_LINK_CONFLICT"});
   await c.query(
    "INSERT INTO health_doctor_account_link_event("+
    "root_realm_id,link_id,action,actor_account_id) VALUES($1,$2,'PROPOSED',$3)",
    [actor.realmId,linkRef,actor.accountId]);
   return {linkRef,status:"PENDING",accepted:false};
  });
 }
 async pendingForMe(bearer:string){
  const actor=await this.sessions.verifySession(bearer);
  const rows=await this.db.query<{id:string;doctor_id:string;full_name:string}>(
   "SELECT l.id,l.doctor_id,d.full_name FROM health_doctor_account_link l "+
   "JOIN health_doctor d ON d.root_realm_id=l.root_realm_id AND d.id=l.doctor_id "+
   "WHERE l.root_realm_id=$1 AND l.account_id=$2 AND l.status='PENDING' "+
   "AND d.status='VERIFIED' ORDER BY l.proposed_at DESC LIMIT 1",
   [actor.realmId,actor.accountId]);
  return {proposal:rows.rows[0]?{
   linkRef:rows.rows[0].id,doctorName:rows.rows[0].full_name}:null};
 }
 async accept(bearer:string,linkRaw:string){
  const actor=await this.sessions.verifySession(bearer),linkRef=id(linkRaw);
  // A real recently password-authenticated session is required as the
  // professional's independent acceptance; a reviewer cannot accept for them.
  if(Date.now()-actor.passwordAuthenticatedAt.getTime()>10*60*1000||
    actor.passwordAuthenticatedAt.getTime()>Date.now()+30000)
   throw new ForbiddenException({code:"HEALTH_CLINICIAN_FRESH_LOGIN_REQUIRED"});
  return this.transaction(async c=>{
   const r=await c.query<Link>(
    "SELECT id,doctor_id,account_id,status,revision FROM "+
    "health_doctor_account_link WHERE root_realm_id=$1 AND id=$2 "+
    "AND account_id=$3 FOR UPDATE",
    [actor.realmId,linkRef,actor.accountId]);
   const link=r.rows[0];
   if(!link)throw new NotFoundException({code:"HEALTH_CLINICIAN_LINK_UNAVAILABLE"});
   if(link.status==="ACTIVE")return {status:"ACTIVE",alreadyAccepted:true};
   if(link.status!=="PENDING")
    throw new ConflictException({code:"HEALTH_CLINICIAN_LINK_REVOKED"});
   const d=await c.query(
    "SELECT id FROM health_doctor WHERE root_realm_id=$1 "+
    "AND id=$2 AND status='VERIFIED' FOR SHARE",
    [actor.realmId,link.doctor_id]);
   if(!d.rowCount)
    throw new ConflictException({code:"HEALTH_CLINICIAN_NOT_VERIFIED"});
   const current=await c.query(
    "SELECT id FROM account WHERE realm_id=$1 AND id=$2 "+
    "AND status='ACTIVE' FOR SHARE",
    [actor.realmId,actor.accountId]);
   if(!current.rowCount)
    throw new ForbiddenException({code:"HEALTH_CLINICIAN_ACCOUNT_UNAVAILABLE"});
   await c.query(
    "UPDATE health_doctor_account_link SET status='ACTIVE',accepted_at=now(),"+
    "revision=revision+1 WHERE root_realm_id=$1 AND id=$2 AND status='PENDING'",
    [actor.realmId,linkRef]);
   await c.query(
    "INSERT INTO health_doctor_account_link_event("+
    "root_realm_id,link_id,action,actor_account_id) VALUES($1,$2,'ACCEPTED',$3)",
    [actor.realmId,linkRef,actor.accountId]);
   return {status:"ACTIVE",alreadyAccepted:false};
  });
 }
 async revoke(bearer:string,linkRaw:string){
  const actor=await this.sessions.requireAction(bearer,"health.doctors.verify");
  const linkRef=id(linkRaw);
  return this.transaction(async c=>{
   await this.current.assertCurrent(c,actor,"health.doctors.verify");
   const r=await c.query<Link>(
    "SELECT id,doctor_id,account_id,status,revision FROM "+
    "health_doctor_account_link WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
    [actor.realmId,linkRef]);
   const link=r.rows[0];
   if(!link)throw new NotFoundException({code:"HEALTH_CLINICIAN_LINK_UNAVAILABLE"});
   if(link.account_id===actor.accountId)
    throw new ForbiddenException({code:"HEALTH_CLINICIAN_INDEPENDENT_REVIEW"});
   if(link.status==="REVOKED")return {status:"REVOKED",changed:false};
   await c.query(
    "UPDATE health_doctor_account_link SET status='REVOKED',"+
    "revoked_at=now(),revoked_by=$3,revision=revision+1 "+
    "WHERE root_realm_id=$1 AND id=$2 AND status<>'REVOKED'",
    [actor.realmId,linkRef,actor.accountId]);
   await c.query(
    "INSERT INTO health_doctor_account_link_event("+
    "root_realm_id,link_id,action,actor_account_id) VALUES($1,$2,'REVOKED',$3)",
    [actor.realmId,linkRef,actor.accountId]);
   return {status:"REVOKED",changed:true};
  });
 }
 /** CG14-owned current clinician→center assignment labels. CG15 can read
  * these only after current CG01 clinical action; no shadow doctor master.
  */
 async currentClinicalAssignments(tx:PoolClient,actor:VerifiedFoundationActor){
  const q=await tx.query<{
   doctor_ref:string;doctor_name:string;center_ref:string;
   center_name:string;time_zone:string}>(
   "SELECT DISTINCT d.id AS doctor_ref,d.full_name AS doctor_name,"+
   "c.id AS center_ref,c.display_name AS center_name,c.time_zone "+
   "FROM health_doctor_account_link l "+
   "JOIN health_doctor d ON d.root_realm_id=l.root_realm_id "+
   "AND d.id=l.doctor_id AND d.status='VERIFIED' "+
   "JOIN health_doctor_center dc ON dc.root_realm_id=d.root_realm_id "+
   "AND dc.doctor_id=d.id AND dc.affiliation_state='APPROVED' "+
   "AND dc.approved_from<=now() "+
   "AND (dc.approved_to IS NULL OR dc.approved_to>now()) "+
   "JOIN health_center c ON c.root_realm_id=dc.root_realm_id "+
   "AND c.id=dc.center_id AND c.status='VERIFIED' "+
   "AND c.access_state='ENABLED' "+
   "JOIN health_provider p ON p.root_realm_id=c.root_realm_id "+
   "AND p.id=c.provider_id AND p.status='VERIFIED' "+
   "JOIN health_center_account_affiliation f ON "+
   "f.root_realm_id=c.root_realm_id AND f.center_id=c.id "+
   "AND f.account_ref=l.account_id AND f.status='ACTIVE' "+
   "JOIN account a ON a.id=l.account_id AND a.realm_id=l.root_realm_id "+
   "AND a.status='ACTIVE' "+
   "WHERE l.root_realm_id=$1 AND l.account_id=$2 "+
   "AND l.status='ACTIVE' AND l.accepted_at IS NOT NULL "+
   "ORDER BY d.full_name,c.display_name,d.id,c.id LIMIT 51",
   [actor.realmId,actor.accountId]);
  if(q.rows.length>50)
   throw new ConflictException({code:"CLINICIAN_ASSIGNMENT_LIST_LIMIT"});
  return q.rows.map(x=>({
   doctorRef:x.doctor_ref,doctorName:x.doctor_name,
   centerRef:x.center_ref,centerName:x.center_name,timeZone:x.time_zone
  }));
 }
 async assertCurrentAppointmentClinician(
  tx:PoolClient,actor:VerifiedFoundationActor,center:string,doctor:string){
  // CG15 independently checks current center action and appointment; this
  // CG14 owner assertion ties the actual professional, account and center.
  const r=await tx.query(
   "SELECT 1 FROM health_doctor_account_link l "+
   "JOIN health_doctor d ON d.root_realm_id=l.root_realm_id "+
   "AND d.id=l.doctor_id AND d.status='VERIFIED' "+
   "JOIN health_doctor_center assoc ON assoc.root_realm_id=d.root_realm_id "+
   "AND assoc.doctor_id=d.id AND assoc.center_id=$3 "+
   "JOIN account a ON a.id=l.account_id AND a.realm_id=l.root_realm_id "+
   "WHERE l.root_realm_id=$1 AND l.account_id=$2 AND l.doctor_id=$4 "+
   "AND l.status='ACTIVE' AND l.accepted_at IS NOT NULL "+
   "AND assoc.affiliation_state='APPROVED' "+
   "AND assoc.approved_from<=now() "+
   "AND (assoc.approved_to IS NULL OR assoc.approved_to>now()) "+
   "AND a.status='ACTIVE' "+
   "FOR SHARE OF l,d,assoc,a",
   [actor.realmId,actor.accountId,center,doctor]);
  if(!r.rowCount)
   throw new ForbiddenException({code:"HEALTH_CLINICIAN_NOT_ASSIGNED"});
 }
}
