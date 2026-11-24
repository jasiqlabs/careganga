import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {ClinicalLabAdmissionService,type CareSource}
 from "./clinical-lab-admission.service";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Pick={mappingRef:string;quantity:number};
type Command={request_digest:string;order_ref:string|null};
type Price={kind:"TEST"|"PACKAGE";test_ref:string|null;package_ref:string|null;
 price_ref:string;version_no:number;patient_minor:string};
type Line={test:string;revision:number;name:string;code:string;sample:string;
 quantity:number;unit:bigint;total:bigint;packageRef:string|null;
 packageRevision:number|null;mapping:string;price:string;priceVersion:number};
function body(v:unknown){
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new BadRequestException({code:"LAB_CLINICAL_INVALID"});
 const x=v as Record<string,unknown>;
 if(Object.keys(x).some(k=>![
  "requestKey","patientRef","careSource","selections"
 ].includes(k)))throw new BadRequestException({code:"LAB_CLINICAL_INVALID"});
 return x;
}
function id(v:unknown){if(typeof v!=="string"||!ID.test(v))
 throw new BadRequestException({code:"LAB_CLINICAL_INVALID"});return v;}
function selections(v:unknown):Pick[]{
 if(!Array.isArray(v)||v.length<1||v.length>10)
  throw new BadRequestException({code:"LAB_CLINICAL_INVALID"});
 const used=new Set<string>();
 return v.map((p:unknown)=>{
  if(!p||typeof p!=="object"||Array.isArray(p))
   throw new BadRequestException({code:"LAB_CLINICAL_INVALID"});
  const x=p as Record<string,unknown>;
  if(Object.keys(x).some(k=>!["mappingRef","quantity"].includes(k))||
    !Number.isSafeInteger(x.quantity)||Number(x.quantity)<1||
    Number(x.quantity)>20)
   throw new BadRequestException({code:"LAB_CLINICAL_INVALID"});
  const mappingRef=id(x.mappingRef);
  if(used.has(mappingRef))throw new BadRequestException({code:"LAB_CLINICAL_DUPLICATE"});
  used.add(mappingRef);
  return {mappingRef,quantity:Number(x.quantity)};
 });
}
const MAX=9999999999n;
const unitPrice=(v:string)=>{const amount=BigInt(v);
 if(amount<0n||amount>MAX)throw new ConflictException({code:"LAB_QUOTE_UNAVAILABLE"});
 return amount;
};
function safeMoney(total:bigint){
 if(total<0n||total>MAX)throw new BadRequestException({code:"LAB_QUOTE_TOO_LARGE"});
 return total.toString();
}

/** One genuine CG15-consented internal order and frozen source quote.
 * No public booking endpoint, payment/CG17 posting or clinical report action.
 * All writes, source checks and idempotent response happen in ONE transaction. */
@Injectable()
export class ClinicalLabOrderService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly admission:ClinicalLabAdmissionService){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let active=false;
  try{
   await c.query("BEGIN");active=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const result=await run(c);
   await c.query("COMMIT");active=false;return result;
  }catch(e){if(active)try{await c.query("ROLLBACK");}catch{};throw e;}
  finally{c.release();}
 }
 private async quote(c:PoolClient,root:string,center:string,
  chosen:Pick):Promise<{lines:Line[];amount:bigint}>{
  const q=await c.query<Price>(
   "SELECT m.test_or_package_kind AS kind,m.test_ref,m.package_ref,"+
   "price.id AS price_ref,price.version_no,"+
   "price.advertised_patient_price_minor::text AS patient_minor "+
   "FROM lab_center_test_mapping m JOIN lab_center_price_version price "+
   "ON price.root_realm_id=m.root_realm_id AND "+
   "price.center_test_mapping_ref=m.id AND price.status='APPROVED' "+
   "AND price.effective_from<=now() "+
   "AND (price.effective_to IS NULL OR price.effective_to>now()) "+
   "JOIN cg03_case review ON review.realm_id=price.root_realm_id "+
   "AND review.cg16_price_id=price.id "+
   "AND review.case_kind='HEALTH_LAB_PRICE_REVIEW' "+
   "AND review.status='OWNER_COMPLETED' "+
   "AND review.cg16_price_version=price.version_no "+
   "AND review.proposer_id=price.proposed_by "+
   "JOIN cg03_case_decision decision ON "+
   "decision.realm_id=review.realm_id AND decision.case_id=review.id "+
   "AND decision.action='APPROVE' "+
   "AND decision.actor_id=price.approved_by "+
   "AND decision.actor_id<>review.proposer_id "+
   "AND decision.accepted_case_revision=review.revision-1 "+
   "AND decision.fresh_password_verified_at IS NOT NULL "+
   "WHERE m.root_realm_id=$1 AND m.center_ref=$2 AND m.id=$3 "+
   "AND m.publication_state='ACTIVE' FOR SHARE OF m,price",
   [root,center,chosen.mappingRef]);
  const item=q.rows[0];
  if(!item)throw new NotFoundException({code:"LAB_CLINICAL_TEST_UNAVAILABLE"});
  const amount=unitPrice(item.patient_minor)*BigInt(chosen.quantity);
  safeMoney(amount);
  let lines:Line[]=[];
  if(item.kind==="TEST"&&item.test_ref){
   const found=await c.query<{id:string;revision:number;name:string;
    unique_test_code:string;sample_type:string}>(
    "SELECT t.id,t.revision,t.name,t.unique_test_code,t.sample_type "+
    "FROM diagnostic_test t JOIN test_category cat ON "+
    "cat.root_realm_id=t.root_realm_id AND cat.id=t.category_ref "+
    "WHERE t.root_realm_id=$1 AND t.id=$2 AND t.status='ACTIVE' "+
    "AND cat.status='ACTIVE' AND t.active_from<=now() "+
    "AND (t.active_to IS NULL OR t.active_to>now()) FOR SHARE OF t,cat",
    [root,item.test_ref]);
   const t=found.rows[0];
   if(!t)throw new NotFoundException({code:"LAB_CLINICAL_TEST_UNAVAILABLE"});
   lines=[{test:t.id,revision:t.revision,name:t.name,code:t.unique_test_code,
    sample:t.sample_type,quantity:chosen.quantity,unit:unitPrice(item.patient_minor),
    total:amount,packageRef:null,packageRevision:null,mapping:chosen.mappingRef,
    price:item.price_ref,priceVersion:item.version_no}];
  }else if(item.kind==="PACKAGE"&&item.package_ref){
   const pack=await c.query<{revision:number}>(
    "SELECT revision FROM diagnostic_package WHERE root_realm_id=$1 "+
    "AND id=$2 AND status='ACTIVE' AND active_from<=now() "+
    "AND (active_to IS NULL OR active_to>now()) FOR SHARE",
    [root,item.package_ref]);
   if(!pack.rows[0])throw new NotFoundException({code:"LAB_CLINICAL_TEST_UNAVAILABLE"});
   const members=await c.query<{test_ref:string;test_revision_at_approval:number;
    quantity:number;name:string;code:string;sample:string}>(
    "SELECT l.test_ref,l.test_revision_at_approval,l.quantity,"+
    "r.snapshot->>'name' AS name,"+
    "r.snapshot->>'testCode' AS code,"+
    "r.snapshot->>'sampleType' AS sample "+
    "FROM diagnostic_package_line l JOIN diagnostic_test_revision r "+
    "ON r.root_realm_id=l.root_realm_id AND r.test_ref=l.test_ref "+
    "AND r.revision_no=l.test_revision_at_approval "+
    "JOIN diagnostic_test t ON t.root_realm_id=l.root_realm_id AND t.id=l.test_ref "+
    "JOIN test_category cat ON cat.root_realm_id=t.root_realm_id "+
    "AND cat.id=t.category_ref "+
    "WHERE l.root_realm_id=$1 AND l.package_ref=$2 AND "+
    "l.package_revision=$3 AND t.status='ACTIVE' AND cat.status='ACTIVE' "+
    "AND t.active_from<=now() AND (t.active_to IS NULL OR t.active_to>now()) "+
    "ORDER BY l.order_index FOR SHARE OF t,cat",
    [root,item.package_ref,pack.rows[0].revision]);
   const expected=await c.query<{count:string}>(
    "SELECT count(*)::text AS count FROM diagnostic_package_line "+
    "WHERE root_realm_id=$1 AND package_ref=$2 AND package_revision=$3",
    [root,item.package_ref,pack.rows[0].revision]);
   if(members.rows.length===0||
     members.rows.length!==Number(expected.rows[0]?.count))
    throw new ConflictException({code:"LAB_CLINICAL_PACKAGE_CHANGED"});
   const weights=members.rows.map(m=>m.quantity*chosen.quantity);
   const sum=weights.reduce((a,b)=>a+b,0);
   if(sum<1||weights.some(w=>w>100))
    throw new BadRequestException({code:"LAB_CLINICAL_QUANTITY_INVALID"});
   let allocated=0n;
   lines=members.rows.map((m,i)=>{
    const qty=weights[i];
    const piece=i===members.rows.length-1?amount-allocated:
     amount*BigInt(qty)/BigInt(sum);
    allocated+=piece;
    return{test:m.test_ref,revision:m.test_revision_at_approval,
     name:m.name,code:m.code,sample:m.sample,quantity:qty,
     unit:piece/BigInt(qty),total:piece,packageRef:item.package_ref,
     packageRevision:pack.rows[0].revision,mapping:chosen.mappingRef,
     price:item.price_ref,priceVersion:item.version_no};
   });
  }else throw new ConflictException({code:"LAB_CLINICAL_TEST_UNAVAILABLE"});
  return {lines,amount};
 }
 async create(bearer:string,centerRef:string,raw:unknown){
  const x=body(raw),requestKey=id(x.requestKey),patientRef=id(x.patientRef);
  const list=selections(x.selections);
  if(!x.careSource||typeof x.careSource!=="object"||
    Array.isArray(x.careSource)||
    Object.keys(x.careSource).some(k=>!["kind","ref"].includes(k)))
   throw new BadRequestException({code:"LAB_PATIENT_SOURCE_INVALID"});
  const rawCare=x.careSource as Record<string,unknown>;
  if(rawCare.kind!=="CENTER_INTAKE"&&rawCare.kind!=="CONSULTATION")
   throw new BadRequestException({code:"LAB_PATIENT_SOURCE_INVALID"});
  const care:CareSource={kind:rawCare.kind,ref:id(rawCare.ref)};
  const original=digest({centerRef,patientRef,care,list});
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,bearer,centerRef,"lab.orders.create");
   const patient=await this.admission.patientCare(c,actor,centerRef,patientRef,care);
   await c.query(
    "INSERT INTO lab_order_command(root_realm_id,actor_ref,request_key,request_digest) "+
    "VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [actor.realmId,actor.accountId,requestKey,original]);
   const cmd=await c.query<Command>(
    "SELECT request_digest,order_ref FROM lab_order_command "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3 FOR UPDATE",
    [actor.realmId,actor.accountId,requestKey]);
   if(cmd.rows[0]?.request_digest!==original)
    throw new ConflictException({code:"LAB_CLINICAL_REQUEST_CONFLICT"});
   if(cmd.rows[0].order_ref){
    const old=await c.query<{display_order_ref:string;status:string}>(
     "SELECT display_order_ref,status FROM lab_order "+
     "WHERE root_realm_id=$1 AND id=$2 AND center_ref=$3",
     [actor.realmId,cmd.rows[0].order_ref,centerRef]);
    if(!old.rows[0])throw new ConflictException({code:"LAB_CLINICAL_REQUEST_CONFLICT"});
    return {orderRef:cmd.rows[0].order_ref,
     displayOrderRef:old.rows[0].display_order_ref,status:old.rows[0].status,replayed:true};
   }
   let total=0n;const lines:Line[]=[];
   for(const selected of list){
    const item=await this.quote(c,actor.realmId,centerRef,selected);
    total+=item.amount;safeMoney(total);lines.push(...item.lines);
   }
   if(lines.length===0||lines.length>100)
    throw new BadRequestException({code:"LAB_CLINICAL_QUANTITY_INVALID"});
   // An entirely specimen-free selection cannot enter the current custody
   // lifecycle. The approved US-002 clinical no-specimen workflow is absent;
   // never leave a patient order permanently stuck in COLLECTION_PENDING.
   if(!lines.some(line=>line.sample!=="NOT_APPLICABLE"))
    throw new BadRequestException({code:"LAB_CLINICAL_SAMPLE_POLICY_REQUIRED"});
   const display="CGL-"+randomBytes(8).toString("hex").toUpperCase();
   const order=await c.query<{id:string}>(
    "INSERT INTO lab_order(root_realm_id,display_order_ref,center_ref,patient_ref,"+
    "care_source_kind,center_intake_ref,consultation_ref,care_consent_revision,"+
    "consent_granted_at,accepted_center_total_minor,source_key,source_digest,"+
    "created_by_account) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id",
    [actor.realmId,display,centerRef,patientRef,care.kind,
     care.kind==="CENTER_INTAKE"?care.ref:null,
     care.kind==="CONSULTATION"?care.ref:null,patient.consentRevision,
     patient.consentRecordedAt,safeMoney(total),requestKey,original,actor.accountId]);
   const orderRef=order.rows[0].id;
   const samples=new Map<string,{id:string}>();
   for(const line of lines){
    const row=await c.query<{id:string}>(
     "INSERT INTO lab_order_line(root_realm_id,order_ref,test_ref,test_revision,"+
     "source_package_ref,package_revision,mapping_ref,price_ref,accepted_price_version,"+
     "test_name_snapshot,test_code_snapshot,sample_type_snapshot,qty,"+
     "accepted_unit_minor,accepted_line_total_minor,source_line_key) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id",
     [actor.realmId,orderRef,line.test,line.revision,line.packageRef,
      line.packageRevision,line.mapping,line.price,line.priceVersion,
      line.name,line.code,line.sample,line.quantity,
      safeMoney(line.unit),safeMoney(line.total),randomUUID()]);
    if(line.sample==="NOT_APPLICABLE")continue;
    let sample=samples.get(line.sample);
    if(!sample){
     const label="CGS-"+randomBytes(10).toString("hex").toUpperCase();
     const created=await c.query<{id:string}>(
      "INSERT INTO lab_sample(root_realm_id,order_ref,opaque_sample_label,"+
      "material_type,collection_location_ref) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [actor.realmId,orderRef,label,line.sample,centerRef]);
     sample=created.rows[0];samples.set(line.sample,sample);
    }
    await c.query(
     "INSERT INTO lab_sample_line(root_realm_id,sample_ref,order_ref,order_line_ref) "+
     "VALUES($1,$2,$3,$4)",[actor.realmId,sample.id,orderRef,row.rows[0].id]);
   }
   await c.query(
    "INSERT INTO lab_order_event(root_realm_id,order_ref,source_key,"+
    "actor_ref,event_type,prior_revision,new_revision) "+
    "VALUES($1,$2,$3,$4,'CREATED',0,1)",
    [actor.realmId,orderRef,requestKey,actor.accountId]);
   await c.query(
    "UPDATE lab_order_command SET order_ref=$4 "+
    "WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",
    [actor.realmId,actor.accountId,requestKey,orderRef]);
   return {orderRef,displayOrderRef:display,status:"COLLECTION_PENDING",replayed:false};
  });
 }
 async centerOrders(bearer:string,centerRef:string,search:unknown="",offsetRaw:unknown="0"){
  if(typeof search!=="string"||search.length>80||/[\u0000-\u001f\u007f]/.test(search)||
   typeof offsetRaw!=="string"||!/^(0|[1-9]\d{0,4})$/.test(offsetRaw)||Number(offsetRaw)>9990)
   throw new BadRequestException({code:"LAB_CLINICAL_INVALID"});
  const offset=Number(offsetRaw),q=search.trim().toLowerCase();
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,bearer,centerRef,"lab.orders.view");
   const result=await c.query(
    "SELECT id AS \"orderRef\",display_order_ref AS \"displayOrderRef\","+
    "status,accepted_center_total_minor::text AS \"quotedTotalMinor\",created_at AS \"createdAt\" "+
    "FROM lab_order WHERE root_realm_id=$1 AND center_ref=$2 "+
    "AND ($3::text=\x27\x27 OR position($3 in lower(display_order_ref))>0 OR position($3 in lower(replace(status::text,\x27_\x27,\x27 \x27)))>0) "+
    "ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET $4",
    [actor.realmId,centerRef,q,offset]);
   return {orders:result.rows.slice(0,30),nextOffset:result.rows.length>30&&offset<9990?offset+30:null};
  });
 }
 async detail(bearer:string,centerRef:string,orderRef:string){
  id(orderRef);
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,bearer,centerRef,"lab.orders.view");
   const r=await c.query(
    "SELECT id AS \"orderRef\",display_order_ref AS \"displayOrderRef\",status,"+
    "accepted_center_total_minor::text AS \"quotedTotalMinor\",created_at AS \"createdAt\" "+
    "FROM lab_order WHERE root_realm_id=$1 AND center_ref=$2 AND id=$3",
    [actor.realmId,centerRef,orderRef]);
   if(!r.rows[0])throw new NotFoundException({code:"LAB_CLINICAL_ORDER_UNAVAILABLE"});
   const [lines,samples,report]=await Promise.all([
    c.query("SELECT test_name_snapshot AS name,test_code_snapshot AS code,"+
     "sample_type_snapshot AS \"sampleType\",qty AS quantity,"+
     "accepted_line_total_minor::text AS \"quotedLineTotalMinor\" "+
     "FROM lab_order_line WHERE root_realm_id=$1 AND order_ref=$2 "+
     "ORDER BY created_at,id",[actor.realmId,orderRef]),
    c.query("SELECT id AS \"sampleRef\",opaque_sample_label AS label,material_type AS \"sampleType\","+
     "custody_state AS status,revision FROM lab_sample WHERE root_realm_id=$1 "+
     "AND order_ref=$2 ORDER BY created_at,id",[actor.realmId,orderRef]),
    c.query("SELECT result_state AS state FROM lab_result_revision "+
     "WHERE root_realm_id=$1 AND order_ref=$2 ORDER BY version_no DESC LIMIT 1",
     [actor.realmId,orderRef])
   ]);
   // The restricted order-detail view reports source evidence state only.
   // Never imply a DRAFT/RESULT_READY file has professional approval or release.
   return {order:r.rows[0],lines:lines.rows,samples:samples.rows,
    report:report.rows[0]??null};
  });
 }
}
