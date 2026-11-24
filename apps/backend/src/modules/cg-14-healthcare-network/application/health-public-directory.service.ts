import {
  BadRequestException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9][a-z0-9-]{2,79}$/;
type Search={q:string;after:string;category:string;center:string;specialty:string;
  pin:string;state:string;district:string;block:string;facility:string;
  service:string;day:number|null;
  minFee:number|null;maxFee:number|null;minExperience:number|null;maxExperience:number|null};
type CenterRow={public_slug:string;center_name:string;provider_name:string;
  center_type:string;address:string;pin_code:string;public_phone:string|null;
  latitude:string|null;longitude:string|null};
type DoctorRow={doctor_ref:string;full_name:string;qualifications:string[];
  specialties:string[];experience_years:number;public_bio:string;
  center_slug:string;center_name:string;address:string;pin_code:string;
  fee_kind:string|null;consultation_mode:string|null;amount_minor:string|null;
  effective_from:Date|null;effective_to:Date|null};
/** Privileged SERVER-INTERNAL typed source: never return IDs, root, provider
 * or CG19 evidence to anonymous clients. CG15 consumes only this original
 * CG14 current approved publication/doctor/fee proof, never shadow masters. */
export type HealthScheduleEligibleSource={
 root_ref:string;association_ref:string;doctor_ref:string;doctor_name:string;
 center_ref:string;center_slug:string;center_name:string;address:string;
 pin_code:string;time_zone:string;amount_minor:string|null;
 fee_effective_from:Date|null;fee_effective_to:Date|null;
};
const safe=(value:unknown,field:string,max=80)=>{
  if(value===undefined)return "";
  if(typeof value!=="string"||value.length>max||
    /[\u0000-\u001f\u007f]/.test(value))
    throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID",field});
  return value.trim();
};
const escapeLike=(value:string)=>value.replace(/[\\%_]/g,"\\$&");
function parse(value:unknown):Search{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID"});
  const x=value as Record<string,unknown>;
  if(Object.keys(x).some(k=>!["q","after","category","specialty","pin",
    "state","district","block","facility","service","day",
    "minExperience","maxExperience",
    "minFee","maxFee","center"].includes(k)))
    throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID"});
  const q=safe(x.q,"q"),after=safe(x.after,"after",130),
    center=safe(x.center,"center",80),
    category=safe(x.category,"category",40),specialty=safe(x.specialty,"specialty",60),
    pin=safe(x.pin,"pin",6),state=safe(x.state,"state",36),
    district=safe(x.district,"district",36),block=safe(x.block,"block",36),
    facility=safe(x.facility,"facility",80),service=safe(x.service,"service",30);
  if(after&&!SLUG.test(after)&&!/^([a-z0-9][a-z0-9-]{2,79})~([0-9a-f-]{36})$/.test(after)||
    center&&!SLUG.test(center)||pin&&!/^[1-9][0-9]{5}$/.test(pin)||
    state&&!UUID.test(state)||district&&!UUID.test(district)||
    block&&!UUID.test(block)||
    category&&!["HOSPITAL","CLINIC","DIAGNOSTIC_LAB","PHARMACY","NURSING","OTHER",
      "POLYCLINIC","DIAGNOSTIC_CENTER","DENTAL_CLINIC","MEDICAL_LABORATORY",
      "NURSING_HOME","ORTHOPEDIC_CLINIC","HOMEOPATHY_CLINIC","AYURVEDIC_CLINIC"
    ].includes(category))
    throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID"});
  const amount=(k:"minFee"|"maxFee")=>{
    if(x[k]===undefined)return null;
    if(typeof x[k]!=="string"||! /^(0|[1-9][0-9]{0,6})$/.test(x[k]))
      throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID",field:k});
    return Number(x[k])*100;
  };
  if(service&&!["CONSULTATION","DIAGNOSTICS","PHARMACY","NURSING","SURGERY","EMERGENCY"].includes(service))
   throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID",field:"service"});
  const day=x.day===undefined?null:Number(x.day);
  if(day!==null&&(typeof x.day!=="string"||!/^[0-6]$/.test(x.day)))
   throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID",field:"day"});
  const minFee=amount("minFee"),maxFee=amount("maxFee");
  if(minFee!==null&&maxFee!==null&&minFee>maxFee)
    throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID",field:"maxFee"});
  const years=(k:"minExperience"|"maxExperience")=>{
    if(x[k]===undefined)return null;
    if(typeof x[k]!=="string"||!/^(0|[1-9][0-9]?)$/.test(x[k])||
      Number(x[k])>70)
     throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID",field:k});
    return Number(x[k]);
  };
  const minExperience=years("minExperience"),maxExperience=years("maxExperience");
  if(minExperience!==null&&maxExperience!==null&&minExperience>maxExperience)
   throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID",field:"maxExperience"});
  return {q,after,category,center,specialty,pin,state,district,block,facility,service,day,
   minFee,maxFee,minExperience,maxExperience};
}
/**
 * The standalone anonymous public directory is sourced exclusively from
 * current CG-03-approved, CG-19-valid, CG-14-PUBLISHED centers. No root,
 * reviewer, bank, license, staff or booking records enter the response.
 * Do not cache: every request must re-evaluate withdrawal and expiry.
 */
@Injectable()
export class HealthPublicDirectoryService{
  constructor(@Inject(DATABASE)private readonly db:Pool){}
  private readonly eligibleCenter=
    "FROM health_center c "+
    "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
    "JOIN access_realm root ON root.id=c.root_realm_id AND root.realm_key='FOUNDATION_ROOT' "+
    "JOIN health_center_publication pub ON pub.root_realm_id=c.root_realm_id "+
    "AND pub.center_id=c.id AND pub.generation=c.publication_generation "+
    "JOIN health_center_revision rev ON rev.id=pub.verified_center_revision_id "+
    "AND rev.root_realm_id=c.root_realm_id AND rev.provider_id=p.id AND rev.center_id=c.id "+
    "JOIN cg03_case cg ON cg.id=rev.approval_case_ref AND cg.realm_id=c.root_realm_id "+
    "AND cg.case_kind='HEALTH_CENTER_VERIFICATION' AND cg.health_center_id=c.id "+
    "AND cg.health_center_revision_id=rev.id AND cg.health_source_digest=rev.source_digest "+
    "JOIN cg03_case_decision d ON d.id=pub.original_final_decision_ref "+
    "AND d.realm_id=c.root_realm_id AND d.case_id=cg.id AND d.action='APPROVE' "+
    "AND d.fresh_password_verified_at IS NOT NULL AND d.actor_id<>cg.proposer_id "+
    "JOIN cg19_stored_file proof ON proof.id=rev.proof_file_ref AND proof.realm_id=c.root_realm_id "+
    "AND proof.owner_kind='CG14_DRAFT' AND proof.health_center_id=c.id "+
    "AND proof.health_provider_id=p.id AND proof.revoked_at IS NULL "+
    "AND proof.scan_status='CLEAN_VERIFIED' "+
    "JOIN cg19_upload_intent intent ON intent.id=proof.upload_intent_id "+
    "AND intent.realm_id=proof.realm_id AND intent.status='VALIDATED' "+
    "AND intent.classification='HEALTH_CENTER_LICENSE' ";
  private readonly predicates=
    "WHERE c.status='VERIFIED' AND p.status='VERIFIED' "+
    "AND c.access_state='ENABLED' AND c.publication_state='PUBLISHED' "+
    "AND cg.status='OWNER_COMPLETED' AND c.public_slug IS NOT NULL ";
  private readonly eligibleDoctor=
    "JOIN health_doctor_center assoc ON assoc.root_realm_id=c.root_realm_id "+
    "AND assoc.center_id=c.id AND assoc.affiliation_state='APPROVED' "+
    "AND assoc.approved_from<=now() AND (assoc.approved_to IS NULL OR assoc.approved_to>now()) "+
    "JOIN health_doctor doc ON doc.root_realm_id=c.root_realm_id "+
    "AND doc.id=assoc.doctor_id AND doc.status='VERIFIED' "+
    "JOIN health_doctor_revision drv ON drv.root_realm_id=doc.root_realm_id "+
    "AND drv.doctor_id=doc.id "+
    "AND drv.revision_no=(SELECT MAX(r2.revision_no) "+
    "FROM health_doctor_revision r2 WHERE r2.root_realm_id=doc.root_realm_id "+
    "AND r2.doctor_id=doc.id) "+
    "JOIN cg03_case dc ON dc.id=drv.approval_case_ref AND dc.realm_id=drv.root_realm_id "+
    "AND dc.case_kind='HEALTH_DOCTOR_VERIFICATION' AND dc.status='OWNER_COMPLETED' "+
    "AND dc.health_doctor_id=doc.id AND dc.health_doctor_revision_id=drv.id "+
    "AND dc.health_source_digest=drv.source_digest "+
    "JOIN cg03_case_decision dd ON dd.case_id=dc.id AND dd.realm_id=dc.realm_id "+
    "AND dd.action='APPROVE' AND dd.fresh_password_verified_at IS NOT NULL "+
    "AND dd.actor_id<>dc.proposer_id "+
    "JOIN cg19_stored_file license ON license.id=drv.proof_file_ref "+
    "AND license.realm_id=drv.root_realm_id AND license.owner_kind='CG14_DOCTOR' "+
    "AND license.health_doctor_id=doc.id AND license.revoked_at IS NULL "+
    "AND license.scan_status='CLEAN_VERIFIED' "+
    "JOIN cg19_upload_intent doctor_intent ON doctor_intent.id=license.upload_intent_id "+
    "AND doctor_intent.realm_id=license.realm_id AND doctor_intent.status='VALIDATED' "+
    "AND doctor_intent.classification='HEALTH_DOCTOR_LICENSE' ";
  // LATERAL result is the approved, currently effective in-person consultation
  // fee for THIS center association, never a copied/provider-wide charge.
  private readonly feeJoin=
    "LEFT JOIN LATERAL (SELECT fee.fee_kind,fee.consultation_mode,"+
    "fee.amount_minor,fee.effective_from,fee.effective_to "+
    "FROM health_center_fee fee WHERE fee.root_realm_id=assoc.root_realm_id "+
    "AND fee.doctor_center_id=assoc.id AND fee.status='APPROVED' "+
    "AND fee.fee_kind='CONSULTATION' AND fee.consultation_mode='IN_PERSON' "+
    "AND fee.effective_from<=now() AND (fee.effective_to IS NULL OR fee.effective_to>now()) "+
    "ORDER BY fee.effective_from DESC LIMIT 1) fee ON TRUE ";
  private filters(s:Search){
    return {params:[s.q?("%"+escapeLike(s.q)+"%"):null,
      s.category||null,s.pin||null,s.state||null,s.district||null,
      s.after||null,s.specialty?("%"+escapeLike(s.specialty)+"%"):null,
      s.minFee,s.maxFee,s.center||null,s.minExperience,s.maxExperience,
      s.block||null,s.facility?("%"+escapeLike(s.facility)+"%"):null,
      s.service||null,s.day
    ] as (string|number|null)[],
      common:"AND ($2::text IS NULL OR c.center_type=$2) "+
        "AND ($3::text IS NULL OR c.pin_code=$3) "+
        "AND ($4::uuid IS NULL OR c.state_ref=$4) "+
        "AND ($5::uuid IS NULL OR c.district_ref=$5) "+
        "AND ($13::uuid IS NULL OR c.block_ref=$13) "+
        "AND ($14::text IS NULL OR EXISTS("+
        "SELECT 1 FROM health_center_content_publication cp "+
        "JOIN health_center_content_revision cr ON cr.id=cp.approved_revision_id "+
        "AND cr.root_realm_id=cp.root_realm_id AND cr.center_id=cp.center_id "+
        "JOIN cg03_case review ON review.id=cr.approval_case_ref "+
        "AND review.realm_id=cr.root_realm_id "+
        "AND review.case_kind='HEALTH_CENTER_CONTENT_REVIEW' "+
        "AND review.health_content_revision_id=cr.id "+
        "AND review.health_source_digest=cr.source_digest "+
        "AND review.status='OWNER_COMPLETED' "+
        "JOIN cg03_case_decision decision ON decision.id=cp.original_decision_ref "+
        "AND decision.realm_id=review.realm_id AND decision.case_id=review.id "+
        "AND decision.action='APPROVE' "+
        "AND decision.fresh_password_verified_at IS NOT NULL "+
        "AND decision.actor_id<>review.proposer_id "+
        "JOIN LATERAL jsonb_array_elements_text("+
        "COALESCE(cr.source_snapshot->'facilities','[]'::jsonb)) facility(value) ON TRUE "+
        "WHERE cp.root_realm_id=c.root_realm_id AND cp.center_id=c.id "+
        "AND cp.withdrawn_at IS NULL AND facility.value ILIKE $14 ESCAPE '\\')) "+
        "AND ($15::text IS NULL OR EXISTS(SELECT 1 FROM health_center_capability cap "+
        "WHERE cap.root_realm_id=c.root_realm_id AND cap.center_id=c.id "+
        "AND cap.capability_code=$15)) "+
        "AND ($16::integer IS NULL OR EXISTS(SELECT 1 FROM health_center_hours h "+
        "WHERE h.root_realm_id=c.root_realm_id AND h.center_id=c.id "+
        "AND h.weekday=$16)) "};
  }
  /** Public-safe location choices derive only from current eligible centers,
   * never expose private future centers or technical UUIDs as UI labels.
   */
  async facets(){
   const locations=await this.db.query<{id:string;level:string;
    display_name:string;parent_area_id:string|null}>(
    "SELECT DISTINCT g.id,g.level,g.display_name,g.parent_area_id "+
    this.eligibleCenter+
    "JOIN geography_area g ON g.root_realm_id=c.root_realm_id "+
    "AND g.id IN(c.state_ref,c.district_ref,c.block_ref) "+
    this.predicates+"AND g.status='ACTIVE' "+
    "ORDER BY g.level,g.display_name,g.id LIMIT 500");
   return {areas:locations.rows.map(g=>({value:g.id,label:g.display_name,
    level:g.level,parentRef:g.parent_area_id}))};
  }
  /** Bounded, live sitemap projection. Never derive SEO from private drafts. */
  async sitemap(){
    const [center,doctor]=await Promise.all([
      this.db.query<{public_slug:string}>(
       "SELECT c.public_slug "+this.eligibleCenter+this.predicates+
       "ORDER BY c.public_slug LIMIT 1000"),
      this.db.query<{id:string}>(
       "SELECT DISTINCT doc.id "+this.eligibleCenter+this.eligibleDoctor+
       this.predicates+"ORDER BY doc.id LIMIT 1000")
    ]);
    return {centers:center.rows.map(x=>x.public_slug),
      doctors:doctor.rows.map(x=>x.id)};
  }
  async centers(input:unknown){
    const s=parse(input),f=this.filters(s);
    if(s.after.includes("~")||s.center||s.specialty||s.minFee!==null||s.maxFee!==null||
      s.minExperience!==null||s.maxExperience!==null)
      throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID"});
    const found=await this.db.query<CenterRow>(
      "SELECT c.public_slug,c.display_name AS center_name,p.legal_name AS provider_name,"+
      "c.center_type,c.address_line AS address,c.pin_code,c.public_phone,"+
      "c.latitude,c.longitude "+this.eligibleCenter+this.predicates+
      f.common+"AND ($1::text IS NULL OR c.display_name ILIKE $1 ESCAPE '\\' "+
      "OR p.legal_name ILIKE $1 ESCAPE '\\') "+
      "AND ($6::text IS NULL OR c.public_slug>$6) "+
      "AND ($7::text IS NULL OR TRUE) "+
      "AND ($8::bigint IS NULL OR TRUE) "+
      "AND ($9::bigint IS NULL OR TRUE) "+
      "AND ($10::text IS NULL OR TRUE) "+
      "AND ($11::smallint IS NULL OR TRUE) "+
      "AND ($12::smallint IS NULL OR TRUE) "+
      "ORDER BY c.public_slug ASC LIMIT 21",
      f.params);
    return {items:found.rows.slice(0,20).map(c=>({
      slug:c.public_slug,centerName:c.center_name,providerName:c.provider_name,
      type:c.center_type,address:c.address,pinCode:c.pin_code,publicPhone:c.public_phone,
      latitude:c.latitude===null?null:Number(c.latitude),
      longitude:c.longitude===null?null:Number(c.longitude)})),
      next:found.rows.length>20?found.rows[19].public_slug:null};
  }
  async doctors(input:unknown){
    const s=parse(input),f=this.filters(s);
    if(s.after&&!/^([a-z0-9][a-z0-9-]{2,79})~([0-9a-f-]{36})$/.test(s.after))
      throw new BadRequestException({code:"HEALTH_PUBLIC_FILTER_INVALID",field:"after"});
    const rows=await this.db.query<DoctorRow>(
      "SELECT doc.id AS doctor_ref,doc.full_name,doc.qualifications,"+
      "doc.specialties,doc.experience_years,doc.public_bio,"+
      "c.public_slug AS center_slug,c.display_name AS center_name,"+
      "c.address_line AS address,c.pin_code,fee.fee_kind,fee.consultation_mode,"+
      "fee.amount_minor,fee.effective_from,fee.effective_to "+
      this.eligibleCenter+this.eligibleDoctor+this.feeJoin+this.predicates+
      f.common+"AND ($1::text IS NULL OR doc.full_name ILIKE $1 ESCAPE '\\' "+
      "OR EXISTS(SELECT 1 FROM unnest(doc.qualifications) qual "+
      "WHERE qual ILIKE $1 ESCAPE '\\')) "+
      "AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM unnest(doc.specialties) spec "+
      "WHERE spec ILIKE $7 ESCAPE '\\')) "+
      "AND ($8::bigint IS NULL OR fee.amount_minor >= $8) "+
      "AND ($9::bigint IS NULL OR fee.amount_minor <= $9) "+
      "AND ($6::text IS NULL OR (c.public_slug,doc.id)>"+
      "(split_part($6,'~',1),split_part($6,'~',2)::uuid)) "+
      "AND ($10::text IS NULL OR c.public_slug=$10) "+
      "AND ($11::smallint IS NULL OR doc.experience_years >= $11) "+
      "AND ($12::smallint IS NULL OR doc.experience_years <= $12) "+
      "ORDER BY c.public_slug,doc.id LIMIT 21",
      f.params);
    return {items:rows.rows.slice(0,20).map(this.safeDoctor),
      next:rows.rows.length>20?
        rows.rows[19].center_slug+"~"+rows.rows[19].doctor_ref:null,
      notice:"Fees are approved current amounts, not appointment availability."};
  }
  /** For CG-15 US002 ONLY. Same original verified-center + verified-doctor
   * CG03/CG19/proof/fee query as public directory, in caller's read snapshot.
   * No internal refs may be serialized directly to client responses.
   */
  /** One CG14-qualified current clinician+in-person fee for a center.
   * The caller may be CG17, but CG14 alone owns professional/license/proof
   * validity. No new center, doctor, fee or patient financial master.
   */
  async eligibleConsultationCandidate(tx:PoolClient,
   rootRef:string,centerSlug:string,doctorRef?:string){
   if(!UUID.test(rootRef)||!SLUG.test(centerSlug)||
      doctorRef!==undefined&&!UUID.test(doctorRef))
    throw new NotFoundException("Current public consultation source unavailable");
   const q=await tx.query<HealthScheduleEligibleSource>(
    "SELECT c.root_realm_id AS root_ref,assoc.id AS association_ref,"+
    "doc.id AS doctor_ref,doc.full_name AS doctor_name,"+
    "c.id AS center_ref,c.public_slug AS center_slug,"+
    "c.display_name AS center_name,c.address_line AS address,"+
    "c.pin_code,c.time_zone,fee.amount_minor,"+
    "fee.effective_from AS fee_effective_from,"+
    "fee.effective_to AS fee_effective_to "+
    this.eligibleCenter+this.eligibleDoctor+this.feeJoin+this.predicates+
    "AND c.root_realm_id=$1 AND c.public_slug=$2 "+
    "AND ($3::uuid IS NULL OR doc.id=$3) "+
    "AND fee.amount_minor IS NOT NULL ORDER BY doc.id LIMIT 1",
    [rootRef,centerSlug,doctorRef??null]);
   return q.rows[0]??null;
  }
  async eligibleScheduleSource(tx:PoolClient,doctorRef:string,centerSlug?:string){
    if(!UUID.test(doctorRef)||centerSlug!==undefined&&!SLUG.test(centerSlug))
      throw new NotFoundException("Current verified doctor unavailable");
    const result=await tx.query<HealthScheduleEligibleSource>(
      "SELECT c.root_realm_id AS root_ref,assoc.id AS association_ref,"+
      "doc.id AS doctor_ref,doc.full_name AS doctor_name,"+
      "c.id AS center_ref,c.public_slug AS center_slug,"+
      "c.display_name AS center_name,c.address_line AS address,"+
      "c.pin_code,c.time_zone,fee.amount_minor,"+
      "fee.effective_from AS fee_effective_from,"+
      "fee.effective_to AS fee_effective_to "+
      this.eligibleCenter+this.eligibleDoctor+this.feeJoin+this.predicates+
      "AND doc.id=$1 AND ($2::text IS NULL OR c.public_slug=$2) "+
      "ORDER BY c.public_slug ASC LIMIT 26",
      [doctorRef,centerSlug??null]);
    if(!result.rows.length)
      throw new NotFoundException("This doctor has no currently verified public center");
    return result.rows.slice(0,25);
  }
  async doctor(doctorRef:string){
    if(!UUID.test(doctorRef))throw new NotFoundException("Verified doctor unavailable");
    const rows=await this.db.query<DoctorRow>(
      "SELECT doc.id AS doctor_ref,doc.full_name,doc.qualifications,"+
      "doc.specialties,doc.experience_years,doc.public_bio,"+
      "c.public_slug AS center_slug,c.display_name AS center_name,"+
      "c.address_line AS address,c.pin_code,fee.fee_kind,fee.consultation_mode,"+
      "fee.amount_minor,fee.effective_from,fee.effective_to "+
      this.eligibleCenter+this.eligibleDoctor+this.feeJoin+this.predicates+
      "AND doc.id=$1 ORDER BY c.public_slug LIMIT 51",[doctorRef]);
    if(!rows.rowCount)throw new NotFoundException("Verified doctor unavailable");
    const first=rows.rows[0];
    return {doctorName:first.full_name,qualifications:first.qualifications,
      specialties:first.specialties,experienceYears:first.experience_years,
      bio:first.public_bio,centers:rows.rows.map(this.safeDoctor),
      notice:"Contact the center to confirm timings. No online appointments are offered."};
  }
  private safeDoctor=(r:DoctorRow)=>({
    doctorRef:r.doctor_ref,doctorName:r.full_name,
    qualifications:r.qualifications,specialties:r.specialties,
    experienceYears:r.experience_years,
    centerSlug:r.center_slug,centerName:r.center_name,
    address:r.address,pinCode:r.pin_code,
    fee:r.amount_minor===null?null:{
      currency:"INR",amountMinor:Number(r.amount_minor),
      kind:r.fee_kind,mode:r.consultation_mode,
      effectiveFrom:r.effective_from?.toISOString(),
      effectiveTo:r.effective_to?.toISOString()??null}
  });
}
