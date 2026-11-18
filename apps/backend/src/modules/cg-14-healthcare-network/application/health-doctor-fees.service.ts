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
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
type Actor=VerifiedFoundationActor;
type CommandRow={id:string;request_digest:string;result_ref:string|null;result_version:number|null};
type Association={id:string;version:number;affiliation_state:string;doctor_id:string;center_id:string};
type FeeRow={id:string;version:number;status:string;effective_from:Date;effective_to:Date|null;
  fee_kind:string;consultation_mode:string;amount_minor:string};
const id=(x:unknown,field:string)=>{
  if(typeof x!=="string"||!UUID.test(x))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FEE_INVALID",field});
  return x;
};
const version=(x:unknown,field:string)=>{
  if(!Number.isSafeInteger(x)||Number(x)<1||Number(x)>2147483646)
    throw new BadRequestException({code:"HEALTH_DOCTOR_FEE_INVALID",field});
  return Number(x);
};
const object=(value:unknown)=>{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FEE_INVALID"});
  return value as Record<string,unknown>;
};
const strict=(x:Record<string,unknown>,keys:string[])=>{
  if(Object.keys(x).some(k=>!keys.includes(k)))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FEE_INVALID"});
};
const date=(value:unknown,field:string,optional=false):Date|null=>{
  if(value===null&&optional)return null;
  if(typeof value!=="string"||!UTC.test(value))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FEE_INVALID",field});
  const d=new Date(value);
  if(!Number.isFinite(d.getTime()))
    throw new BadRequestException({code:"HEALTH_DOCTOR_FEE_INVALID",field});
  return d;
};
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

/**
 * Foundation-authorized professional fees only. CG-17 owns settlement,
 * CG-15 owns accepted appointment fee snapshots and CG-03 owns
 * professional verification; no duplicate masters or invented bookings.
 */
@Injectable()
export class HealthDoctorFeesService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identity:FoundationStructureIdentityFacade){}

  private async transact<T>(fn:(tx:PoolClient)=>Promise<T>):Promise<T>{
    const tx=await this.db.connect();let open=false;
    try{
      await tx.query("BEGIN");open=true;
      await tx.query("SET LOCAL lock_timeout='3s'");
      await tx.query("SET LOCAL statement_timeout='12s'");
      const out=await fn(tx);
      await tx.query("COMMIT");open=false;
      return out;
    }catch(e){
      if(open)try{await tx.query("ROLLBACK");}catch{}
      if(e&&typeof e==="object"&&"code" in e&&
        (e.code==="23P01"||e.code==="23505"||e.code==="23514"))
        throw new ConflictException({code:"HEALTH_DOCTOR_FEE_OVERLAP"});
      throw e;
    }finally{tx.release();}
  }
  private async command(tx:PoolClient,actor:Actor,action:string,
    key:string,payload:unknown){
    const signature=digest(payload);
    const created=await tx.query<{id:string}>(
      "INSERT INTO health_network_command(root_realm_id,actor_ref,action_key,"+
      "request_key,request_digest) VALUES($1,$2,$3,$4,$5) "+
      "ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) DO NOTHING RETURNING id",
      [actor.realmId,actor.accountId,action,key,signature]);
    if(created.rows[0])return {id:created.rows[0].id,replay:null as CommandRow|null};
    const old=await tx.query<CommandRow>(
      "SELECT id,request_digest,result_ref,result_version FROM health_network_command "+
      "WHERE root_realm_id=$1 AND actor_ref=$2 AND action_key=$3 AND request_key=$4 FOR SHARE",
      [actor.realmId,actor.accountId,action,key]);
    if(!old.rows[0]||old.rows[0].request_digest!==signature||!old.rows[0].result_ref)
      throw new ConflictException({code:"HEALTH_DOCTOR_FEE_REQUEST_CONFLICT"});
    return {id:null,replay:old.rows[0]};
  }
  private async complete(tx:PoolClient,commandId:string,ref:string,recordVersion:number){
    await tx.query(
      "UPDATE health_network_command SET result_ref=$2,result_version=$3 WHERE id=$1",
      [commandId,ref,recordVersion]);
  }
  private async association(tx:PoolClient,actor:Actor,doctorRef:string,
    associationRef:string,lock:boolean):Promise<Association>{
    // Lock the specific doctor-center row first. Every fee write has
    // this same lock order, preventing competing approvals at one center.
    const q=await tx.query<Association>(
      "SELECT a.id,a.version,a.affiliation_state,a.doctor_id,a.center_id "+
      "FROM health_doctor_center a WHERE a.root_realm_id=$1 AND a.doctor_id=$2 "+
      "AND a.id=$3 "+(lock?"FOR UPDATE":"FOR SHARE"),
      [actor.realmId,doctorRef,associationRef]);
    const row=q.rows[0];
    if(!row)throw new NotFoundException({code:"HEALTH_DOCTOR_ASSOCIATION_UNAVAILABLE"});
    if(row.affiliation_state!=="APPROVED")
      throw new ConflictException({code:"HEALTH_DOCTOR_ASSOCIATION_CHANGED"});
    const state=await tx.query<{doctor_status:string;center_status:string;
      access_state:string;provider_status:string}>(
      "SELECT d.status AS doctor_status,c.status AS center_status,"+
      "c.access_state,p.status AS provider_status FROM health_doctor d "+
      "JOIN health_doctor_center a ON a.root_realm_id=d.root_realm_id "+
      "AND a.doctor_id=d.id "+
      "JOIN health_center c ON c.root_realm_id=a.root_realm_id AND c.id=a.center_id "+
      "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
      "WHERE d.root_realm_id=$1 AND d.id=$2 AND a.id=$3 FOR SHARE OF d,c,p",
      [actor.realmId,doctorRef,associationRef]);
    const s=state.rows[0];
    if(!s||s.doctor_status!=="VERIFIED"||s.center_status!=="VERIFIED"||
      s.access_state!=="ENABLED"||s.provider_status!=="VERIFIED")
      throw new ConflictException({code:"HEALTH_DOCTOR_FEE_INELIGIBLE"});
    return row;
  }
  async propose(bearer:string,doctorRef:string,associationRef:string,body:unknown){
    const doctor=id(doctorRef,"doctorRef"),associationId=id(associationRef,"associationRef");
    const x=object(body);
    strict(x,["requestKey","expectedAssociationVersion","feeKind",
      "consultationMode","amountMinor","effectiveFromUtc","effectiveToUtc"]);
    const key=id(x.requestKey,"requestKey");
    const expected=version(x.expectedAssociationVersion,"expectedAssociationVersion");
    const kind=x.feeKind,mode=x.consultationMode;
    if(!["CONSULTATION","FOLLOW_UP"].includes(String(kind))||
      !["IN_PERSON","VIDEO"].includes(String(mode))||
      !Number.isSafeInteger(x.amountMinor)||Number(x.amountMinor)<0||
      Number(x.amountMinor)>10000000000)
      throw new BadRequestException({code:"HEALTH_DOCTOR_FEE_INVALID",field:"amountMinor"});
    const from=date(x.effectiveFromUtc,"effectiveFromUtc")!;
    const to=x.effectiveToUtc===undefined?null:date(x.effectiveToUtc,"effectiveToUtc",true);
    if(from.getTime()<Date.now()-60000||
      from.getTime()>Date.now()+5*365*86400000||
      (to!==null&&to.getTime()<=from.getTime()))
      throw new BadRequestException({code:"HEALTH_DOCTOR_FEE_INVALID",field:"effectiveFromUtc"});
    const actor=await this.sessions.requireAction(bearer,"health.doctors.manage");
    const input={doctor,associationId,expected,kind,mode,amountMinor:Number(x.amountMinor),
      from:from.toISOString(),to:to?.toISOString()??null};
    return this.transact(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.manage");
      const cmd=await this.command(tx,actor,"DOCTOR_FEE_PROPOSE",key,input);
      if(cmd.replay)return {feeRef:cmd.replay.result_ref,version:cmd.replay.result_version,
        status:"PROPOSED",replayed:true};
      const assoc=await this.association(tx,actor,doctor,associationId,true);
      if(assoc.version!==expected)
        throw new ConflictException({code:"HEALTH_DOCTOR_ASSOCIATION_CHANGED"});
      const fee=await tx.query<{id:string;version:number}>(
        "INSERT INTO health_center_fee(root_realm_id,doctor_center_id,fee_kind,"+
        "consultation_mode,amount_minor,effective_from,effective_to,proposed_by) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,version",
        [actor.realmId,associationId,kind,mode,Number(x.amountMinor),
          from,to,actor.accountId]);
      const row=fee.rows[0];
      await tx.query(
        "INSERT INTO health_center_fee_event(root_realm_id,fee_id,actor_ref,action_key,"+
        "request_key) VALUES($1,$2,$3,'PROPOSED',$4)",
        [actor.realmId,row.id,actor.accountId,key]);
      await this.complete(tx,cmd.id!,row.id,row.version);
      return {feeRef:row.id,version:row.version,status:"PROPOSED",replayed:false,
        message:"New center-specific consultation fee proposed. Existing approved fees remain unchanged."};
    });
  }
  async approve(bearer:string,doctorRef:string,associationRef:string,feeRef:string,body:unknown){
    const doctor=id(doctorRef,"doctorRef"),associationId=id(associationRef,"associationRef"),
      feeId=id(feeRef,"feeRef");
    const x=object(body);
    strict(x,["requestKey","expectedVersion"]);
    const key=id(x.requestKey,"requestKey"),v=version(x.expectedVersion,"expectedVersion");
    const actor=await this.sessions.requireAction(bearer,"health.doctors.verify");
    return this.transact(async tx=>{
      await this.identity.assertCurrent(tx,actor,"health.doctors.verify");
      const cmd=await this.command(tx,actor,"DOCTOR_FEE_APPROVE",key,
        {doctor,associationId,feeId,v});
      if(cmd.replay)return {feeRef:cmd.replay.result_ref,version:cmd.replay.result_version,
        status:"APPROVED",replayed:true};
      await this.association(tx,actor,doctor,associationId,true);
      const found=await tx.query<FeeRow>(
        "SELECT id,version,status,effective_from,effective_to,fee_kind,"+
        "consultation_mode,amount_minor FROM health_center_fee "+
        "WHERE root_realm_id=$1 AND doctor_center_id=$2 AND id=$3 FOR UPDATE",
        [actor.realmId,associationId,feeId]);
      const fee=found.rows[0];
      if(!fee)throw new NotFoundException({code:"HEALTH_DOCTOR_FEE_UNAVAILABLE"});
      if(fee.version!==v||fee.status!=="PROPOSED")
        throw new ConflictException({code:"HEALTH_DOCTOR_FEE_CHANGED"});
      if(fee.effective_from.getTime()<Date.now()-60000)
        throw new ConflictException({code:"HEALTH_DOCTOR_FEE_STALE"});
      const overlapping=await tx.query<{id:string;effective_from:Date;effective_to:Date|null;version:number}>(
        "SELECT id,effective_from,effective_to,version FROM health_center_fee "+
        "WHERE root_realm_id=$1 AND doctor_center_id=$2 AND fee_kind=$3 "+
        "AND consultation_mode=$4 AND status='APPROVED' AND "+
        "tstzrange(effective_from,effective_to,'[)') && tstzrange($5::timestamptz,$6::timestamptz,'[)') "+
        "ORDER BY effective_from,id FOR UPDATE",
        [actor.realmId,associationId,fee.fee_kind,fee.consultation_mode,
          fee.effective_from,fee.effective_to]);
      if(overlapping.rows.length>1)
        throw new ConflictException({code:"HEALTH_DOCTOR_FEE_OVERLAP"});
      const prior=overlapping.rows[0];
      if(prior){
        if(prior.effective_from>=fee.effective_from||
          fee.effective_from.getTime()<=Date.now()+1000)
          throw new ConflictException({code:"HEALTH_DOCTOR_FEE_STALE"});
        await tx.query(
          "UPDATE health_center_fee SET effective_to=$3,version=version+1,updated_at=now() "+
          "WHERE root_realm_id=$1 AND id=$2",
          [actor.realmId,prior.id,fee.effective_from]);
        await tx.query(
          "INSERT INTO health_center_fee_event(root_realm_id,fee_id,actor_ref,action_key,"+
          "prior_end,new_end,request_key) VALUES($1,$2,$3,'END_EARLY',$4,$5,$6)",
          [actor.realmId,prior.id,actor.accountId,prior.effective_to,
            fee.effective_from,key]);
      }
      await tx.query(
        "UPDATE health_center_fee SET status='APPROVED',version=version+1,"+
        "approved_by=$3,approved_at=now(),updated_at=now() "+
        "WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,feeId,actor.accountId]);
      await tx.query(
        "INSERT INTO health_center_fee_event(root_realm_id,fee_id,actor_ref,action_key,"+
        "request_key) VALUES($1,$2,$3,'APPROVED',$4)",
        [actor.realmId,feeId,actor.accountId,key]);
      await this.complete(tx,cmd.id!,feeId,v+1);
      return {feeRef:feeId,version:v+1,status:"APPROVED",replayed:false,
        message:"Center fee approved with immutable amount and validity history. No patient payment was created."};
    });
  }
  async list(bearer:string,doctorRef:string,associationRef:string){
    const doctor=id(doctorRef,"doctorRef"),associationId=id(associationRef,"associationRef");
    const actor=await this.sessions.requireAction(bearer,"health.doctors.view");
    const association=await this.db.query<{eligible:boolean}>(
      "SELECT (a.affiliation_state='APPROVED' AND d.status='VERIFIED' "+
      "AND c.status='VERIFIED' AND c.access_state='ENABLED' "+
      "AND p.status='VERIFIED') AS eligible FROM health_doctor_center a "+
      "JOIN health_doctor d ON d.root_realm_id=a.root_realm_id AND d.id=a.doctor_id "+
      "JOIN health_center c ON c.root_realm_id=a.root_realm_id AND c.id=a.center_id "+
      "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
      "WHERE a.root_realm_id=$1 AND a.doctor_id=$2 AND a.id=$3",
      [actor.realmId,doctor,associationId]);
    if(!association.rows[0])
      throw new NotFoundException({code:"HEALTH_DOCTOR_ASSOCIATION_UNAVAILABLE"});
    const eligible=association.rows[0].eligible;
    const result=await this.db.query<FeeRow&{created_at:Date}>(
      "SELECT id,fee_kind,consultation_mode,amount_minor,effective_from,"+
      "effective_to,status,version,created_at FROM health_center_fee "+
      "WHERE root_realm_id=$1 AND doctor_center_id=$2 "+
      "ORDER BY created_at DESC,id DESC LIMIT 50",
      [actor.realmId,associationId]);
    const now=Date.now();
    return {fees:result.rows.map(f=>({
      feeRef:f.id,feeKind:f.fee_kind,consultationMode:f.consultation_mode,
      amountMinor:Number(f.amount_minor),status:f.status,version:f.version,
      effectiveFromUtc:f.effective_from.toISOString(),
      effectiveToUtc:f.effective_to?.toISOString()??null,
      current:eligible&&f.status==="APPROVED"&&f.effective_from.getTime()<=now&&
        (!f.effective_to||f.effective_to.getTime()>now)
    }))};
  }
}
