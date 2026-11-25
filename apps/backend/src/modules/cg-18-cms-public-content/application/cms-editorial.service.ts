import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {CmsPublicationApprovalService} from "../../cg-03-registration-approvals/application/cms-publication-approval.service";
import {CmsDraftMediaService} from "../../cg-19-documents-notifications/application/cms-draft-media.service";
import {CmsPublicNoticeSource} from "../../cg-19-documents-notifications/application/cms-public-notice-source.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {extendedKinds,parseDraftExtendedSection,parseExtendedSection,validateExtendedPage,healthcareEditorialClaimsSafe} from "./cms-extended-sections";
import {eligibleProjectSources,projectTeaserRefs,validateProjectTeaser,projectTeaserRevisionEligible,publicProjectTeaser} from "../../cg-05-projects-field-operations/application/project-public-source";
import {eligibleEventSources,validateEventArticle,eventArticleRevisionEligible,publicEventArticle,EVENT_CURRENT_SQL} from "../../cg-05-projects-field-operations/application/event-public-source";
import {approvedBeneficiaryImpact,beneficiaryImpactFields,beneficiaryImpactSource} from "../../cg-06-beneficiaries-assistance/application/beneficiary-impact-public-source";
import {complianceEligible} from "./cms-compliance-eligibility";
import {eligibleCampaignSources,campaignTeaserRefs,validateCampaignTeaser,publicCampaignSources,onlineDonationReady} from "../../cg-07-campaigns-donations/application/campaign-public-source";
import {HrPublicBioEditorialSource,type HrEditorialPerson} from "../../cg-10-human-resources/application/hr-public-bio-editorial-source";
import {initialEditorialRelease} from "./cms-initial-editorial-release";
import {releaseIllustration,releaseIllustrations,releaseIllustrationBytes,verifyReleaseIllustrations,type ReleaseIllustration} from "./cms-release-illustrations";
import {CsrPartnerPublicSource,type CsrEditorialSelection} from "../../cg-08-csr-funding/application/csr-partner-public-source";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const KINDS=new Set(["HOME","ABOUT","IMPACT","COMPLIANCE","GALLERY","ARTICLE","CONTACT","HEALTHCARE","POLICY","PARTNERS"]);
const POLICY_SLUGS=new Set(["terms-and-conditions","privacy-policy","cookie-policy",
 "disclaimer","refund-and-cancellation","grievance-redressal",
 "copyright-and-intellectual-property"]);
const SECTION=new Set(["HERO","RICH_TEXT","TEAM","CTA","PROJECT_TEASER","CAMPAIGN_TEASER",
 "FEATURE_CARDS","JOIN_CARDS","SITE_FOOTER","IMPACT_GROUP","COMPLIANCE_FACTS",
 "GALLERY_GRID","ARTICLE_BODY","HEALTHCARE_CATEGORIES","CONTACT_INFO","PARTNER_CARDS"]);
const assetRoles=new Set(["HERO","MOBILE_HERO","TEAM","ABOUT","PROMO","FEATURE",
 "GALLERY","ARTICLE","DOCUMENT","IMPACT","CONTACT"]);
const reserved=new Set(["admin","api","login","join","volunteer","auth","internal","_next"]);
const NOTICE_CURRENT_SQL=
 "AND NOT EXISTS(SELECT 1 FROM cms_section_revision ns "+
 "WHERE ns.foundation_root_id=pub.foundation_root_id "+
 "AND ns.page_revision_id=pub.page_revision_id "+
 "AND ns.section_kind='ARTICLE_BODY' "+
 "AND ns.structured_fields ? 'sourceNoticeRef' "+
 "AND (ns.structured_fields->>'publicReleaseConfirmed' IS DISTINCT FROM 'true' "+
 "OR NOT EXISTS (SELECT 1 FROM cg19_notice n "+
 "WHERE n.realm_id=ns.foundation_root_id "+
 "AND n.id::text=ns.structured_fields->>'sourceNoticeRef' "+
 "AND n.audience_kind='ALL_ACTIVE' AND n.approved_by IS NOT NULL "+
 "AND n.approved_at IS NOT NULL AND n.state='ACTIVE' AND n.expires_at>now() "+
 "AND n.title=ns.structured_fields->>'heading' "+
 "AND n.body=ns.structured_fields->>'body'))) ";
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function uuid(v:unknown,field:string){
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException({code:"CMS_INPUT_INVALID",field});
 return v;
}
function text(v:unknown,field:string,max=4000,min=0){
 if(typeof v!=="string"||v.trim().length<min||v.length>max||
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)||
  /<[^>]*>|(?:javascript|data):|on(?:error|click)\s*=/i.test(v))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field});
 return v.trim();
}
function input(v:unknown,keys:string[]){
 if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.keys(v).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CMS_INPUT_INVALID"});
 return v as Record<string,unknown>;
}
export function teamSelections(raw:unknown):HrEditorialPerson[]{
 if(!Array.isArray(raw)||raw.length>15)throw new BadRequestException({code:"CMS_TEAM_SOURCE_NOT_READY",field:"members"});
 const people=raw.map(v=>{
  const x=input(v,["sourceRef","proof","name","designation"]);
  if(typeof x.proof!=="string"||!HASH.test(x.proof))throw new BadRequestException({code:"CMS_TEAM_SOURCE_NOT_READY",field:"members"});
  return {sourceRef:uuid(x.sourceRef,"sourceRef"),proof:x.proof,name:text(x.name,"name",160,1),designation:text(x.designation,"designation",120,1)};
 });
 if(new Set(people.map(p=>p.sourceRef)).size!==people.length)throw new BadRequestException({code:"CMS_TEAM_SOURCE_NOT_READY",field:"members"});
 return people;
}
function path(v:unknown,field:string,kind?:string){
 const x=text(v,field,140,1);
 if(kind==="HEALTHCARE"&&!["/","/about","/contact"].includes(x))throw new BadRequestException({code:"CMS_UNAVAILABLE_ROUTE",field});
 if(!["/","/about","/contact","/our-impact","/ngo-information","/gallery","/videos","/publications","/healthcare","/our-work","/upcoming-projects","/collaboration","/membership","/volunteer","/campaigns"].includes(x))
  throw new BadRequestException({code:"CMS_UNAVAILABLE_ROUTE",field});
 if(!/^\/(?:[a-z0-9-]+\/?)*$/.test(x)||x.startsWith("//")||
  /(^|\/)(admin|api|auth|internal|_next)(\/|$)/.test(x)||
  /^\/(join|book)(\/|$)/.test(x))
  throw new BadRequestException({code:"CMS_UNAVAILABLE_ROUTE",field});
 return x;
}
type Section={kind:"HERO"|"RICH_TEXT"|"TEAM"|"CTA"|"PROJECT_TEASER"|"CAMPAIGN_TEASER"|
 "FEATURE_CARDS"|"JOIN_CARDS"|"SITE_FOOTER"|"IMPACT_GROUP"|
 "COMPLIANCE_FACTS"|"GALLERY_GRID"|"ARTICLE_BODY"|"HEALTHCARE_CATEGORIES"|"CONTACT_INFO"|"PARTNER_CARDS";order:number;
 fields:Record<string,unknown>};
type Placement={fileRef:string;version:number;role:"HERO"|"MOBILE_HERO"|"TEAM"|
 "ABOUT"|"PROMO"|"FEATURE"|"GALLERY"|"ARTICLE"|"DOCUMENT"|"IMPACT"|"CONTACT";
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
  if(a.role==="HERO"||a.role==="MOBILE_HERO")return s.kind==="HERO"&&s.order===a.order&&s.fields.textOnly!==true;
  if(a.role==="ABOUT")return s.kind==="RICH_TEXT"&&s.order===a.order&&s.fields.variant==="SPLIT";
  if(a.role==="PROMO")return s.kind==="CTA"&&s.order===a.order;
  if(a.role==="TEAM")return s.kind==="TEAM"&&
   Array.isArray(s.fields.members)&&a.order<s.fields.members.length;
  if(a.role==="FEATURE")return (s.kind==="FEATURE_CARDS"&&
   Array.isArray(s.fields.cards)&&a.order<s.fields.cards.length)||
   (s.kind==="PARTNER_CARDS"&&Array.isArray(s.fields.partners)&&a.order<s.fields.partners.length)||
   (s.kind==="HEALTHCARE_CATEGORIES"&&Array.isArray(s.fields.categories)&&a.order<s.fields.categories.length);
  if(a.role==="GALLERY")return s.kind==="GALLERY_GRID"&&
   Array.isArray(s.fields.items)&&a.order<s.fields.items.length;
  if(a.role==="ARTICLE")return s.kind==="ARTICLE_BODY"&&a.order===0;
  if(a.role==="IMPACT")return s.kind==="IMPACT_GROUP"&&a.order===s.order;
  if(a.role==="CONTACT")return s.kind==="CONTACT_INFO"&&
   Number.isSafeInteger(a.order)&&a.order>=0&&a.order<3;
  if(a.role==="DOCUMENT")return s.kind==="COMPLIANCE_FACTS"&&
    Array.isArray(s.fields.documents)&&a.order<s.fields.documents.length;
  return false;
 });
}
type NavDesired={loginDesired:boolean;memberJoinDesired:boolean;volunteerJoinDesired:boolean};
type Content={kind:"HOME"|"ABOUT"|"IMPACT"|"COMPLIANCE"|"GALLERY"|"ARTICLE"|
 "CONTACT"|"HEALTHCARE"|"POLICY"|"PARTNERS";slug:string;title:string;seoTitle:string;
 seoDescription:string;canonicalPath:string;sections:Section[];assets:Placement[];navigation:NavDesired|null};
function parseContent(raw:unknown):Content{
 const v=input(raw,["kind","slug","title","seoTitle","seoDescription","canonicalPath",
  "sections","assets","navigation"]);
 if(typeof v.kind!=="string"||!KINDS.has(v.kind))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"kind"});
 const kind=v.kind as Content["kind"],slug=text(v.slug,"slug",70,1).toLowerCase();
 const fixed:Partial<Record<Content["kind"],string>>={HOME:"home",ABOUT:"about",
  IMPACT:"our-impact",COMPLIANCE:"80g",GALLERY:"gallery",CONTACT:"contact",
  HEALTHCARE:"healthcare",PARTNERS:"collaboration"};
 if(!/^[a-z0-9][a-z0-9-]{0,69}$/.test(slug)||reserved.has(slug)||
    (fixed[kind]!==undefined&&slug!==fixed[kind])||
    (kind==="ARTICLE"&&(Object.values(fixed).includes(slug)||POLICY_SLUGS.has(slug)))||
    (kind==="POLICY"&&!POLICY_SLUGS.has(slug)))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"slug"});
 const hasEvent=kind==="ARTICLE"&&Array.isArray(v.sections)&&v.sections.some(s=>s&&typeof s==="object"&&s.kind==="ARTICLE_BODY"&&s.fields&&typeof s.fields==="object"&&typeof s.fields.sourceEventRef==="string");
 const title=text(v.title,"title",180,hasEvent?2:3);
 const seoTitle=text(v.seoTitle??v.title,"seoTitle",180,3);
 const seoDescription=text(v.seoDescription??"","seoDescription",300);
 const expectedPath=kind==="HOME"?"/":kind==="ABOUT"?"/about":
  kind==="COMPLIANCE"?"/ngo-information":kind==="ARTICLE"?"/blog/"+slug:
  kind==="POLICY"?"/policies/"+slug:"/"+slug;
 const canonicalPath=v.canonicalPath??expectedPath;
 if(typeof canonicalPath!=="string"||canonicalPath!==expectedPath||
    !/^\/(?:[a-z0-9-]+\/?)*$/.test(canonicalPath))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"canonicalPath"});
 if(!Array.isArray(v.sections)||v.sections.length<1||v.sections.length>24||
  (kind==="POLICY"&&v.sections.length>12))
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections"});
 const sections=v.sections.map((raw,i)=>{
  const sec=input(raw,["kind","order","fields"]);
  if(typeof sec.kind!=="string"||!SECTION.has(sec.kind)||
    (kind==="POLICY"&&sec.kind!=="RICH_TEXT")||
    !Number.isSafeInteger(sec.order)||Number(sec.order)<0||Number(sec.order)>100)
   throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections["+i+"]"});
  if(extendedKinds.has(String(sec.kind))){
   const parsed=parseDraftExtendedSection(String(sec.kind),sec.fields);
   if(Buffer.byteLength(JSON.stringify(parsed),"utf8")>8192)
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections["+i+"].fields"});
   return {kind:sec.kind as Section["kind"],order:Number(sec.order),fields:parsed};
  }
  const fields=input(sec.fields,sec.kind==="HERO"?
   ["heading","subtitle","description","eyebrow","tags","visible","textOnly",
    "headingFont","headingWeight","headingSize","headingColor","subtitleColor",
    "primaryLabel","primaryPath","secondaryLabel","secondaryPath"]:
   sec.kind==="TEAM"?["heading","members"]:
   sec.kind==="CTA"?["heading","eyebrow","body","label","path"]:
   sec.kind==="FEATURE_CARDS"?["heading","eyebrow","body","cards"]:
   sec.kind==="JOIN_CARDS"?["volunteerTitle","volunteerBody","volunteerBenefits",
    "memberTitle","memberBody","memberBenefits"]:
   sec.kind==="SITE_FOOTER"?["mission","address","email","phone","whatsappNumber","newsletterText"]:
   sec.kind==="RICH_TEXT"?["heading","body","eyebrow","variant","highlights","placement"]:
   sec.kind==="PROJECT_TEASER"||sec.kind==="CAMPAIGN_TEASER"?["heading","sourceRefs"]:["heading"]);
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
   if(fields.textOnly!==undefined&&typeof fields.textOnly!=="boolean")throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"textOnly"});
   if(fields.textOnly===true)out.textOnly=true;
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
   if(fields.primaryPath!==undefined)out.primaryPath=path(fields.primaryPath,"primaryPath",kind);
   if(Boolean(fields.primaryLabel)!==Boolean(fields.primaryPath))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"primaryPath"});
   if(fields.secondaryLabel!==undefined)out.secondaryLabel=text(fields.secondaryLabel,"secondaryLabel",60,2);
   if(fields.secondaryPath!==undefined)out.secondaryPath=path(fields.secondaryPath,"secondaryPath",kind);
   if(Boolean(fields.secondaryLabel)!==Boolean(fields.secondaryPath))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"secondaryPath"});
  }else if(sec.kind==="RICH_TEXT"){
   out.heading=text(fields.heading??"","heading",160,kind==="POLICY"?0:3);
   out.body=text(fields.body??"","body",4000,kind==="POLICY"?0:5);
   out.eyebrow=text(fields.eyebrow??"","eyebrow",100);
   if(fields.variant!==undefined){
    if(!["STANDARD","SPLIT"].includes(String(fields.variant)))
     throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"variant"});
    out.variant=fields.variant;
   }
   out.highlights=array(fields.highlights??[],"highlights",4,200);
   // Approved About revision can also own neutral introductory text for existing public owner routes.
   // No new operational master, URLs, personal information or permission/availability override.
   if(fields.placement!==undefined){
    if(kind!=="ABOUT"||typeof fields.placement!=="string"||!["TEAM","MEMBERSHIP","VOLUNTEER","NOTICES","UPCOMING_PROJECTS","ANNUAL_REPORTS","FINANCIAL_REPORTS"].includes(fields.placement)||fields.variant==="SPLIT")
     throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"placement"});
    out.placement=fields.placement;
   }
  }else if(sec.kind==="CTA"){
   out.heading=text(fields.heading??"","heading",160);
   out.eyebrow=text(fields.eyebrow??"","eyebrow",80);
   out.body=text(fields.body??"","body",400);
   if(fields.label!==undefined)out.label=text(fields.label,"label",80,2);
   if(fields.path!==undefined)out.path=path(fields.path,"path",kind);
   if(Boolean(fields.label)!==Boolean(fields.path))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"path"});
  }else if(sec.kind==="TEAM"){
   out.heading=text(fields.heading??"Our team","heading",160,3);
   if(!Array.isArray(fields.members)||fields.members.length>15)
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"members"});
   if(kind!=="HOME"&&kind!=="ABOUT")throw new BadRequestException({code:"CMS_TEAM_SOURCE_NOT_READY",field:"members"});
   out.members=teamSelections(fields.members);
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
   out.whatsappNumber=text(fields.whatsappNumber??"","whatsappNumber",16);
   out.email=text(fields.email??"","email",150);
   out.newsletterText=text(fields.newsletterText??"","newsletterText",250);
   if(out.phone&&!/^\+?[0-9 ()-]{7,32}$/.test(String(out.phone)))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"phone"});
   if(out.whatsappNumber&&!/^\+?[1-9][0-9]{9,14}$/.test(String(out.whatsappNumber)))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"whatsappNumber"});
   if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(out.email)))
    throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"email"});
  }else if(sec.kind==="PROJECT_TEASER"){out.heading=text(fields.heading??"Projects","heading",160,2);out.sourceRefs=projectTeaserRefs(fields.sourceRefs??[]);}
  else if(sec.kind==="CAMPAIGN_TEASER"){out.heading=text(fields.heading??"Campaigns","heading",160,2);out.sourceRefs=campaignTeaserRefs(fields.sourceRefs??[]);}
  else out.heading=text(fields.heading??"","heading",160);
  if(JSON.stringify(out).length>8192)
   throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections"});
  return {kind:sec.kind as Section["kind"],order:Number(sec.order),fields:out};
 });
 const placed=sections.filter(s=>s.kind==="RICH_TEXT"&&typeof s.fields.placement==="string");
 if(new Set(placed.map(s=>s.fields.placement)).size!==placed.length)
  throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"placement"});
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
  if(a.role==="TEAM"||!placementFits(sections,a))throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"assets["+i+"].role"});
   if(!placementFits(sections,a))throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"assets["+i+"].role"});
 }
 if(kind!=="HOME"&&kind!=="ABOUT")validateExtendedPage(kind,sections,assets);
 if(kind==="HEALTHCARE"&&!healthcareEditorialClaimsSafe(sections,[title,seoTitle,seoDescription]))
  throw new BadRequestException({code:"CMS_HEALTHCARE_UNSUPPORTED_RATE_CLAIM"});
 return {kind,slug,title,seoTitle,seoDescription,canonicalPath,sections,assets,navigation};
}
type Page={id:string;kind:string;slug:string;version:string;created_by:string;
 draft_revision_no:number;archived_at:Date|null};
type Revision={id:string;revision_no:number;status:string;content_digest:string;
 release_baseline:boolean;approval_case_ref:string|null;title:string;seo_title:string;seo_description:string;
 seo_canonical_path:string;created_by:string};
@Injectable()
export class CmsEditorialService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly approvals:CmsPublicationApprovalService,
  private readonly media:CmsDraftMediaService,
  private readonly notices:CmsPublicNoticeSource,
  private readonly csrPartners:CsrPartnerPublicSource,
  private readonly hrPublicBio:HrPublicBioEditorialSource){}
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

 /** The CG18 original editor may only select current revocable CG08 rights
  * in their CURRENT CG02 branch scope, never type arbitrary partner brands. */
 partnerSources(bearer:string){return this.csrPartners.editorialOptions(bearer);}
 /** Validate the SAME exact partner release version at submit and publish.
  * Current public reads additionally recheck so withdrawal is instantaneous.
  */
 private async partnerRevisionCurrent(tx:PoolClient,root:string,kind:string,revisionRef:string){
  if(kind!=="PARTNERS")return; // Enforce only when kind==="PARTNERS"
  const q=await tx.query<{structured_fields:Record<string,unknown>}>(
   "SELECT structured_fields FROM cms_section_revision WHERE foundation_root_id=$1 "+
   "AND page_revision_id=$2 AND section_kind='PARTNER_CARDS'",
   [root,revisionRef]);
  if(q.rows.length!==1)throw new ConflictException({code:"CMS_PARTNER_SOURCE_UNAVAILABLE"});
  const valid=parseExtendedSection("PARTNER_CARDS",q.rows[0].structured_fields);
  const chosen=valid.partners as CsrEditorialSelection[];
  const eligible=await this.csrPartners.currentCards(tx,root,chosen);
  if(eligible.length!==chosen.length)
   throw new ConflictException({code:"CMS_PARTNER_SOURCE_UNAVAILABLE"});
 }
 async teamSources(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"cms.content.manage");
  return this.withTx(async tx=>{
   await this.identity.assertCurrent(tx,actor,"cms.content.manage");
   return {sources:await this.hrPublicBio.choices(tx,actor)};
  });
 }
 private async teamRevisionCurrent(tx:PoolClient,root:string,revisionRef:string){
  const sections=await tx.query<{structured_fields:Record<string,unknown>}>(
   "SELECT structured_fields FROM cms_section_revision WHERE foundation_root_id=$1 AND page_revision_id=$2 AND section_kind='TEAM'",[root,revisionRef]);
  for(const row of sections.rows){
   const chosen=teamSelections(row.structured_fields.members);
   if((await this.hrPublicBio.currentCards(tx,root,chosen,true)).length!==chosen.length)
    throw new ConflictException({code:"CMS_TEAM_SOURCE_NOT_READY"});
  }
 }
 async beneficiaryImpact(bearer:string){
  const a=await this.sessions.requireAction(bearer,"cms.content.manage");
  return this.withTx(async tx=>{
   await this.identity.assertCurrent(tx,a,"cms.content.manage");await this.identity.assertCurrent(tx,a,"foundation.branches.admin");await this.identity.assertCurrent(tx,a,"beneficiaries.assistance.view");
   const fields=await beneficiaryImpactFields(tx,a.realmId,String(new Date().getUTCFullYear()-1));
   return {fields:fields?.items.length?fields:null};
  });
 }
 async eventSources(bearer:string){
  const a=await this.sessions.requireAction(bearer,"cms.content.manage");
  return this.withTx(async tx=>{await this.identity.assertCurrent(tx,a,"cms.content.manage");return {sources:await eligibleEventSources(tx,a.realmId)};});
 }
 async campaignSources(bearer:string){
  const a=await this.sessions.requireAction(bearer,"cms.content.manage");
  return this.withTx(async tx=>{await this.identity.assertCurrent(tx,a,"cms.content.manage");return {sources:await eligibleCampaignSources(tx,a.realmId)};});
 }
 async projectSources(bearer:string){
  const a=await this.sessions.requireAction(bearer,"cms.content.manage");
  return this.withTx(async tx=>{await this.identity.assertCurrent(tx,a,"cms.content.manage");return {sources:await eligibleProjectSources(tx,a.realmId)};});
 }
 /**
  * Deployment-only, fixed source baseline. No HTTP controller, staff session,
  * fake CG03 decision, external manifest or request-provided content.
  * Root lock serializes normal create and concurrent server startups.
  */
 async initializeReleaseBaseline():Promise<void>{
  // Normal restarts only read the one-time marker; no writes or content parsing.
  const done=await this.db.query("SELECT 1 FROM cms_release_install i JOIN access_realm r ON r.id=i.foundation_root_id WHERE r.realm_key='FOUNDATION_ROOT' AND i.release_key='CAREGANGA_INITIAL_EDITORIAL_V1'");
  if(done.rowCount){console.log("CMS initial release already installed; no content changes.");return;}
  await verifyReleaseIllustrations();
  await this.withTx(async tx=>{
   await tx.query("INSERT INTO access_realm(realm_key) VALUES('FOUNDATION_ROOT') ON CONFLICT(realm_key) DO NOTHING");
   const root=(await tx.query<{id:string}>("SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT' FOR UPDATE")).rows[0]?.id;
   if(!root)throw Error("CMS Foundation root unavailable");
   if((await tx.query("SELECT 1 FROM cms_release_install WHERE foundation_root_id=$1",[root])).rowCount)return;
   // Validate every fixed entry before writing the first page.
   const entries=initialEditorialRelease.map(parseContent);
   for(const value of entries){
    if((await tx.query("SELECT 1 FROM cms_page WHERE foundation_root_id=$1 AND slug=$2",[root,value.slug])).rowCount)continue;
    // Only fixed editorial copy, no private/operational data or uploaded asset
    // can be admitted to this release authorization.
    if(value.assets.length||value.sections.some(sec=>sec.kind==="TEAM"||sec.kind==="ARTICLE_BODY"||sec.kind==="CAMPAIGN_TEASER"||
     (sec.kind==="PROJECT_TEASER"&&Array.isArray(sec.fields.sourceRefs)&&sec.fields.sourceRefs.length>0)))throw Error("Invalid release baseline");
    const bundled=value.slug==="home"?releaseIllustrations:[];
    if(bundled.some(a=>!placementFits(value.sections,a)))throw Error("Invalid release illustration placement");
    const digest=sha({...value,bundled:bundled.map(a=>a.key).sort()});
    const page=(await tx.query<{id:string}>("INSERT INTO cms_page(foundation_root_id,slug,kind,draft_revision_no,release_baseline) VALUES($1,$2,$3,1,true) RETURNING id",[root,value.slug,value.kind])).rows[0].id;
    const rev=(await tx.query<{id:string}>("INSERT INTO cms_page_revision(foundation_root_id,page_id,revision_no,title,seo_title,seo_description,seo_canonical_path,content_digest,release_baseline) VALUES($1,$2,1,$3,$4,$5,$6,$7,true) RETURNING id",[root,page,value.title,value.seoTitle,value.seoDescription,value.canonicalPath,digest])).rows[0].id;
    for(const sec of value.sections)await tx.query("INSERT INTO cms_section_revision(foundation_root_id,page_revision_id,section_kind,order_no,structured_fields) VALUES($1,$2,$3,$4,$5::jsonb)",[root,rev,sec.kind,sec.order,JSON.stringify(sec.fields)]);
    await this.writeReleaseAssets(tx,root,rev,bundled);
    // Legal shells require genuine client text and the normal CG03 workflow.
    if(value.kind==="POLICY")continue;
    const publication=(await tx.query<{id:string}>("INSERT INTO cms_publication(foundation_root_id,page_id,page_revision_id,source_content_digest,publication_key,state,effective_at,release_baseline) VALUES($1,$2,$3,$4,$5,'EFFECTIVE',now(),true) RETURNING id",[root,page,rev,digest,randomUUID()])).rows[0].id;
    await tx.query("INSERT INTO cms_page_effective(foundation_root_id,page_id,publication_id) VALUES($1,$2,$3)",[root,page,publication]);
    if(value.navigation){
     const seq=(await tx.query<{revision_no:number}>("SELECT COALESCE(MAX(revision_no),0)+1 AS revision_no FROM cms_navigation_revision WHERE foundation_root_id=$1",[root])).rows[0].revision_no;
     const nav=(await tx.query<{id:string}>("INSERT INTO cms_navigation_revision(foundation_root_id,revision_no,login_desired,member_join_desired,volunteer_join_desired,source_digest,status,home_revision_id,release_baseline) VALUES($1,$2,$3,$4,$5,$6,'DRAFT',$7,true) RETURNING id",[root,seq,value.navigation.loginDesired,value.navigation.memberJoinDesired,value.navigation.volunteerJoinDesired,digest,rev])).rows[0].id;
     await tx.query("INSERT INTO cms_navigation_effective(foundation_root_id,revision_id) VALUES($1,$2) ON CONFLICT(foundation_root_id) DO NOTHING",[root,nav]);
    }
   }
   await tx.query("INSERT INTO cms_release_install(foundation_root_id,release_key) VALUES($1,'CAREGANGA_INITIAL_EDITORIAL_V1')",[root]);
  });
 }
 private async releaseAssets(db:Pool|PoolClient,root:string,rev:string):Promise<ReleaseIllustration[]>{
  const rows=await db.query<{asset_key:string}>("SELECT asset_key FROM cms_release_asset WHERE foundation_root_id=$1 AND page_revision_id=$2 ORDER BY role,sort_order",[root,rev]);
  return rows.rows.map(row=>{
   const asset=releaseIllustration(row.asset_key);if(!asset)throw Error("Invalid bundled media source");return asset;
  });
 }
 private async writeReleaseAssets(tx:PoolClient,root:string,rev:string,assets:readonly ReleaseIllustration[]){
  await tx.query("DELETE FROM cms_release_asset WHERE foundation_root_id=$1 AND page_revision_id=$2",[root,rev]);
  for(const a of assets)await tx.query("INSERT INTO cms_release_asset(foundation_root_id,page_revision_id,asset_key,role,sort_order) VALUES($1,$2,$3,$4,$5)",[root,rev,a.key,a.role,a.order]);
 }
 async releaseMedia(key:string){
  if(!releaseIllustration(key))throw new NotFoundException();
  const visible=()=>this.db.query("SELECT 1 FROM cms_release_asset a JOIN cms_page_revision v ON v.id=a.page_revision_id AND v.foundation_root_id=a.foundation_root_id JOIN cms_page p ON p.id=v.page_id AND p.foundation_root_id=v.foundation_root_id JOIN access_realm r ON r.id=p.foundation_root_id JOIN cms_page_effective e ON e.page_id=p.id AND e.foundation_root_id=p.foundation_root_id JOIN cms_publication pub ON pub.id=e.publication_id AND pub.foundation_root_id=e.foundation_root_id AND pub.page_revision_id=v.id WHERE r.realm_key='FOUNDATION_ROOT' AND p.archived_at IS NULL AND pub.state='EFFECTIVE' AND pub.effective_at<=now() AND (pub.expires_at IS NULL OR pub.expires_at>now()) AND a.asset_key=$1 LIMIT 1",[key]);
  if(!(await visible()).rowCount)throw new NotFoundException();
  const bytes=await releaseIllustrationBytes(key);
  if(!(await visible()).rowCount)throw new NotFoundException();
  return bytes;
 }
 async list(bearer:string,scope?:string){
  if(scope!==undefined&&scope!=="baseline")throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"scope"});
  const a=await this.sessions.requireAction(bearer,"cms.content.view");
  const result=await this.db.query<{pageRef:string;kind:string;slug:string;title:string;
   version:string;draftStatus:string;publicStatus:string|null}>(
   'SELECT p.id AS "pageRef",p.kind,p.slug,v.title,p.version,'+
   'CASE WHEN v.release_baseline THEN \'RELEASE_BASELINE\' ELSE v.status END AS "draftStatus",pub.state AS "publicStatus" '+
   'FROM cms_page p JOIN cms_page_revision v ON v.page_id=p.id '+
   'AND v.foundation_root_id=p.foundation_root_id '+
   'AND v.revision_no=p.draft_revision_no '+
   'LEFT JOIN cms_page_effective e ON e.page_id=p.id '+
   'AND e.foundation_root_id=p.foundation_root_id '+
   'LEFT JOIN cms_publication pub ON pub.id=e.publication_id '+
   "WHERE p.foundation_root_id=$1 AND p.archived_at IS NULL "+
   "AND (NOT $2::boolean OR p.kind<>\'ARTICLE\') "+
   "ORDER BY p.created_at DESC,p.id DESC LIMIT 100",[a.realmId,scope==="baseline"]);
  return {pages:result.rows};
 }
 async detail(bearer:string,ref:string){
  const a=await this.sessions.requireAction(bearer,"cms.content.view");
  return this.withTx(async tx=>{
   const page=await this.row(tx,a,ref);
   const rev=await this.revision(tx,a,page);
   const [sections,assets,published,navigation,scheduled,history]=await Promise.all([
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
     [a.realmId,page.id]),
    tx.query("SELECT 1 FROM cms_publication WHERE foundation_root_id=$1 AND page_id=$2 LIMIT 1",[a.realmId,page.id])
   ]);
   return {pageRef:page.id,kind:page.kind,slug:page.slug,version:Number(page.version),
    revisionRef:rev.id,revisionNo:rev.revision_no,status:rev.release_baseline?"RELEASE_BASELINE":rev.status,
    approvalCaseRef:rev.approval_case_ref,title:rev.title,
    seoTitle:rev.seo_title,seoDescription:rev.seo_description,
    canonicalPath:rev.seo_canonical_path,
    sections:sections.rows.map(x=>({kind:x.section_kind,order:x.order_no,fields:x.structured_fields})),
    assets:assets.rows.map(x=>({fileRef:x.cg19_file_ref,
     version:x.cg19_validated_version,role:x.role,altText:x.alt_text,order:x.sort_order})),
    bundledAssets:(await this.releaseAssets(tx,a.realmId,rev.id)).map(({key,role,order,altText})=>({key,role,order,altText})),
    navigation:page.kind==="HOME"?{loginDesired:navigation.rows[0]?.login_desired??true,
     memberJoinDesired:navigation.rows[0]?.member_join_desired??false,
     volunteerJoinDesired:navigation.rows[0]?.volunteer_join_desired??false}:null,
    scheduledAt:scheduled.rows[0]?.effective_at?.toISOString()??null,
    hasPublicationHistory:!!history.rowCount,
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
   if(sec.kind==="ARTICLE_BODY"){
    await this.notices.validateDraft(tx,actor.realmId,sec.fields);
    await validateEventArticle(tx,actor.realmId,sec.fields);
    if(sec.fields.sourceEventRef!==undefined&&(value.title!==sec.fields.heading||value.assets.length))throw new BadRequestException({code:"CMS_PROJECT_SOURCE_INVALID",field:"sourceEventRef"});
   }
   if(sec.kind==="PROJECT_TEASER")await validateProjectTeaser(tx,actor.realmId,sec.fields);
   if(sec.kind==="CAMPAIGN_TEASER")await validateCampaignTeaser(tx,actor.realmId,sec.fields);
   if(sec.kind==="TEAM"){
    const chosen=teamSelections(sec.fields.members);
    if(chosen.length){
     const current=await this.hrPublicBio.choices(tx,actor,chosen.map(p=>p.sourceRef));
     if(chosen.some(p=>!current.some(c=>c.sourceRef===p.sourceRef&&c.proof===p.proof&&c.name===p.name&&c.designation===p.designation)))
      throw new ConflictException({code:"CMS_TEAM_SOURCE_NOT_READY"});
    }
   }
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
  if(content.sections.some(s=>typeof s.fields.sourceNoticeRef==="string"))
   await this.notices.requireSelectionAccess(bearer);
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
  if(value.sections.some(s=>typeof s.fields.sourceNoticeRef==="string"))
   await this.notices.requireSelectionAccess(bearer);
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
   const inherited=(await this.releaseAssets(tx,actor.realmId,current.id)).filter(asset=>
    placementFits(value.sections,asset)&&!value.assets.some(a=>a.role===asset.role&&a.order===asset.order));
   const revisionDigest=inherited.length?sha({...value,bundled:inherited.map(a=>a.key).sort()}):digest;
   if(page.kind==="ARTICLE"){
    const priorEvent=await tx.query<{activity_id:string}>("SELECT e.activity_id FROM cms_section_revision s JOIN cms_page_revision v ON v.id=s.page_revision_id AND v.foundation_root_id=s.foundation_root_id JOIN event_public_eligibility e ON e.root_realm_id=s.foundation_root_id AND e.id::text=s.structured_fields->>'sourceEventRef' WHERE v.foundation_root_id=$1 AND v.page_id=$2 AND s.section_kind='ARTICLE_BODY' LIMIT 1",[actor.realmId,page.id]);
    if(priorEvent.rows[0]){
     const next=value.sections.find(s=>s.kind==="ARTICLE_BODY")?.fields.sourceEventRef;
     if(typeof next!=="string"||!(await tx.query("SELECT 1 FROM event_public_eligibility WHERE root_realm_id=$1 AND id::text=$2 AND activity_id=$3",[actor.realmId,next,priorEvent.rows[0].activity_id])).rowCount)throw new ConflictException({code:"CMS_PROJECT_SOURCE_UNAVAILABLE"});
    }
   }
   if(current.status!=="DRAFT"||current.release_baseline){
    revisionNo++;
    const rev=await tx.query<{id:string}>(
     "INSERT INTO cms_page_revision(foundation_root_id,page_id,revision_no,title,"+
     "seo_title,seo_description,seo_canonical_path,content_digest,created_by) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
     [actor.realmId,page.id,revisionNo,value.title,value.seoTitle,
      value.seoDescription,value.canonicalPath,revisionDigest,actor.accountId]);
    revisionRef=rev.rows[0].id;
   }else{
    await tx.query("UPDATE cms_page_revision SET title=$3,seo_title=$4,"+
     "seo_description=$5,seo_canonical_path=$6,content_digest=$7 "+
     "WHERE id=$1 AND foundation_root_id=$2 AND status='DRAFT'",
     [current.id,actor.realmId,value.title,value.seoTitle,value.seoDescription,
      value.canonicalPath,revisionDigest]);
   }
   await this.putSections(tx,actor,revisionRef,value);
   await this.writeReleaseAssets(tx,actor.realmId,revisionRef,inherited);
   if(value.navigation)await this.saveNavigation(tx,actor,revisionRef,revisionDigest,value.navigation);
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
   if(Number(page.version)!==v.expectedVersion||rev.status!=="DRAFT"||rev.release_baseline)
    throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   const assets=await tx.query<{file_ref:string;version:number;role:string;sort_order:number}>(
    "SELECT cg19_file_ref AS file_ref,cg19_validated_version AS version,role,sort_order "+
    "FROM cms_asset_placement WHERE foundation_root_id=$1 AND page_revision_id=$2",
    [actor.realmId,rev.id]);
   if(page.kind==="HOME"){
    const slides=await tx.query<{order_no:number;text_only:boolean}>(
     "SELECT order_no, (structured_fields->>'textOnly' IS NOT DISTINCT FROM 'true') AS text_only FROM cms_section_revision "+
     "WHERE foundation_root_id=$1 AND page_revision_id=$2 AND section_kind='HERO' "+
     "AND structured_fields->>'visible' IS DISTINCT FROM 'false' "+
     "ORDER BY order_no",[actor.realmId,rev.id]);
    const bundled=await this.releaseAssets(tx,actor.realmId,rev.id);
    if(!slides.rows.length||slides.rows.some(slide=>!slide.text_only&&!assets.rows.some(asset=>
      asset.role==="HERO"&&asset.sort_order===slide.order_no)&&!bundled.some(asset=>asset.role==="HERO"&&asset.order===slide.order_no)))
     throw new BadRequestException({code:"CMS_HERO_IMAGE_REQUIRED",field:"heroImage"});
   }
   if(page.kind==="POLICY"){
    const owned=await tx.query<{section_kind:string;structured_fields:Record<string,unknown>}>(
     "SELECT section_kind,structured_fields FROM cms_section_revision "+
     "WHERE foundation_root_id=$1 AND page_revision_id=$2 ORDER BY order_no",
     [actor.realmId,rev.id]);
    if(owned.rows.length<1||owned.rows.length>12||
      owned.rows.some(row=>row.section_kind!=="RICH_TEXT"||
       typeof row.structured_fields.heading!=="string"||
       row.structured_fields.heading.trim().length<3||
       typeof row.structured_fields.body!=="string"||
       row.structured_fields.body.trim().length<5)||assets.rows.length>0)
     throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"sections"});
   }else if(page.kind!=="HOME"&&page.kind!=="ABOUT"){
    const owned=await tx.query<{section_kind:string;order_no:number;
     structured_fields:Record<string,unknown>}>(
     "SELECT section_kind,order_no,structured_fields FROM cms_section_revision "+
     "WHERE foundation_root_id=$1 AND page_revision_id=$2 ORDER BY order_no",
     [actor.realmId,rev.id]);
    const submitted=owned.rows.map(row=>({
     kind:row.section_kind,order:row.order_no,
     fields:extendedKinds.has(row.section_kind)?
      parseExtendedSection(row.section_kind,row.structured_fields):row.structured_fields
    }));
    for(const sec of submitted)if(sec.kind==="IMPACT_GROUP"&&sec.fields.source===beneficiaryImpactSource){
     if(!(await approvedBeneficiaryImpact(tx,actor.realmId,sec.fields)).valid||assets.rows.some(a=>a.role==="IMPACT"&&a.sort_order===sec.order))throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
    }
    validateExtendedPage(page.kind,submitted,
     assets.rows.map(a=>({role:a.role,order:a.sort_order})),true);
   }
   if(!(await complianceEligible(tx,actor.realmId,rev.id)))
    throw new ConflictException({code:"CMS_COMPLIANCE_EVIDENCE_EXPIRED"});
   if(!(await projectTeaserRevisionEligible(tx,actor.realmId,rev.id))||!(await eventArticleRevisionEligible(tx,actor.realmId,rev.id)))throw new ConflictException({code:"CMS_PROJECT_SOURCE_UNAVAILABLE"});
   if(!(await this.notices.revisionEligible(tx,actor.realmId,rev.id)))
    throw new ConflictException({code:"CMS_ORIGINAL_NOTICE_UNAVAILABLE"});
   await this.partnerRevisionCurrent(tx,actor.realmId,page.kind,rev.id);
   await this.teamRevisionCurrent(tx,actor.realmId,rev.id);
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
  const v=input(raw,["expectedVersion","requestKey","caseRef","publishAt","firstPublicationOnly"]);
  if(v.firstPublicationOnly!==undefined&&typeof v.firstPublicationOnly!=="boolean")throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"firstPublicationOnly"});
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
  if(v.firstPublicationOnly===true&&future)throw new BadRequestException({code:"CMS_INPUT_INVALID",field:"publishAt"});
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
   // Under the same page lock used by publish and withdraw, the first-install
   // command cannot resurrect a page with any prior publication history.
   if(v.firstPublicationOnly===true){
    const history=await tx.query("SELECT 1 FROM cms_publication WHERE foundation_root_id=$1 AND page_id=$2 LIMIT 1",[actor.realmId,page.id]);
    if(history.rowCount)throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   }
   if(Number(page.version)!==v.expectedVersion)
    throw new ConflictException({code:"CMS_SOURCE_CHANGED"});
   const rev=await this.revision(tx,actor,page);
   if(rev.status!=="SUBMITTED"||rev.approval_case_ref!==caseRef)
    throw new ConflictException({code:"CMS_REVIEW_UNAVAILABLE"});
   if(!(await complianceEligible(tx,actor.realmId,rev.id)))
    throw new ConflictException({code:"CMS_COMPLIANCE_EVIDENCE_EXPIRED"});
   if(!(await projectTeaserRevisionEligible(tx,actor.realmId,rev.id))||!(await eventArticleRevisionEligible(tx,actor.realmId,rev.id)))throw new ConflictException({code:"CMS_PROJECT_SOURCE_UNAVAILABLE"});
   if(!(await this.notices.revisionEligible(tx,actor.realmId,rev.id)))
    throw new ConflictException({code:"CMS_ORIGINAL_NOTICE_UNAVAILABLE"});
   await this.partnerRevisionCurrent(tx,actor.realmId,page.kind,rev.id);
   await this.teamRevisionCurrent(tx,actor.realmId,rev.id);
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
 async publicArticles(categoryInput?:string,cursorInput?:string,eventsOnly=false){
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
   "AND (NOT $3::boolean OR body.structured_fields ? 'sourceEventRef') "+
   "AND NOT EXISTS(SELECT 1 FROM cms_asset_placement a "+
   "LEFT JOIN cg19_cms_media_file f ON f.id=a.cg19_file_ref "+
   "AND f.realm_id=a.foundation_root_id AND f.page_id=v.page_id "+
   "WHERE a.page_revision_id=v.id AND a.foundation_root_id=p.foundation_root_id "+
   "AND (f.id IS NULL OR f.revoked_at IS NOT NULL OR "+
   "a.public_rights_status<>'VALIDATED' OR "+
   "f.scan_status<>'CLEAN_VERIFIED' OR f.public_rights_confirmed=false "+
   "OR f.revision<>a.cg19_validated_version)) "+
   NOTICE_CURRENT_SQL+EVENT_CURRENT_SQL+
   "ORDER BY p.slug LIMIT 21",[category,cursor,eventsOnly]);
  return {schemaVersion:1,posts:rows.rows.slice(0,20).map(x=>({
   slug:x.slug,title:x.title,category:x.category,excerpt:x.excerpt,
   asOfDate:x.as_of_date,path:"/blog/"+x.slug})),
   nextCursor:rows.rows.length>20?rows.rows[19].slug:null};
 }
 /** Only original CG19 ALL_ACTIVE notices explicitly approved as public in a
  * separate effective CG18 Article revision. No recipient, channel, internal
  * reference or sender fields enter this anonymous source projection.
  */
 async publicNotices(){
  const rows=await this.db.query<{slug:string;title:string;body:string;
   category:string;priority:string;approved_at:Date;expires_at:Date}>( 
   "SELECT p.slug,n.title,n.body,"+
   "body.structured_fields->>'category' AS category,"+
   "n.priority,n.approved_at,n.expires_at "+
   "FROM cms_page p JOIN cms_page_effective e ON e.page_id=p.id "+
   "AND e.foundation_root_id=p.foundation_root_id "+
   "JOIN cms_publication pub ON pub.id=e.publication_id "+
   "AND pub.foundation_root_id=e.foundation_root_id "+
   "JOIN cms_page_revision v ON v.id=pub.page_revision_id "+
   "AND v.foundation_root_id=pub.foundation_root_id "+
   "JOIN cms_section_revision body ON body.page_revision_id=v.id "+
   "AND body.foundation_root_id=p.foundation_root_id "+
   "AND body.section_kind='ARTICLE_BODY' "+
   "JOIN cg19_notice n ON n.realm_id=p.foundation_root_id "+
   "AND n.id::text=body.structured_fields->>'sourceNoticeRef' "+
   "JOIN access_realm root ON root.id=p.foundation_root_id "+
   "WHERE root.realm_key='FOUNDATION_ROOT' AND p.kind='ARTICLE' "+
   "AND p.archived_at IS NULL AND pub.state='EFFECTIVE' "+
   "AND pub.effective_at<=now() "+
   "AND (pub.expires_at IS NULL OR pub.expires_at>now()) "+
   "AND body.structured_fields->>'publicReleaseConfirmed'='true' "+
   "AND n.audience_kind='ALL_ACTIVE' AND n.approved_by IS NOT NULL "+
   "AND n.approved_at IS NOT NULL AND n.state='ACTIVE' "+
   "AND n.expires_at>now() "+
   "AND n.title=body.structured_fields->>'heading' "+
   "AND n.body=body.structured_fields->>'body' "+
   "AND NOT EXISTS(SELECT 1 FROM cms_asset_placement a "+
   "LEFT JOIN cg19_cms_media_file f ON f.id=a.cg19_file_ref "+
   "AND f.realm_id=a.foundation_root_id AND f.page_id=v.page_id "+
   "WHERE a.page_revision_id=v.id AND a.foundation_root_id=p.foundation_root_id "+
   "AND (f.id IS NULL OR f.revoked_at IS NOT NULL OR "+
   "a.public_rights_status<>'VALIDATED' OR "+
   "f.scan_status<>'CLEAN_VERIFIED' OR f.public_rights_confirmed=false "+
   "OR f.revision<>a.cg19_validated_version)) "+
   "ORDER BY n.approved_at DESC,p.slug ASC LIMIT 60");
  return {schemaVersion:1,notices:rows.rows.map(n=>({
   title:n.title,body:n.body,category:n.category,
   priority:n.priority==="IMPORTANT"?"IMPORTANT":"NORMAL",
   publishedOn:n.approved_at.toISOString().slice(0,10),
   expiresOn:n.expires_at.toISOString().slice(0,10),
   path:"/blog/"+n.slug
  }))};
 }
 async publicNavigation(){
  const response=await this.db.query<{effective_generation:string;login_desired:boolean;
   member_join_desired:boolean;volunteer_join_desired:boolean}>(
   'SELECT n.id AS "effective_generation",n.login_desired,'+
   'n.member_join_desired,n.volunteer_join_desired '+
   'FROM cms_navigation_effective e JOIN cms_navigation_revision n '+
   'ON n.id=e.revision_id AND n.foundation_root_id=e.foundation_root_id '+
   'JOIN cms_page_revision v ON v.id=n.home_revision_id '+
   'AND v.foundation_root_id=n.foundation_root_id '+
   'LEFT JOIN cg03_case c ON c.id=v.approval_case_ref '+
   'AND c.realm_id=v.foundation_root_id AND c.cms_page_revision_id=v.id '+
   'LEFT JOIN cg03_case_decision d ON d.id=n.cg03_decision_ref AND d.case_id=c.id '+
   'AND d.realm_id=c.realm_id '+
   'JOIN cms_page_effective active ON active.foundation_root_id=n.foundation_root_id '+
   'JOIN cms_publication publication ON publication.id=active.publication_id '+
   'AND publication.foundation_root_id=active.foundation_root_id '+
   'AND publication.page_revision_id=n.home_revision_id '+
   'JOIN access_realm realm ON realm.id=n.foundation_root_id '+
   "WHERE realm.realm_key='FOUNDATION_ROOT' "+
   "AND publication.state='EFFECTIVE' AND publication.effective_at<=now() "+
   "AND (publication.expires_at IS NULL OR publication.expires_at>now()) "+
   "AND ((n.release_baseline AND v.release_baseline AND publication.release_baseline AND n.status='DRAFT') "+
   "OR (NOT n.release_baseline AND NOT publication.release_baseline AND n.status='APPROVED' AND c.status='OWNER_COMPLETED' AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND n.effective_at<=now())) "+
   'AND n.source_digest=v.content_digest LIMIT 1');
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
   "AND f.realm_id=a.foundation_root_id AND f.page_id=p.id "+
   "WHERE a.foundation_root_id=p.foundation_root_id "+
   "AND a.page_revision_id=pub.page_revision_id "+
   "AND (f.id IS NULL OR f.revoked_at IS NOT NULL OR "+
   "a.public_rights_status<>'VALIDATED' OR "+
   "f.scan_status<>'CLEAN_VERIFIED' OR f.public_rights_confirmed=false "+
   "OR a.cg19_validated_version<>f.revision)) "+
   "AND NOT EXISTS (SELECT 1 FROM cms_section_revision cs "+
   "WHERE cs.foundation_root_id=p.foundation_root_id "+
   "AND cs.page_revision_id=pub.page_revision_id "+
   "AND cs.section_kind='COMPLIANCE_FACTS' "+
   "AND cs.structured_fields->>'verification'='VERIFIED' "+
   "AND cs.structured_fields->>'validUntil'<to_char(current_date,'YYYY-MM-DD')) "+
   NOTICE_CURRENT_SQL+EVENT_CURRENT_SQL+
   "ORDER BY p.slug LIMIT 100");
  const publishedRoutes=routes.rows.map(p=>({kind:p.kind,slug:p.slug,
   path:p.kind==="ARTICLE"?"/blog/"+p.slug:
    p.kind==="POLICY"?"/policies/"+p.slug:
    p.kind==="HOME"?"/":p.kind==="COMPLIANCE"?"/ngo-information":"/"+p.slug}));
  // Original approved CMS placements are the publication authority for
  // project listing routes, not a second operational page master.
  if(routes.rows.some(p=>p.kind==="HOME"||p.kind==="ABOUT")){
   const placement=await this.db.query("SELECT 1 FROM cms_page p JOIN access_realm r ON r.id=p.foundation_root_id AND r.realm_key='FOUNDATION_ROOT' JOIN cms_page_effective e ON e.page_id=p.id AND e.foundation_root_id=p.foundation_root_id JOIN cms_publication pub ON pub.id=e.publication_id AND pub.foundation_root_id=e.foundation_root_id JOIN cms_section_revision s ON s.foundation_root_id=pub.foundation_root_id AND s.page_revision_id=pub.page_revision_id WHERE p.kind IN('HOME','ABOUT') AND p.archived_at IS NULL AND pub.state='EFFECTIVE' AND pub.effective_at<=now() AND (pub.expires_at IS NULL OR pub.expires_at>now()) AND s.section_kind='PROJECT_TEASER' LIMIT 1");
   if(placement.rowCount)publishedRoutes.push({kind:"PROJECTS",slug:"our-work",path:"/our-work"},{kind:"PROJECTS",slug:"upcoming-projects",path:"/upcoming-projects"});
  }
  // A Campaigns link appears only when a current original CG07 + CG03 +
  // CG18 effective publication + CG19 media proof produces a real public card.
  if((await publicCampaignSources(this.db)).length>0)
   publishedRoutes.push({kind:"CAMPAIGNS",slug:"campaigns",path:"/campaigns"});
  if(await onlineDonationReady(this.db))publishedRoutes.push({kind:"DONATE",slug:"donate",path:"/donate"});
  // Approval authority remains the current effective CG03-approved Home.
  // Never turn on public joins for a draft, absent approval or withdrawn Home.
  const memberJoin=x?.member_join_desired===true;
  const volunteerJoin=x?.volunteer_join_desired===true;
  return {schemaVersion:1,effectiveGeneration:x?.effective_generation??null,
   publishedRoutes,
   login:{visible:x?.login_desired===true,label:"Staff login",
    path:x?.login_desired?"/admin/login":null},
   memberJoin:{visible:memberJoin,label:"Become a Member",
    path:memberJoin?"/membership":null},
   volunteerJoin:{visible:volunteerJoin,label:"Become a Volunteer",
    path:volunteerJoin?"/volunteer":null}};
 }
 async publicCampaignCatalogue(slug?:string){
  const cards=await publicCampaignSources(this.db,slug);
  return {schemaVersion:1,kind:"CAMPAIGNS" as const,slug:"campaigns",title:"Campaigns",
   seoTitle:"Campaigns | CareGanga Foundation",
   seoDescription:"Current independently approved CareGanga Foundation fundraising campaigns.",
   canonicalPath:"/campaigns",effectiveGeneration:sha(cards),
   cards,donationsEnabled:await onlineDonationReady(this.db)};
 }
 async publicDonationReadiness(){return {schemaVersion:1,onlineAvailable:await onlineDonationReady(this.db)};}

 async publicProjectCatalogue(slug:"our-work"|"upcoming-projects"){
  const pages=await Promise.all(["home","about"].map(async name=>{try{return await this.publicPage(name);}catch(e){if(e instanceof NotFoundException)return null;throw e;}}));
  const approved=pages.filter((p):p is NonNullable<typeof p>=>p!==null);
  const sections=approved.flatMap(p=>p.sections.filter(s=>s.kind==="PROJECT_TEASER"));
  if(!sections.length)throw new NotFoundException({code:"CMS_NOT_PUBLISHED"});
  const selected=new Map<string,Record<string,unknown>>();
  for(const section of sections){const cards=(section.fields as Record<string,unknown>).cards;if(!Array.isArray(cards))continue;for(const row of cards){if(!row||typeof row!=="object"||typeof row.slug!=="string")continue;if(slug==="upcoming-projects"&&row.status!=="PLANNED")continue;selected.set(row.slug,row);}}
  const intro=slug==="upcoming-projects"?approved.find(p=>p.kind==="ABOUT")?.sections.find(s=>s.kind==="RICH_TEXT"&&s.fields.placement==="UPCOMING_PROJECTS")?.fields:undefined;
  const cards=[...selected.values()],title=typeof intro?.heading==="string"?intro.heading:slug==="upcoming-projects"?"Upcoming Projects":"Our Work";
  const description=typeof intro?.body==="string"?intro.body:"Current approved CareGanga Foundation projects.";
  const introSections=intro?[{kind:"RICH_TEXT",order:0,fields:{heading:title,body:description,eyebrow:intro.eyebrow,highlights:intro.highlights,variant:"STANDARD"}}]:[];
  return {schemaVersion:1,effectiveGeneration:sha([approved.map(p=>p.effectiveGeneration),cards]),kind:"PROJECTS",slug,title,seoTitle:title+" | CareGanga Foundation",seoDescription:description.slice(0,300),canonicalPath:"/"+slug,lastPublishedAt:approved.map(p=>p.lastPublishedAt).sort().reverse()[0],sections:[...introSections,{kind:"PROJECT_TEASER",order:1,fields:{heading:slug==="upcoming-projects"?"Planned projects":"Our Projects",cards}}],assets:[]};
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
    "FROM cms_asset_placement a JOIN cms_page_revision source_rev "+
    "ON source_rev.id=a.page_revision_id AND source_rev.foundation_root_id=a.foundation_root_id "+
    "JOIN cg19_cms_media_file f "+
    "ON f.id=a.cg19_file_ref AND f.realm_id=a.foundation_root_id "+
    "AND f.page_id=source_rev.page_id "+
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
  if(!(await this.notices.revisionEligible(this.db,x.foundation_root_id,x.revision_id)))
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
  // Recheck approved coarse aggregate at every public read; never expose attached beneficiary media.
 const beneficiaryImpactOrders=new Set<number>();
 for(const sec of sections.rows){
  if(sec.section_kind!=="IMPACT_GROUP"||sec.structured_fields.source!==beneficiaryImpactSource)continue;
  beneficiaryImpactOrders.add(sec.order_no);
  const current=await approvedBeneficiaryImpact(this.db,x.foundation_root_id,sec.structured_fields);
  sec.structured_fields=current.fields!;
 }
 const authoredSections:Section[]=sections.rows.map(sec=>({
  kind:sec.section_kind as Section["kind"],order:sec.order_no,
  fields:sec.structured_fields}));
 if(x.kind==="HEALTHCARE"&&!healthcareEditorialClaimsSafe(authoredSections,[x.title,x.seo_title,x.seo_description]))
  throw new NotFoundException({code:"CMS_HEALTHCARE_FINANCIAL_SOURCE_NOT_VERIFIED"});
 const gallerySource=authoredSections.find(x=>x.kind==="GALLERY_GRID");
 const authoredGallery=Array.isArray(gallerySource?.fields.items)?
  gallerySource.fields.items as Record<string,unknown>[]:[];
 const visibleAssets=assets.rows.filter(asset=>!(asset.role==="IMPACT"&&beneficiaryImpactOrders.has(asset.sort_order))).filter(asset=>placementFits(authoredSections,
  {role:asset.role,order:asset.sort_order})&&
  (asset.role!=="GALLERY"||authoredGallery[asset.sort_order]?.visible!==false));
 const eventCards=new Map<number,Record<string,unknown>>();
 for(const section of sections.rows)if(section.section_kind==="ARTICLE_BODY"&&section.structured_fields.sourceEventRef!==undefined){
  const card=await publicEventArticle(this.db,x.foundation_root_id,section.structured_fields);
  if(!card)throw new NotFoundException({code:"CMS_NOT_PUBLISHED"});
  eventCards.set(section.order_no,card);
 }
 const campaignCards=new Map<number,Record<string,unknown>>();
 for(const section of sections.rows)if(section.section_kind==="CAMPAIGN_TEASER"){
  const refs=campaignTeaserRefs(section.structured_fields.sourceRefs??[]);
  const sources=await eligibleCampaignSources(this.db,x.foundation_root_id,refs);
  const matches=new Set(refs);
  campaignCards.set(section.order_no,{heading:section.structured_fields.heading,
   cards:sources.filter(v=>matches.has(v.sourceRef)).map(({sourceRef,...safe})=>safe)});
 }
 const projectCards=new Map<number,Record<string,unknown>>();
 for(const section of sections.rows)if(section.section_kind==="PROJECT_TEASER")projectCards.set(section.order_no,await publicProjectTeaser(this.db,x.foundation_root_id,section.structured_fields));
 const currentPartnerCards=new Map<number,Record<string,unknown>>();
 const publicPartnerLogoOrders=new Set<number>();
 for(const section of sections.rows){
  if(section.section_kind!=="PARTNER_CARDS")continue;
  if(x.kind!=="PARTNERS")throw new NotFoundException({code:"CMS_NOT_PUBLISHED"});
  let selected:CsrEditorialSelection[];
  try{
   const parsed=parseExtendedSection("PARTNER_CARDS",section.structured_fields);
   selected=parsed.partners as CsrEditorialSelection[];
  }catch{throw new NotFoundException({code:"CMS_NOT_PUBLISHED"});}
  const approved=await this.csrPartners.currentCards(this.db,x.foundation_root_id,selected);
  const byRef=new Map(approved.map(row=>[row.sourceRef,row]));
  const cards=selected.flatMap((item,index)=>{
   const v=byRef.get(item.sourceRef);
   if(!v||v.rightsVersion!==item.rightsVersion)return [];
   publicPartnerLogoOrders.add(index);
   // No source ref, consent evidence, registration/contact or money outside.
   return [{name:v.name,summary:v.summary,originalIndex:index}];
  });
  currentPartnerCards.set(section.order_no,{
   heading:section.structured_fields.heading,intro:section.structured_fields.intro,
   cards
  });
 }
 const teamCards=new Map<number,Record<string,unknown>>();
 for(const section of sections.rows)if(section.section_kind==="TEAM"){
  let chosen:HrEditorialPerson[]=[];
  try{chosen=teamSelections(section.structured_fields.members);}catch{/* historical manually entered identity is not a valid selection */}
  const cards=await this.hrPublicBio.currentCards(this.db,x.foundation_root_id,chosen);
  teamCards.set(section.order_no,{heading:section.structured_fields.heading,
   members:cards.map(({name,designation})=>({name,designation,consentConfirmed:true}))});
 }
 const bundled=await this.releaseAssets(this.db,x.foundation_root_id,x.revision_id);
 const hiddenHeroOrders=new Set(sections.rows.filter(sec=>
   sec.section_kind==="HERO"&&sec.structured_fields?.visible===false)
   .map(sec=>sec.order_no));
  return {schemaVersion:1,effectiveGeneration:x.publication_id,
   kind:x.kind,slug:x.slug,title:x.title,seoTitle:x.seo_title,
   seoDescription:x.seo_description,canonicalPath:x.seo_canonical_path,
   lastPublishedAt:x.changed_at.toISOString(),
   sections:sections.rows.filter(v=>v.section_kind!=="HERO"||
     !hiddenHeroOrders.has(v.order_no)).map(v=>({kind:v.section_kind,order:v.order_no,
    fields:v.section_kind==="PARTNER_CARDS"?(currentPartnerCards.get(v.order_no)??{heading:"Partners",cards:[]}):v.section_kind==="PROJECT_TEASER"?(projectCards.get(v.order_no)??{heading:"Projects",cards:[]}):v.section_kind==="CAMPAIGN_TEASER"?(campaignCards.get(v.order_no)??{heading:"Campaigns",cards:[]}):v.section_kind==="ARTICLE_BODY"?
      (eventCards.get(v.order_no)??Object.fromEntries(Object.entries(v.structured_fields).filter(([k])=>
       !["sourceNoticeRef","sourceEventRef","publicReleaseConfirmed"].includes(k)))):
     v.section_kind==="TEAM"?(teamCards.get(v.order_no)??{heading:v.structured_fields.heading,members:[]}):
     v.section_kind==="GALLERY_GRID"?{...v.structured_fields,
      items:Array.isArray(v.structured_fields.items)?
       (v.structured_fields.items as Record<string,unknown>[]).flatMap((item,index)=>
        item&&item.visible!==false?[{...item,originalIndex:index}]:[]):[]}:
     v.structured_fields})),
   assets:[...bundled.filter(v=>placementFits(authoredSections,v)&&!(v.role==="HERO"&&hiddenHeroOrders.has(v.order))).map(v=>({role:v.role,altText:v.altText,src:"/api/public/content/release-media/"+v.key,order:v.order})),...visibleAssets.filter(v=>v.role!=="TEAM").filter(v=>x.kind!=="PARTNERS"||v.role!=="FEATURE"||publicPartnerLogoOrders.has(v.sort_order)).filter(v=>!["HERO","MOBILE_HERO"].includes(v.role)||
     !hiddenHeroOrders.has(v.sort_order)).map(v=>({role:v.role,altText:v.alt_text,
    src:"/api/public/content/media/"+v.cg19_file_ref,order:v.sort_order}))]};
 }
}
