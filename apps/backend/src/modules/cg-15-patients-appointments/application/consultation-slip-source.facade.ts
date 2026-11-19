import {Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type OriginalConsultationSlip={
 rootRef:string;bookingRef:string;bookingId:string;sourceVersion:number;
 sourceDigest:string;patientName:string;doctorName:string;centerName:string;
 centerAddress:string;startAt:string;endAt:string;timeZone:string;
 consultationFeeMinor:string;bookingStatus:string;collectionStatus:"DUE_AT_CENTER";
};
type SourceRow={root_realm_id:string;id:string;booking_display_id:string;
 revision:number;terms_revision:number;patient_display_name:string;doctor_name:string;
 center_name:string;center_address:string;start_at:Date;end_at:Date;
 time_zone:string;fee_minor:string;booking_state:string;collection_state:"DUE_AT_CENTER"};
@Injectable()
export class ConsultationSlipSourceFacade{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly ownCenter:HealthCenterSupportScopeFacade){}
 async actorForSlip(bearer:string){
  return this.sessions.verifySession(bearer);
 }
 /** Genuine self-linked patient-only original. Never trust a display ID as auth.
  * Rendering and downloading pass this check every time, not just at issue.
  */
 async original(bearer:string,id:string):Promise<OriginalConsultationSlip>{
  const actor=await this.sessions.verifySession(bearer);
  if(!UUID.test(id))throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
  const rows=await this.db.query<SourceRow>(
   "SELECT a.root_realm_id,a.id,a.booking_display_id,a.revision,a.terms_revision,"+
   "a.patient_display_name,a.doctor_name,a.center_name,a.center_address,"+
   "a.start_at,a.end_at,a.time_zone,a.fee_minor::text,a.booking_state,a.collection_state "+
   "FROM cg15_consultation_appointment a "+
   "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id AND p.id=a.patient_id "+
   "JOIN cg15_patient_account_link l ON l.root_realm_id=a.root_realm_id "+
   "AND l.patient_id=a.patient_id AND l.revoked_at IS NULL "+
   "JOIN account user_account ON user_account.realm_id=l.root_realm_id "+
   "AND user_account.id=l.account_id AND user_account.status='ACTIVE' "+
   "JOIN access_realm root ON root.id=a.root_realm_id AND root.realm_key='FOUNDATION_ROOT' "+
   "WHERE a.root_realm_id=$1 AND a.id=$2 AND l.account_id=$3 "+
   "AND a.payment_mode='PAY_AT_CENTER' AND a.collection_state='DUE_AT_CENTER'",
   [actor.realmId,id,actor.accountId]);
  const row=rows.rows[0];
  if(!row)throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
  return this.format(row);
 }
 private format(row:SourceRow):OriginalConsultationSlip{
 const value={rootRef:row.root_realm_id,bookingRef:row.id,
   bookingId:row.booking_display_id,sourceVersion:row.terms_revision,
   patientName:row.patient_display_name,
   doctorName:row.doctor_name,centerName:row.center_name,
   centerAddress:row.center_address,startAt:row.start_at.toISOString(),
   endAt:row.end_at.toISOString(),timeZone:row.time_zone,
   consultationFeeMinor:row.fee_minor,bookingStatus:row.booking_state,
   collectionStatus:row.collection_state};
  // Operational check-in updates appointment.revision/bookingStatus, but NOT
  // the accepted terms source digest. Cancel/reschedule increment terms revision.
  const {bookingStatus:_status,...originalTerms}=value;
  const sourceDigest=createHash("sha256").update(JSON.stringify(originalTerms)).digest("hex");
  return {...value,sourceDigest};
 }
 /** A center cannot read a private patient slip by Booking ID alone.
  * Only a currently permissioned, enabled, own-center staff member and a
  * consented real appointment may see the one-page consultation record.
  */
 async originalForCenter(bearer:string,id:string):Promise<OriginalConsultationSlip>{
  const actor=await this.sessions.verifySession(bearer);
  if(!UUID.test(id))throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   const selected=await tx.query<{center_id:string}>(
    "SELECT center_id FROM cg15_consultation_appointment "+
    "WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,id]);
   if(!selected.rows[0])
    throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   await this.ownCenter.assertCurrent(
    tx,actor,selected.rows[0].center_id,"health.visits.manage");
   const data=await tx.query<SourceRow>(
    "SELECT a.root_realm_id,a.id,a.booking_display_id,a.revision,a.terms_revision,"+
    "a.patient_display_name,a.doctor_name,a.center_name,a.center_address,"+
    "a.start_at,a.end_at,a.time_zone,a.fee_minor::text,a.booking_state,a.collection_state "+
    "FROM cg15_consultation_appointment a "+
    "JOIN cg15_patient p ON p.root_realm_id=a.root_realm_id AND p.id=a.patient_id "+
    "JOIN cg15_patient_account_link l ON l.root_realm_id=p.root_realm_id "+
    "AND l.patient_id=p.id AND l.revoked_at IS NULL "+
    "JOIN account acct ON acct.id=l.account_id AND acct.realm_id=l.root_realm_id "+
    "WHERE a.root_realm_id=$1 AND a.id=$2 AND a.center_id=$3 "+
    "AND acct.status='ACTIVE' AND p.profile_status='VERIFIED' "+
    "AND EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
    "WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) "+
    "AND (SELECT consent.granted FROM cg15_patient_consent consent "+
    "WHERE consent.root_realm_id=p.root_realm_id AND consent.patient_id=p.id "+
    "AND consent.purpose='PATIENT_CARE' ORDER BY consent.revision_no DESC LIMIT 1)=true "+
    "AND a.payment_mode='PAY_AT_CENTER' AND a.collection_state='DUE_AT_CENTER'",
    [actor.realmId,id,selected.rows[0].center_id]);
   if(!data.rows[0])
    throw new NotFoundException({code:"CG15_BOOKING_NOT_FOUND"});
   await tx.query("COMMIT");open=false;
   return this.format(data.rows[0]);
  }catch(e){if(open)await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 /** Public verifier can only know current validity. It never returns a
  * booking, patient, doctor, center, time, fee or protected document link.
  */
 async activeForToken(rootRef:string,bookingRef:string,version:number){
  const rows=await this.db.query<{status:string;end_at:Date;revision:number}>(
   "SELECT booking_state AS status,end_at,terms_revision AS revision "+
   "FROM cg15_consultation_appointment WHERE root_realm_id=$1 AND id=$2",
   [rootRef,bookingRef]);
  const row=rows.rows[0];
  return !!row&&row.revision===version&&
   ["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION"].includes(row.status)&&
   row.end_at.getTime()>Date.now()-24*3600000;
 }
}
