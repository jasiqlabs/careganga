import {
  BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LICENSE=/^[A-Za-z0-9][A-Za-z0-9 ./-]{2,79}$/;
const JURISDICTION=/^[A-Z0-9][A-Z0-9 -]{1,79}$/;
const CONTROL=/[\u0000-\u001f\u007f]/;
type DoctorDraft={
  fullName:string;registrationJurisdiction:string;registrationNumber:string;
  qualifications:string[];specialties:string[];experienceYears:number;
  publicBio:string;portraitRightsStatus:"NONE"|"CONSENT_PENDING";
  professionalLicenseValidThrough:string|null;
};
type Actor=VerifiedFoundationActor;
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const validId=(x:unknown,field:string)=>{
  if(typeof x!=="string"||!UUID.test(x))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field});
  return x;
};
const object=(x:unknown,field:string)=>{
  if(!x||typeof x!=="object"||Array.isArray(x))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field});
  return x as Record<string,unknown>;
};
const fields=(x:Record<string,unknown>,keys:string[],name:string)=>{
  if(Object.keys(x).some(key=>!keys.includes(key)))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:name});
};
const text=(x:unknown,field:string,min:number,max:number)=>{
  if(typeof x!=="string"||CONTROL.test(x)||/[<>]/.test(x))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field});
  const value=x.trim().replace(/\s+/g," ");
  if(value.length<min||value.length>max)
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field});
  return value;
};
const names=(input:unknown,field:string,max:number)=>{
  if(!Array.isArray(input)||input.length>max)
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field});
  const values=input.map(x=>text(x,field,2,100));
  if(new Set(values.map(x=>x.toLowerCase())).size!==values.length)
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field});
  return values;
};
function parseDraft(value:unknown):DoctorDraft{
  const x=object(value,"doctor");
  fields(x,["fullName","registrationJurisdiction","registrationNumber",
    "qualifications","specialties","experienceYears","publicBio",
    "portraitRightsStatus","professionalLicenseValidThrough"],"doctor");
  const jurisdiction=text(x.registrationJurisdiction,"registrationJurisdiction",2,80)
    .toUpperCase();
  const registration=text(x.registrationNumber,"registrationNumber",3,80);
  if(!JURISDICTION.test(jurisdiction)||!LICENSE.test(registration)||
    !/[A-Za-z0-9]{3}/.test(registration.replace(/[\s/-]+/g,""))||
    !Number.isSafeInteger(x.experienceYears)||Number(x.experienceYears)<0||
    Number(x.experienceYears)>70)
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"registrationNumber"});
  if(x.portraitRightsStatus!=="NONE"&&x.portraitRightsStatus!=="CONSENT_PENDING")
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"portraitRightsStatus"});
  // Neither an unverified consent declaration nor an applicant's biography
  // can set VERIFIED or public status. CG-19 must verify actual media rights.
  const bio=x.publicBio===undefined?"":text(x.publicBio,"publicBio",0,2000);
  const expires=x.professionalLicenseValidThrough;
  let professionalLicenseValidThrough:string|null=null;
  if(expires!==undefined&&expires!==null&&expires!==""){
   if(typeof expires!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(expires))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",
     field:"professionalLicenseValidThrough"});
   const parsed=Date.parse(expires+"T00:00:00Z");
   if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==expires)
    throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",
     field:"professionalLicenseValidThrough"});
   professionalLicenseValidThrough=expires;
  }
  return {fullName:text(x.fullName,"fullName",2,160),
    registrationJurisdiction:jurisdiction,registrationNumber:registration,
    qualifications:names(x.qualifications??[],"qualifications",15),
    specialties:names(x.specialties??[],"specialties",12),
    experienceYears:Number(x.experienceYears),publicBio:bio,
    portraitRightsStatus:x.portraitRightsStatus,
    professionalLicenseValidThrough};
}
function expected(x:unknown){
  if(!Number.isSafeInteger(x)||Number(x)<1||Number(x)>2147483646)
    throw new BadRequestException({code:"HEALTH_DOCTOR_VERSION_INVALID",field:"expectedVersion"});
  return Number(x);
}
type CommandRow={id:string;request_digest:string;result_ref:string|null;result_version:number|null};

@Injectable()
export class HealthDoctorDraftService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identity:FoundationStructureIdentityFacade){}

  private async transaction<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
    const tx=await this.db.connect();let open=false;
    try{
      await tx.query("BEGIN");open=true;
      await tx.query("SET LOCAL lock_timeout='3s'");
      await tx.query("SET LOCAL statement_timeout='12s'");
      const result=await fn(tx);
      await tx.query("COMMIT");open=false;
      return result;
    }catch(e){
      if(open)try{await tx.query("ROLLBACK");}catch{}
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505"){
        const db=e as {constraint?:string};
        if(db.constraint?.startsWith("health_doctor_center_"))
          throw new ConflictException({code:"HEALTH_DOCTOR_ASSOCIATION_CHANGED"});
        throw new ConflictException({code:"HEALTH_DOCTOR_DUPLICATE",field:"registrationNumber"});
      }
      throw e;
    }finally{tx.release();}
  }
  private async command(tx:PoolClient,actor:Actor,action:string,
    requestKey:unknown,payload:unknown){
    const key=validId(requestKey,"requestKey"),hash=digest(payload);
    const inserted=await tx.query<{id:string}>(
      "INSERT INTO health_network_command(root_realm_id,actor_ref,action_key,"+
      "request_key,request_digest) VALUES($1,$2,$3,$4,$5) "+
      "ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) "+
      "DO NOTHING RETURNING id",
      [actor.realmId,actor.accountId,action,key,hash]);
    if(inserted.rows[0])return {id:inserted.rows[0].id,replay:null as CommandRow|null};
    const old=await tx.query<CommandRow>(
      "SELECT id,request_digest,result_ref,result_version FROM health_network_command "+
      "WHERE root_realm_id=$1 AND actor_ref=$2 AND action_key=$3 AND request_key=$4 FOR SHARE",
      [actor.realmId,actor.accountId,action,key]);
    if(!old.rows[0]||old.rows[0].request_digest!==hash||!old.rows[0].result_ref)
      throw new ConflictException({code:"HEALTH_DOCTOR_REQUEST_CONFLICT"});
    return {id:null,replay:old.rows[0]};
  }
  private async recorded(tx:PoolClient,actor:Actor,commandId:string,
    action:string,doctorRef:string,centerRef:string|null,resultRef:string,version:number){
    await tx.query("UPDATE health_network_command SET result_ref=$2,result_version=$3 "+
      "WHERE id=$1",[commandId,resultRef,version]);
    await tx.query("INSERT INTO health_doctor_event(root_realm_id,doctor_id,center_id,"+
      "actor_ref,action_key,record_version,command_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [actor.realmId,doctorRef,centerRef,actor.accountId,action,version,commandId]);
  }
  private async actor(bearer:string,action:"health.doctors.view"|"health.doctors.manage"|"health.doctors.verify"|"health.centers.draft.edit"){
    return this.sessions.requireAction(bearer,action);
  }
  async create(bearer:string,body:unknown){
    const x=object(body,"doctor");
    fields(x,["requestKey","doctor"],"doctor");
    const draft=parseDraft(x.doctor),actor=await this.actor(bearer,"health.doctors.manage");
    return this.transaction(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.manage");
      const cmd=await this.command(tx,actor,"DOCTOR_DRAFT_CREATE",x.requestKey,draft);
      if(cmd.replay)return {doctorRef:cmd.replay.result_ref,version:cmd.replay.result_version,
        status:"PENDING",replayed:true};
      const created=await tx.query<{id:string;version:number}>(
        "INSERT INTO health_doctor(root_realm_id,registration_jurisdiction,"+
        "registration_number,full_name,normalized_name,qualifications,specialties,"+
        "experience_years,public_bio,portrait_rights_status,"+
        "professional_license_valid_through,created_by) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,version",
        [actor.realmId,draft.registrationJurisdiction,draft.registrationNumber,
        draft.fullName,draft.fullName.toLowerCase(),draft.qualifications,
        draft.specialties,draft.experienceYears,draft.publicBio,
        draft.portraitRightsStatus,draft.professionalLicenseValidThrough,actor.accountId]);
      const row=created.rows[0];
      await this.recorded(tx,actor,cmd.id!,"DOCTOR_DRAFT_CREATE",row.id,null,
        row.id,row.version);
      return {doctorRef:row.id,version:row.version,status:"PENDING",replayed:false,
        message:"Doctor registration saved as pending. Independent license verification is required."};
    });
  }
  async update(bearer:string,doctorRef:string,body:unknown){
    const ref=validId(doctorRef,"doctorRef"),x=object(body,"doctor");
    fields(x,["requestKey","expectedVersion","doctor"],"doctor");
    const draft=parseDraft(x.doctor),v=expected(x.expectedVersion);
    const actor=await this.actor(bearer,"health.doctors.manage");
    return this.transaction(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.manage");
      const cmd=await this.command(tx,actor,"DOCTOR_DRAFT_UPDATE",x.requestKey,
        {ref,v,draft});
      if(cmd.replay)return {doctorRef:cmd.replay.result_ref,
        version:cmd.replay.result_version,status:"PENDING",replayed:true};
      const current=await tx.query<{version:number;status:string}>(
        "SELECT version,status FROM health_doctor "+
        "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,ref]);
      if(!current.rows[0]||current.rows[0].status!=="PENDING")
        throw new NotFoundException({code:"HEALTH_DOCTOR_NOT_PENDING"});
      if(current.rows[0].version!==v)
        throw new ConflictException({code:"HEALTH_DOCTOR_VERSION_CHANGED"});
      await tx.query("UPDATE health_doctor SET registration_jurisdiction=$3,"+
        "registration_number=$4,full_name=$5,normalized_name=$6,"+
        "qualifications=$7,specialties=$8,experience_years=$9,"+
        "public_bio=$10,portrait_rights_status=$11,"+
        "professional_license_valid_through=$12,version=version+1,"+
        "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,ref,draft.registrationJurisdiction,draft.registrationNumber,
          draft.fullName,draft.fullName.toLowerCase(),draft.qualifications,draft.specialties,
          draft.experienceYears,draft.publicBio,draft.portraitRightsStatus,
          draft.professionalLicenseValidThrough]);
      await this.recorded(tx,actor,cmd.id!,"DOCTOR_DRAFT_UPDATE",ref,null,ref,v+1);
      return {doctorRef:ref,version:v+1,status:"PENDING",replayed:false,
        message:"Pending doctor draft updated. No approval or public listing was created."};
    });
  }
  async list(bearer:string,offset=0,search="",status=""){
    const actor=await this.actor(bearer,"health.doctors.view");
    if(!Number.isInteger(offset)||offset<0||offset>10000||
      typeof search!=="string"||search.length>80||/[\u0000-\u001f\u007f]/.test(search)||
      !["","PENDING","VERIFIED","SUSPENDED"].includes(status))
      throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"search"});
    const r=await this.db.query<{id:string;full_name:string;status:string;
      version:number;specialties:string[]}>(
      "SELECT id,full_name,status,version,specialties FROM health_doctor "+
      "WHERE root_realm_id=$1 AND ($4::text='' OR status::text=$4) "+
      "AND ($3::text='' OR position($3 in normalized_name)>0 "+
      "OR position($3 in lower(registration_number))>0 "+
      "OR EXISTS(SELECT 1 FROM unnest(specialties) AS s(value) WHERE position($3 in lower(s.value))>0)) "+
      "ORDER BY normalized_name,id LIMIT 51 OFFSET $2",
      [actor.realmId,offset,search.trim().toLowerCase(),status]);
    return {doctors:r.rows.slice(0,50).map(x=>({
      doctorRef:x.id,name:x.full_name,status:x.status,version:x.version,
      specialties:x.specialties
    })),nextOffset:r.rows.length>50?offset+50:null};
  }
  async detail(bearer:string,doctorRef:string){
    const actor=await this.actor(bearer,"health.doctors.view");
    const ref=validId(doctorRef,"doctorRef");
    const r=await this.db.query<{id:string;full_name:string;registration_jurisdiction:string;
      registration_number:string;qualifications:string[];specialties:string[];
      experience_years:number;public_bio:string;portrait_rights_status:string;
      professional_license_valid_through:string|null;
      status:string;version:number}>(
      "SELECT id,full_name,registration_jurisdiction,registration_number,"+
      "qualifications,specialties,experience_years,public_bio,"+
      "portrait_rights_status,"+
      "to_char(professional_license_valid_through,'YYYY-MM-DD') AS professional_license_valid_through,"+
      "status,version FROM health_doctor "+
      "WHERE root_realm_id=$1 AND id=$2",[actor.realmId,ref]);
    const d=r.rows[0];
    if(!d)throw new NotFoundException({code:"HEALTH_DOCTOR_UNAVAILABLE"});
    // Private licence number is deliberately not returned by public APIs.
    return {doctorRef:d.id,status:d.status,version:d.version,
      doctor:{fullName:d.full_name,registrationJurisdiction:d.registration_jurisdiction,
        registrationNumber:d.registration_number,qualifications:d.qualifications,
        specialties:d.specialties,experienceYears:d.experience_years,
        publicBio:d.public_bio,portraitRightsStatus:d.portrait_rights_status,
        professionalLicenseValidThrough:d.professional_license_valid_through}};
  }
  async proposeCenter(bearer:string,doctorRef:string,body:unknown){
    const ref=validId(doctorRef,"doctorRef"),x=object(body,"center");
    fields(x,["requestKey","centerRef"],"center");
    const centerRef=validId(x.centerRef,"centerRef");
    const actor=await this.actor(bearer,"health.doctors.manage");
    return this.transaction(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.manage");
      const cmd=await this.command(tx,actor,"DOCTOR_CENTER_PROPOSE",x.requestKey,
        {doctorRef:ref,centerRef});
      if(cmd.replay)return {associationRef:cmd.replay.result_ref,
        version:cmd.replay.result_version,status:"PENDING",replayed:true};
      const doctor=await tx.query(
        "SELECT id FROM health_doctor WHERE root_realm_id=$1 AND id=$2 "+
        "AND status='VERIFIED' FOR SHARE",[actor.realmId,ref]);
      if(!doctor.rowCount)
        throw new ConflictException({code:"HEALTH_DOCTOR_NOT_VERIFIED"});
      const center=await tx.query(
        "SELECT c.id FROM health_center c JOIN health_provider p "+
        "ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
        "WHERE c.root_realm_id=$1 AND c.id=$2 AND c.status='VERIFIED' "+
        "AND p.status='VERIFIED' FOR SHARE OF c,p",
        [actor.realmId,centerRef]);
      if(!center.rowCount)
        throw new ConflictException({code:"HEALTH_CENTER_NOT_VERIFIED"});
      const created=await tx.query<{id:string;version:number}>(
        "INSERT INTO health_doctor_center(root_realm_id,doctor_id,center_id,proposed_by) "+
        "VALUES($1,$2,$3,$4) RETURNING id,version",
        [actor.realmId,ref,centerRef,actor.accountId]);
      await this.recorded(tx,actor,cmd.id!,"DOCTOR_CENTER_PROPOSE",ref,centerRef,
        created.rows[0].id,created.rows[0].version);
      return {associationRef:created.rows[0].id,version:created.rows[0].version,
        status:"PENDING",replayed:false,
        message:"Center association proposed. It is not active or publicly visible."};
    });
  }
  /** Center staff may only propose a doctor for their own current ACTIVE
   * affiliation. This intentionally exposes no doctor license or proof fields.
   */
  private async assertOwnCenter(tx:PoolClient,actor:Actor,centerRef:string){
    // Explicit parent-to-child locking: provider → center → assignment.
    // A revoked or disabled center never retains fee/doctor write access.
    const source=await tx.query<{provider_id:string}>(
      "SELECT provider_id FROM health_center WHERE root_realm_id=$1 AND id=$2",
      [actor.realmId,centerRef]);
    if(!source.rows[0])
      throw new NotFoundException({code:"HEALTH_CENTER_STAFF_UNAVAILABLE"});
    const provider=await tx.query<{status:string}>(
      "SELECT status FROM health_provider WHERE root_realm_id=$1 AND id=$2 FOR SHARE",
      [actor.realmId,source.rows[0].provider_id]);
    const center=await tx.query<{status:string;access_state:string}>(
      "SELECT status,access_state FROM health_center WHERE root_realm_id=$1 "+
      "AND provider_id=$2 AND id=$3 FOR SHARE",
      [actor.realmId,source.rows[0].provider_id,centerRef]);
    if(provider.rows[0]?.status!=="VERIFIED"||
       center.rows[0]?.status!=="VERIFIED"||
       center.rows[0]?.access_state!=="ENABLED")
      throw new NotFoundException({code:"HEALTH_CENTER_STAFF_UNAVAILABLE"});
    const assignment=await tx.query(
      "SELECT f.id FROM health_center_account_affiliation f "+
      "JOIN account a ON a.id=f.account_ref AND a.realm_id=f.root_realm_id "+
      "WHERE f.root_realm_id=$1 AND f.center_id=$2 AND f.account_ref=$3 "+
      "AND f.status='ACTIVE' AND a.status='ACTIVE' FOR SHARE OF f,a",
      [actor.realmId,centerRef,actor.accountId]);
    if(!assignment.rowCount)
      throw new NotFoundException({code:"HEALTH_CENTER_STAFF_UNAVAILABLE"});
  }
  async ownEligibleDoctors(bearer:string,centerRef:string,q=""){
    const center=validId(centerRef,"centerRef"),term=q.trim();
    if(term.length>80||CONTROL.test(term))
      throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"q"});
    const actor=await this.actor(bearer,"health.centers.draft.edit");
    return this.transaction(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.centers.draft.edit");
      await this.assertOwnCenter(tx,actor,center);
      const result=await tx.query<{id:string;full_name:string;specialties:string[]}>(
        "SELECT d.id,d.full_name,d.specialties FROM health_doctor d "+
        "WHERE d.root_realm_id=$1 AND d.status='VERIFIED' "+
        "AND ($3::text='' OR d.full_name ILIKE ('%' || $3 || '%')) "+
        "AND NOT EXISTS (SELECT 1 FROM health_doctor_center dc "+
        "WHERE dc.root_realm_id=d.root_realm_id AND dc.doctor_id=d.id "+
        "AND dc.center_id=$2) ORDER BY d.normalized_name,d.id LIMIT 50",
        [actor.realmId,center,term]);
      return {doctors:result.rows.map(d=>({
        doctorRef:d.id,name:d.full_name,specialties:d.specialties
      }))};
    });
  }
  async proposeOwnCenter(bearer:string,centerRef:string,body:unknown){
    const center=validId(centerRef,"centerRef"),x=object(body,"center");
    fields(x,["requestKey","doctorRef"],"center");
    const doctor=validId(x.doctorRef,"doctorRef");
    const actor=await this.actor(bearer,"health.centers.draft.edit");
    return this.transaction(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.centers.draft.edit");
      await this.assertOwnCenter(tx,actor,center);
      const cmd=await this.command(tx,actor,"DOCTOR_CENTER_PROPOSE",x.requestKey,
        {doctorRef:doctor,centerRef:center});
      if(cmd.replay)return {associationRef:cmd.replay.result_ref,
        version:cmd.replay.result_version,status:"PENDING",replayed:true};
      const existing=await tx.query(
        "SELECT id FROM health_doctor WHERE root_realm_id=$1 AND id=$2 "+
        "AND status='VERIFIED' FOR SHARE",[actor.realmId,doctor]);
      if(!existing.rowCount)
        throw new NotFoundException({code:"HEALTH_DOCTOR_UNAVAILABLE"});
      const created=await tx.query<{id:string;version:number}>(
        "INSERT INTO health_doctor_center(root_realm_id,doctor_id,center_id,proposed_by) "+
        "VALUES($1,$2,$3,$4) RETURNING id,version",
        [actor.realmId,doctor,center,actor.accountId]);
      await this.recorded(tx,actor,cmd.id!,"DOCTOR_CENTER_PROPOSE",doctor,center,
        created.rows[0].id,created.rows[0].version);
      return {associationRef:created.rows[0].id,version:created.rows[0].version,
        status:"PENDING",replayed:false,
        message:"Doctor association requested for this center. Foundation approval is required."};
    });
  }
  async suspendDoctor(bearer:string,doctorRef:string,body:unknown){
    const ref=validId(doctorRef,"doctorRef"),x=object(body,"doctor");
    fields(x,["requestKey","expectedVersion","currentPassword"],"doctor");
    const v=expected(x.expectedVersion);
    if(typeof x.currentPassword!=="string")
      throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"currentPassword"});
    const actor=await this.actor(bearer,"health.doctors.verify");
    await this.sessions.limitFoundationRootProof(actor);
    return this.transaction(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.verify");
      await this.sessions.requireFreshFoundationRootProof(
        tx,actor,x.currentPassword as string);
      const cmd=await this.command(tx,actor,"DOCTOR_SUSPEND",x.requestKey,{ref,v});
      if(cmd.replay)return {doctorRef:cmd.replay.result_ref,
        version:cmd.replay.result_version,status:"SUSPENDED",replayed:true};
      const doctor=await tx.query<{status:string;version:number}>(
        "SELECT status,version FROM health_doctor "+
        "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,ref]);
      const current=doctor.rows[0];
      if(!current)throw new NotFoundException({code:"HEALTH_DOCTOR_UNAVAILABLE"});
      if(current.status!=="VERIFIED"||current.version!==v)
        throw new ConflictException({code:"HEALTH_DOCTOR_VERSION_CHANGED"});
      // Global professional suspension invalidates every center association,
      // without changing the independent price/evidence history or other doctors.
      await tx.query(
        "UPDATE health_doctor_center SET affiliation_state='SUSPENDED',"+
        "version=version+1,updated_at=now() WHERE root_realm_id=$1 "+
        "AND doctor_id=$2 AND affiliation_state IN('PENDING','APPROVED')",
        [actor.realmId,ref]);
      await tx.query(
        "UPDATE health_doctor SET status='SUSPENDED',version=version+1,"+
        "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,ref]);
      await this.recorded(tx,actor,cmd.id!,"DOCTOR_SUSPEND",ref,null,ref,v+1);
      return {doctorRef:ref,version:v+1,status:"SUSPENDED",replayed:false,
        message:"Doctor verification suspended at all centers. Old prices and evidence remain private history; no appointment was created."};
    });
  }
  async eligibleCenters(bearer:string,q=""){
    const actor=await this.actor(bearer,"health.doctors.manage");
    const term=q.trim();
    if(term.length>80||CONTROL.test(term))
      throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"q"});
    const r=await this.db.query<{id:string;display_name:string;legal_name:string;pin_code:string}>(
      "SELECT c.id,c.display_name,p.legal_name,c.pin_code FROM health_center c "+
      "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
      "WHERE c.root_realm_id=$1 AND c.status='VERIFIED' AND c.access_state='ENABLED' "+
      "AND p.status='VERIFIED' AND "+
      "($2::text='' OR c.display_name ILIKE ('%' || $2 || '%')) "+
      "ORDER BY c.display_name,c.id LIMIT 50",
      [actor.realmId,term]);
    return {centers:r.rows.map(x=>({centerRef:x.id,name:x.display_name,
      providerName:x.legal_name,pinCode:x.pin_code}))};
  }
  async approveCenter(bearer:string,doctorRef:string,associationRef:string,body:unknown){
    const doctorId=validId(doctorRef,"doctorRef");
    const associationId=validId(associationRef,"associationRef");
    const x=object(body,"center");
    fields(x,["requestKey","expectedVersion"],"center");
    const v=expected(x.expectedVersion);
    const actor=await this.actor(bearer,"health.doctors.verify");
    return this.transaction(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.verify");
      const cmd=await this.command(tx,actor,"DOCTOR_CENTER_APPROVE",x.requestKey,
        {doctorId,associationId,v});
      if(cmd.replay)return {associationRef:cmd.replay.result_ref,
        version:cmd.replay.result_version,status:"APPROVED",replayed:true};
      // Parent-first lock order matches healthcare fee and center suspension.
      const source=await tx.query<{center_id:string;provider_id:string}>(
        "SELECT a.center_id,c.provider_id FROM health_doctor_center a "+
        "JOIN health_center c ON c.root_realm_id=a.root_realm_id AND c.id=a.center_id "+
        "WHERE a.root_realm_id=$1 AND a.doctor_id=$2 AND a.id=$3",
        [actor.realmId,doctorId,associationId]);
      if(!source.rows[0])
        throw new NotFoundException({code:"HEALTH_DOCTOR_ASSOCIATION_UNAVAILABLE"});
      const provider=await tx.query(
        "SELECT id FROM health_provider WHERE root_realm_id=$1 AND id=$2 "+
        "AND status='VERIFIED' FOR SHARE",
        [actor.realmId,source.rows[0].provider_id]);
      const center=await tx.query(
        "SELECT id FROM health_center WHERE root_realm_id=$1 AND id=$2 "+
        "AND provider_id=$3 AND status='VERIFIED' AND access_state='ENABLED' FOR SHARE",
        [actor.realmId,source.rows[0].center_id,source.rows[0].provider_id]);
      if(!provider.rowCount||!center.rowCount)
        throw new ConflictException({code:"HEALTH_CENTER_NOT_VERIFIED"});
      const doctor=await tx.query(
        "SELECT id FROM health_doctor WHERE root_realm_id=$1 AND id=$2 "+
        "AND status='VERIFIED' FOR SHARE",[actor.realmId,doctorId]);
      if(!doctor.rowCount)
        throw new ConflictException({code:"HEALTH_DOCTOR_NOT_VERIFIED"});
      const association=await tx.query<{version:number;affiliation_state:string;center_id:string}>(
        "SELECT version,affiliation_state,center_id FROM health_doctor_center "+
        "WHERE root_realm_id=$1 AND doctor_id=$2 AND id=$3 AND center_id=$4 FOR UPDATE",
        [actor.realmId,doctorId,associationId,source.rows[0].center_id]);
      const current=association.rows[0];
      if(!current)
        throw new NotFoundException({code:"HEALTH_DOCTOR_ASSOCIATION_UNAVAILABLE"});
      if(current.version!==v||current.affiliation_state!=="PENDING")
        throw new ConflictException({code:"HEALTH_DOCTOR_ASSOCIATION_CHANGED"});
      await tx.query(
        "UPDATE health_doctor_center SET affiliation_state='APPROVED',"+
        "approved_from=now(),approved_by=$4,version=version+1,updated_at=now() "+
        "WHERE root_realm_id=$1 AND doctor_id=$2 AND id=$3",
        [actor.realmId,doctorId,associationId,actor.accountId]);
      await this.recorded(tx,actor,cmd.id!,"DOCTOR_CENTER_APPROVE",
        doctorId,current.center_id,associationId,v+1);
      return {associationRef:associationId,version:v+1,status:"APPROVED",
        replayed:false,message:"Doctor approved for this center only. No public listing or booking was created."};
    });
  }
  async suspendCenter(bearer:string,doctorRef:string,associationRef:string,body:unknown){
    const doctorId=validId(doctorRef,"doctorRef");
    const associationId=validId(associationRef,"associationRef");
    const x=object(body,"center");
    fields(x,["requestKey","expectedVersion"],"center");
    const v=expected(x.expectedVersion);
    const actor=await this.actor(bearer,"health.doctors.verify");
    return this.transaction(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.verify");
      const cmd=await this.command(tx,actor,"DOCTOR_CENTER_SUSPEND",x.requestKey,
        {doctorId,associationId,v});
      if(cmd.replay)return {associationRef:cmd.replay.result_ref,
        version:cmd.replay.result_version,status:"SUSPENDED",replayed:true};
      const found=await tx.query<{version:number;affiliation_state:string;center_id:string}>(
        "SELECT version,affiliation_state,center_id FROM health_doctor_center "+
        "WHERE root_realm_id=$1 AND doctor_id=$2 AND id=$3 FOR UPDATE",
        [actor.realmId,doctorId,associationId]);
      const current=found.rows[0];
      if(!current)
        throw new NotFoundException({code:"HEALTH_DOCTOR_ASSOCIATION_UNAVAILABLE"});
      if(current.version!==v||current.affiliation_state!=="APPROVED")
        throw new ConflictException({code:"HEALTH_DOCTOR_ASSOCIATION_CHANGED"});
      await tx.query(
        "UPDATE health_doctor_center SET affiliation_state='SUSPENDED',"+
        "approved_to=now(),version=version+1,updated_at=now() "+
        "WHERE root_realm_id=$1 AND doctor_id=$2 AND id=$3",
        [actor.realmId,doctorId,associationId]);
      await this.recorded(tx,actor,cmd.id!,"DOCTOR_CENTER_SUSPEND",
        doctorId,current.center_id,associationId,v+1);
      return {associationRef:associationId,version:v+1,status:"SUSPENDED",
        replayed:false,message:"Doctor association suspended at this center. Other centers remain unchanged."};
    });
  }
  async centers(bearer:string,doctorRef:string){
    const actor=await this.actor(bearer,"health.doctors.view");
    const ref=validId(doctorRef,"doctorRef");
    const r=await this.db.query<{id:string;display_name:string;affiliation_state:string;
      center_id:string;version:number;center_status:string}>(
      "SELECT a.id,c.display_name,a.affiliation_state,a.center_id,a.version,"+
      "c.status AS center_status FROM health_doctor_center a "+
      "JOIN health_center c ON c.root_realm_id=a.root_realm_id AND c.id=a.center_id "+
      "WHERE a.root_realm_id=$1 AND a.doctor_id=$2 "+
      "ORDER BY c.display_name,a.id LIMIT 100",
      [actor.realmId,ref]);
    return {centers:r.rows.map(x=>({
      associationRef:x.id,centerRef:x.center_id,name:x.display_name,
      status:x.affiliation_state,centerStatus:x.center_status,version:x.version
    }))};
  }
}
