import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
type ConsentRow={root_realm_id:string;employee_id:string;account_ref:string;
 consent_status:"GRANTED"|"REVOKED";consent_version:number};
type Person={id:string;status:string;account_ref:string};
@Injectable()
export class HrPublicBioConsentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 private async myEmployee(tx:PoolClient,actor:VerifiedFoundationActor){
  const r=await tx.query<Person>(
   "SELECT id,status,account_ref FROM hr_employee "+
   "WHERE root_realm_id=$1 AND account_ref=$2 FOR SHARE",
   [actor.realmId,actor.accountId]);
  return r.rows[0]??null;
 }
 async mine(token:string){
  const actor=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertPatientSessionCurrent(tx,actor);
   const person=await this.myEmployee(tx,actor);
   if(!person){await tx.query("COMMIT");return {linked:false,consented:false,revision:0};}
   const q=await tx.query<ConsentRow>(
    "SELECT root_realm_id,employee_id,account_ref,consent_status,consent_version "+
    "FROM hr_public_bio_consent WHERE root_realm_id=$1 AND employee_id=$2 FOR SHARE",
    [actor.realmId,person.id]);
   await tx.query("COMMIT");
   return {linked:true,
    consented:q.rows[0]?.consent_status==="GRANTED"&&
     ["ACTIVE","PROBATION"].includes(person.status),
    revision:q.rows[0]?.consent_version??0,
    purpose:"Minimal professional name and designation only; no public portrait permission"};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async decide(token:string,body:unknown){
  const actor=await this.sessions.verifySession(token);
  if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body as Record<string,unknown>).some(k=>
      !["consent","expectedRevision"].includes(k))||
    !("consent" in body)||typeof body.consent!=="boolean"||
    !("expectedRevision" in body)||
    !Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<0)
   throw new BadRequestException("Check the professional profile permission");
  const input=body as {consent:boolean;expectedRevision:number};
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertPatientSessionCurrent(tx,actor);
   const person=await this.myEmployee(tx,actor);
   if(!person)throw new ConflictException(
    "Your existing account is not linked to approved employment");
   if(input.consent&&!["ACTIVE","PROBATION"].includes(person.status))
    throw new ConflictException("Inactive employees cannot authorize public profiles");
   if(input.consent){
    const active=await tx.query(
     "SELECT 1 FROM hr_employment_assignment a JOIN branch b "+
     "ON b.id=a.branch_ref AND b.root_realm_id=a.root_realm_id "+
     "WHERE a.employee_id=$1 AND a.root_realm_id=$2 "+
     "AND a.valid_from<=CURRENT_DATE AND "+
     "(a.valid_to IS NULL OR a.valid_to>CURRENT_DATE) "+
     "AND b.status='ACTIVE' FOR SHARE OF a,b",
     [person.id,actor.realmId]);
    if(!active.rowCount)throw new ConflictException(
     "Current Foundation assignment is unavailable");
   }
   const q=await tx.query<ConsentRow>(
    "SELECT * FROM hr_public_bio_consent "+
    "WHERE root_realm_id=$1 AND employee_id=$2 FOR UPDATE",
    [actor.realmId,person.id]);
   const previous=q.rows[0],revision=previous?.consent_version??0;
   const desired=input.consent?"GRANTED":"REVOKED";
   if(revision!==input.expectedRevision){
    if(previous?.consent_status===desired&&revision===input.expectedRevision+1){
     await tx.query("COMMIT");
     return {consented:input.consent,revision,replayed:true};
    }
    throw new ConflictException(
     "Professional public-use permission changed. Refresh before updating.");
   }
   if(previous?.consent_status===desired){
    await tx.query("COMMIT");
    return {consented:input.consent,revision,replayed:true};
   }
   const next=revision+1;
   const upsert=await tx.query(
    "INSERT INTO hr_public_bio_consent(root_realm_id,employee_id,account_ref,"+
    "consent_status,consent_version,granted_at,revoked_at) "+
    "VALUES($1,$2,$3,$4,$5,"+
      "CASE WHEN $4='GRANTED' THEN now() ELSE NULL END,"+
      "CASE WHEN $4='REVOKED' THEN now() ELSE NULL END) "+
    "ON CONFLICT(root_realm_id,employee_id) DO UPDATE SET "+
    "consent_status=EXCLUDED.consent_status,"+
    "consent_version=EXCLUDED.consent_version,"+
    "account_ref=EXCLUDED.account_ref,"+
    "granted_at=EXCLUDED.granted_at,revoked_at=EXCLUDED.revoked_at,"+
    "updated_at=now() WHERE hr_public_bio_consent.consent_version=$6",
    [actor.realmId,person.id,actor.accountId,desired,next,revision]);
   if(!upsert.rowCount)throw new ConflictException(
    "Professional permission was updated by another request");
   await tx.query(
    "INSERT INTO hr_public_bio_consent_event(root_realm_id,employee_id,"+
    "account_ref,action,consent_version) VALUES($1,$2,$3,$4,$5)",
    [actor.realmId,person.id,actor.accountId,desired,next]);
   await tx.query("COMMIT");
   return {consented:input.consent,revision:next,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 /** Explicit CG10 -> CG18 narrow source seam, never a public API.
  * CG18 still independently owns editorial consent, media rights and publish.
  */
 async minimalForEditorial(tx:PoolClient,actor:VerifiedFoundationActor,employeeRef:string){
  await this.identity.assertCurrent(tx,actor,"hr.employees.view");
  const q=await tx.query<{name:string;designation:string;branch_name:string}>(
   "SELECT app.legal_name AS name,assignment.designation,b.name AS branch_name "+
   "FROM hr_employee e JOIN hr_employee_application app "+
     "ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id "+
   "JOIN hr_public_bio_consent c ON c.employee_id=e.id AND c.root_realm_id=e.root_realm_id "+
     "AND c.consent_status='GRANTED' AND c.account_ref=e.account_ref "+
   "JOIN hr_employment_assignment assignment ON assignment.employee_id=e.id "+
     "AND assignment.root_realm_id=e.root_realm_id "+
     "AND assignment.valid_from<=CURRENT_DATE AND "+
     "(assignment.valid_to IS NULL OR assignment.valid_to>CURRENT_DATE) "+
   "JOIN branch b ON b.id=assignment.branch_ref AND b.root_realm_id=e.root_realm_id "+
   "WHERE e.id=$1 AND e.root_realm_id=$2 AND e.status IN('ACTIVE','PROBATION') "+
     "AND b.status='ACTIVE' FOR SHARE OF e,c,assignment,b",
   [employeeRef,actor.realmId]);
  return q.rows[0]??null; // No scanned file reference / PAN / bank / phone / login / grants.
 }
}
