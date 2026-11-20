import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";

function parse(raw:Record<string,unknown>){
 const allowed=new Set(["q","category","center","page"]);
 if(Object.keys(raw).some(k=>!allowed.has(k)))
  throw new BadRequestException({code:"LAB_PUBLIC_FILTER_INVALID"});
 const str=(name:string,max:number)=>{
  const value=raw[name];
  if(value===undefined||value==="")return "";
  if(typeof value!=="string"||value.length>max||
    /[\u0000-\u001f\u007f<>]/.test(value))
   throw new BadRequestException({code:"LAB_PUBLIC_FILTER_INVALID"});
  return value.trim();
 };
 const q=str("q",80),category=str("category",24).toUpperCase(),
  center=str("center",80).toLowerCase(),page=str("page",2);
 if(category&&!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(category)||
    center&&!/^[a-z0-9][a-z0-9-]{2,79}$/.test(center)||
    page&&!/^(?:[1-9]|10)$/.test(page))
  throw new BadRequestException({code:"LAB_PUBLIC_FILTER_INVALID"});
 return {q,category,center,page:page?Number(page):0};
}
const PUBLIC_OFFERS_SQL="SELECT m.id AS \"offerRef\",m.test_or_package_kind AS kind,\n COALESCE(t.name,pkg.name) AS name,\n COALESCE(t.unique_test_code,pkg.unique_package_code) AS code,\n category.code AS \"categoryCode\",\n CASE WHEN m.test_or_package_kind='TEST' THEN category.display_name\n  ELSE 'Diagnostic packages' END AS category,\n t.sample_type AS \"sampleType\",\n CASE WHEN m.test_or_package_kind='PACKAGE' THEN pkg.description ELSE NULL END AS description,\n c.public_slug AS \"centerSlug\",c.display_name AS \"centerName\",\n p.legal_name AS \"providerName\",c.address_line AS \"centerAddress\",\n c.pin_code AS \"pinCode\",c.public_phone AS \"publicPhone\",\n price.base_price_minor::text AS \"basePriceMinor\",\n price.advertised_patient_price_minor::text AS \"patientPriceMinor\",\n price.price_currency AS currency,price.effective_from AS \"validFromUtc\",\n price.effective_to AS \"validUntilUtc\",price.version_no AS \"priceVersion\"\nFROM lab_center_test_mapping m\nJOIN lab_center_price_version price ON\n price.root_realm_id=m.root_realm_id AND price.center_test_mapping_ref=m.id\n AND price.status='APPROVED' AND price.effective_from<=now()\n AND (price.effective_to IS NULL OR price.effective_to>now())\nJOIN cg03_case pricingReview ON pricingReview.realm_id=price.root_realm_id\n AND pricingReview.case_kind='HEALTH_LAB_PRICE_REVIEW'\n AND pricingReview.cg16_price_id=price.id\n AND pricingReview.cg16_price_version=price.version_no\n AND pricingReview.status='OWNER_COMPLETED'\n AND pricingReview.proposer_id=price.proposed_by\nJOIN cg03_case_decision pricingDecision ON pricingDecision.realm_id=pricingReview.realm_id\n AND pricingDecision.case_id=pricingReview.id AND pricingDecision.action='APPROVE'\n AND pricingDecision.actor_id=price.approved_by\n AND pricingDecision.actor_id<>pricingReview.proposer_id\n AND pricingDecision.fresh_password_verified_at IS NOT NULL\n AND pricingDecision.accepted_case_revision=pricingReview.revision-1\nJOIN health_center c ON c.root_realm_id=m.root_realm_id AND c.id=m.center_ref\nJOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id\nJOIN access_realm root ON root.id=c.root_realm_id AND root.realm_key='FOUNDATION_ROOT'\nJOIN health_center_capability cap ON cap.root_realm_id=c.root_realm_id\n AND cap.center_id=c.id AND cap.capability_code='DIAGNOSTICS'\nJOIN health_center_publication pub ON pub.root_realm_id=c.root_realm_id\n AND pub.center_id=c.id AND pub.generation=c.publication_generation\nJOIN health_center_revision rev ON rev.id=pub.verified_center_revision_id\n AND rev.root_realm_id=c.root_realm_id AND rev.center_id=c.id\n AND rev.provider_id=p.id\nJOIN cg03_case cg ON cg.id=rev.approval_case_ref AND cg.realm_id=c.root_realm_id\n AND cg.case_kind='HEALTH_CENTER_VERIFICATION' AND cg.status='OWNER_COMPLETED'\n AND cg.health_center_id=c.id AND cg.health_center_revision_id=rev.id\n AND cg.health_source_digest=rev.source_digest\nJOIN cg03_case_decision decision ON decision.id=pub.original_final_decision_ref\n AND decision.realm_id=cg.realm_id AND decision.case_id=cg.id\n AND decision.action='APPROVE' AND decision.actor_id<>cg.proposer_id\n AND decision.fresh_password_verified_at IS NOT NULL\nJOIN cg19_stored_file proof ON proof.id=rev.proof_file_ref\n AND proof.realm_id=c.root_realm_id AND proof.owner_kind='CG14_DRAFT'\n AND proof.health_provider_id=p.id AND proof.health_center_id=c.id\n AND proof.scan_status='CLEAN_VERIFIED' AND proof.revoked_at IS NULL\nJOIN cg19_upload_intent intent ON intent.id=proof.upload_intent_id\n AND intent.realm_id=proof.realm_id AND intent.status='VALIDATED'\n AND intent.classification='HEALTH_CENTER_LICENSE'\nLEFT JOIN diagnostic_test t ON t.root_realm_id=m.root_realm_id AND t.id=m.test_ref\nLEFT JOIN test_category category ON category.root_realm_id=t.root_realm_id\n AND category.id=t.category_ref\nLEFT JOIN diagnostic_package pkg ON pkg.root_realm_id=m.root_realm_id\n AND pkg.id=m.package_ref\nWHERE m.publication_state='ACTIVE' AND c.status='VERIFIED'\n AND p.status='VERIFIED' AND c.access_state='ENABLED'\n AND c.publication_state='PUBLISHED' AND c.public_slug IS NOT NULL\n AND ((m.test_or_package_kind='TEST' AND m.test_ref IS NOT NULL\n   AND t.status='ACTIVE' AND category.status='ACTIVE'\n   AND t.active_from<=now() AND (t.active_to IS NULL OR t.active_to>now()))\n  OR (m.test_or_package_kind='PACKAGE' AND m.package_ref IS NOT NULL\n   AND pkg.status='ACTIVE' AND pkg.active_from<=now()\n   AND (pkg.active_to IS NULL OR pkg.active_to>now())\n   AND EXISTS (SELECT 1 FROM diagnostic_package_line line\n     WHERE line.root_realm_id=pkg.root_realm_id\n     AND line.package_ref=pkg.id AND line.package_revision=pkg.revision)\n   AND NOT EXISTS (SELECT 1 FROM diagnostic_package_line line\n     LEFT JOIN diagnostic_test component ON component.root_realm_id=line.root_realm_id\n      AND component.id=line.test_ref\n     LEFT JOIN test_category component_category ON\n      component_category.root_realm_id=component.root_realm_id\n      AND component_category.id=component.category_ref\n     WHERE line.root_realm_id=pkg.root_realm_id AND line.package_ref=pkg.id\n      AND line.package_revision=pkg.revision AND\n      (component.status IS DISTINCT FROM 'ACTIVE' OR\n       component.active_from>now() OR\n       (component.active_to IS NOT NULL AND component.active_to<=now()) OR\n       component_category.status IS DISTINCT FROM 'ACTIVE'))))\n AND ($1='' OR COALESCE(t.name,pkg.name) ILIKE $1 ESCAPE '\\' OR\n  COALESCE(t.unique_test_code,pkg.unique_package_code) ILIKE $1 ESCAPE '\\'\n  OR c.display_name ILIKE $1 ESCAPE '\\')\n AND ($2='' OR (m.test_or_package_kind='TEST' AND category.code=$2))\n AND ($3='' OR c.public_slug=$3)\nORDER BY COALESCE(t.name,pkg.name),c.display_name,c.id,m.id\nLIMIT 51 OFFSET $4";
type OfferRow={
 offerRef:string;kind:"TEST"|"PACKAGE";name:string;code:string;
 category:string;categoryCode:string|null;sampleType:string|null;description:string|null;
 centerSlug:string;centerName:string;providerName:string;
 centerAddress:string;pinCode:string;publicPhone:string|null;
 basePriceMinor:string;patientPriceMinor:string;currency:string;
 validFromUtc:string;validUntilUtc:string|null;priceVersion:number;
};
/** Anonymous safe read projection: never include patient/order/specimen,
 * report, technician, bank, payment, Lab ERP, CG17 or private CG19 fields. */
@Injectable()
export class DiagnosticsPublicCatalogService{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 async facets(){
  // Reuse the exact same published CG14 / CG03 / CG19 / CG16 joins as
  // anonymous offers. Unpublished or expired tariffs never yield a category.
  const start=PUBLIC_OFFERS_SQL.indexOf("FROM lab_center_test_mapping");
  const end=PUBLIC_OFFERS_SQL.lastIndexOf("ORDER BY");
  if(start<0||end<=start)throw Error("Public lab source query unavailable");
  const predicates=PUBLIC_OFFERS_SQL.slice(start,end);
  const result=await this.db.query<{code:string;name:string}>(
   "SELECT DISTINCT category.code,category.display_name AS name "+
    predicates+
    " AND m.test_or_package_kind='TEST' AND category.code IS NOT NULL "+
    "ORDER BY category.display_name,category.code LIMIT 100",
   ["","",""]);
  return {categories:result.rows};
 }
 async offers(raw:Record<string,unknown>){
  const f=parse(raw);
  const term=f.q?"%"+f.q.replace(/[\\%_]/g,"\\$&")+"%":"";
  const result=await this.db.query<OfferRow>(PUBLIC_OFFERS_SQL,
   [term,f.category,f.center,f.page*50]);
  const more=result.rows.length>50;
  return {state:"READY" as const,items:result.rows.slice(0,50),
   next:more&&f.page<10?String(f.page+1):null,
   notice:"These are partner commercial laboratory prices, not Foundation assistance or a confirmed payment. Confirm services directly with the center."};
 }
}
