import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type CsrEditorialSelection=Readonly<{sourceRef:string;rightsVersion:number}>;
export type CsrEditorialCard=Readonly<{sourceRef:string;rightsVersion:number;name:string;summary:string}>;
/** Reusable public-safe source fields only. No CSR private source, contact,
 * amount, bank record, document bytes, or unverified CG03 relationship.
 *
 * CG18 is still the independent editorial publication owner: this adapter
 * never serves an anonymous HTTP endpoint by itself.
 */
const eligibleSql=
 'SELECT p.id AS "sourceRef",r.version AS "rightsVersion",'+
 'p.legal_name AS name,r.public_summary AS summary FROM csr_partner p '+
 'JOIN csr_partner_public_release r ON r.root_realm_id=p.root_realm_id '+
 'AND r.partner_id=p.id AND r.state=\'AUTHORIZED\' '+
 'WHERE p.root_realm_id=$1 AND p.status=\'APPROVED\' '+
 'AND (p.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch current_branch '+
 'WHERE current_branch.id=p.branch_ref AND current_branch.root_realm_id=p.root_realm_id '+
 'AND current_branch.status=\'ACTIVE\')) '+
 'AND EXISTS(SELECT 1 FROM csr_partner_review_snapshot s '+
 'JOIN cg03_case c ON c.realm_id=s.root_realm_id AND c.csr_review_ref=s.id '+
 'AND c.csr_partner_id=s.partner_id AND c.csr_source_version=s.source_version '+
 'AND c.csr_source_digest=s.source_digest AND c.case_kind=\'CSR_PARTNER_REVIEW\' '+
 'AND c.status=\'OWNER_COMPLETED\' '+
 'JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id '+
 'AND d.action=\'APPROVE\' AND d.fresh_password_verified_at IS NOT NULL '+
 'JOIN cg19_stored_file f ON f.id=s.evidence_file_id '+
 'AND f.realm_id=s.root_realm_id AND f.csr_partner_id=s.partner_id '+
 'AND f.owner_kind=\'CG08_CSR_AGREEMENT\' AND f.scan_status=\'CLEAN_VERIFIED\' '+
 'AND f.revoked_at IS NULL '+
 'JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id '+
 'AND i.csr_partner_id=f.csr_partner_id AND i.owner_kind=\'CG08_CSR_AGREEMENT\' '+
 'AND i.status=\'VALIDATED\' '+
 'WHERE s.root_realm_id=p.root_realm_id AND s.partner_id=p.id '+
 'AND s.evidence_file_id=r.evidence_file_id)';
@Injectable()
export class CsrPartnerPublicSource{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade){}
 /** Exact current CG02 branch/manager scope for the Foundation CMS selector. */
 async editorialOptions(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"cms.content.manage");
  await this.sessions.requireAction(bearer,"csr.partners.view");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
   await this.identity.assertCurrent(tx,actor,"cms.content.manage");
   await this.identity.assertCurrent(tx,actor,"csr.partners.view");
   const scope=await this.branches.projectBranchScope(tx,actor);
   const result=await tx.query<CsrEditorialCard>(eligibleSql+
    " AND ($2::boolean OR p.branch_ref=ANY($3::uuid[])) "+
    "ORDER BY p.legal_name,p.id LIMIT 51",
    [actor.realmId,scope.all,scope.branches.map(v=>v.value)]);
   if(result.rows.length>50)throw new BadRequestException(
    "Narrow the approved partner catalogue before publishing.");
   await tx.query("COMMIT");
   return {partners:result.rows};
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 /** Original source-backed, exact-rights-version projection. A withdrawn
  * partner is omitted immediately; new consent cannot reuse old CG18 approval.
  */
 async currentCards(db:Pool|PoolClient,root:string,selections:readonly CsrEditorialSelection[]){
  if(selections.length>12||selections.some(v=>!v||typeof v.sourceRef!=="string"||
     !UUID.test(v.sourceRef)||!Number.isSafeInteger(v.rightsVersion)||v.rightsVersion<1)||
     new Set(selections.map(x=>x.sourceRef)).size!==selections.length)
   throw new BadRequestException("Invalid original partner editorial selection.");
  if(selections.length===0)return [] as CsrEditorialCard[];
  const found=await db.query<CsrEditorialCard>(eligibleSql+
   " AND p.id=ANY($2::uuid[]) ORDER BY p.legal_name,p.id LIMIT 13",
   [root,selections.map(x=>x.sourceRef)]);
  const byRef=new Map(found.rows.map(x=>[x.sourceRef,x]));
  return selections.flatMap(selection=>{
   const x=byRef.get(selection.sourceRef);
   return x&&x.rightsVersion===selection.rightsVersion?[x]:[];
  });
 }
}
