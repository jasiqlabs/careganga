import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException}
 from "@nestjs/common";
import {createHash,randomBytes} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {ClinicalLabAdmissionService,CURRENT_LAB_ORDER_CARE_PREDICATE} from "./clinical-lab-admission.service";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const transitions={
 collect:{from:["PENDING_COLLECTION"],to:"COLLECTED",event:"COLLECTED"},
 receive:{from:["COLLECTED"],to:"RECEIVED",event:"RECEIVED"},
 "start-processing":{from:["RECEIVED"],to:"PROCESSING",event:"PROCESSING_STARTED"},
 reject:{from:["COLLECTED","RECEIVED","PROCESSING"],to:"REJECTED",event:"REJECTED"},
 recollect:{from:["REJECTED"],to:"RECOLLECTION_REQUIRED",event:"RECOLLECTION_REQUESTED"}
} as const;
type Action=keyof typeof transitions;
type Sample={revision:number;custody_state:string;opaque_sample_label:string;
 material_type:string;order_status:string};

/** Real center-scoped specimen chain. Source-keyed, revision-checked and
 * immutable. No test-report release or external notification here. */
@Injectable()
export class ClinicalLabCustodyService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly clinical:ClinicalLabAdmissionService){}
 async change(token:string,center:string,order:string,sample:string,action:string,
  raw:unknown){
  if(![center,order,sample].every(x=>ID.test(x))||
    !Object.prototype.hasOwnProperty.call(transitions,action))
   throw new BadRequestException({code:"LAB_CUSTODY_INVALID"});
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"LAB_CUSTODY_INVALID"});
  const input=raw as Record<string,unknown>;
  if(Object.keys(input).some(k=>!["requestKey","expectedVersion"].includes(k))||
    typeof input.requestKey!=="string"||!ID.test(input.requestKey)||
    !Number.isSafeInteger(input.expectedVersion)||Number(input.expectedVersion)<1)
   throw new BadRequestException({code:"LAB_CUSTODY_INVALID"});
  const requestKey=input.requestKey,expected=Number(input.expectedVersion);
  const t=transitions[action as Action];
  const hash=createHash("sha256").update(JSON.stringify({action,expected})).digest("hex");
  const c=await this.db.connect();let active=false;
  try{
   await c.query("BEGIN");active=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const actor=await this.clinical.requireCurrent(c,token,center,"lab.samples.manage");
   const r=await c.query<Sample>(
    "SELECT s.revision,s.custody_state,s.opaque_sample_label,"+
    "s.material_type,o.status AS order_status FROM lab_sample s "+
    "JOIN lab_order o ON o.root_realm_id=s.root_realm_id AND o.id=s.order_ref "+
    "WHERE s.root_realm_id=$1 AND s.id=$2 AND s.order_ref=$3 "+
    "AND o.center_ref=$4 "+CURRENT_LAB_ORDER_CARE_PREDICATE+"FOR UPDATE OF s,o",
    [actor.realmId,sample,order,center]);
   const old=r.rows[0];
   if(!old)throw new NotFoundException({code:"LAB_CUSTODY_SAMPLE_UNAVAILABLE"});
   const replay=await c.query<{source_digest:string;to_status:string;new_revision:number}>(
    "SELECT source_digest,to_status,new_revision FROM lab_sample_custody_event "+
    "WHERE root_realm_id=$1 AND sample_ref=$2 AND source_key=$3",
    [actor.realmId,sample,requestKey]);
   if(replay.rows[0]){
    if(replay.rows[0].source_digest!==hash)
     throw new ConflictException({code:"LAB_CUSTODY_REQUEST_CONFLICT"});
    await c.query("COMMIT");active=false;
    return{sampleLabel:old.opaque_sample_label,status:replay.rows[0].to_status,
     revision:replay.rows[0].new_revision,replayed:true};
   }
   if(old.order_status==="CANCELLED"||old.revision!==expected||
      !(t.from as readonly string[]).includes(old.custody_state))
    throw new ConflictException({code:"LAB_CUSTODY_STALE_OR_OUT_OF_SEQUENCE"});
   const holder=await c.query<{to_holder_ref:string|null}>(
    "SELECT to_holder_ref FROM lab_sample_custody_event "+
    "WHERE root_realm_id=$1 AND sample_ref=$2 "+
    "ORDER BY new_revision DESC LIMIT 1",[actor.realmId,sample]);
   await c.query(
    "UPDATE lab_sample SET custody_state=$3,revision=revision+1,"+
    "collected_at=CASE WHEN $3='COLLECTED' THEN now() ELSE collected_at END,"+
    "received_at=CASE WHEN $3='RECEIVED' THEN now() ELSE received_at END "+
    "WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,sample,t.to]);
   await c.query(
    "INSERT INTO lab_sample_custody_event(root_realm_id,order_ref,sample_ref,"+
    "actor_ref,source_key,source_digest,prior_revision,new_revision,"+
    "from_status,to_status,from_holder_ref,to_holder_ref,event_type) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
    [actor.realmId,order,sample,actor.accountId,requestKey,hash,
     expected,expected+1,old.custody_state,t.to,
     holder.rows[0]?.to_holder_ref??null,actor.accountId,t.event]);
   let replacementLabel:string|undefined;
   if(action==="recollect"){
    const label="CGS-"+randomBytes(10).toString("hex").toUpperCase();
    const newSample=await c.query<{id:string}>(
     "INSERT INTO lab_sample(root_realm_id,order_ref,opaque_sample_label,"+
     "material_type,collection_location_ref,replacement_for_sample_ref) "+
     "VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
     [actor.realmId,order,label,old.material_type,center,sample]);
    await c.query(
     "INSERT INTO lab_sample_line(root_realm_id,sample_ref,order_ref,order_line_ref) "+
     "SELECT root_realm_id,$2,order_ref,order_line_ref FROM lab_sample_line "+
     "WHERE root_realm_id=$1 AND sample_ref=$3",
     [actor.realmId,newSample.rows[0].id,sample]);
    replacementLabel=label;
   }
   const activeSamples=await c.query<{custody_state:string}>(
    "SELECT s.custody_state FROM lab_sample s WHERE s.root_realm_id=$1 "+
    "AND s.order_ref=$2 AND NOT EXISTS(SELECT 1 FROM lab_sample replacement "+
    "WHERE replacement.root_realm_id=s.root_realm_id "+
    "AND replacement.replacement_for_sample_ref=s.id)",
    [actor.realmId,order]);
   const states=activeSamples.rows.map(x=>x.custody_state);
   const next=states.some(x=>x==="REJECTED"||x==="RECOLLECTION_REQUIRED")?
    "RECOLLECTION_REQUIRED":
    states.length>0&&states.every(x=>x==="PROCESSING"||x==="RESULT_READY")?
     "PROCESSING":
    states.length>0&&states.every(x=>
     ["COLLECTED","RECEIVED","PROCESSING","RESULT_READY"].includes(x))?
     "COLLECTED":"COLLECTION_PENDING";
   if(next!==old.order_status){
    const v=await c.query<{revision:number}>(
     "UPDATE lab_order SET status=$3,revision=revision+1,updated_at=now() "+
     "WHERE root_realm_id=$1 AND id=$2 RETURNING revision",
     [actor.realmId,order,next]);
    const revision=v.rows[0].revision;
    await c.query(
     "INSERT INTO lab_order_event(root_realm_id,order_ref,source_key,actor_ref,"+
     "event_type,prior_revision,new_revision) VALUES($1,$2,$3,$4,$5,$6,$7)",
     [actor.realmId,order,requestKey,actor.accountId,
      action==="recollect"||action==="reject"?
       "RECOLLECTION_REQUESTED":"COLLECTION_RECORDED",revision-1,revision]);
   }
   await c.query("COMMIT");active=false;
   return{sampleLabel:old.opaque_sample_label,status:t.to,revision:expected+1,
    ...(replacementLabel?{replacementLabel}:{}),replayed:false};
  }catch(e){if(active)try{await c.query("ROLLBACK");}catch{};throw e;}
  finally{c.release();}
 }
}
