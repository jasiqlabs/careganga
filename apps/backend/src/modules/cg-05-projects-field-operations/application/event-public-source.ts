import {BadRequestException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
/** Only the independently reviewed, current, consented source. No private
 * project description, branch/staff identity, GPS, finance or raw cover URL. */
const current=`
 FROM event_public_eligibility s JOIN project_activity p ON p.root_realm_id=s.root_realm_id AND p.id=s.activity_id AND p.version=s.activity_version
 JOIN cg03_case c ON c.realm_id=s.root_realm_id AND c.case_kind='FOUNDATION_EVENT_REVIEW' AND c.event_public_ref=s.id AND c.event_public_id=p.id AND c.event_public_version=p.version AND c.event_public_digest=s.source_digest
 WHERE s.root_realm_id=$1 AND s.revoked_at IS NULL AND s.consent_confirmed AND p.kind='EVENT' AND p.status IN('SCHEDULED','ONGOING','COMPLETED') AND p.status=s.event_status AND c.status='OWNER_COMPLETED'
 AND (s.cover_file_ref IS NULL OR EXISTS(SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id WHERE f.id=s.cover_file_ref AND f.realm_id=s.root_realm_id AND f.activity_id=s.activity_id AND f.proposal_revision=s.activity_version AND f.revision=s.cover_file_version AND f.owner_kind='CG05_ACTIVITY' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.status='VALIDATED'))
 AND (p.project_id IS NULL OR EXISTS(SELECT 1 FROM project parent WHERE parent.root_realm_id=p.root_realm_id AND parent.id=p.project_id AND parent.status<>'CANCELLED' AND parent.branch_ref IS NOT DISTINCT FROM p.branch_ref))
 AND (p.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=p.root_realm_id AND b.id=p.branch_ref AND b.status='ACTIVE'))
 AND EXISTS(SELECT 1 FROM account a JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL JOIN role r ON r.id=ar.role_id AND r.realm_id=a.realm_id AND r.active
 WHERE a.id=s.submitted_by AND a.realm_id=s.root_realm_id AND a.status='ACTIVE' AND (r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='projects.activities.manage'))
 AND EXISTS(SELECT 1 FROM account_role vr JOIN role rr ON rr.id=vr.role_id AND rr.realm_id=vr.realm_id AND rr.active WHERE vr.account_id=a.id AND vr.realm_id=a.realm_id AND vr.revoked_at IS NULL AND (rr.is_protected OR EXISTS(SELECT 1 FROM role_grant vg WHERE vg.role_id=rr.id AND vg.capability_key='projects.activities.view')))
 AND (s.cover_file_ref IS NULL OR EXISTS(SELECT 1 FROM account_role dr JOIN role rr ON rr.id=dr.role_id AND rr.realm_id=a.realm_id AND rr.active WHERE dr.account_id=a.id AND dr.realm_id=a.realm_id AND dr.revoked_at IS NULL AND (rr.is_protected OR EXISTS(SELECT 1 FROM role_grant dg WHERE dg.role_id=rr.id AND dg.capability_key='documents.files.view'))))
 AND (p.branch_ref IS NOT NULL AND EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=p.root_realm_id AND b.id=p.branch_ref AND b.manager_account_ref=a.id) OR r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='foundation.branches.admin')))
 AND EXISTS(SELECT 1 FROM cg03_case_decision d JOIN account a ON a.id=d.actor_id AND a.realm_id=d.realm_id AND a.status='ACTIVE' JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL JOIN role r ON r.id=ar.role_id AND r.realm_id=a.realm_id AND r.active AND r.is_protected WHERE d.case_id=c.id AND d.realm_id=c.realm_id AND d.action='APPROVE' AND d.actor_id<>c.proposer_id AND d.fresh_password_verified_at IS NOT NULL)
`;
/** Correlated filter for public article/navigation queries. No caller value is interpolated. */
export const EVENT_CURRENT_SQL=" AND NOT EXISTS(SELECT 1 FROM cms_section_revision ns WHERE ns.foundation_root_id=pub.foundation_root_id AND ns.page_revision_id=pub.page_revision_id AND ns.section_kind='ARTICLE_BODY' AND ns.structured_fields ? 'sourceEventRef' AND NOT EXISTS(SELECT 1 "+current.replace("s.root_realm_id=$1","s.root_realm_id=ns.foundation_root_id")+" AND s.id::text=ns.structured_fields->>'sourceEventRef' AND s.title=ns.structured_fields->>'heading' AND s.safe_summary=ns.structured_fields->>'body' AND s.category=ns.structured_fields->>'category' AND left(s.safe_summary,400)=ns.structured_fields->>'excerpt')) ";
type Source={sourceRef:string;slug:string;title:string;category:string;summary:string;area:string;launch:string|null;status:string;scheduledStart:string;scheduledEnd:string;coverSrc:string|null};
export async function eligibleEventSources(db:Pool|PoolClient,root:string,refs?:string[]){
 const query=await db.query<Source>('SELECT s.id AS "sourceRef",\'event-\'||lower(p.activity_code) AS slug,s.title,s.category,s.safe_summary AS summary,s.general_area AS area,s.planned_launch::text AS launch,s.event_status AS status,s.scheduled_start AS "scheduledStart",s.scheduled_end AS "scheduledEnd",CASE WHEN s.cover_file_ref IS NOT NULL THEN \'/api/public/content/media/\'||s.cover_file_ref::text END AS "coverSrc"'+current+(refs?' AND s.id=ANY($2::uuid[])':'')+' ORDER BY s.submitted_at DESC,s.id DESC LIMIT 100',refs?[root,refs]:[root]);
 return query.rows;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function eventSourceRef(raw:unknown){if(typeof raw!=="string"||!uuid.test(raw))throw new BadRequestException({code:"CMS_PROJECT_SOURCE_INVALID",field:"sourceEventRef"});return raw.toLowerCase();}
export async function validateEventArticle(db:PoolClient,root:string,fields:Record<string,unknown>){
 if(fields.sourceEventRef===undefined)return;
 const sources=await eligibleEventSources(db,root,[eventSourceRef(fields.sourceEventRef)]);
 const s=sources[0];
 if(!s||fields.heading!==s.title||fields.body!==s.summary||fields.category!==s.category||fields.excerpt!==s.summary.slice(0,400)||fields.sourceNoticeRef!==undefined)throw new BadRequestException({code:"CMS_PROJECT_SOURCE_UNAVAILABLE",field:"sourceEventRef"});
}
export async function eventArticleRevisionEligible(db:Pool|PoolClient,root:string,revision:string){
 const q=await db.query<{structured_fields:Record<string,unknown>}>("SELECT structured_fields FROM cms_section_revision WHERE foundation_root_id=$1 AND page_revision_id=$2 AND section_kind='ARTICLE_BODY' AND structured_fields ? 'sourceEventRef'",[root,revision]);
 for(const row of q.rows){const f=row.structured_fields;const s=(await eligibleEventSources(db,root,[eventSourceRef(f.sourceEventRef)]))[0];if(!s||f.heading!==s.title||f.body!==s.summary||f.category!==s.category||f.excerpt!==s.summary.slice(0,400))return false;}
 return true;
}
export async function publicEventArticle(db:Pool|PoolClient,root:string,fields:Record<string,unknown>){
 const s=(await eligibleEventSources(db,root,[eventSourceRef(fields.sourceEventRef)]))[0];
 if(!s||fields.heading!==s.title||fields.body!==s.summary||fields.category!==s.category||fields.excerpt!==s.summary.slice(0,400))return null;
 const {sourceRef,...safe}=s;
 return {heading:s.title,body:s.summary,category:s.category,excerpt:s.summary.slice(0,400),asOfDate:fields.asOfDate,authorLabel:fields.authorLabel,source:fields.source,tags:fields.tags,event:safe};
}
/** Anonymous bytes lookup: the exact consented file must still be referenced by
 * an effective, original CMS placement. Never publish on eligibility alone. */
export async function publishedEventCover(db:Pool|PoolClient,fileRef:string){
 if(!uuid.test(fileRef))return null;
 const q=await db.query<{object_key:string;object_version:string;original_mime:string;verified_sha256:string;verified_size_bytes:string;revision:number}>(`
 SELECT f.object_key,f.object_version,f.original_mime,f.verified_sha256,f.verified_size_bytes::text,f.revision
 FROM cg19_stored_file f JOIN event_public_eligibility pe ON pe.cover_file_ref=f.id AND pe.root_realm_id=f.realm_id AND pe.activity_id=f.activity_id AND pe.activity_version=f.proposal_revision AND pe.cover_file_version=f.revision
 JOIN access_realm root ON root.id=f.realm_id AND root.realm_key='FOUNDATION_ROOT'
 WHERE f.id=$1 AND f.owner_kind='CG05_ACTIVITY' AND f.original_mime IN('image/jpeg','image/png','image/webp')
 AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
 AND EXISTS(SELECT 1 ${current.replace("s.root_realm_id=$1","s.root_realm_id=pe.root_realm_id")} AND s.id=pe.id)
 AND EXISTS(SELECT 1 FROM cms_page page JOIN cms_page_effective e ON e.page_id=page.id AND e.foundation_root_id=page.foundation_root_id
 JOIN cms_publication pub ON pub.id=e.publication_id AND pub.foundation_root_id=e.foundation_root_id AND pub.page_id=page.id
 JOIN cms_section_revision sec ON sec.page_revision_id=pub.page_revision_id AND sec.foundation_root_id=pub.foundation_root_id
 WHERE page.foundation_root_id=pe.root_realm_id AND page.kind='ARTICLE' AND page.archived_at IS NULL AND pub.state='EFFECTIVE'
 AND pub.effective_at<=now() AND (pub.expires_at IS NULL OR pub.expires_at>now())
 AND sec.section_kind='ARTICLE_BODY' AND sec.structured_fields->>'sourceEventRef'=pe.id::text AND sec.structured_fields->>'heading'=pe.title AND sec.structured_fields->>'body'=pe.safe_summary AND sec.structured_fields->>'category'=pe.category AND sec.structured_fields->>'excerpt'=left(pe.safe_summary,400))
 LIMIT 1`,[fileRef]);
 return q.rows[0]??null;
}
