import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {HealthPublicDirectoryService}
 from "../../cg-14-healthcare-network/application/health-public-directory.service";
import {HealthPublicRequestThrottleService}
 from "../../cg-14-healthcare-network/application/health-public-request-throttle.service";

const SLUG=/^[a-z0-9][a-z0-9-]{2,79}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Original={revisionRef:string;rootRef:string;centerRef:string;doctorRef:string|null;
 centerSlug:string;centerName:string;candidateDoctor:string|null;
 mode:"PERCENT"|"FIXED";percentBasisPoints:number|null;
 fixedMinor:string|null;capMinor:string;validUntil:Date};
type PublicBenefit={centerSlug:string;centerName:string;doctorRef:string|null;
 doctorName:string|null;feeMinor:string|null;currency:"INR";
 mode:"PERCENT"|"FIXED";percentBasisPoints:number|null;
 fixedSupportMinor:string|null;maximumSupportMinor:string;
 validUntil:string;eligibility:"VERIFIED_PATIENT_CARE";
 patientEntitlementConfirmed:false;bookingChargeAccepted:false};
/** CG17 owns only supported currently active assistance. CG18 owns its
 * independent editorial page; CG14 owns public professional and price proof.
 * No CG15 patient identity, private center IDs, historical rule or mock badge
 * may enter this public response.
 */
@Injectable()
export class PublicHealthcareAssistanceService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly directory:HealthPublicDirectoryService,
  private readonly throttle:HealthPublicRequestThrottleService){}
 async current(request:object,filters:unknown){
  await this.throttle.hit(request,"centers");
  if(!filters||typeof filters!=="object"||Array.isArray(filters))
   throw new BadRequestException({code:"PUBLIC_ASSISTANCE_FILTER_INVALID"});
  const input=filters as Record<string,unknown>;
  if(Object.keys(input).some(key=>!["center","doctor"].includes(key)))
   throw new BadRequestException({code:"PUBLIC_ASSISTANCE_FILTER_INVALID"});
  const center=input.center===undefined?"":input.center;
  const doctor=input.doctor===undefined?"":input.doctor;
  if(typeof center!=="string"||center!==""&&!SLUG.test(center)||
    typeof doctor!=="string"||doctor!==""&&!UUID.test(doctor))
   throw new BadRequestException({code:"PUBLIC_ASSISTANCE_FILTER_INVALID"});
  const client=await this.db.connect();
  try{
   await client.query("BEGIN READ ONLY");
   await client.query("SET LOCAL statement_timeout='8s'");
   const q=await client.query<Original>(
    "SELECT rule.id AS \"revisionRef\",rule.root_realm_id AS \"rootRef\","+ 
    "rule.center_ref AS \"centerRef\","+
    "rule.doctor_ref AS \"doctorRef\",c.public_slug AS \"centerSlug\","+
    "c.display_name AS \"centerName\","+
    "COALESCE(rule.doctor_ref,$2::uuid,one_doctor.doctor_id) AS \"candidateDoctor\","+
    "rule.mode,rule.percent_basis_points AS \"percentBasisPoints\","+
    "rule.fixed_minor::text AS \"fixedMinor\","+
    "rule.cap_minor::text AS \"capMinor\",rule.valid_until AS \"validUntil\" "+
    "FROM healthcare_policy_revision rule "+
    "JOIN access_realm root ON root.id=rule.root_realm_id "+
    "AND root.realm_key='FOUNDATION_ROOT' "+
    "JOIN health_center c ON c.root_realm_id=rule.root_realm_id "+
    "AND c.id=rule.center_ref "+
    "LEFT JOIN LATERAL(SELECT assoc.doctor_id "+
    "FROM health_doctor_center assoc "+
    "WHERE assoc.root_realm_id=c.root_realm_id AND assoc.center_id=c.id "+
    "AND assoc.affiliation_state='APPROVED' AND assoc.approved_from<=now() "+
    "AND (assoc.approved_to IS NULL OR assoc.approved_to>now()) "+
    "ORDER BY assoc.doctor_id LIMIT 1) one_doctor ON rule.doctor_ref IS NULL "+
    "WHERE rule.approval_state='ACTIVE' "+
    "AND rule.service_kind='CONSULTATION' "+
    "AND rule.activated_at IS NOT NULL AND rule.activated_at<=now() "+
    "AND rule.valid_from<=now() AND rule.valid_until>now() "+
    "AND ($1::text='' OR c.public_slug=$1) "+
    "AND ($2::uuid IS NULL OR rule.doctor_ref=$2 OR rule.doctor_ref IS NULL) "+
    "ORDER BY c.display_name,rule.doctor_ref NULLS LAST,rule.id LIMIT 13",
    [center,doctor||null]);
   const result:PublicBenefit[]=[];
   for(const row of q.rows.slice(0,12)){
    if(!row.candidateDoctor)continue;
    try{
     const live=await this.directory.eligibleScheduleSource(
      client,row.candidateDoctor,row.centerSlug);
     const original=live.find(x=>x.root_ref===row.rootRef&&x.center_ref===row.centerRef&&
      x.doctor_ref===row.candidateDoctor&&x.amount_minor!==null);
     if(!original)continue;
     result.push({centerSlug:row.centerSlug,centerName:row.centerName,
      doctorRef:row.doctorRef??(doctor?row.candidateDoctor:null),
      doctorName:row.doctorRef||doctor?original.doctor_name:null,
      feeMinor:row.doctorRef||doctor?original.amount_minor:null,
      currency:"INR",mode:row.mode,percentBasisPoints:row.percentBasisPoints,
      fixedSupportMinor:row.fixedMinor,maximumSupportMinor:row.capMinor,
      validUntil:row.validUntil.toISOString(),
      eligibility:"VERIFIED_PATIENT_CARE",
      patientEntitlementConfirmed:false,bookingChargeAccepted:false});
    }catch{/* Missing/revoked CG14 professional proof = never publicize. */}
   }
   await client.query("COMMIT");
   return {state:result.length?"READY":"NO_APPROVED_CURRENT_BENEFITS",
    items:result,disclaimer:"Published policy conditions are not a patient entitlement. "+
    "Actual assistance requires current CG15 patient identity/consent, "+
    "verified consultation fee and accepted CG17 charge."};
  }catch(e){
   try{await client.query("ROLLBACK")}catch{}
   throw e;
  }finally{client.release()}
 }
}
