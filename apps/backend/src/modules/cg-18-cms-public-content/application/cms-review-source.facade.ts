import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {Pool} from "pg";
import {releaseIllustration,releaseIllustrationBytes} from "./cms-release-illustrations";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
export type CmsOriginalSource={pageRef:string;revisionRef:string;revisionNo:number;
 sourceDigest:string;title:string;createdBy:string;pageVersion:number;pageKind:string};
/** This is the CG-18-owned original source projection consumed through a typed
 * read-only facade by CG-03, not a second CMS approval state.
 */
@Injectable()
export class CmsReviewSourceFacade{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 async original(tx:PoolClient,actor:VerifiedFoundationActor,
  pageRef:string,revisionRef:string,revisionNo:number,digest:string):Promise<CmsOriginalSource>{
  if(!UUID.test(pageRef)||!UUID.test(revisionRef)||!Number.isSafeInteger(revisionNo)||
     revisionNo<1||!DIGEST.test(digest))
   throw new BadRequestException({code:"CMS_SOURCE_INVALID"});
  const row=await tx.query<{pageRef:string;revisionRef:string;revisionNo:number;
   sourceDigest:string;title:string;createdBy:string;pageVersion:number;
   pageKind:string;status:string;currentRevision:number}>(
   'SELECT p.id AS "pageRef",v.id AS "revisionRef",v.revision_no AS "revisionNo",'+
   'v.content_digest AS "sourceDigest",v.title,v.created_by AS "createdBy",'+
   'p.version AS "pageVersion",p.kind AS "pageKind",v.status,'+
   'p.draft_revision_no AS "currentRevision" FROM cms_page p '+
   'JOIN cms_page_revision v ON v.page_id=p.id AND '+
   'v.foundation_root_id=p.foundation_root_id '+
   'WHERE p.id=$1 AND p.foundation_root_id=$2 AND p.archived_at IS NULL '+
   'AND v.id=$3 AND v.revision_no=$4 AND v.content_digest=$5 AND NOT v.release_baseline FOR SHARE OF p,v',
   [pageRef,actor.realmId,revisionRef,revisionNo,digest]);
  const x=row.rows[0];
  if(!x||x.currentRevision!==revisionNo||
   !["DRAFT","SUBMITTED"].includes(x.status))
   throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
  return x;
 }
 async reviewSnapshot(bearerRealm:string,pageRef:string,revisionRef:string,caseRef:string){
  const original=await this.db.query<{title:string;kind:string;slug:string;
   seo_title:string;seo_description:string;structured_fields:unknown;order_no:number;
   section_kind:string}>(
   'SELECT v.title,p.kind,p.slug,v.seo_title,v.seo_description,'+
   's.structured_fields,s.order_no,s.section_kind FROM cms_page p '+
   'JOIN cms_page_revision v ON v.page_id=p.id AND v.foundation_root_id=p.foundation_root_id '+
   'LEFT JOIN cms_section_revision s ON s.page_revision_id=v.id '+
   'AND s.foundation_root_id=v.foundation_root_id '+
   'WHERE p.foundation_root_id=$1 AND p.id=$2 AND v.id=$3 '+
   'AND v.approval_case_ref=$4 ORDER BY s.order_no,s.id LIMIT 101',
   [bearerRealm,pageRef,revisionRef,caseRef]);
  if(!original.rows.length)throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
  const nav=await this.db.query<{login_desired:boolean;member_join_desired:boolean;
   volunteer_join_desired:boolean}>(
   "SELECT login_desired,member_join_desired,volunteer_join_desired "+
   "FROM cms_navigation_revision WHERE foundation_root_id=$1 AND "+
   "home_revision_id=$2 AND status='SUBMITTED'",
   [bearerRealm,revisionRef]);
  if(original.rows[0].kind==="HOME"&&!nav.rows[0])
   throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
  const media=await this.db.query<{fileRef:string;role:string;altText:string;order:number;current:boolean;mime:string|null}>(
   'SELECT a.cg19_file_ref AS "fileRef",a.role,a.alt_text AS "altText",'+
   'a.sort_order AS "order",f.original_mime AS "mime",'+
   '(a.public_rights_status = \'VALIDATED\' AND f.id IS NOT NULL '+
   'AND a.cg19_validated_version=f.revision AND f.revoked_at IS NULL '+
   'AND f.scan_status = \'CLEAN_VERIFIED\' '+
   'AND f.public_rights_confirmed=true) AS current '+
   'FROM cms_asset_placement a LEFT JOIN cg19_cms_media_file f '+
   'ON f.id=a.cg19_file_ref AND f.realm_id=a.foundation_root_id '+
   'AND f.page_id=(SELECT target.page_id FROM cms_page_revision target '+
   'WHERE target.id=a.page_revision_id AND target.foundation_root_id=a.foundation_root_id) '+
   'WHERE a.foundation_root_id=$1 AND a.page_revision_id=$2 '+
   'ORDER BY a.role,a.sort_order LIMIT 31',
   [bearerRealm,revisionRef]);
  const releaseRows=await this.db.query<{asset_key:string;role:string;sort_order:number}>(
   "SELECT asset_key,role,sort_order FROM cms_release_asset WHERE foundation_root_id=$1 AND page_revision_id=$2 ORDER BY role,sort_order",
   [bearerRealm,revisionRef]);
  const bundled=await Promise.all(releaseRows.rows.map(async row=>{
   const art=releaseIllustration(row.asset_key);
   let current=false;
   if(art&&art.role===row.role&&art.order===row.sort_order)try{await releaseIllustrationBytes(art.key);current=true;}catch{}
   return {fileRef:"release-"+row.asset_key,role:row.role,altText:art?.altText??"Unverified release illustration",order:row.sort_order,current,mime:"image/webp",bundled:true};
  }));
  return {navigation:nav.rows[0]?{
   loginDesired:nav.rows[0].login_desired,
   memberJoinDesired:nav.rows[0].member_join_desired,
   volunteerJoinDesired:nav.rows[0].volunteer_join_desired}:null,
   title:original.rows[0].title,kind:original.rows[0].kind,
   slug:original.rows[0].slug,seoTitle:original.rows[0].seo_title,
   seoDescription:original.rows[0].seo_description,
   assets:[...media.rows.map(a=>({fileRef:a.fileRef,role:a.role,altText:a.altText,
    order:a.order,current:a.current,mime:a.mime,bundled:false})),...bundled],
   sections:original.rows.slice(0,100).filter(x=>x.section_kind!==null)
    .map(x=>({kind:x.section_kind,order:x.order_no,fields:x.structured_fields}))};
 }
}
