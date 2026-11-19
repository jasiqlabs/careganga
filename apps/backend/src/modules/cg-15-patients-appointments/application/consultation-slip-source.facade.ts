import {Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
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
  private readonly sessions:SessionService){}
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
