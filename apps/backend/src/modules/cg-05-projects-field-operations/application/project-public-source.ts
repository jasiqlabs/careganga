import {BadRequestException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
/** Only the independently reviewed, current, consented source. No private
 * project description, branch/staff identity, GPS, finance or raw cover URL. */
const current=`
 FROM project_public_eligibility s JOIN project p ON p.root_realm_id=s.root_realm_id AND p.id=s.project_id AND p.version=s.project_version
 JOIN cg03_case c ON c.realm_id=s.root_realm_id AND c.case_kind='PROJECT_PUBLIC_ELIGIBILITY' AND c.project_public_ref=s.id AND c.project_public_id=p.id AND c.project_public_version=p.version AND c.project_public_digest=s.source_digest
 WHERE s.root_realm_id=$1 AND s.revoked_at IS NULL AND s.consent_confirmed AND p.status IN('PLANNED','ACTIVE') AND p.status=s.project_status AND c.status='OWNER_COMPLETED'
 AND (p.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=p.root_realm_id AND b.id=p.branch_ref AND b.status='ACTIVE'))
 AND EXISTS(SELECT 1 FROM account a JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL JOIN role r ON r.id=ar.role_id AND r.realm_id=a.realm_id AND r.active
 WHERE a.id=s.submitted_by AND a.realm_id=s.root_realm_id AND a.status='ACTIVE' AND (r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='projects.manage'))
 AND (p.branch_ref IS NOT NULL AND EXISTS(SELECT 1 FROM branch b WHERE b.root_realm_id=p.root_realm_id AND b.id=p.branch_ref AND b.manager_account_ref=a.id) OR r.is_protected OR EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key='foundation.branches.admin')))
 AND EXISTS(SELECT 1 FROM cg03_case_decision d JOIN account a ON a.id=d.actor_id AND a.realm_id=d.realm_id AND a.status='ACTIVE' JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL JOIN role r ON r.id=ar.role_id AND r.realm_id=a.realm_id AND r.active AND r.is_protected WHERE d.case_id=c.id AND d.realm_id=c.realm_id AND d.action='APPROVE' AND d.actor_id<>c.proposer_id AND d.fresh_password_verified_at IS NOT NULL)
`;
type Source={sourceRef:string;title:string;category:string;summary:string;area:string;launch:string|null;status:string};
export async function eligibleProjectSources(db:Pool|PoolClient,root:string,refs?:string[]){
 const query=await db.query<Source>('SELECT s.id AS "sourceRef",s.title,s.category,s.safe_summary AS summary,s.general_area AS area,s.planned_launch::text AS launch,s.project_status AS status'+current+(refs?' AND s.id=ANY($2::uuid[])':'')+' ORDER BY s.submitted_at DESC,s.id DESC LIMIT 100',refs?[root,refs]:[root]);
 return query.rows;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function projectTeaserRefs(raw:unknown):string[]{
 if(!Array.isArray(raw)||raw.length>12||raw.some(x=>typeof x!=="string"||!uuid.test(x))||new Set(raw).size!==raw.length)throw new BadRequestException({code:"CMS_PROJECT_SOURCE_INVALID",field:"sourceRefs"});
 return raw;
}
export async function validateProjectTeaser(db:PoolClient,root:string,fields:Record<string,unknown>){
 const refs=projectTeaserRefs(fields.sourceRefs??[]);
 if(refs.length&&(await eligibleProjectSources(db,root,refs)).length!==refs.length)throw new BadRequestException({code:"CMS_PROJECT_SOURCE_UNAVAILABLE",field:"sourceRefs"});
}
export async function projectTeaserRevisionEligible(db:Pool|PoolClient,root:string,revision:string){
 const q=await db.query<{structured_fields:Record<string,unknown>}>("SELECT structured_fields FROM cms_section_revision WHERE foundation_root_id=$1 AND page_revision_id=$2 AND section_kind='PROJECT_TEASER'",[root,revision]);
 for(const row of q.rows){const refs=projectTeaserRefs(row.structured_fields.sourceRefs??[]);if(refs.length&&(await eligibleProjectSources(db,root,refs)).length!==refs.length)return false;}
 return true;
}
/** Called on every actual published response; revoked/stale cards disappear
 * without returning an eligibility UUID or fetching private project fields. */
export async function publicProjectTeaser(db:Pool|PoolClient,root:string,fields:Record<string,unknown>){
 const refs=projectTeaserRefs(fields.sourceRefs??[]),sources=refs.length?await eligibleProjectSources(db,root,refs):[];
 const byId=new Map(sources.map(s=>[s.sourceRef,s]));
 return {heading:typeof fields.heading==="string"?fields.heading:"Projects",cards:refs.flatMap(id=>{const s=byId.get(id);if(!s)return [];const {sourceRef,...safe}=s;return [safe];})};
}
