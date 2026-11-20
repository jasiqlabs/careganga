import {ForbiddenException,Injectable,NotFoundException,ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";

/** Only CG15 can assert appointment identity, patient consent, center,
 * authentic reservation and accepted original consultation fee snapshot.
 * CG17 consumes this typed read-only contract; it must not copy masters.
 */
export type Cg15ChargeSource=Readonly<{
 sourceRef:string;sourceVersion:number;patientRef:string;doctorRef:string;
 centerRef:string;associationRef:string;createdBy:string;
 bookedAt:Date;bookingState:string;collectionState:string;
 feeMinor:string;feeVersion:number;feeRef:string;currency:"INR";
 consentRevision:number;bookingDisplayId:string;holdRef:string
}>;
export type Cg15HoldQuoteSource=Readonly<{
 holdRef:string;centerRef:string;doctorRef:string;patientRef:string;
 feeMinor:string;feeVersion:number;feeRef:string;
 expiresAt:Date;currency:"INR"
}>;
const eligible=["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION","COMPLETED","NO_SHOW"];
@Injectable()
export class ConsultationChargeSourceFacade{
 constructor(private readonly scope:HealthCenterSupportScopeFacade){}
 private async patient(c:PoolClient,a:VerifiedFoundationActor,
  patientRef:string,center:string,staff:boolean){
  if(staff){
   await this.scope.assertCurrent(c,a,center,"health.patients.intake");
  }else{
   const owned=await c.query(
    "SELECT p.id FROM cg15_patient_account_link l "+
    "JOIN cg15_patient p ON p.root_realm_id=l.root_realm_id AND p.id=l.patient_id "+
    "JOIN account owner ON owner.id=l.account_id AND owner.realm_id=l.root_realm_id "+
    "WHERE l.root_realm_id=$1 AND l.account_id=$2 AND l.patient_id=$3 "+
    "AND l.revoked_at IS NULL AND owner.status='ACTIVE' FOR SHARE OF p,l,owner",
    [a.realmId,a.accountId,patientRef]);
   if(!owned.rowCount)throw new NotFoundException({code:"CONSULTATION_SOURCE_UNAVAILABLE"});
  }
  const proof=await c.query<{status:string;identity_verified:boolean;
   consent_granted:boolean|null;revision_no:number|null}>(
   "SELECT p.profile_status AS status,"+
   "EXISTS(SELECT 1 FROM cg15_patient_identity_event e "+
   "WHERE e.root_realm_id=p.root_realm_id AND e.patient_id=p.id) "+
   "AS identity_verified,"+
   "(SELECT v.granted FROM cg15_patient_consent v "+
   "WHERE v.root_realm_id=p.root_realm_id AND v.patient_id=p.id "+
   "AND v.purpose='PATIENT_CARE' ORDER BY v.revision_no DESC LIMIT 1) "+
   "AS consent_granted,"+
   "(SELECT v.revision_no FROM cg15_patient_consent v "+
   "WHERE v.root_realm_id=p.root_realm_id AND v.patient_id=p.id "+
   "AND v.purpose='PATIENT_CARE' ORDER BY v.revision_no DESC LIMIT 1) "+
   "AS revision_no "+
   "FROM cg15_patient p WHERE p.root_realm_id=$1 AND p.id=$2 FOR SHARE OF p",
   [a.realmId,patientRef]);
  const x=proof.rows[0];
  if(!x||x.status!=="VERIFIED"||!x.identity_verified||
     !x.consent_granted||!Number.isSafeInteger(x.revision_no))
   throw new ForbiddenException({code:"CONSULTATION_PATIENT_NOT_READY"});
  return x.revision_no!;
 }
 private async fee(c:PoolClient,a:VerifiedFoundationActor,
  association:string,minor:string,version:number,at:Date){
  const verified=await c.query<{id:string;amount_minor:string;version:number}>(
   "SELECT id,amount_minor::text,version FROM health_center_fee "+
   "WHERE root_realm_id=$1 AND doctor_center_id=$2 "+
   "AND fee_kind='CONSULTATION' AND consultation_mode='IN_PERSON' "+
   "AND status='APPROVED' AND version=$3 "+
   "AND amount_minor=$4::bigint AND effective_from<=$5 "+
   "ORDER BY effective_from DESC,id DESC LIMIT 1 FOR SHARE",
   [a.realmId,association,version,minor,at]);
  if(!verified.rows[0])
   throw new ConflictException({code:"CONSULTATION_ORIGINAL_FEE_UNAVAILABLE"});
  return verified.rows[0].id;
 }
 async hold(c:PoolClient,a:VerifiedFoundationActor,ref:string,center?:string):
  Promise<Cg15HoldQuoteSource>{
  const q=await c.query<{id:string;patient_id:string;doctor_id:string;
   center_id:string;association_id:string;fee_minor:string;
   fee_version:number;expires_at:Date;status:string;created_by_account:string;
   created_at:Date}>(
   "SELECT id,patient_id,doctor_id,center_id,association_id,"+
   "fee_minor::text,fee_version,expires_at,status,created_by_account,created_at "+
   "FROM cg15_consultation_hold WHERE root_realm_id=$1 AND id=$2",
   [a.realmId,ref]);
  const x=q.rows[0];
  if(!x||center&&x.center_id!==center)
   throw new NotFoundException({code:"CONSULTATION_SOURCE_UNAVAILABLE"});
  await this.patient(c,a,x.patient_id,x.center_id,!!center);
  if(x.created_by_account!==a.accountId)
   throw new ForbiddenException({code:"CONSULTATION_NOT_YOUR_RESERVATION"});
  if(x.status!=="HELD"||x.expires_at<=new Date())
   throw new ConflictException({code:"CONSULTATION_HOLD_EXPIRED"});
  const feeRef=await this.fee(c,a,x.association_id,x.fee_minor,x.fee_version,x.created_at);
  return {holdRef:x.id,centerRef:x.center_id,doctorRef:x.doctor_id,
   patientRef:x.patient_id,feeMinor:x.fee_minor,feeVersion:x.fee_version,
   feeRef,expiresAt:x.expires_at,currency:"INR"};
 }
 async booking(c:PoolClient,a:VerifiedFoundationActor,ref:string,
  center?:string):Promise<Cg15ChargeSource>{
  const q=await c.query<{id:string;patient_id:string;doctor_id:string;
   center_id:string;association_id:string;fee_minor:string;fee_version:number;
   booking_state:string;collection_state:string;currency:string;
   booking_display_id:string;created_at:Date;revision:number;
   created_by_account:string;hold_id:string}>(
   "SELECT id,patient_id,doctor_id,center_id,association_id,"+
   "fee_minor::text,fee_version,booking_state,collection_state,currency,"+
   "booking_display_id,created_at,revision,created_by_account,hold_id "+
   "FROM cg15_consultation_appointment "+
   "WHERE root_realm_id=$1 AND id=$2",
   [a.realmId,ref]);
  const x=q.rows[0];
  if(!x||center&&x.center_id!==center)
   throw new NotFoundException({code:"CONSULTATION_SOURCE_UNAVAILABLE"});
  const consentRevision=await this.patient(c,a,x.patient_id,x.center_id,!!center);
  if(x.currency!=="INR"||x.collection_state==="NOT_COLLECTIBLE"||
     !eligible.includes(x.booking_state)||x.booking_state==="CANCELLED")
   throw new ConflictException({code:"CONSULTATION_NOT_COLLECTIBLE"});
  if(!x.created_at||x.fee_version<1)
   throw new ConflictException({code:"CONSULTATION_ORIGINAL_FEE_UNAVAILABLE"});
  const proof=await c.query(
   "SELECT 1 FROM cg15_consultation_private_intent "+
   "WHERE root_realm_id=$1 AND appointment_id=$2 "+
   "AND patient_id=$3 AND purpose='PATIENT_CARE' "+
   "AND consent_revision<=$4",
   [a.realmId,x.id,x.patient_id,consentRevision]);
  if(!proof.rowCount)
   throw new ConflictException({code:"CONSULTATION_ORIGINAL_CARE_UNAVAILABLE"});
  const feeRef=await this.fee(c,a,x.association_id,x.fee_minor,x.fee_version,x.created_at);
  return {sourceRef:x.id,sourceVersion:x.revision,patientRef:x.patient_id,
   doctorRef:x.doctor_id,centerRef:x.center_id,associationRef:x.association_id,
   createdBy:x.created_by_account,bookedAt:x.created_at,
   bookingState:x.booking_state,collectionState:x.collection_state,
   feeMinor:x.fee_minor,feeVersion:x.fee_version,feeRef,
   currency:"INR",consentRevision,bookingDisplayId:x.booking_display_id,
   holdRef:x.hold_id};
 }
}
