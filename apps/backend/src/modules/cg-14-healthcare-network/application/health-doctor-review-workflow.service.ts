import {
  BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthDoctorPrivateEvidenceService} from "../../cg-19-documents-notifications/application/health-doctor-private-evidence.service";
import {HealthVerificationApprovalService} from "../../cg-03-registration-approvals/application/health-verification-approval.service";
import {HealthDoctorReviewSourceFacade,type DoctorSubmission} from "./health-doctor-review-source.facade";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(v:unknown,field:string)=>{
  if(typeof v!=="string"||!UUID.test(v))
    throw new BadRequestException({code:"HEALTH_DOCTOR_REVIEW_INVALID",field});
  return v;
};
const revision=(v:unknown)=>{
  if(!Number.isSafeInteger(v)||Number(v)<1||Number(v)>2147483646)
    throw new BadRequestException({code:"HEALTH_DOCTOR_REVIEW_INVALID",field:"expectedVersion"});
  return Number(v);
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Actor=VerifiedFoundationActor;
type CommandRow={id:string;request_digest:string;result_ref:string|null;result_version:number|null};
type ReviewCase={id:string;realm_id:string;health_doctor_id:string;
  health_doctor_revision_id:string;health_revision_no:number;
  health_source_digest:string;request_key:string;status:string};
@Injectable()
export class HealthDoctorReviewWorkflowService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identity:FoundationStructureIdentityFacade,
    private readonly evidence:HealthDoctorPrivateEvidenceService,
    private readonly source:HealthDoctorReviewSourceFacade,
    private readonly cg03:HealthVerificationApprovalService){}
  private async transact<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
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
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
        throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED"});
      throw e;
    }finally{tx.release();}
  }
  private async command(tx:PoolClient,actor:Actor,key:string,
    requestKey:string,payload:unknown){
    const signature=hash(payload);
    const inserted=await tx.query<{id:string}>(
      "INSERT INTO health_network_command(root_realm_id,actor_ref,action_key,"+
      "request_key,request_digest) VALUES($1,$2,$3,$4,$5) "+
      "ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) "+
      "DO NOTHING RETURNING id",
      [actor.realmId,actor.accountId,key,requestKey,signature]);
    if(inserted.rows[0])return {id:inserted.rows[0].id,replay:null as CommandRow|null};
    const old=await tx.query<CommandRow>(
      "SELECT id,request_digest,result_ref,result_version FROM health_network_command "+
      "WHERE root_realm_id=$1 AND actor_ref=$2 AND action_key=$3 AND request_key=$4 FOR SHARE",
      [actor.realmId,actor.accountId,key,requestKey]);
    if(!old.rows[0]||old.rows[0].request_digest!==signature||!old.rows[0].result_ref)
      throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED"});
    return {id:null,replay:old.rows[0]};
  }
  private async complete(tx:PoolClient,actor:Actor,cmdId:string,
    action:string,doctorRef:string,resultRef:string,version:number){
    await tx.query("UPDATE health_network_command SET result_ref=$2,result_version=$3 "+
      "WHERE id=$1",[cmdId,resultRef,version]);
    await tx.query(
      "INSERT INTO health_doctor_event(root_realm_id,doctor_id,actor_ref,"+
      "action_key,record_version,command_id) VALUES($1,$2,$3,$4,$5,$6)",
      [actor.realmId,doctorRef,actor.accountId,action,version,cmdId]);
  }
  async submit(bearer:string,doctorRef:string,body:unknown){
    const ref=id(doctorRef,"doctorRef");
    if(!body||typeof body!=="object"||Array.isArray(body))
      throw new BadRequestException({code:"HEALTH_DOCTOR_REVIEW_INVALID"});
    const x=body as Record<string,unknown>;
    if(Object.keys(x).some(k=>!["requestKey","expectedVersion","proofFileRef"].includes(k)))
      throw new BadRequestException({code:"HEALTH_DOCTOR_REVIEW_INVALID"});
    const key=id(x.requestKey,"requestKey"),v=revision(x.expectedVersion),
      file=id(x.proofFileRef,"proofFileRef");
    const actor=await this.sessions.requireAction(bearer,"health.doctors.manage");
    return this.transact(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.manage");
      const cmd=await this.command(tx,actor,"DOCTOR_SUBMIT",key,{ref,v,file});
      if(cmd.replay)return {caseRef:cmd.replay.result_ref,
        status:"SUBMITTED",version:cmd.replay.result_version,replayed:true};
      const current=await tx.query<{version:number;status:string;full_name:string;
        registration_jurisdiction:string;registration_number:string;
        qualifications:string[];specialties:string[];experience_years:number;
        public_bio:string;portrait_rights_status:string}>(
        "SELECT version,status,full_name,registration_jurisdiction,registration_number,"+
        "qualifications,specialties,experience_years,public_bio,portrait_rights_status "+
        "FROM health_doctor WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
        [actor.realmId,ref]);
      const d=current.rows[0];
      if(!d||d.status!=="PENDING")
        throw new NotFoundException({code:"HEALTH_DOCTOR_NOT_PENDING"});
      if(d.version!==v)
        throw new ConflictException({code:"HEALTH_DOCTOR_VERSION_CHANGED"});
      // The protected CG19 original file must match this exact doctor and version.
      await this.evidence.prove(tx,actor,ref,v,file);
      const snapshot={
        fullName:d.full_name,registrationJurisdiction:d.registration_jurisdiction,
        registrationNumber:d.registration_number,qualifications:d.qualifications,
        specialties:d.specialties,experienceYears:d.experience_years,
        publicBio:d.public_bio,portraitRightsStatus:d.portrait_rights_status
      };
      const digest=hash(snapshot);
      const frozen=await tx.query<{id:string}>(
        "INSERT INTO health_doctor_revision(root_realm_id,doctor_id,revision_no,"+
        "source_version,source_snapshot,source_digest,proof_file_ref,submitted_by) "+
        "VALUES($1,$2,$3,$3,$4::jsonb,$5,$6,$7) RETURNING id",
        [actor.realmId,ref,v,JSON.stringify(snapshot),digest,file,actor.accountId]);
      await tx.query(
        "UPDATE health_doctor SET status='SUBMITTED',version=version+1,"+
        "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,ref]);
      const input:DoctorSubmission={kind:"HEALTH_DOCTOR_VERIFICATION",
        doctorRef:ref,revisionRef:frozen.rows[0].id,revisionNo:v,
        digest,requestKey:key};
      const caseRow=await this.cg03.createDoctorCase(tx,actor,input);
      await tx.query("UPDATE health_doctor_revision SET approval_case_ref=$3 "+
        "WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,frozen.rows[0].id,caseRow.caseRef]);
      await this.complete(tx,actor,cmd.id!,"DOCTOR_SUBMIT",ref,caseRow.caseRef,v+1);
      return {caseRef:caseRow.caseRef,reference:caseRow.caseNumber,
        status:"SUBMITTED",version:v+1,replayed:false,
        message:"Doctor submitted with original scanned license for an independent Foundation review."};
    });
  }
  async apply(bearer:string,caseRef:string){
    const ref=id(caseRef,"caseRef");
    const actor=await this.sessions.requireAction(bearer,"health.doctors.verify");
    return this.transact(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.verify");
      // Always lock the original CG03 case before the mutable doctor record.
      const q=await tx.query<ReviewCase>(
        "SELECT id,realm_id,health_doctor_id,health_doctor_revision_id,"+
        "health_revision_no,health_source_digest,request_key,status "+
        "FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
        "AND case_kind='HEALTH_DOCTOR_VERIFICATION' FOR UPDATE",
        [actor.realmId,ref]);
      const c=q.rows[0];
      if(!c)throw new NotFoundException({code:"HEALTH_DOCTOR_REVIEW_UNAVAILABLE"});
      if(c.status==="OWNER_COMPLETED"){
        const latest=await tx.query<{status:string}>(
          "SELECT status FROM health_doctor WHERE root_realm_id=$1 AND id=$2",
          [actor.realmId,c.health_doctor_id]);
        return {status:latest.rows[0]?.status??"UNAVAILABLE",replayed:true};
      }
      if(c.status!=="PENDING_OWNER")
        throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_UNAVAILABLE"});
      const input:DoctorSubmission&{caseRef:string}={
        kind:"HEALTH_DOCTOR_VERIFICATION",doctorRef:c.health_doctor_id,
        revisionRef:c.health_doctor_revision_id,revisionNo:c.health_revision_no,
        digest:c.health_source_digest,requestKey:c.request_key,caseRef:ref
      };
      await this.cg03.approvedDoctor(tx,actor,input);
      await this.source.original(tx,actor,input);
      const found=await tx.query<{version:number}>(
        "SELECT version FROM health_doctor WHERE root_realm_id=$1 AND id=$2 "+
        "AND status='SUBMITTED' FOR UPDATE",[actor.realmId,c.health_doctor_id]);
      if(!found.rows[0]||found.rows[0].version!==c.health_revision_no+1)
        throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED"});
      const cmd=await this.command(tx,actor,"DOCTOR_VERIFY",ref,{
        doctorRef:c.health_doctor_id,revisionRef:c.health_doctor_revision_id,
        revisionNo:c.health_revision_no,digest:c.health_source_digest});
      if(cmd.replay)throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED"});
      await tx.query(
        "UPDATE health_doctor SET status='VERIFIED',version=version+1,"+
        "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,c.health_doctor_id]);
      await this.cg03.finish(tx,actor,ref);
      await this.complete(tx,actor,cmd.id!,"DOCTOR_VERIFY",c.health_doctor_id,
        c.health_doctor_id,c.health_revision_no+2);
      return {status:"VERIFIED",replayed:false,
        message:"Original independent verification was applied. No center association or public listing was activated."};
    });
  }
  async returnToDraft(bearer:string,caseRef:string){
    const ref=id(caseRef,"caseRef");
    const actor=await this.sessions.requireAction(bearer,"health.doctors.manage");
    return this.transact(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.manage");
      const q=await tx.query<ReviewCase>(
        "SELECT id,realm_id,health_doctor_id,health_doctor_revision_id,"+
        "health_revision_no,health_source_digest,request_key,status "+
        "FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
        "AND case_kind='HEALTH_DOCTOR_VERIFICATION' FOR UPDATE",
        [actor.realmId,ref]);
      const c=q.rows[0];
      if(!c)throw new NotFoundException({code:"HEALTH_DOCTOR_REVIEW_UNAVAILABLE"});
      if(!["RETURNED","REJECTED"].includes(c.status))
        throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_UNAVAILABLE"});
      const cmd=await this.command(tx,actor,"DOCTOR_RETURN",ref,{
        doctorRef:c.health_doctor_id,revisionRef:c.health_doctor_revision_id,
        revisionNo:c.health_revision_no,digest:c.health_source_digest});
      if(cmd.replay)
        return {status:"PENDING",version:cmd.replay.result_version,replayed:true};
      const doctor=await tx.query<{version:number;status:string}>(
        "SELECT version,status FROM health_doctor WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",
        [actor.realmId,c.health_doctor_id]);
      if(!doctor.rows[0]||doctor.rows[0].status!=="SUBMITTED"||
        doctor.rows[0].version!==c.health_revision_no+1)
        throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED"});

      await tx.query(
        "UPDATE health_doctor SET status='PENDING',version=version+1,"+
        "updated_at=now() WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,c.health_doctor_id]);
      await this.complete(tx,actor,cmd.id!,"DOCTOR_RETURN",c.health_doctor_id,
        c.health_doctor_id,c.health_revision_no+2);
      return {status:"PENDING",version:c.health_revision_no+2,replayed:false,
        message:"Returned doctor registration is a new pending draft. Refresh and upload current evidence before resubmitting."};
    });
  }
}
