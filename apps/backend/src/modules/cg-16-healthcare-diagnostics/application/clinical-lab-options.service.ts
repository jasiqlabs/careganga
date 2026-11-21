import {ForbiddenException,Inject,Injectable,ServiceUnavailableException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ClinicalLabAdmissionService} from "./clinical-lab-admission.service";

/** Live, permission-filtered H10 selectors. Never accept typed patient UUIDs
 * as proof, expose arbitrary CG15 directory or use public list as ERP access. */
@Injectable()
export class ClinicalLabOptionsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly admission:ClinicalLabAdmissionService){}
 private async tx<T>(job:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let started=false;
  try{
   await c.query("BEGIN");started=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   const result=await job(c);
   await c.query("COMMIT");started=false;return result;
  }catch(e){if(started)try{await c.query("ROLLBACK");}catch{};throw e;}
  finally{c.release();}
 }
 async centers(token:string){
  if(process.env.CAREGANGA_ERP_LAB_ENABLED!=="true"||
    process.env.CAREGANGA_LAB_CLINICAL_READINESS!=="APPROVED")
   throw new ServiceUnavailableException({code:"LAB_CLINICAL_OPERATIONS_DISABLED"});
  let action:"lab.orders.create"|"lab.orders.view"="lab.orders.view";
  let actor;
  try{actor=await this.sessions.requireAction(token,action);}
  catch(e){
   if(!(e instanceof ForbiddenException))throw e;
   action="lab.orders.create";actor=await this.sessions.requireAction(token,action);
  }
  return this.tx(async c=>{
   const rows=await c.query<{centerRef:string;name:string}>(
    "SELECT f.center_id AS \"centerRef\",hc.display_name AS name "+
    "FROM health_center_account_affiliation f JOIN health_center hc "+
    "ON hc.root_realm_id=f.root_realm_id AND hc.id=f.center_id "+
    "JOIN account a ON a.realm_id=f.root_realm_id AND a.id=f.account_ref "+
    "WHERE f.root_realm_id=$1 AND f.account_ref=$2 "+
    "AND f.status='ACTIVE' AND a.status='ACTIVE' "+
    "ORDER BY hc.display_name,hc.id LIMIT 30",
    [actor.realmId,actor.accountId]);
   const allowed:{centerRef:string;name:string}[]=[];
   for(const item of rows.rows){
    try{
     await this.admission.requireCurrent(c,token,item.centerRef,action);
     allowed.push(item);
    }catch(e){
     // Denied assigned center is deliberately hidden, not shown as eligible.
     if(e&&typeof e==="object"&&"status" in e&&
       (e.status===403||e.status===404))continue;
     throw e;
    }
   }
   return {centers:allowed};
  });
 }
 async patients(token:string,centerRef:string){
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,centerRef,"lab.orders.create");
   const r=await c.query<{
    patientRef:string;virtualPatientId:string;name:string;
    careSourceKind:string;careSourceRef:string
   }>(
    "SELECT source.patient_ref AS \"patientRef\","+
    "p.virtual_display_id AS \"virtualPatientId\","+
    "p.first_name||' '||p.last_name AS name,"+
    "source.kind AS \"careSourceKind\",source.source_ref AS \"careSourceRef\" "+
    "FROM (SELECT i.patient_id AS patient_ref,i.id AS source_ref,"+
    "'CENTER_INTAKE'::text AS kind,i.created_at "+
    "FROM cg15_patient_center_intake i WHERE i.root_realm_id=$1 "+
    "AND i.center_id=$2 AND i.patient_id IS NOT NULL "+
    "AND i.assisted_consent_attested=true UNION ALL "+
    "SELECT a.patient_id,a.id,'CONSULTATION'::text AS kind,a.created_at "+
    "FROM cg15_consultation_appointment a WHERE a.root_realm_id=$1 "+
    "AND a.center_id=$2 AND a.booking_state IN("+
    "'ARRIVED','WAITING','IN_CONSULTATION','COMPLETED')) source "+
    "JOIN cg15_patient p ON p.root_realm_id=$1 "+
    "AND p.id=source.patient_ref AND p.profile_status='VERIFIED' "+
    "WHERE EXISTS(SELECT 1 FROM cg15_patient_identity_event proof "+
    "WHERE proof.root_realm_id=p.root_realm_id AND proof.patient_id=p.id) "+
    "AND EXISTS(SELECT 1 FROM cg15_patient_consent consent "+
    "WHERE consent.root_realm_id=p.root_realm_id AND consent.patient_id=p.id "+
    "AND consent.purpose='PATIENT_CARE' AND consent.granted=true "+
    "AND consent.revision_no=(SELECT MAX(latest.revision_no) "+
    "FROM cg15_patient_consent latest WHERE latest.root_realm_id=p.root_realm_id "+
    "AND latest.patient_id=p.id AND latest.purpose='PATIENT_CARE')) "+
    "ORDER BY name,source.created_at DESC LIMIT 60",
    [actor.realmId,centerRef]);
   return {patients:r.rows};
  });
 }
 async catalog(token:string,centerRef:string){
  return this.tx(async c=>{
   const actor=await this.admission.requireCurrent(c,token,centerRef,"lab.orders.create");
   const r=await c.query<{
    mappingRef:string;name:string;code:string;kind:"TEST"|"PACKAGE";
    currentPatientPriceMinor:string;currency:string
   }>(
    "SELECT m.id AS \"mappingRef\",m.test_or_package_kind AS kind,"+
    "COALESCE(t.name,p.name) AS name,"+
    "COALESCE(t.unique_test_code,p.unique_package_code) AS code,"+
    "price.advertised_patient_price_minor::text AS \"currentPatientPriceMinor\","+
    "price.price_currency AS currency "+
    "FROM lab_center_test_mapping m "+
    "JOIN lab_center_price_version price ON price.root_realm_id=m.root_realm_id "+
    "AND price.center_test_mapping_ref=m.id AND price.status='APPROVED' "+
    "AND price.effective_from<=now() "+
    "AND (price.effective_to IS NULL OR price.effective_to>now()) "+
    "JOIN cg03_case review ON review.realm_id=price.root_realm_id "+
    "AND review.case_kind='HEALTH_LAB_PRICE_REVIEW' "+
    "AND review.cg16_price_id=price.id AND review.status='OWNER_COMPLETED' "+
    "AND review.proposer_id=price.proposed_by "+
    "AND review.cg16_price_version=price.version_no "+
    "JOIN cg03_case_decision decision ON decision.realm_id=review.realm_id "+
    "AND decision.case_id=review.id AND decision.action='APPROVE' "+
    "AND decision.actor_id=price.approved_by "+
    "AND decision.actor_id<>review.proposer_id "+
    "AND decision.accepted_case_revision=review.revision-1 "+
    "AND decision.fresh_password_verified_at IS NOT NULL "+
    "LEFT JOIN diagnostic_test t ON t.root_realm_id=m.root_realm_id "+
    "AND t.id=m.test_ref "+
    "LEFT JOIN test_category cat ON cat.root_realm_id=t.root_realm_id "+
    "AND cat.id=t.category_ref "+
    "LEFT JOIN diagnostic_package p ON p.root_realm_id=m.root_realm_id "+
    "AND p.id=m.package_ref "+
    "WHERE m.root_realm_id=$1 AND m.center_ref=$2 "+
    "AND m.publication_state='ACTIVE' "+
    "AND ((m.test_or_package_kind='TEST' AND t.status='ACTIVE' "+
    "AND cat.status='ACTIVE' AND t.active_from<=now() "+
    "AND (t.active_to IS NULL OR t.active_to>now())) OR "+
    "(m.test_or_package_kind='PACKAGE' AND p.status='ACTIVE' "+
    "AND p.active_from<=now() AND (p.active_to IS NULL OR p.active_to>now()) "+
    "AND EXISTS(SELECT 1 FROM diagnostic_package_line l "+
    "WHERE l.root_realm_id=p.root_realm_id AND l.package_ref=p.id "+
    "AND l.package_revision=p.revision) "+
    "AND NOT EXISTS(SELECT 1 FROM diagnostic_package_line l "+
    "LEFT JOIN diagnostic_test member ON member.root_realm_id=l.root_realm_id "+
    "AND member.id=l.test_ref LEFT JOIN test_category memberCat "+
    "ON memberCat.root_realm_id=member.root_realm_id "+
    "AND memberCat.id=member.category_ref "+
    "WHERE l.root_realm_id=p.root_realm_id AND l.package_ref=p.id "+
    "AND l.package_revision=p.revision AND "+
    "(member.status IS DISTINCT FROM 'ACTIVE' OR member.active_from>now() "+
    "OR (member.active_to IS NOT NULL AND member.active_to<=now()) "+
    "OR memberCat.status IS DISTINCT FROM 'ACTIVE')))) "+
    "ORDER BY name,m.id LIMIT 100",
    [actor.realmId,centerRef]);
   return {items:r.rows};
  });
 }
}
