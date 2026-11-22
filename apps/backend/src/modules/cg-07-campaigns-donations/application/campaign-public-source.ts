import {BadRequestException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";

/** CG07 original operational eligibility; independent CG18 CMS effective
 * placement is REQUIRED for anonymous publication, not just CG03 approval.
 * No donation, financial receipt, donor, internal staff or private docs flow.
 */
const PUBLIC_SLUG=/^cg-camp-[0-9]{8}$/;
const BASE=`
 FROM campaign c
 JOIN campaign_revision rev ON rev.root_realm_id=c.root_realm_id AND rev.campaign_id=c.id
  AND rev.revision_no=c.current_revision
 JOIN access_realm root ON root.id=c.root_realm_id AND root.realm_key='FOUNDATION_ROOT'
 JOIN cg03_case review ON review.realm_id=c.root_realm_id
  AND review.campaign_id=c.id AND review.case_kind='CAMPAIGN_LAUNCH'
  AND review.campaign_source_revision=c.current_revision
  AND review.campaign_source_digest=rev.immutable_digest AND review.status='OWNER_COMPLETED'
 JOIN cg03_case_decision decision ON decision.realm_id=review.realm_id AND decision.case_id=review.id
  AND decision.action='APPROVE' AND decision.actor_id<>review.proposer_id
  AND decision.fresh_password_verified_at IS NOT NULL
 WHERE c.source_status='APPROVED'
 AND (c.start_at IS NULL OR c.start_at<=(now() AT TIME ZONE 'Asia/Kolkata')::date)
 AND (c.end_at IS NULL OR c.end_at>=(now() AT TIME ZONE 'Asia/Kolkata')::date)
 AND (c.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b
    WHERE b.root_realm_id=c.root_realm_id AND b.id=c.branch_ref AND b.status='ACTIVE'))
 AND (c.project_source_ref IS NULL OR EXISTS(SELECT 1 FROM project p
    WHERE p.root_realm_id=c.root_realm_id AND p.id=c.project_source_ref
      AND p.status='ACTIVE' AND p.branch_ref IS NOT DISTINCT FROM c.branch_ref))
 AND (c.event_source_ref IS NULL OR EXISTS(SELECT 1 FROM project_activity e
    WHERE e.root_realm_id=c.root_realm_id AND e.id=c.event_source_ref
      AND e.kind='EVENT' AND e.status IN('SCHEDULED','ONGOING')
      AND e.project_id IS NOT DISTINCT FROM c.project_source_ref
      AND e.branch_ref IS NOT DISTINCT FROM c.branch_ref))
 AND (c.volunteer_source_ref IS NULL OR EXISTS(SELECT 1 FROM volunteer v
    WHERE v.root_realm_id=c.root_realm_id AND v.id=c.volunteer_source_ref
      AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,c.branch_ref)))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(
  COALESCE(rev.step5_media_refs->'supportingFileRefs','[]'::jsonb)
 ) supporting(ref) WHERE NOT EXISTS(
  SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i
    ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
  WHERE f.id=supporting.ref::uuid AND f.realm_id=c.root_realm_id
    AND f.campaign_id=c.id AND f.proposal_revision<=rev.revision_no
    AND f.owner_kind='CG07_CAMPAIGN' AND f.scan_status='CLEAN_VERIFIED'
    AND f.revoked_at IS NULL AND i.owner_kind='CG07_CAMPAIGN'
    AND i.status='VALIDATED' AND i.campaign_id=c.id
    AND i.classification='CAMPAIGN_DOCUMENT' AND i.campaign_media_rights_confirmed
 ))
 AND (rev.step5_media_refs->>'coverRef' IS NULL OR EXISTS(
    SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i
       ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
    WHERE f.id=(rev.step5_media_refs->>'coverRef')::uuid
      AND f.realm_id=c.root_realm_id AND f.campaign_id=c.id
      AND f.owner_kind='CG07_CAMPAIGN' AND f.proposal_revision<=rev.revision_no
      AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
      AND f.original_mime IN('image/jpeg','image/png')
      AND i.owner_kind='CG07_CAMPAIGN' AND i.status='VALIDATED'
      AND i.campaign_media_rights_confirmed AND i.classification='CAMPAIGN_COVER'))
 AND (rev.step5_media_refs->>'fileRef' IS NULL OR EXISTS(
    SELECT 1 FROM cg19_stored_file f JOIN cg19_upload_intent i
       ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
    WHERE f.id=(rev.step5_media_refs->>'fileRef')::uuid
      AND f.realm_id=c.root_realm_id AND f.campaign_id=c.id
      AND f.owner_kind='CG07_CAMPAIGN' AND f.proposal_revision<=rev.revision_no
      AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL
      AND f.original_mime IN('image/jpeg','image/png','image/webp')
      AND i.owner_kind='CG07_CAMPAIGN' AND i.status='VALIDATED'
      AND i.campaign_media_rights_confirmed AND i.classification='CAMPAIGN_BANNER'))
 `;
type Source={sourceRef:string;slug:string;title:string;category:string;summary:string;
 description:string;goalMinor:string|null;startAt:string|null;endAt:string|null;
 area:string;coverSrc:string|null;heroSrc:string|null;heroAlt:string};
const PUBLIC_COLUMNS=`c.id AS "sourceRef",lower(c.code_norm) AS slug,c.title,c.category,
  left(rev.step1_basic->>'summary',500) AS summary,
  left(rev.step1_basic->>'description',4000) AS description,
  c.goal_minor::text AS "goalMinor",c.start_at::text AS "startAt",c.end_at::text AS "endAt",
  left(coalesce(rev.step2_project_and_geo->>'location',''),250) AS area,
  CASE WHEN rev.step5_media_refs->>'coverRef' IS NOT NULL THEN
   '/api/public/campaigns/media/'||(rev.step5_media_refs->>'coverRef') END AS "coverSrc",
  CASE WHEN rev.step5_media_refs->>'fileRef' IS NOT NULL THEN
   '/api/public/campaigns/media/'||(rev.step5_media_refs->>'fileRef') END AS "heroSrc",
  left(coalesce(nullif(rev.step5_media_refs->>'alt',''),c.title),240) AS "heroAlt"`;

export function campaignTeaserRefs(raw:unknown):string[]{
 if(!Array.isArray(raw)||raw.length>12||
  raw.some(v=>typeof v!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))||
  new Set(raw.map(v=>String(v).toLowerCase())).size!==raw.length)
  throw new BadRequestException({code:"CMS_CAMPAIGN_SOURCE_INVALID",field:"sourceRefs"});
 return (raw as string[]).map(v=>v.toLowerCase());
}
export async function eligibleCampaignSources(db:Pool|PoolClient,root:string,refs?:string[]){
 const rows=await db.query<Source>(`SELECT ${PUBLIC_COLUMNS}${BASE}
  AND c.root_realm_id=$1
  ${refs?"AND c.id=ANY($2::uuid[])":""}
  ORDER BY c.created_at DESC,c.id DESC LIMIT 100`,refs?[root,refs]:[root]);
 return rows.rows;
}
export async function validateCampaignTeaser(db:PoolClient,root:string,fields:Record<string,unknown>){
 const refs=campaignTeaserRefs(fields.sourceRefs??[]);
 if(refs.length&&(await eligibleCampaignSources(db,root,refs)).length!==refs.length)
  throw new BadRequestException({code:"CMS_CAMPAIGN_SOURCE_UNAVAILABLE",field:"sourceRefs"});
}
/** Cross-owner CMS source check per request, never a cached CG07 boolean. */
const PUBLISHED=`
 AND EXISTS(SELECT 1 FROM cms_page p
  JOIN cms_page_effective effective ON effective.page_id=p.id
    AND effective.foundation_root_id=p.foundation_root_id
  JOIN cms_publication publication ON publication.id=effective.publication_id
    AND publication.page_id=p.id AND publication.foundation_root_id=p.foundation_root_id
  JOIN cg03_case cg18review ON cg18review.realm_id=p.foundation_root_id
    AND cg18review.case_kind='CMS_PUBLICATION'
    AND cg18review.cms_page_id=p.id AND cg18review.cms_page_revision_id=publication.page_revision_id
    AND cg18review.cms_content_digest=publication.source_content_digest
    AND cg18review.status='OWNER_COMPLETED'
  JOIN cg03_case_decision cms_decision ON cms_decision.realm_id=cg18review.realm_id
    AND cms_decision.case_id=cg18review.id
    AND cms_decision.id=publication.cg03_final_decision_ref
    AND cms_decision.action='APPROVE'
    AND cms_decision.actor_id<>cg18review.proposer_id
    AND cms_decision.fresh_password_verified_at IS NOT NULL
  JOIN cms_section_revision section ON section.foundation_root_id=p.foundation_root_id
    AND section.page_revision_id=publication.page_revision_id
  WHERE p.foundation_root_id=c.root_realm_id AND p.kind IN('HOME','ABOUT')
    AND p.archived_at IS NULL
    AND publication.state='EFFECTIVE' AND publication.effective_at<=now()
    AND (publication.expires_at IS NULL OR publication.expires_at>now())
    AND section.section_kind='CAMPAIGN_TEASER'
    AND (section.structured_fields->'sourceRefs') ? c.id::text)`;
/** Public DTO deliberately strips the opaque source id. No donation CTA
 * becomes active until US002's genuine verified donation route exists.
 */
export async function publicCampaignSources(db:Pool|PoolClient,slug?:string){
 if(slug!==undefined&&!PUBLIC_SLUG.test(slug))return [];
 const rows=await db.query<Source>(`SELECT DISTINCT ON (c.id) ${PUBLIC_COLUMNS}${BASE}${PUBLISHED}
  ${slug?" AND lower(c.code_norm)=$1":""}
  ORDER BY c.id,c.updated_at DESC LIMIT 100`,slug?[slug]:[]);
 return rows.rows.map(({sourceRef,...publicData})=>publicData);
}
export async function publicCampaignMedia(db:Pool|PoolClient,fileRef:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileRef))return null;
 const rows=await db.query<{
  object_key:string;object_version:string;original_mime:string;
  verified_sha256:string;verified_size_bytes:string;revision:number}>(`
 SELECT f.object_key,f.object_version,f.original_mime,f.verified_sha256,
  f.verified_size_bytes::text,f.revision
 FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.id=f.upload_intent_id
  AND i.realm_id=f.realm_id
 JOIN campaign c ON c.id=f.campaign_id AND c.root_realm_id=f.realm_id
 JOIN campaign_revision rev ON rev.root_realm_id=c.root_realm_id
  AND rev.campaign_id=c.id AND rev.revision_no=c.current_revision
 WHERE f.id=$1 AND f.owner_kind='CG07_CAMPAIGN' AND f.scan_status='CLEAN_VERIFIED'
  AND f.revoked_at IS NULL AND f.proposal_revision<=rev.revision_no
  AND f.original_mime IN('image/jpeg','image/png','image/webp')
  AND i.owner_kind='CG07_CAMPAIGN' AND i.campaign_id=c.id
  AND i.status='VALIDATED' AND i.campaign_media_rights_confirmed
  AND ((i.classification='CAMPAIGN_COVER' AND
    rev.step5_media_refs->>'coverRef'=f.id::text AND f.original_mime IN('image/jpeg','image/png'))
   OR (i.classification='CAMPAIGN_BANNER' AND
    rev.step5_media_refs->>'fileRef'=f.id::text))
  AND EXISTS(SELECT 1 ${BASE}${PUBLISHED} AND c.id=f.campaign_id)
 LIMIT 1`,[fileRef]);
 return rows.rows[0]??null;
}
