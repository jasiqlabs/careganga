import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException}
 from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {ClinicalLabAdmissionService} from "./clinical-lab-admission.service";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CODE=/^[A-Z0-9][A-Z0-9_-]{1,31}$/;
const date=/^\d{4}-\d{2}-\d{2}$/;
const id=(v:unknown)=>{if(typeof v!=="string"||!UUID.test(v))
 throw new BadRequestException({code:"LAB_EQUIPMENT_SOURCE_INVALID"});return v;};
const name=(v:unknown,max:number,min=0)=>{if(typeof v!=="string"||
 v.trim().length<min||v.trim().length>max||/[\u0000-\u001f\u007f]/.test(v))
 throw new BadRequestException({code:"LAB_EQUIPMENT_SOURCE_INVALID"});
 return v.trim();};
const oneDate=(v:unknown)=>{if(typeof v!=="string"||!date.test(v)||
 Number.isNaN(Date.parse(v+"T00:00:00Z"))||
 new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)
 throw new BadRequestException({code:"LAB_EQUIPMENT_DATE_INVALID"});return v;};
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function object(v:unknown,keys:string[]){
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"LAB_EQUIPMENT_SOURCE_INVALID"});
 return v as Record<string,unknown>;
}
type Equipment={equipmentRef:string;centerRef:string;code:string;name:string;
 manufacturer:string;model:string;serialNumber:string;status:string;
 readiness:string;effectiveReadiness:string;calibrationDueOn:string|null;
 revision:number;fileRef:string|null;};
type Row={id:string;center_ref:string;equipment_code:string;display_name:string;
 manufacturer:string;model:string;serial_number:string;status:string;readiness:string;
 effective_readiness:string;calibration_due_on:string|null;revision:number;
 evidence_file_ref:string|null;};
const selectEquipment=
 "SELECT e.id,e.center_ref,e.equipment_code,e.display_name,e.manufacturer,"+
 "e.model,e.serial_number,e.status,e.readiness,e.revision,"+
 "e.evidence_file_ref,to_char(e.calibration_due_on,'YYYY-MM-DD') AS calibration_due_on,"+
 "CASE WHEN e.readiness='READY' AND (e.calibration_due_on IS NULL "+
 "OR e.calibration_due_on<(now() AT TIME ZONE c.time_zone)::date "+
 "OR f.id IS NULL OR f.revoked_at IS NOT NULL) THEN 'CALIBRATION_DUE' "+
 "ELSE e.readiness END AS effective_readiness "+
 "FROM lab_equipment e JOIN health_center c ON "+
 "c.root_realm_id=e.root_realm_id AND c.id=e.center_ref "+
 "LEFT JOIN cg19_lab_quality_file f ON "+
 "f.root_realm_id=e.root_realm_id AND f.id=e.evidence_file_ref ";
const view=(x:Row):Equipment=>({equipmentRef:x.id,centerRef:x.center_ref,
 code:x.equipment_code,name:x.display_name,manufacturer:x.manufacturer,
 model:x.model,serialNumber:x.serial_number,status:x.status,
 readiness:x.readiness,effectiveReadiness:x.effective_readiness,
 calibrationDueOn:x.calibration_due_on,revision:x.revision,
 fileRef:x.evidence_file_ref});

@Injectable()
export class ClinicalLabEquipmentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly admission:ClinicalLabAdmissionService,
  private readonly sessions:SessionService){}
 private async tx<T>(job:(c:PoolClient)=>Promise<T>){
  const c=await this.db.connect();let opened=false;
  try{
   await c.query("BEGIN");opened=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const r=await job(c);await c.query("COMMIT");opened=false;return r;
  }catch(e){if(opened)try{await c.query("ROLLBACK")}catch{};
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"LAB_EQUIPMENT_ALREADY_EXISTS"});
   throw e;
  }finally{c.release();}
 }
 private async replay(c:PoolClient,actor:VerifiedFoundationActor,key:string,hash:string){
  const q=await c.query<{request_digest:string;equipment_ref:string;applied_revision:number}>(
   "SELECT request_digest,equipment_ref,applied_revision FROM lab_equipment_command "+
   "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
   [actor.realmId,actor.accountId,key]);
  if(!q.rows[0])return null;
  if(q.rows[0].request_digest!==hash)
   throw new ConflictException({code:"LAB_EQUIPMENT_REQUEST_KEY_CONFLICT"});
  return q.rows[0];
 }
 private async lockKey(c:PoolClient,actor:VerifiedFoundationActor,key:string){
  // Serialize retries of exactly one source command, no global tenant lock.
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [actor.realmId+":"+actor.accountId+":"+key]);
 }
 async eligibleCenters(token:string){
  // No patient/CG15/order dependency. This is visible only to a staff actor
  // granted the equipment read action, current assigned center and LAB ERP.
  const actor=await this.sessions.requireAction(token,"lab.equipment.view");
  return this.tx(async c=>{
   const rows=await c.query<{centerRef:string;name:string}>(
    "SELECT f.center_id AS \"centerRef\",center.display_name AS name "+
    "FROM health_center_account_affiliation f "+
    "JOIN health_center center ON center.root_realm_id=f.root_realm_id "+
    "AND center.id=f.center_id JOIN account actor ON "+
    "actor.realm_id=f.root_realm_id AND actor.id=f.account_ref "+
    "WHERE f.root_realm_id=$1 AND f.account_ref=$2 AND f.status='ACTIVE' "+
    "AND actor.status='ACTIVE' ORDER BY center.display_name,center.id LIMIT 31",
    [actor.realmId,actor.accountId]);
   if(rows.rows.length>30)throw new ConflictException({code:"LAB_EQUIPMENT_CENTER_LIMIT"});
   const available:{centerRef:string;name:string}[]=[];
   for(const row of rows.rows){
    try{
     await this.admission.requireEquipmentCurrent(
      c,token,row.centerRef,"lab.equipment.view");
     available.push(row);
    }catch(e){
     if(e&&typeof e==="object"&&"status" in e&&
      (e.status===403||e.status===404))continue;
     throw e;
    }
   }
   return {centers:available};
  });
 }
 async list(token:string,centerRaw:string){
  const center=id(centerRaw);
  return this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.equipment.view");
   const result=await c.query<Row>(
    selectEquipment+"WHERE e.root_realm_id=$1 AND e.center_ref=$2 "+
    "ORDER BY e.equipment_code,e.id LIMIT 101",[actor.realmId,center]);
   if(result.rows.length>100)
    throw new ConflictException({code:"LAB_EQUIPMENT_LIST_LIMIT"});
   return {centerRef:center,items:result.rows.map(view)};
  });
 }
 async history(token:string,centerRaw:string,equipmentRaw:string){
  const center=id(centerRaw),equipment=id(equipmentRaw);
  return this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.equipment.view");
   const e=await c.query<Row>(selectEquipment+
    "WHERE e.root_realm_id=$1 AND e.center_ref=$2 AND e.id=$3",
    [actor.realmId,center,equipment]);
   if(!e.rows[0])throw new NotFoundException({code:"LAB_EQUIPMENT_NOT_FOUND"});
   const events=await c.query<{eventRef:string;eventType:string;
    description:string;occurredAt:Date;fileRef:string|null}>(
    "SELECT id AS \"eventRef\",event_type AS \"eventType\",description,"+
    "occurred_at AS \"occurredAt\",evidence_file_ref AS \"fileRef\" "+
    "FROM lab_equipment_event WHERE root_realm_id=$1 AND center_ref=$2 "+
    "AND equipment_ref=$3 ORDER BY occurred_at DESC,id DESC LIMIT 40",
    [actor.realmId,center,equipment]);
   return {equipment:view(e.rows[0]),events:events.rows};
  });
 }
 async create(token:string,centerRaw:string,raw:unknown){
  const center=id(centerRaw);
  const data=object(raw,["requestKey","code","name","manufacturer","model","serialNumber"]);
  const key=id(data.requestKey),code=name(data.code,32,2).toUpperCase();
  if(!CODE.test(code))throw new BadRequestException({code:"LAB_EQUIPMENT_CODE_INVALID"});
  const record={code,displayName:name(data.name,160,2),
   manufacturer:name(data.manufacturer??"",120),model:name(data.model??"",120),
   serialNumber:name(data.serialNumber??"",120)};
  const hash=digest(["CG16_LAB_EQUIPMENT_REGISTER_V1",center,record]);
  return this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.equipment.manage");
   await this.lockKey(c,actor,key);
   const replay=await this.replay(c,actor,key,hash);
   if(replay)return {equipmentRef:replay.equipment_ref,revision:replay.applied_revision,
    readiness:"NOT_READY",replayed:true};
   const equipment=await c.query<{id:string}>(
    "INSERT INTO lab_equipment(root_realm_id,center_ref,equipment_code,"+
    "display_name,manufacturer,model,serial_number,created_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [actor.realmId,center,code,record.displayName,record.manufacturer,
     record.model,record.serialNumber,actor.accountId]);
   const equipmentRef=equipment.rows[0].id;
   await c.query(
    "INSERT INTO lab_equipment_event(root_realm_id,center_ref,equipment_ref,"+
    "actor_ref,request_key,event_type,prior_revision,new_revision,description) "+
    "VALUES($1,$2,$3,$4,$5,'REGISTERED',0,1,$6)",
    [actor.realmId,center,equipmentRef,actor.accountId,key,
     "Registered original laboratory equipment; not yet marked ready"]);
   await c.query(
    "INSERT INTO lab_equipment_command(root_realm_id,actor_ref,request_key,"+
    "request_digest,center_ref,equipment_ref,applied_revision) "+
    "VALUES($1,$2,$3,$4,$5,$6,1)",
    [actor.realmId,actor.accountId,key,hash,center,equipmentRef]);
   return {equipmentRef,revision:1,readiness:"NOT_READY",replayed:false};
  });
 }
 async update(token:string,centerRaw:string,equipmentRaw:string,raw:unknown){
  const center=id(centerRaw),equipment=id(equipmentRaw);
  const data=object(raw,["requestKey","expectedVersion","action","note",
   "calibrationDueOn","evidenceFileRef"]);
  const key=id(data.requestKey);
  const action=data.action;
  if(!["MAINTENANCE","MARK_OUT_OF_SERVICE","RETIRED"].includes(String(action))||
    !Number.isSafeInteger(data.expectedVersion)||Number(data.expectedVersion)<1)
   throw new BadRequestException({code:"LAB_EQUIPMENT_ACTION_INVALID"});
  const expected=Number(data.expectedVersion),note=name(data.note,1000,2);
  const proof=data.evidenceFileRef===undefined||data.evidenceFileRef===null?
   null:id(data.evidenceFileRef);
  const until=data.calibrationDueOn===undefined||data.calibrationDueOn===null?
   null:oneDate(data.calibrationDueOn);
  if(action==="MAINTENANCE"&&(!proof||!until))
   throw new BadRequestException({code:"LAB_EQUIPMENT_PROOF_REQUIRED"});
  if(action!=="MAINTENANCE"&&(proof||until))
   throw new BadRequestException({code:"LAB_EQUIPMENT_ACTION_INVALID"});
  const hash=digest(["CG16_LAB_EQUIPMENT_EVENT_V1",center,equipment,action,
   expected,proof,until,note]);
  return this.tx(async c=>{
   const actor=await this.admission.requireEquipmentCurrent(
    c,token,center,"lab.equipment.manage");
   await this.lockKey(c,actor,key);
   const repeated=await this.replay(c,actor,key,hash);
   if(repeated){
    if(repeated.equipment_ref!==equipment)
     throw new ConflictException({code:"LAB_EQUIPMENT_REQUEST_KEY_CONFLICT"});
    return {equipmentRef:equipment,revision:repeated.applied_revision,replayed:true};
   }
   const q=await c.query<{revision:number;status:string}>(
    "SELECT revision,status FROM lab_equipment WHERE root_realm_id=$1 "+
    "AND center_ref=$2 AND id=$3 FOR UPDATE",
    [actor.realmId,center,equipment]);
   const cur=q.rows[0];
   if(!cur||cur.status!=="ACTIVE")
    throw new NotFoundException({code:"LAB_EQUIPMENT_NOT_ACTIVE"});
   if(cur.revision!==expected)
    throw new ConflictException({code:"LAB_EQUIPMENT_REVISION_CHANGED"});
   if(proof){
    const f=await c.query<{id:string}>(
     "SELECT f.id FROM cg19_lab_quality_file f "+
     "JOIN cg19_lab_quality_intent intent ON "+
     "intent.root_realm_id=f.root_realm_id AND intent.id=f.intent_ref "+
     "AND intent.status='VALIDATED' "+
     "WHERE f.root_realm_id=$1 AND f.center_ref=$2 AND f.equipment_ref=$3 "+
     "AND f.id=$4 AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL",
     [actor.realmId,center,equipment,proof]);
    if(!f.rows[0])throw new ConflictException({code:"LAB_EQUIPMENT_PROOF_NOT_VERIFIED"});
   }
   if(action==="MAINTENANCE"){
    const current=await c.query<{today:string}>(
     "SELECT to_char((now() AT TIME ZONE time_zone)::date,'YYYY-MM-DD') "+
     "AS today FROM health_center WHERE root_realm_id=$1 AND id=$2",
     [actor.realmId,center]);
    if(!current.rows[0]||until===null||until<current.rows[0].today)
     throw new ConflictException({code:"LAB_EQUIPMENT_CALIBRATION_EXPIRED"});
   }
   const readiness=action==="MAINTENANCE"?"READY":"OUT_OF_SERVICE";
   const status=action==="RETIRED"?"RETIRED":"ACTIVE";
   const updated=await c.query<{revision:number}>(
    "UPDATE lab_equipment SET status=$4,readiness=$5,"+
    "calibration_due_on=CASE WHEN $6::date IS NOT NULL THEN $6::date ELSE calibration_due_on END,"+
    "evidence_file_ref=CASE WHEN $7::uuid IS NOT NULL THEN $7::uuid ELSE evidence_file_ref END,"+
    "revision=revision+1,updated_at=now() WHERE root_realm_id=$1 "+
    "AND center_ref=$2 AND id=$3 RETURNING revision",
    [actor.realmId,center,equipment,status,readiness,until,proof]);
   await c.query(
    "INSERT INTO lab_equipment_event(root_realm_id,center_ref,equipment_ref,"+
    "actor_ref,request_key,event_type,prior_revision,new_revision,description,"+
    "evidence_file_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [actor.realmId,center,equipment,actor.accountId,key,action,expected,
     updated.rows[0].revision,note,proof]);
   await c.query(
    "INSERT INTO lab_equipment_command(root_realm_id,actor_ref,request_key,"+
    "request_digest,center_ref,equipment_ref,applied_revision) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7)",
    [actor.realmId,actor.accountId,key,hash,center,equipment,
     updated.rows[0].revision]);
   return {equipmentRef:equipment,revision:updated.rows[0].revision,
    readiness,replayed:false};
  });
 }
}
