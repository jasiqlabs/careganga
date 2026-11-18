import {Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
@Injectable()
export class HealthPublicCenterService{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 /** Anonymous reads are intentionally restricted to one current Foundation
  * root and original CG-03 final decision, CG-19 proof, active provider/center.
  * No finance data, license images, staff, booking, doctor or ERP assumptions.
  */
 async center(publicSlug:string){
  const slug=publicSlug.trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug))
   throw new NotFoundException("Verified center unavailable");
  // Build the public projection within a short center-row read lock.
  // Suspension and publication mutations also acquire this center lock.
  const tx=await this.db.connect();
  let active=false;
  try{
  await tx.query("BEGIN");active=true;
  const result=await tx.query<{id:string;root_realm_id:string;display_name:string;
   center_type:string;address_line:string;pin_code:string;
   public_phone:string|null;time_zone:string;latitude:string|null;
   longitude:string|null;provider_name:string;publication_generation:number}>(
    "SELECT c.id,c.root_realm_id,c.display_name,c.center_type,c.address_line,"+
    "c.pin_code,c.public_phone,c.time_zone,c.latitude,c.longitude,"+
    "p.legal_name AS provider_name,c.publication_generation "+
    "FROM health_center c "+
    "JOIN health_provider p ON p.id=c.provider_id AND p.root_realm_id=c.root_realm_id "+
    "JOIN access_realm root ON root.id=c.root_realm_id "+
    "AND root.realm_key='FOUNDATION_ROOT' "+
    "JOIN health_center_publication pub ON pub.root_realm_id=c.root_realm_id "+
    "AND pub.center_id=c.id AND pub.generation=c.publication_generation "+
    "JOIN health_center_revision rev ON rev.id=pub.verified_center_revision_id "+
    "AND rev.root_realm_id=c.root_realm_id AND rev.provider_id=p.id "+
    "AND rev.center_id=c.id "+
    "JOIN cg03_case cg ON cg.id=rev.approval_case_ref "+
    "AND cg.realm_id=c.root_realm_id AND cg.case_kind='HEALTH_CENTER_VERIFICATION' "+
    "AND cg.health_center_id=c.id AND cg.health_center_revision_id=rev.id "+
    "AND cg.health_source_digest=rev.source_digest "+
    "JOIN cg03_case_decision d ON d.id=pub.original_final_decision_ref "+
    "AND d.case_id=cg.id AND d.realm_id=cg.realm_id "+
    "AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL "+
    "AND d.actor_id<>cg.proposer_id "+
    "JOIN cg19_stored_file proof ON proof.id=rev.proof_file_ref "+
    "AND proof.realm_id=c.root_realm_id "+
    "AND proof.owner_kind='CG14_DRAFT' AND proof.health_center_id=c.id "+
    "AND proof.health_provider_id=p.id AND proof.revoked_at IS NULL "+
    "AND proof.scan_status='CLEAN_VERIFIED' "+
    "JOIN cg19_upload_intent intent ON intent.id=proof.upload_intent_id "+
    "AND intent.realm_id=proof.realm_id "+
    "WHERE c.public_slug=$1 AND c.publication_state='PUBLISHED' "+
    "AND c.status='VERIFIED' AND p.status='VERIFIED' "+
    "AND c.access_state='ENABLED' AND cg.status='OWNER_COMPLETED' "+
    "AND intent.status='VALIDATED' AND intent.classification='HEALTH_CENTER_LICENSE' "+
    "LIMIT 1 FOR SHARE OF c",[slug]);
  const c=result.rows[0];
  if(!c)throw new NotFoundException("Verified center unavailable");
  const [hours,services]=await Promise.all([
    tx.query<{weekday:number;open_local:string;close_local:string;service_type:string}>(
      "SELECT weekday,open_local::text,close_local::text,service_type "+
      "FROM health_center_hours WHERE root_realm_id=$1 AND center_id=$2 "+
      "ORDER BY weekday,open_local LIMIT 42",[c.root_realm_id,c.id]),
    tx.query<{capability_code:string}>(
      "SELECT capability_code FROM health_center_capability "+
      "WHERE root_realm_id=$1 AND center_id=$2 ORDER BY capability_code LIMIT 6",
      [c.root_realm_id,c.id])
  ]);
  // Revalidate the public generation after loading dependent rows so a
  // concurrent withdrawal does not return a stale approved projection.
  const fresh=await tx.query(
    "SELECT 1 FROM health_center c "+
    "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
    "JOIN health_center_publication pub ON pub.root_realm_id=c.root_realm_id "+
    "AND pub.center_id=c.id AND pub.generation=c.publication_generation "+
    "JOIN health_center_revision rev ON rev.id=pub.verified_center_revision_id "+
    "AND rev.root_realm_id=c.root_realm_id AND rev.center_id=c.id "+
    "JOIN cg19_stored_file file ON file.id=rev.proof_file_ref "+
    "AND file.realm_id=c.root_realm_id AND file.revoked_at IS NULL "+
    "AND file.scan_status='CLEAN_VERIFIED' "+
    "JOIN cg19_upload_intent intent ON intent.id=file.upload_intent_id "+
    "AND intent.realm_id=file.realm_id AND intent.status='VALIDATED' "+
    "WHERE c.root_realm_id=$1 AND c.id=$2 AND c.publication_generation=$3 "+
    "AND c.status='VERIFIED' AND p.status='VERIFIED' "+
    "AND c.access_state='ENABLED' AND c.publication_state='PUBLISHED'",
    [c.root_realm_id,c.id,c.publication_generation]);
  if(!fresh.rowCount)throw new NotFoundException("Verified center unavailable");
  await tx.query("COMMIT");active=false;
  return {centerName:c.display_name,providerName:c.provider_name,type:c.center_type,
    address:c.address_line,pinCode:c.pin_code,publicPhone:c.public_phone,
    timeZone:c.time_zone,latitude:c.latitude===null?null:Number(c.latitude),
    longitude:c.longitude===null?null:Number(c.longitude),
    hours:hours.rows.map(h=>({weekday:h.weekday,opens:h.open_local.slice(0,5),
      closes:h.close_local.slice(0,5),service:h.service_type})),
    declaredServices:services.rows.map(x=>x.capability_code),
    notice:"Verified center information. Booking and online payment are not available here."};
  }catch(error){
    if(active)try{await tx.query("ROLLBACK");}catch{}
    throw error;
  }finally{tx.release();}
 }
}
