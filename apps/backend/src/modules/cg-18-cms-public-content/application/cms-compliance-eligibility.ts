import type {Pool,PoolClient} from "pg";
/** A verified statutory claim must expire even when an otherwise approved
 * editorial publication remains effective. No separate certificate master.
 * This is checked for publisher, scheduled activation and every public read.
 */
export async function complianceEligible(
 db:Pick<Pool|PoolClient,"query">,root:string,revision:string
):Promise<boolean>{
 const found=await db.query<{structured_fields:Record<string,unknown>}>(
  "SELECT structured_fields FROM cms_section_revision "+
  "WHERE foundation_root_id=$1 AND page_revision_id=$2 "+
  "AND section_kind='COMPLIANCE_FACTS' LIMIT 1",[root,revision]);
 const fields=found.rows[0]?.structured_fields;
 if(!fields)return true;
 if(fields.verification!=="VERIFIED")return true;
 const end=fields.validUntil;
 if(typeof end!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(end)||
   end<new Date(Date.now()+330*60_000).toISOString().slice(0,10))return false;
 const media=await db.query(
  "SELECT 1 FROM cms_asset_placement a "+
  "JOIN cg19_cms_media_file f ON f.id=a.cg19_file_ref "+
  "AND f.realm_id=a.foundation_root_id AND f.page_id=a.page_id "+
  "JOIN cg19_cms_upload_intent i ON i.id=f.upload_intent_id "+
  "AND i.realm_id=f.realm_id "+
  "WHERE a.foundation_root_id=$1 AND a.page_revision_id=$2 "+
  "AND a.role='DOCUMENT' AND a.sort_order=0 "+
  "AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' "+
  "AND f.public_rights_confirmed=true AND i.status='VALIDATED' "+
  "AND i.rights_confirmed=true AND a.public_rights_status='VALIDATED' "+
  "AND a.cg19_validated_version=f.revision LIMIT 1",[root,revision]);
 return !!media.rowCount;
}
