import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Original={id:string;title:string;body:string;approved_at:Date;
 expires_at:Date};
const safe=(value:string)=>value.length<=480&&!/[<>\u0000-\u001f\u007f]/.test(value);
/** CG19 remains the ORIGINAL notice and recipient master.
 * CMS receives only a deliberately hand-selected, independently reviewed,
 * de-identified public title/body projection. No recipient/outbox fields.
 */
@Injectable()
export class CmsPublicNoticeSource{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService){}
 private async original(db:Pool|PoolClient,root:string,noticeRef:string){
  if(!UUID.test(noticeRef))return null;
  const found=await db.query<Original>(
   "SELECT id,title,body,approved_at,expires_at FROM cg19_notice "+
   "WHERE id=$1 AND realm_id=$2 AND audience_kind='ALL_ACTIVE' "+
   "AND approved_by IS NOT NULL AND approved_at IS NOT NULL "+
   "AND state='ACTIVE' AND expires_at>now() LIMIT 1",[noticeRef,root]);
  const n=found.rows[0];
  if(!n||!safe(n.title)||!safe(n.body))return null;
  return {noticeRef:n.id,title:n.title,body:n.body,
   expiresAt:n.expires_at.toISOString(),asOfDate:n.approved_at.toISOString().slice(0,10)};
 }
 async requireSelectionAccess(bearer:string){
  await this.sessions.requireAction(bearer,"cms.content.manage");
  await this.sessions.requireAction(bearer,"communications.notices.manage");
 }
 async candidates(bearer:string){
  // An editor must have BOTH the original CG19 notice visibility/manage action
  // and CG18 publication-edit permission; other editors get no notice list.
  const actor=await this.sessions.requireAction(bearer,"cms.content.manage");
  await this.sessions.requireAction(bearer,"communications.notices.manage");
  const found=await this.db.query<{id:string;title:string;body:string;
   approved_at:Date;expires_at:Date}>(
   "SELECT id,title,body,approved_at,expires_at FROM cg19_notice "+
   "WHERE realm_id=$1 AND audience_kind='ALL_ACTIVE' "+
   "AND approved_by IS NOT NULL AND approved_at IS NOT NULL "+
   "AND state='ACTIVE' AND expires_at>now() "+
   "ORDER BY approved_at DESC,id DESC LIMIT 50",[actor.realmId]);
  return {sources:found.rows.filter(x=>safe(x.title)&&safe(x.body)).map(x=>({
   noticeRef:x.id,title:x.title,body:x.body,
   expiresAt:x.expires_at.toISOString(),
   asOfDate:x.approved_at.toISOString().slice(0,10)}))};
 }
 async requireCurrent(db:Pool|PoolClient,root:string,noticeRef:string,
  heading:string,body:string):Promise<boolean>{
  const original=await this.original(db,root,noticeRef);
  return !!original&&original.title===heading&&original.body===body;
 }
 async revisionEligible(db:Pool|PoolClient,root:string,revision:string):
  Promise<boolean>{
  const section=await db.query<{structured_fields:Record<string,unknown>}>(
   "SELECT structured_fields FROM cms_section_revision "+
   "WHERE foundation_root_id=$1 AND page_revision_id=$2 "+
   "AND section_kind='ARTICLE_BODY' LIMIT 1",[root,revision]);
  const fields=section.rows[0]?.structured_fields;
  if(!fields||fields.sourceNoticeRef===undefined)return true;
  if(fields.publicReleaseConfirmed!==true||
   typeof fields.sourceNoticeRef!=="string"||
   typeof fields.heading!=="string"||typeof fields.body!=="string")
   return false;
  return this.requireCurrent(db,root,fields.sourceNoticeRef,fields.heading,fields.body);
 }
 async validateDraft(db:PoolClient,root:string,
  fields:Record<string,unknown>):Promise<void>{
  if(fields.sourceNoticeRef===undefined)return;
  if(fields.publicReleaseConfirmed!==true||
   typeof fields.sourceNoticeRef!=="string"||
   typeof fields.heading!=="string"||typeof fields.body!=="string"||
   !(await this.requireCurrent(db,root,fields.sourceNoticeRef,fields.heading,fields.body)))
   throw new BadRequestException({code:"CMS_ORIGINAL_NOTICE_UNAVAILABLE",field:"sourceNoticeRef"});
 }
}
