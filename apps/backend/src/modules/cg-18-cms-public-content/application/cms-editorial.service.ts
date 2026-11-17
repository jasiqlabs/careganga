import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {CmsPublicationApprovalService} from "../../cg-03-registration-approvals/application/cms-publication-approval.service";
import {CmsDraftMediaService} from "../../cg-19-documents-notifications/application/cms-draft-media.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {extendedKinds,parseExtendedSection,validateExtendedPage} from "./cms-extended-sections";
import {complianceEligible} from "./cms-compliance-eligibility";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const KINDS=new Set(["HOME","ABOUT","IMPACT","COMPLIANCE","GALLERY","ARTICLE","CONTACT","HEALTHCARE"]);
const SECTION=new Set(["HERO","RICH_TEXT","TEAM","CTA","PROJECT_TEASER",
 "FEATURE_CARDS","JOIN_CARDS","SITE_FOOTER","IMPACT_GROUP","COMPLIANCE_FACTS",
 "GALLERY_GRID","ARTICLE_BODY","HEALTHCARE_CATEGORIES"]);
const assetRoles=new Set(["HERO","MOBILE_HERO","TEAM","ABOUT","PROMO","FEATURE",
 "GALLERY","ARTICLE","DOCUMENT","IMPACT"]);
const reserved=new Set(["admin","api","login","join","volunteer","auth","internal","_next"]);
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function uuid(v:unknown,field:string){
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException({code:"CMS_INPUT_INVALID",field});
 return v;
}
function text(v:unknown,field:string,max=4000,min=0){
 if(typeof v!=="string"||v.trim().length<min||v.length>max||
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field});
 return v.trim();
}
function input(v:unknown,keys:string[]){
 if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.keys(v).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CMS_INPUT_INVALID"});
 return v as Record<string,unknown>;
}
function path(v:unknown,field:string){
 const x=text(v,field,140,1);
 if(!["/","/about","/contact"].includes(x))
  throw new BadRequestException({code:"CMS_UNAVAILABLE_ROUTE",field});
 if(!/^\/(?:[a-z0-9-]+\/?)*$/.test(x)||x.startsWith("//")||
  /(^|\/)(admin|api|auth|internal|_next)(\/|$)/.test(x)||
  /^\/(join|volunteer|book)(\/|$)/.test(x))
  throw new BadRequestException({code:"CMS_UNAVAILABLE_ROUTE",field});
 return x;
}
type Section={kind:"HERO"|"RICH_TEXT"|"TEAM"|"CTA"|"PROJECT_TEASER"|
 "FEATURE_CARDS"|"JOIN_CARDS"|"SITE_FOOTER"|"IMPACT_GROUP"|
 "COMPLIANCE_FACTS"|"GALLERY_GRID"|"ARTICLE_BODY"|"HEALTHCARE_CATEGORIES";order:number;
 fields:Record<string,unknown>};
type Placement={fileRef:string;version:number;role:"HERO"|"MOBILE_HERO"|"TEAM"|
 "ABOUT"|"PROMO"|"FEATURE"|"GALLERY"|"ARTICLE"|"DOCUMENT"|"IMPACT";
 altText:string;order:number};
// Only reveal media when its exact authored section or indexed card still exists.
const IMAGE_MIME=new Set(["image/jpeg","image/png","image/webp"]);
function placementMimeAllowed(asset:Placement,sections:readonly Section[],mime:string){
 if(asset.role==="DOCUMENT")return mime==="application/pdf"||IMAGE_MIME.has(mime);
 if(asset.role==="GALLERY"){
  const gallery=sections.find(s=>s.kind==="GALLERY_GRID");
  const items=gallery?.fields.items;
  const item=Array.isArray(items)?items[asset.order] as Record<string,unknown>|undefined:undefined;
  return item?.mediaType==="PHOTO"?IMAGE_MIME.has(mime):
   item?.mediaType==="VIDEO"?mime==="video/mp4":
   item?.mediaType==="PUBLICATION"?mime==="application/pdf":false;
 }
 return IMAGE_MIME.has(mime);
}
function placementFits(sections:readonly Section[],a:{role:string;order:number}){
 return sections.some(s=>{
  if(a.role==="HERO"||a.role==="MOBILE_HERO")return s.kind==="HERO"&&s.order===a.order;
  if(a.role==="ABOUT")return s.kind==="RICH_TEXT"&&s.order===a.order&&s.fields.variant==="SPLIT";
  if(a.role==="PROMO")return s.kind==="CTA"&&s.order===a.order;
  if(a.role==="TEAM")return s.kind==="TEAM"&&
   Array.isArray(s.fields.members)&&a.order<s.fields.members.length;
  if(a.role==="FEATURE")return s.kind==="FEATURE_CARDS"&&
   Array.isArray(s.fields.cards)&&a.order<s.fields.cards.length;
  if(a.role==="GALLERY")return s.kind==="GALLERY_GRID"&&
   Array.isArray(s.fields.items)&&a.order<s.fields.items.length;
  if(a.role==="ARTICLE")return s.kind==="ARTICLE_BODY"&&a.order===0;
  if(a.role==="IMPACT")return s.kind==="IMPACT_GROUP"&&a.order===s.order;
  if(a.role==="DOCUMENT")return s.kind==="COMPLIANCE_FACTS"&&a.order===0;
  return false;
 });
}
type NavDesired={loginDesired:boolean;memberJoinDesired:boolean;volunteerJoinDesired:boolean};
type Content={kind:"HOME"|"ABOUT"|"IMPACT"|"COMPLIANCE"|"GALLERY"|"ARTICLE"|
 "CONTACT"|"HEALTHCARE";slug:string;title:string;seoTitle:string;
 seoDescription:string;canonicalPath:string;sections:Section[];assets:Placement[];navigation:NavDesired|null};
function parseContent(raw:unknown):Content{
 const v=input(raw,["kind","slug","title","seoTitle","seoDescription","canonicalPath",
  "sections","assets","navigation"]);
 if(typeof v.kind!=="string"||!KINDS.has(v.kind))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"kind"});
 const kind=v.kind as Content["kind"],slug=text(v.slug,"slug",70,1).toLowerCase();
 const fixed:Partial<Record<Content["kind"],string>>={HOME:"home",ABOUT:"about",
  IMPACT:"impact",COMPLIANCE:"80g",GALLERY:"gallery",CONTACT:"contact",
  HEALTHCARE:"healthcare"};
 if(!/^[a-z0-9][a-z0-9-]{0,69}$/.test(slug)||reserved.has(slug)||
    (fixed[kind]!==undefined&&slug!==fixed[kind])||
    (kind==="ARTICLE"&&Object.values(fixed).includes(slug)))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"slug"});
 const title=text(v.title,"title",180,3);
 const seoTitle=text(v.seoTitle??v.title,"seoTitle",180,3);
 const seoDescription=text(v.seoDescription??"","seoDescription",300);
 const expectedPath=kind==="HOME"?"/":kind==="ABOUT"?"/about":
  kind==="COMPLIANCE"?"/80g":kind==="ARTICLE"?"/blog/"+slug:"/"+slug;
 const canonicalPath=v.canonicalPath??expectedPath;
 if(typeof canonicalPath!=="string"||canonicalPath!==expectedPath||
    !/^\/(?:[a-z0-9-]+\/?)*$/.test(canonicalPath))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"canonicalPath"});
 if(!Array.isArray(v.sections)||v.sections.length<1||v.sections.length>24)
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections"});
 const sections=v.sections.map((raw,i)=>{
  const sec=input(raw,["kind","order","fields"]);
  if(typeof sec.kind!=="string"||!SECTION.has(sec.kind)||
    !Number.isSafeInteger(sec.order)||Number(sec.order)<0||Number(sec.order)>100)
   throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections["+i+"]"});
  if(extendedKinds.has(String(sec.kind)))return {
   kind:sec.kind as Section["kind"],order:Number(sec.order),
   fields:parseExtendedSection(String(sec.kind),sec.fields)};
  const fields=input(sec.fields,sec.kind==="HERO"?
   ["heading","subtitle","description","eyebrow","tags","visible",
    "headingFont","headingWeight","headingSize","headingColor","subtitleColor",
    "primaryLabel","primaryPath","secondaryLabel","secondaryPath"]:
   sec.kind==="TEAM"?["heading","members"]:
   sec.kind==="CTA"?["heading","eyebrow","body","label","path"]:
   sec.kind==="FEATURE_CARDS"?["heading","eyebrow","body","cards"]:
   sec.kind==="JOIN_CARDS"?["volunteerTitle","volunteerBody","volunteerBenefits",
    "memberTitle","memberBody","memberBenefits"]:
   sec.kind==="SITE_FOOTER"?["mission","address","email","phone","newsletterText"]:
   sec.kind==="RICH_TEXT"?["heading","body","eyebrow","variant","highlights"]:
   ["heading"]);
  const out:Record<string,unknown>={};
  const array=(raw:unknown,field:string,limit:number,max:number)=>{
   if(!Array.isArray(raw)||raw.length>limit)
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field});
   return raw.map(item=>text(item,field,max,2));
  };
  if(sec.kind==="HERO"){
   out.heading=text(fields.heading,"heading",180,3);
   out.subtitle=text(fields.subtitle??"","subtitle",700);
   out.description=text(fields.description??"","description",400);
   out.eyebrow=text(fields.eyebrow??"","eyebrow",100);
   out.tags=array(fields.tags??[],"tags",4,36);
   if(fields.visible!==undefined&&typeof fields.visible!=="boolean")
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"visible"});
   out.visible=fields.visible!==false;
   const heroStyle=(field:string,raw:unknown,allowed:string[],fallback:string)=>{
    if(raw===undefined)return fallback;
    const candidate=text(raw,field,30,1);
    if(!allowed.includes(candidate))
     throw new BadRequestException({code:"CMS_INPUT_INVALID",field});
    return candidate;
   };
   const heroColor=(field:string,raw:unknown,fallback:string)=>{
    if(raw===undefined)return fallback;
    if(typeof raw!=="string"||!/^#[0-9A-Fa-f]{6}$/.test(raw))
     throw new BadRequestException({code:"CMS_INPUT_INVALID",field});
    return raw.toUpperCase();
   };
   out.headingFont=heroStyle("headingFont",fields.headingFont,["SERIF","SANS"],"SERIF");
   out.headingWeight=heroStyle("headingWeight",fields.headingWeight,["REGULAR","BOLD"],"BOLD");
   out.headingSize=heroStyle("headingSize",fields.headingSize,["STANDARD","LARGE"],"LARGE");
   out.headingColor=heroColor("headingColor",fields.headingColor,"#FFE34A");
   out.subtitleColor=heroColor("subtitleColor",fields.subtitleColor,"#8CF442");
   if(fields.primaryLabel!==undefined)out.primaryLabel=text(fields.primaryLabel,"primaryLabel",60,2);
   if(fields.primaryPath!==undefined)out.primaryPath=path(fields.primaryPath,"primaryPath");
   if(Boolean(fields.primaryLabel)!==Boolean(fields.primaryPath))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"primaryPath"});
   if(fields.secondaryLabel!==undefined)out.secondaryLabel=text(fields.secondaryLabel,"secondaryLabel",60,2);
   if(fields.secondaryPath!==undefined)out.secondaryPath=path(fields.secondaryPath,"secondaryPath");
   if(Boolean(fields.secondaryLabel)!==Boolean(fields.secondaryPath))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"secondaryPath"});
  }else if(sec.kind==="RICH_TEXT"){
   out.heading=text(fields.heading,"heading",160,3);
   out.body=text(fields.body,"body",4000,5);
   out.eyebrow=text(fields.eyebrow??"","eyebrow",100);
   if(fields.variant!==undefined){
    if(!["STANDARD","SPLIT"].includes(String(fields.variant)))
     throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"variant"});
    out.variant=fields.variant;
   }
   out.highlights=array(fields.highlights??[],"highlights",4,200);
  }else if(sec.kind==="CTA"){
   out.heading=text(fields.heading??"","heading",160);
   out.eyebrow=text(fields.eyebrow??"","eyebrow",80);
   out.body=text(fields.body??"","body",400);
   if(fields.label!==undefined)out.label=text(fields.label,"label",80,2);
   if(fields.path!==undefined)out.path=path(fields.path,"path");
   if(Boolean(fields.label)!==Boolean(fields.path))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"path"});
  }else if(sec.kind==="TEAM"){
   out.heading=text(fields.heading??"Our team","heading",160,3);
   if(!Array.isArray(fields.members)||fields.members.length>15)
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"members"});
   out.members=fields.members.map((member:unknown)=>{
    const m=input(member,["name","designation","bio","consentConfirmed"]);
    if(m.consentConfirmed!==true)
     throw new BadRequestException({code:"CMS_TEAM_CONSENT_REQUIRED"});
    return {name:text(m.name,"name",100,2),
     designation:text(m.designation,"designation",100,2),
     bio:text(m.bio??"","bio",600),consentConfirmed:true};
   });
  }else if(sec.kind==="FEATURE_CARDS"){
   out.eyebrow=text(fields.eyebrow??"","eyebrow",80);
   out.heading=text(fields.heading,"heading",160,3);
   out.body=text(fields.body??"","body",500);
   if(!Array.isArray(fields.cards)||fields.cards.length<1||fields.cards.length>3)
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"cards"});
   out.cards=fields.cards.map((candidate:unknown)=>{
    const card=input(candidate,["label","title","body"]);
    return {label:text(card.label,"label",50,2),
     title:text(card.title,"title",110,3),
     body:text(card.body,"body",350,5)};
   });
  }else if(sec.kind==="JOIN_CARDS"){
   out.volunteerTitle=text(fields.volunteerTitle,"volunteerTitle",120,3);
   out.volunteerBody=text(fields.volunteerBody,"volunteerBody",500,5);
   out.memberTitle=text(fields.memberTitle,"memberTitle",120,3);
   out.memberBody=text(fields.memberBody,"memberBody",500,5);
   out.volunteerBenefits=array(fields.volunteerBenefits??[],"volunteerBenefits",3,170);
   out.memberBenefits=array(fields.memberBenefits??[],"memberBenefits",3,170);
  }else if(sec.kind==="SITE_FOOTER"){
   out.mission=text(fields.mission??"","mission",600);
   out.address=text(fields.address??"","address",300);
   out.phone=text(fields.phone??"","phone",32);
   out.email=text(fields.email??"","email",150);
   out.newsletterText=text(fields.newsletterText??"","newsletterText",250);
   if(out.phone&&!/^\+?[0-9 ()-]{7,32}$/.test(String(out.phone)))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"phone"});
   if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(out.email)))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"email"});
  }else out.heading=text(fields.heading??"","heading",160);
  if(JSON.stringify(out).length>8192)
   throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections"});
  return {kind:sec.kind as Section["kind"],order:Number(sec.order),fields:out};
 });
 if(new Set(sections.map(s=>s.kind+":"+s.order)).size!==sections.length)
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections"});
 if(sections.filter(s=>s.kind==="HERO").length>6)
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"heroSlides"});
 if(!sections.some(s=>s.kind==="HERO")&&kind==="HOME")
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections"});
 if(!Array.isArray(v.assets??[])||(v.assets as unknown[]).length>30)
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"assets"});
 const navigation=kind==="HOME"?(()=>{
  const candidate=v.navigation??{loginDesired:true,memberJoinDesired:false,volunteerJoinDesired:false};
  const n=input(candidate,["loginDesired","memberJoinDesired","volunteerJoinDesired"]);
  if(typeof n.loginDesired!=="boolean"||typeof n.memberJoinDesired!=="boolean"||
     typeof n.volunteerJoinDesired!=="boolean")
   throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"navigation"});
  return {loginDesired:n.loginDesired,memberJoinDesired:n.memberJoinDesired,
   volunteerJoinDesired:n.volunteerJoinDesired};
 })():null;
 if(kind!=="HOME"&&v.navigation!==undefined)
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"navigation"});
 const assets=(v.assets as unknown[]|undefined??[]).map((raw,i)=>{
  const a=input(raw,["fileRef","version","role","altText","order"]);
  if(typeof a.role!=="string"||!assetRoles.has(a.role)||
   !Number.isSafeInteger(a.version)||Number(a.version)<1||
   !Number.isSafeInteger(a.order)||Number(a.order)<0||Number(a.order)>100)
   throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"assets["+i+"]"});
  return {fileRef:uuid(a.fileRef,"fileRef"),version:Number(a.version),
   role:a.role as Placement["role"],altText:text(a.altText,"altText",300,3),
   order:Number(a.order)};
 });
 if(new Set(assets.map(a=>a.role+":"+a.order)).size!==assets.length)
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"assets"});
 // Every image must point to an authored section, card or person. Otherwise
 // authorized but unused media could be exposed in the public page payload.
 for(let i=0;i<assets.length;i++){
  const a=assets[i];
  if(!placementFits(sections,a))throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"assets["+i+"].role"});
 }
 if(kind!=="HOME"&&kind!=="ABOUT")validateExtendedPage(kind,sections,assets);
 return {kind,slug,title,seoTitle,seoDescription,canonicalPath,sections,assets,navigation};
}
type Page={id:string;kind:string;slug:string;version:string;created_by:string;
 draft_revision_no:number;archived_at:Date|null};
type Revision={id:string;revision_no:number;status:string;content_digest:string;
 approval_case_ref:string|null;title:string;seo_title:string;seo_description:string;
 seo_canonical_path:string;created_by:string};
@Injectable()
export class CmsEditorialService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly approvals:CmsPublicationApprovalService,
  private readonly media:CmsDraftMediaService){}
 private async withTx<T>(cb:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");const result=await cb(tx);await tx.query("COMMIT");return result;}
  catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async row(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,lock=false){
  const result=await tx.query<Page>(
   "SELECT * FROM cms_page WHERE id=$1 AND foundation_root_id=$2 AND archived_at IS NULL "+
   (lock?"FOR UPDATE":"FOR SHARE"),[uuid(ref,"pageRef"),actor.realmId]);
  const p=result.rows[0];if(!p)throw new NotFoundException({code:"CMS_NOT_FOUND"});
  return p;
 }
 private async revision(tx:PoolClient,actor:VerifiedFoundationActor,p:Page){
  const result=await tx.query<Revision>(
   "SELECT * FROM cms_page_revision WHERE page_id=$1 AND foundation_root_id=$2 "+
   "AND revision_no=$3 FOR SHARE",[p.id,actor.realmId,p.draft_revision_no]);
  const v=result.rows[0];if(!v)throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
  return v;
 }
 async list(bearer:string){
  const a=await this.sessions.requireAction(bearer,"cms.content.view");
  const result=await this.db.query<{pageRef:string;kind:string;slug:string;title:string;
   version:string;draftStatus:string;publicStatus:string|null}>(
   'SELECT p.id AS "pageRef",p.kind,p.slug,v.title,p.version,'+
   'v.status AS "draftStatus",pub.state AS "publicStatus" '+
   'FROM cms_page p JOIN cms_page_revision v ON v.page_id=p.id '+
   'AND v.foundation_root_id=p.foundation_root_id '+
   'AND v.revision_no=p.draft_revision_no '+
   'LEFT JOIN cms_page_effective e ON e.page_id=p.id '+
   'AND e.foundation_root_id=p.foundation_root_id '+
   'LEFT JOIN cms_publication pub ON pub.id=e.publication_id '+
   "WHERE p.foundation_root_id=$1 AND p.archived_at IS NULL "+
   "ORDER BY p.created_at DESC,p.id DESC LIMIT 100",[a.realmId]);
  return {pages:result.rows};
 }
 async detail(bearer:string,ref:string){
  const a=await this.sessions.requireAction(bearer,"cms.content.view");
  return this.withTx(async tx=>{
   const page=await this.row(tx,a,ref);
   const rev=await this.revision(tx,a,page);
   const [sections,assets,published,navigation,scheduled]=await Promise.all([
    tx.query<{section_kind:string;order_no:number;structured_fields:Record<string,unknown>}>(
     "SELECT section_kind,order_no,structured_fields FROM cms_section_revision "+
     "WHERE foundation_root_id=$1 AND page_revision_id=$2 ORDER BY order_no,id",
     [a.realmId,rev.id]),
    tx.query<{cg19_file_ref:string;cg19_validated_version:number;role:string;
     alt_text:string;sort_order:number}>(
     "SELECT cg19_file_ref,cg19_validated_version,role,alt_text,sort_order "+
     "FROM cms_asset_placement WHERE foundation_root_id=$1 AND page_revision_id=$2 "+
     "ORDER BY sort_order,id",[a.realmId,rev.id]),
    tx.query<{state:string;publication_id:string}>(
     "SELECT pub.state,pub.id AS publication_id FROM cms_page_effective e "+
     "JOIN cms_publication pub ON pub.id=e.publication_id "+
     "AND pub.foundation_root_id=e.foundation_root_id "+
     "WHERE e.foundation_root_id=$1 AND e.page_id=$2",
     [a.realmId,page.id]),
    tx.query<{login_desired:boolean;member_join_desired:boolean;volunteer_join_desired:boolean}>(
     "SELECT login_desired,member_join_desired,volunteer_join_desired FROM cms_navigation_revision "+
     "WHERE foundation_root_id=$1 AND home_revision_id=$2",
     [a.realmId,rev.id]),
    tx.query<{effective_at:Date}>(
     "SELECT effective_at FROM cms_publication WHERE "+
     "foundation_root_id=$1 AND page_id=$2 AND state='SCHEDULED' "+
     "ORDER BY effective_at DESC,id DESC LIMIT 1",
     [a.realmId,page.id])
   ]);
   return {pageRef:page.id,kind:page.kind,slug:page.slug,version:Number(page.version),
    revisionRef:rev.id,revisionNo:rev.revision_no,status:rev.status,
    approvalCaseRef:rev.approval_case_ref,title:rev.title,
    seoTitle:rev.seo_title,seoDescription:rev.seo_description,
    canonicalPath:rev.seo_canonical_path,
    sections:sections.rows.map(x=>({kind:x.section_kind,order:x.order_no,fields:x.structured_fields})),
    assets:assets.rows.map(x=>({fileRef:x.cg19_file_ref,
     version:x.cg19_validated_version,role:x.role,altText:x.alt_text,order:x.sort_order})),
    navigation:page.kind==="HOME"?{loginDesired:navigation.rows[0]?.login_desired??true,
     memberJoinDesired:navigation.rows[0]?.member_join_desired??false,
     volunteerJoinDesired:navigation.rows[0]?.volunteer_join_desired??false}:null,
    scheduledAt:scheduled.rows[0]?.effective_at?.toISOString()??null,
    publicationStatus:published.rows[0]?.state??"NOT_PUBLISHED"};
  });
 }
 private async putSections(tx:PoolClient,actor:VerifiedFoundationActor,rev:string,
  value:Content){
  await tx.query("DELETE FROM cms_asset_placement WHERE foundation_root_id=$1 "+
   "AND page_revision_id=$2",[actor.realmId,rev]);
  await tx.query("DELETE FROM cms_section_revision WHERE foundation_root_id=$1 "+
   "AND page_revision_id=$2",[actor.realmId,rev]);
  for(const sec of value.sections){
   await tx.query("INSERT INTO cms_section_revision(foundation_root_id,page_revision_id,"+
    "section_kind,order_no,structured_fields) VALUES($1,$2,$3,$4,$5::jsonb)",
    [actor.realmId,rev,sec.kind,sec.order,JSON.stringify(sec.fields)]);
  }
  for(const asset of value.assets){
   const proof=await this.media.validatePlacement(tx,actor,rev,asset.fileRef,asset.version);
   if(!placementMimeAllowed(asset,value.sections,proof.mime))
    throw new BadRequestException({code:"CMS_MEDIA_INVALID",field:"assets"});
   await tx.query("INSERT INTO cms_asset_placement(foundation_root_id,page_revision_id,"+
    "page_id,cg19_file_ref,cg19_validated_version,role,alt_text,sort_order,"+
    "public_rights_status) SELECT $1,$2,v.page_id,$3,$4,$5,$6,$7,'VALIDATED' "+
    "FROM cms_page_revision v WHERE v.id=$2 AND v.foundation_root_id=$1",
    [actor.realmId,rev,asset.fileRef,asset.version,
     asset.role,asset.altText,asset.order]);
  }
 }
 private async saveNavigation(tx:PoolClient,actor:VerifiedFoundationActor,
  revisionRef:string,digest:string,nav:NavDesired){
  const existing=await tx.query("SELECT id FROM cms_navigation_revision WHERE "+
   "foundation_root_id=$1 AND home_revision_id=$2 FOR UPDATE",
   [actor.realmId,revisionRef]);
  if(existing.rows[0]){
   const updated=await tx.query(
    "UPDATE cms_navigation_revision SET login_desired=$3,member_join_desired=$4,"+
    "volunteer_join_desired=$5,source_digest=$6 "+
    "WHERE foundation_root_id=$1 AND home_revision_id=$2 AND status='DRAFT' RETURNING id",
    [actor.realmId,revisionRef,nav.loginDesired,nav.memberJoinDesired,
     nav.volunteerJoinDesired,digest]);
   if(!updated.rowCount)throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
  }else{
   await tx.query("SELECT id FROM access_realm WHERE id=$1 FOR UPDATE",[actor.realmId]);
   const seq=await tx.query<{revision_no:number}>(
    "SELECT COALESCE(MAX(revision_no),0)+1 AS revision_no "+
    "FROM cms_navigation_revision WHERE foundation_root_id=$1",[actor.realmId]);
   await tx.query("INSERT INTO cms_navigation_revision(foundation_root_id,"+
    "revision_no,login_desired,member_join_desired,volunteer_join_desired,"+
    "source_digest,status,created_by,home_revision_id) "+
    "VALUES($1,$2,$3,$4,$5,$6,'DRAFT',$7,$8)",
    [actor.realmId,seq.rows[0].revision_no,nav.loginDesired,
     nav.memberJoinDesired,nav.volunteerJoinDesired,digest,actor.accountId,revisionRef]);
  }
 }
 async create(bearer:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"cms.content.manage");
  const v=input(raw,["content","requestKey"]);
  const commandKey=uuid(v.requestKey,"requestKey"),content=parseContent(v.content);
  const digest=sha(content);
  return this.withTx(async tx=>{
   await this.identity.assertCurrent(tx,actor,"cms.content.manage");
   // The nonexistent slug row cannot be FOR UPDATE locked. Serialize the
   // rare create per Foundation so duplicates return an actionable 409, not SQL.
   await tx.query(
    "SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
    [actor.realmId]);
   const replay=await tx.query<{page_or_nav_ref:string;redacted_metadata:Record<string,unknown>;
    actor_ref:string}>(
    "SELECT page_or_nav_ref,redacted_metadata,actor_ref FROM cms_change_audit "+
    "WHERE foundation_root_id=$1 AND event_key=$2 FOR SHARE",
    [actor.realmId,commandKey]);
   if(replay.rows[0]){
    if(replay.rows[0].actor_ref!==actor.accountId||
      replay.rows[0].redacted_metadata.digest!==digest)
     throw new ConflictException({code:"CMS_REPLAY_CONFLICT"});
    return {confirmed:true,pageRef:replay.rows[0].page_or_nav_ref,replayed:true};
   }
   const found=await tx.query("SELECT id FROM cms_page "+
    "WHERE foundation_root_id=$1 AND slug=$2 FOR UPDATE",
    [actor.realmId,content.slug]);
   if(found.rowCount)throw new ConflictException({code:"CMS_PAGE_EXISTS"});
   const page=await tx.query<{id:string}>(
    "INSERT INTO cms_page(foundation_root_id,slug,kind,draft_revision_no,created_by) "+
    "VALUES($1,$2,$3,1,$4) RETURNING id",
    [actor.realmId,content.slug,content.kind,actor.accountId]);
   const rev=await tx.query<{id:string}>(
    "INSERT INTO cms_page_revision(foundation_root_id,page_id,revision_no,title,"+
    "seo_title,seo_description,seo_canonical_path,content_digest,created_by) "+
    "VALUES($1,$2,1,$3,$4,$5,$6,$7,$8) RETURNING id",
    [actor.realmId,page.rows[0].id,content.title,content.seoTitle,
     content.seoDescription,content.canonicalPath,digest,actor.accountId]);
   await this.putSections(tx,actor,rev.rows[0].id,content);
   if(content.navigation)await this.saveNavigation(tx,actor,rev.rows[0].id,digest,content.navigation);
   await tx.query("INSERT INTO cms_change_audit(foundation_root_id,page_or_nav_ref,event_key,"+
    "actor_ref,action,revision_ref,redacted_metadata) "+
    "VALUES($1,$2,$3,$4,'CREATE',$5,$6::jsonb)",
    [actor.realmId,page.rows[0].id,commandKey,actor.accountId,rev.rows[0].id,
     JSON.stringify({digest})]);
   return {confirmed:true,pageRef:page.rows[0].id,revisionRef:rev.rows[0].id,
    status:"DRAFT",replayed:false};
  });
 }
 async save(bearer:string,pageRef:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"cms.content.manage");
  const v=input(raw,["content","expectedVersion","requestKey"]);
  const key=uuid(v.requestKey,"requestKey"),value=parseContent(v.content);
  const expected=Number(v.expectedVersion);
  if(!Number.isSafeInteger(v.expectedVersion)||expected<1)
   throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"expectedVersion"});
  const digest=sha(value);
  return this.withTx(async tx=>{
   await this.identity.assertCurrent(tx,actor,"cms.content.manage");
   const prior=await tx.query<{page_or_nav_ref:string;actor_ref:string;
    redacted_metadata:Record<string,unknown>}>(
    "SELECT page_or_nav_ref,actor_ref,redacted_metadata FROM cms_change_audit "+
    "WHERE foundation_root_id=$1 AND event_key=$2 FOR SHARE",
    [actor.realmId,key]);
   if(prior.rows[0]){
    if(prior.rows[0].page_or_nav_ref!==pageRef||
      prior.rows[0].actor_ref!==actor.accountId||
      prior.rows[0].redacted_metadata.digest!==digest)
     throw new ConflictException({code:"CMS_REPLAY_CONFLICT"});
    return {confirmed:true,status:"DRAFT_SAVED",replayed:true};
   }
   const page=await this.row(tx,actor,pageRef,true);
   if(page.slug!==value.slug||page.kind!==value.kind||Number(page.version)!==expected)
    throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   let current=await this.revision(tx,actor,page),revisionRef=current.id,
    revisionNo=page.draft_revision_no;
   if(current.status!=="DRAFT"){
    revisionNo++;
    const rev=await tx.query<{id:string}>(
     "INSERT INTO cms_page_revision(foundation_root_id,page_id,revision_no,title,"+
     "seo_title,seo_description,seo_canonical_path,content_digest,created_by) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
     [actor.realmId,page.id,revisionNo,value.title,value.seoTitle,
      value.seoDescription,value.canonicalPath,digest,actor.accountId]);
    revisionRef=rev.rows[0].id;
   }else{
    await tx.query("UPDATE cms_page_revision SET title=$3,seo_title=$4,"+
     "seo_description=$5,seo_canonical_path=$6,content_digest=$7 "+
     "WHERE id=$1 AND foundation_root_id=$2 AND status='DRAFT'",
     [current.id,actor.realmId,value.title,value.seoTitle,value.seoDescription,
      value.canonicalPath,digest]);
   }
   await this.putSections(tx,actor,revisionRef,value);
   if(value.navigation)await this.saveNavigation(tx,actor,revisionRef,digest,value.navigation);
   await tx.query("UPDATE cms_page SET version=version+1,draft_revision_no=$3 "+
    "WHERE id=$1 AND foundation_root_id=$2",
    [page.id,actor.realmId,revisionNo]);
   await tx.query("INSERT INTO cms_change_audit(foundation_root_id,page_or_nav_ref,"+
    "event_key,actor_ref,action,revision_ref,redacted_metadata) "+
    "VALUES($1,$2,$3,$4,'EDIT',$5,$6::jsonb)",
    [actor.realmId,page.id,key,actor.accountId,revisionRef,JSON.stringify({digest})]);
   return {confirmed:true,status:"DRAFT_SAVED",pageRef:page.id,
    revisionRef,version:expected+1,replayed:false};
  });
 }
 async submit(bearer:string,pageRef:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"cms.content.manage");
  const v=input(raw,["requestKey","expectedVersion"]),key=uuid(v.requestKey,"requestKey");
  if(!Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<1)
   throw new BadRequestException({code:"CMS_INPUT_INVALID"});
  return this.withTx(async tx=>{
   await this.identity.assertCurrent(tx,actor,"cms.content.manage");
   const previous=await tx.query<{actor_ref:string;page_or_nav_ref:string;
    action:string;revision_ref:string}>(
    "SELECT actor_ref,page_or_nav_ref,action,revision_ref "+
    "FROM cms_change_audit WHERE foundation_root_id=$1 AND event_key=$2 FOR SHARE",
    [actor.realmId,key]);
   if(previous.rows[0]){
    const x=previous.rows[0];
    if(x.actor_ref!==actor.accountId||x.page_or_nav_ref!==pageRef||
       x.action!=="SUBMIT")throw new ConflictException({code:"CMS_REPLAY_CONFLICT"});
    const accepted=await tx.query<{caseRef:string;caseNumber:string;version:string}>(
     'SELECT c.id AS "caseRef",c.case_number AS "caseNumber",p.version FROM '+
     'cms_page_revision v JOIN cms_page p ON p.id=v.page_id '+
     'AND p.foundation_root_id=v.foundation_root_id '+
     'JOIN cg03_case c ON c.id=v.approval_case_ref AND c.realm_id=v.foundation_root_id '+
     'WHERE v.foundation_root_id=$1 AND v.id=$2 AND p.id=$3',
     [actor.realmId,x.revision_ref,pageRef]);
    if(!accepted.rows[0])throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
    return {confirmed:true,status:"AWAITING_APPROVAL",
     caseRef:accepted.rows[0].caseRef,caseNumber:accepted.rows[0].caseNumber,
     version:Number(accepted.rows[0].version),replayed:true};
   }
   const page=await this.row(tx,actor,pageRef,true),rev=await this.revision(tx,actor,page);
   if(Number(page.version)!==v.expectedVersion||rev.status!=="DRAFT")
    throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   const assets=await tx.query<{file_ref:string;version:number;role:string;sort_order:number}>(
    "SELECT cg19_file_ref AS file_ref,cg19_validated_version AS version,role,sort_order "+
    "FROM cms_asset_placement WHERE foundation_root_id=$1 AND page_revision_id=$2",
    [actor.realmId,rev.id]);
   if(page.kind==="HOME"){
    const slides=await tx.query<{order_no:number}>(
     "SELECT order_no FROM cms_section_revision "+
     "WHERE foundation_root_id=$1 AND page_revision_id=$2 AND section_kind='HERO' "+
     "AND structured_fields->>'visible' IS DISTINCT FROM 'false' "+
     "ORDER BY order_no",[actor.realmId,rev.id]);
    if(!slides.rows.length||slides.rows.some(slide=>!assets.rows.some(asset=>
      asset.role==="HERO"&&asset.sort_order===slide.order_no)))
     throw new BadRequestException({code:"CMS_HERO_IMAGE_REQUIRED",field:"heroImage"});
   }
   if(page.kind!=="HOME"&&page.kind!=="ABOUT"){
    const owned=await tx.query<{section_kind:string;order_no:number;
     structured_fields:Record<string,unknown>}>(
     "SELECT section_kind,order_no,structured_fields FROM cms_section_revision "+
     "WHERE foundation_root_id=$1 AND page_revision_id=$2 ORDER BY order_no",
     [actor.realmId,rev.id]);
    validateExtendedPage(page.kind,owned.rows.map(row=>({
     kind:row.section_kind,order:row.order_no,fields:row.structured_fields})),
     assets.rows.map(a=>({role:a.role,order:a.sort_order})),true);
   }
   if(!(await complianceEligible(tx,actor.realmId,rev.id)))
    throw new ConflictException({code:"CMS_COMPLIANCE_EVIDENCE_EXPIRED"});
   for(const asset of assets.rows)
    await this.media.validatePlacement(tx,actor,rev.id,asset.file_ref,asset.version);
   const original=await this.approvals.createCase(tx,actor,{
    pageRef:page.id,revisionRef:rev.id,revisionNo:rev.revision_no,
    digest:rev.content_digest,requestKey:key});
   if(page.kind==="HOME"){
    const nav=await tx.query(
     "UPDATE cms_navigation_revision SET status='SUBMITTED' "+
     "WHERE foundation_root_id=$1 AND home_revision_id=$2 "+
     "AND source_digest=$3 AND status='DRAFT' RETURNING id",
     [actor.realmId,rev.id,rev.content_digest]);
    if(!nav.rowCount)throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   }
   await tx.query("UPDATE cms_page_revision SET status='SUBMITTED',"+
    "submitted_at=now(),approval_case_ref=$3,approval_source_revision=$4 "+
    "WHERE id=$1 AND foundation_root_id=$2 AND status='DRAFT'",
    [rev.id,actor.realmId,original.caseRef,rev.revision_no]);
   await tx.query("UPDATE cms_page SET version=version+1 "+
    "WHERE id=$1 AND foundation_root_id=$2",[page.id,actor.realmId]);
   await tx.query("INSERT INTO cms_change_audit(foundation_root_id,page_or_nav_ref,"+
    "event_key,actor_ref,action,revision_ref) "+
    "VALUES($1,$2,$3,$4,'SUBMIT',$5)",
    [actor.realmId,page.id,key,actor.accountId,rev.id]);
   return {confirmed:true,status:"AWAITING_APPROVAL",caseRef:original.caseRef,
    caseNumber:original.caseNumber,version:Number(page.version)+1};
  });
 }
 async publish(bearer:string,pageRef:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"cms.content.publish");
  const v=input(raw,["expectedVersion","requestKey","caseRef","publishAt"]);
  const key=uuid(v.requestKey,"requestKey"),caseRef=uuid(v.caseRef,"caseRef");
  let future:Date|null=null;
  if(v.publishAt!==undefined&&v.publishAt!==null&&v.publishAt!==""){
   if(typeof v.publishAt!=="string"||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v.publishAt))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"publishAt"});
   const due=new Date(v.publishAt);
   const diff=due.getTime()-Date.now();
   if(!Number.isFinite(diff)||diff<60000||diff>365*86400000)
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"publishAt"});
   future=due;
  }
  if(!Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<1)
   throw new BadRequestException({code:"CMS_INPUT_INVALID"});
  return this.withTx(async tx=>{
   await this.identity.assertCurrent(tx,actor,"cms.content.publish");
   const page=await this.row(tx,actor,pageRef,true);
   const old=await tx.query<{id:string;source_content_digest:string;state:string}>(
    "SELECT id,source_content_digest,state FROM cms_publication WHERE "+
    "foundation_root_id=$1 AND page_id=$2 AND publication_key=$3 FOR SHARE",
    [actor.realmId,page.id,key]);
   if(old.rows[0]){
    const rev=await tx.query<Revision>(
     "SELECT * FROM cms_page_revision WHERE id=(SELECT page_revision_id "+
     "FROM cms_publication WHERE id=$1) AND foundation_root_id=$2",
     [old.rows[0].id,actor.realmId]);
    if(rev.rows[0]?.approval_case_ref!==caseRef||
       rev.rows[0]?.content_digest!==old.rows[0].source_content_digest)
     throw new ConflictException({code:"CMS_REPLAY_CONFLICT"});
    return {confirmed:true,status:old.rows[0].state==="EFFECTIVE"?
     "PUBLISHED":old.rows[0].state==="SCHEDULED"?"SCHEDULED":
     old.rows[0].state==="WITHDRAWN"?"HIDDEN":"SUPERSEDED",replayed:true};
   }
   if(Number(page.version)!==v.expectedVersion)
    throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   const rev=await this.revision(tx,actor,page);
   if(rev.status!=="SUBMITTED"||rev.approval_case_ref!==caseRef)
    throw new ConflictException({code:"CMS_REVIEW_UNAVAILABLE"});
   if(!(await complianceEligible(tx,actor.realmId,rev.id)))
    throw new ConflictException({code:"CMS_COMPLIANCE_EVIDENCE_EXPIRED"});
   const final=await this.approvals.approved(tx,actor,{
    caseRef,pageRef:page.id,revisionRef:rev.id,
    revisionNo:rev.revision_no,digest:rev.content_digest});
   // One independent decision can authorize one publication. The page row
   // lock serializes competing publishers so repeated DIFFERENT request keys
   // yield a safe 409 rather than a raw database unique-index failure.
   const consumed=await tx.query(
    "SELECT id FROM cms_publication WHERE foundation_root_id=$1 "+
    "AND page_id=$2 AND cg03_final_decision_ref=$3 FOR SHARE",
    [actor.realmId,page.id,final.decisionRef]);
   if(consumed.rowCount)throw new ConflictException({code:"CMS_REPLAY_CONFLICT"});
   const assets=await tx.query<{cg19_file_ref:string;cg19_validated_version:number}>(
    "SELECT cg19_file_ref,cg19_validated_version FROM cms_asset_placement "+
    "WHERE foundation_root_id=$1 AND page_revision_id=$2 FOR SHARE",
    [actor.realmId,rev.id]);
   for(const asset of assets.rows)
    await this.media.validatePlacement(tx,actor,rev.id,
     asset.cg19_file_ref,asset.cg19_validated_version);
   if(future){
    const publication=await tx.query<{id:string}>(
     "INSERT INTO cms_publication(foundation_root_id,page_id,page_revision_id,"+
     "cg03_final_decision_ref,source_content_digest,publication_key,"+
     "state,effective_at,created_by) "+
     "VALUES($1,$2,$3,$4,$5,$6,'SCHEDULED',$7,$8) RETURNING id",
     [actor.realmId,page.id,rev.id,final.decisionRef,rev.content_digest,
      key,future,actor.accountId]);
    await tx.query("INSERT INTO cms_publication_due("+
     "foundation_root_id,page_publication_ref,due_at) VALUES($1,$2,$3)",
     [actor.realmId,publication.rows[0].id,future]);
    await tx.query("UPDATE cms_page SET version=version+1 "+
     "WHERE id=$1 AND foundation_root_id=$2",[page.id,actor.realmId]);
    await tx.query("INSERT INTO cms_change_audit(foundation_root_id,page_or_nav_ref,"+
     "event_key,actor_ref,action,revision_ref) "+
     "VALUES($1,$2,$3,$4,'SCHEDULE',$5)",
     [actor.realmId,page.id,key,actor.accountId,rev.id]);
    return {confirmed:true,status:"SCHEDULED",effectiveAt:future.toISOString(),replayed:false};
   }
   const active=await tx.query<{publication_id:string}>(
    "SELECT publication_id FROM cms_page_effective WHERE "+
    "foundation_root_id=$1 AND page_id=$2 FOR UPDATE",[actor.realmId,page.id]);
   if(active.rows[0])await tx.query(
    "UPDATE cms_publication SET state='SUPERSEDED' WHERE "+
    "id=$1 AND foundation_root_id=$2 AND state='EFFECTIVE'",
    [active.rows[0].publication_id,actor.realmId]);
   const result=await tx.query<{id:string}>(
    "INSERT INTO cms_publication(foundation_root_id,page_id,page_revision_id,"+
    "cg03_final_decision_ref,source_content_digest,publication_key,"+
    "state,effective_at,created_by) "+
    "VALUES($1,$2,$3,$4,$5,$6,'EFFECTIVE',now(),$7) RETURNING id",
    [actor.realmId,page.id,rev.id,final.decisionRef,rev.content_digest,
     key,actor.accountId]);
   await tx.query("INSERT INTO cms_page_effective(foundation_root_id,page_id,"+
    "publication_id) VALUES($1,$2,$3) ON CONFLICT(foundation_root_id,page_id) "+
    "DO UPDATE SET publication_id=EXCLUDED.publication_id,"+
    "version=cms_page_effective.version+1,changed_at=now()",
    [actor.realmId,page.id,result.rows[0].id]);
   await tx.query("UPDATE cms_page SET version=version+1 "+
    "WHERE id=$1 AND foundation_root_id=$2",[page.id,actor.realmId]);
   if(page.kind==="HOME"){
    const nav=await tx.query<{id:string}>(
     "UPDATE cms_navigation_revision SET "+
     "status='APPROVED',cg03_decision_ref=$3,effective_at=now() "+
     "WHERE foundation_root_id=$1 AND home_revision_id=$2 "+
     "AND source_digest=$4 AND status='SUBMITTED' RETURNING id",
     [actor.realmId,rev.id,final.decisionRef,rev.content_digest]);
    if(!nav.rows[0])throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
    await tx.query("INSERT INTO cms_navigation_effective(foundation_root_id,revision_id) "+
     "VALUES($1,$2) ON CONFLICT(foundation_root_id) DO UPDATE "+
     "SET revision_id=EXCLUDED.revision_id,"+
     "version=cms_navigation_effective.version+1,changed_at=now()",
     [actor.realmId,nav.rows[0].id]);
   }
   await this.approvals.finish(tx,actor,caseRef);
   await tx.query("INSERT INTO cms_change_audit(foundation_root_id,page_or_nav_ref,"+
    "event_key,actor_ref,action,revision_ref) "+
    "VALUES($1,$2,$3,$4,'PUBLISH',$5)",
    [actor.realmId,page.id,key,actor.accountId,rev.id]);
   return {confirmed:true,status:"PUBLISHED",replayed:false};
  });
 }
 async withdraw(bearer:string,pageRef:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"cms.content.publish");
  const v=input(raw,["requestKey","expectedVersion","reason"]);
  const key=uuid(v.requestKey,"requestKey"),reason=text(v.reason,"reason",300,8);
  if(!Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<1)
   throw new BadRequestException({code:"CMS_INPUT_INVALID"});
  return this.withTx(async tx=>{
   await this.identity.assertCurrent(tx,actor,"cms.content.publish");
   const page=await this.row(tx,actor,pageRef,true);
   const previous=await tx.query<{id:string}>(
    "SELECT id FROM cms_change_audit WHERE foundation_root_id=$1 AND "+
    "page_or_nav_ref=$2 AND event_key=$3 AND action='WITHDRAW'",
    [actor.realmId,page.id,key]);
   if(previous.rows[0])return {confirmed:true,status:"HIDDEN",replayed:true};
   if(Number(page.version)!==v.expectedVersion)
    throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   const selected=await tx.query<{publication_id:string}>(
    "SELECT publication_id FROM cms_page_effective WHERE "+
    "foundation_root_id=$1 AND page_id=$2 FOR UPDATE",[actor.realmId,page.id]);
   const pending=await tx.query<{id:string}>(
    "SELECT id FROM cms_publication WHERE foundation_root_id=$1 "+
    "AND page_id=$2 AND state='SCHEDULED' FOR UPDATE",
    [actor.realmId,page.id]);
   if(!selected.rows[0]&&!pending.rows.length)
    throw new ConflictException({code:"CMS_NOT_PUBLISHED"});
   if(pending.rows.length){
    await tx.query("UPDATE cms_publication_due SET status='CANCELLED' "+
     "WHERE foundation_root_id=$1 AND page_publication_ref=ANY($2::uuid[]) "+
     "AND status='READY'",
     [actor.realmId,pending.rows.map(x=>x.id)]);
    await tx.query("UPDATE cms_publication SET state='WITHDRAWN',revoked_at=now() "+
     "WHERE foundation_root_id=$1 AND id=ANY($2::uuid[]) AND state='SCHEDULED'",
     [actor.realmId,pending.rows.map(x=>x.id)]);
   }
   if(selected.rows[0])await tx.query("DELETE FROM cms_page_effective WHERE foundation_root_id=$1 "+
    "AND page_id=$2",[actor.realmId,page.id]);
   if(selected.rows[0])await tx.query("UPDATE cms_publication SET state='WITHDRAWN',revoked_at=now() "+
    "WHERE id=$1 AND foundation_root_id=$2 AND state='EFFECTIVE'",
    [selected.rows[0].publication_id,actor.realmId]);
   await tx.query("UPDATE cms_page SET version=version+1 "+
    "WHERE id=$1 AND foundation_root_id=$2",[page.id,actor.realmId]);
   await tx.query("INSERT INTO cms_change_audit(foundation_root_id,page_or_nav_ref,"+
    "event_key,actor_ref,action,redacted_metadata) "+
    "VALUES($1,$2,$3,$4,'WITHDRAW',$5::jsonb)",
    [actor.realmId,page.id,key,actor.accountId,JSON.stringify({reason})]);
   return {confirmed:true,status:"HIDDEN",replayed:false};
  });
 }
 /** Only current effective, original-reviewed article source; bounded cursor,
  * no CMS draft, patient, notice recipients or CG19 object credentials.
  */
 async publicArticles(categoryInput?:string,cursorInput?:string){
  const category=categoryInput?.trim()??"";
  const cursor=cursorInput?.trim()??"";
  if(category.length>80||!/^[\p{L}0-9 &-]*$/u.test(category)||
    (cursor&&!/^[a-z0-9][a-z0-9-]{0,69}$/.test(cursor)))
   throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"category"});
  const rows=await this.db.query<{slug:string;title:string;category:string;
   excerpt:string;as_of_date:string}>(
   "SELECT p.slug,v.title,body.structured_fields->>'category' AS category, "+
   "body.structured_fields->>'excerpt' AS excerpt, "+
   "body.structured_fields->>'asOfDate' AS as_of_date "+
   "FROM cms_page p JOIN cms_page_effective e ON e.page_id=p.id "+
   "AND e.foundation_root_id=p.foundation_root_id "+
   "JOIN cms_publication pub ON pub.id=e.publication_id "+
   "AND pub.foundation_root_id=e.foundation_root_id "+
   "JOIN cms_page_revision v ON v.id=pub.page_revision_id "+
   "AND v.foundation_root_id=p.foundation_root_id "+
   "JOIN cms_section_revision body ON body.page_revision_id=v.id "+
   "AND body.foundation_root_id=p.foundation_root_id AND body.section_kind='ARTICLE_BODY' "+
   "JOIN access_realm root ON root.id=p.foundation_root_id "+
   "WHERE root.realm_key='FOUNDATION_ROOT' AND p.kind='ARTICLE' "+
   "AND p.archived_at IS NULL AND pub.state='EFFECTIVE' "+
   "AND pub.effective_at<=now() AND (pub.expires_at IS NULL OR pub.expires_at>now()) "+
   "AND ($1::text='' OR lower(body.structured_fields->>'category')=lower($1)) "+
   "AND ($2::text='' OR p.slug>$2) "+
   "AND NOT EXISTS(SELECT 1 FROM cms_asset_placement a "+
   "LEFT JOIN cg19_cms_media_file f ON f.id=a.cg19_file_ref "+
   "AND f.realm_id=a.foundation_root_id AND f.page_id=a.page_id "+
   "WHERE a.page_revision_id=v.id AND a.foundation_root_id=p.foundation_root_id "+
   "AND (f.id IS NULL OR f.revoked_at IS NOT NULL OR "+
   "f.scan_status<>'CLEAN_VERIFIED' OR f.public_rights_confirmed=false "+
   "OR f.revision<>a.cg19_validated_version)) "+
   "ORDER BY p.slug LIMIT 21",[category,cursor]);
  return {schemaVersion:1,posts:rows.rows.slice(0,20).map(x=>({
   slug:x.slug,title:x.title,category:x.category,excerpt:x.excerpt,
   asOfDate:x.as_of_date,path:"/blog/"+x.slug})),
   nextCursor:rows.rows.length>20?rows.rows[19].slug:null};
 }
 async publicNavigation(){
  const response=await this.db.query<{effective_generation:string;login_desired:boolean}>(
   'SELECT n.id AS "effective_generation",n.login_desired '+
   'FROM cms_navigation_effective e JOIN cms_navigation_revision n '+
   'ON n.id=e.revision_id AND n.foundation_root_id=e.foundation_root_id '+
   'JOIN cms_page_revision v ON v.id=n.home_revision_id '+
   'AND v.foundation_root_id=n.foundation_root_id '+
   'JOIN cg03_case c ON c.id=v.approval_case_ref '+
   'AND c.realm_id=v.foundation_root_id AND c.cms_page_revision_id=v.id '+
   'JOIN cg03_case_decision d ON d.id=n.cg03_decision_ref AND d.case_id=c.id '+
   'AND d.realm_id=c.realm_id '+
   'JOIN cms_page_effective active ON active.foundation_root_id=n.foundation_root_id '+
   'JOIN cms_publication publication ON publication.id=active.publication_id '+
   'AND publication.foundation_root_id=active.foundation_root_id '+
   'AND publication.page_revision_id=n.home_revision_id '+
   'JOIN access_realm realm ON realm.id=n.foundation_root_id '+
   "WHERE realm.realm_key='FOUNDATION_ROOT' AND n.status='APPROVED' "+
   "AND publication.state='EFFECTIVE' AND publication.effective_at<=now() "+
   "AND (publication.expires_at IS NULL OR publication.expires_at>now()) "+
   "AND c.status='OWNER_COMPLETED' AND d.action='APPROVE' "+
   'AND d.fresh_password_verified_at IS NOT NULL '+
   'AND n.source_digest=v.content_digest AND n.effective_at<=now() LIMIT 1');
  const x=response.rows[0];
  const routes=await this.db.query<{kind:string;slug:string}>(
   "SELECT p.kind,p.slug FROM cms_page p JOIN cms_page_effective e "+
   "ON e.page_id=p.id AND e.foundation_root_id=p.foundation_root_id "+
   "JOIN cms_publication pub ON pub.id=e.publication_id "+
   "AND pub.foundation_root_id=e.foundation_root_id "+
   "JOIN access_realm r ON r.id=p.foundation_root_id "+
   "WHERE r.realm_key='FOUNDATION_ROOT' AND p.archived_at IS NULL "+
   "AND pub.state='EFFECTIVE' AND pub.effective_at<=now() "+
   "AND (pub.expires_at IS NULL OR pub.expires_at>now()) "+
   "AND NOT EXISTS(SELECT 1 FROM cms_asset_placement a "+
   "LEFT JOIN cg19_cms_media_file f ON f.id=a.cg19_file_ref "+
   "AND f.realm_id=a.foundation_root_id AND f.page_id=a.page_id "+
   "WHERE a.foundation_root_id=p.foundation_root_id "+
   "AND a.page_revision_id=pub.page_revision_id "+
   "AND (f.id IS NULL OR f.revoked_at IS NOT NULL OR "+
   "f.scan_status<>'CLEAN_VERIFIED' OR f.public_rights_confirmed=false "+
   "OR a.cg19_validated_version<>f.revision)) "+
   "AND NOT EXISTS (SELECT 1 FROM cms_section_revision cs "+
   "WHERE cs.foundation_root_id=p.foundation_root_id "+
   "AND cs.page_revision_id=pub.page_revision_id "+
   "AND cs.section_kind='COMPLIANCE_FACTS' "+
   "AND cs.structured_fields->>'verification'='VERIFIED' "+
   "AND cs.structured_fields->>'validUntil'<to_char(current_date,'YYYY-MM-DD')) "+
   "ORDER BY p.slug LIMIT 100");
  const publishedRoutes=routes.rows.map(p=>({kind:p.kind,slug:p.slug,
   path:p.kind==="ARTICLE"?"/blog/"+p.slug:
    p.kind==="HOME"?"/":p.kind==="COMPLIANCE"?"/80g":"/"+p.slug}));
  return {schemaVersion:1,effectiveGeneration:x?.effective_generation??null,
   publishedRoutes,
   login:{visible:x?.login_desired===true,label:"Staff login",
    path:x?.login_desired?"/admin/login":null},
   memberJoin:{visible:false,label:"Member registration",path:null},
   volunteerJoin:{visible:false,label:"Volunteer registration",path:null}};
 }
 async publicPage(slugInput:string){
  const slug=text(slugInput,"slug",70,1);
  if(!/^[a-z0-9-]+$/.test(slug))throw new NotFoundException();
  const rows=await this.db.query<{id:string;foundation_root_id:string;kind:string;slug:string;title:string;
   seo_title:string;seo_description:string;seo_canonical_path:string;
   publication_id:string;revision_id:string;changed_at:Date}>(
   "SELECT p.id,p.foundation_root_id,p.kind,p.slug,v.title,v.seo_title,v.seo_description,"+
   "v.seo_canonical_path,pub.id AS publication_id,v.id AS revision_id,"+
   "e.changed_at FROM cms_page p JOIN cms_page_effective e "+
   "ON e.foundation_root_id=p.foundation_root_id AND e.page_id=p.id "+
   "JOIN cms_publication pub ON pub.id=e.publication_id "+
   "AND pub.foundation_root_id=e.foundation_root_id "+
   "JOIN cms_page_revision v ON v.id=pub.page_revision_id "+
   "AND v.foundation_root_id=pub.foundation_root_id "+
   "JOIN access_realm realm ON realm.id=p.foundation_root_id "+
   "WHERE realm.realm_key='FOUNDATION_ROOT' AND p.slug=$1 "+
   "AND p.archived_at IS NULL AND pub.state='EFFECTIVE' "+
   "AND pub.effective_at<=now() AND (pub.expires_at IS NULL OR pub.expires_at>now()) "+
   "LIMIT 1",[slug]);
  const x=rows.rows[0];if(!x)throw new NotFoundException({code:"CMS_NOT_PUBLISHED"});
  const [sections,assets]=await Promise.all([
   this.db.query<{section_kind:string;order_no:number;structured_fields:Record<string,unknown>}>(
    "SELECT section_kind,order_no,structured_fields FROM cms_section_revision "+
    "WHERE page_revision_id=$1 ORDER BY order_no,id LIMIT 100",[x.revision_id]),
   this.db.query<{cg19_file_ref:string;role:string;alt_text:string;sort_order:number}>(
    "SELECT a.cg19_file_ref,a.role,a.alt_text,a.sort_order "+
    "FROM cms_asset_placement a JOIN cg19_cms_media_file f "+
    "ON f.id=a.cg19_file_ref AND f.realm_id=a.foundation_root_id "+
    "AND f.page_id=a.page_id "+
    "WHERE a.page_revision_id=$1 AND a.public_rights_status='VALIDATED' "+
    "AND a.cg19_validated_version=f.revision AND f.revoked_at IS NULL "+
    "AND f.scan_status='CLEAN_VERIFIED' AND f.public_rights_confirmed=true "+
    "ORDER BY a.sort_order,a.id LIMIT 30",[x.revision_id])
  ]);
  const exists=await this.db.query("SELECT 1 FROM cms_page_effective e "+
   "JOIN cms_publication pub ON pub.id=e.publication_id "+
   "AND pub.foundation_root_id=e.foundation_root_id "+
   "WHERE pub.id=$1 AND pub.state='EFFECTIVE' AND pub.effective_at<=now() "+
   "AND (pub.expires_at IS NULL OR pub.expires_at>now())",[x.publication_id]);
  if(!exists.rowCount)throw new NotFoundException({code:"CMS_NOT_PUBLISHED"});
  if(!(await complianceEligible(this.db,x.foundation_root_id,x.revision_id)))
   throw new NotFoundException({code:"CMS_NOT_PUBLISHED"});
  // A revoked image can carry private/consent-sensitive context in its
  // surrounding section. Fail the entire snapshot instead of returning
  // textual details with an intentionally missing image reference.
  const inventory=await this.db.query<{count:string}>(
   "SELECT count(*)::text AS count FROM cms_asset_placement "+
   "WHERE foundation_root_id=$1 AND page_revision_id=$2",
   [x.foundation_root_id,x.revision_id]);
  if(Number(inventory.rows[0]?.count??0)!==assets.rows.length)
   throw new NotFoundException({code:"CMS_NOT_PUBLISHED"});
  const authoredSections:Section[]=sections.rows.map(sec=>({
  kind:sec.section_kind as Section["kind"],order:sec.order_no,
  fields:sec.structured_fields}));
 const visibleAssets=assets.rows.filter(asset=>placementFits(authoredSections,
  {role:asset.role,order:asset.sort_order}));
 const hiddenHeroOrders=new Set(sections.rows.filter(sec=>
   sec.section_kind==="HERO"&&sec.structured_fields?.visible===false)
   .map(sec=>sec.order_no));
  return {schemaVersion:1,effectiveGeneration:x.publication_id,
   kind:x.kind,slug:x.slug,title:x.title,seoTitle:x.seo_title,
   seoDescription:x.seo_description,canonicalPath:x.seo_canonical_path,
   lastPublishedAt:x.changed_at.toISOString(),
   sections:sections.rows.filter(v=>v.section_kind!=="HERO"||
     !hiddenHeroOrders.has(v.order_no)).map(v=>({kind:v.section_kind,order:v.order_no,
    fields:v.structured_fields})),
   assets:visibleAssets.filter(v=>!["HERO","MOBILE_HERO"].includes(v.role)||
     !hiddenHeroOrders.has(v.sort_order)).map(v=>({role:v.role,altText:v.alt_text,
    src:"/api/public/content/media/"+v.cg19_file_ref,order:v.sort_order}))};
 }
}
