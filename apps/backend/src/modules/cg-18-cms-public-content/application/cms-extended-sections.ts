import {BadRequestException} from "@nestjs/common";

/** Typed CG-18 editorial payloads. This is content, never a source-of-truth
 * project, patient, finance, event, approval or CG-19 file master.
 * No executable HTML, arbitrary URL, recipient or internal record reference.
 */
export const extendedKinds=new Set([
 "IMPACT_GROUP","COMPLIANCE_FACTS","GALLERY_GRID",
 "ARTICLE_BODY","HEALTHCARE_CATEGORIES","CONTACT_INFO","PARTNER_CARDS"
]);
export const impactGroups=[
 "HERO","PILLARS","STATS","GROWTH","GEOGRAPHY",
 "BREAKDOWN","FOCUS","STORIES","UPDATES","CTA"
] as const;
export type EditorialSection={kind:string;order:number;fields:Record<string,unknown>};
const danger=/<[^>]*>|javascript:|data:|(?:onerror|onclick)\s*=/i;
const error=(field:string):never=>{
 throw new BadRequestException({code:"CMS_INPUT_INVALID",field});
};
const obj=(v:unknown,field:string,allowed:string[])=>{
 if(!v||typeof v!=="object"||Array.isArray(v)||
  Object.keys(v).some(k=>!allowed.includes(k)))return error(field);
 return v as Record<string,unknown>;
};
const str=(v:unknown,field:string,max:number,min=0)=>{
 if(typeof v!=="string"||v.trim().length<min||v.length>max||
  /[\u0000-\u0009\u000b-\u001f\u007f]/.test(v)||danger.test(v))return error(field);
 return v.trim();
};
const num=(v:unknown,field:string,low:number,high:number)=>{
 if(typeof v!=="number"||!Number.isFinite(v)||v<low||v>high)return error(field);
 return v;
};
const date=(v:unknown,field:string)=>{
 const s=str(v,field,10,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||
  !Number.isFinite(Date.parse(s+"T00:00:00Z"))||
  new Date(s+"T00:00:00Z").toISOString().slice(0,10)!==s)return error(field);
 return s;
};
const local=(v:unknown,field:string)=>{
 const x=str(v,field,120,1);
 if(!["/","/about","/contact","/our-impact","/gallery","/healthcare","/ngo-information"].includes(x))
  return error(field);
 return x;
};
const groupItem=(raw:unknown,i:number,group:string)=>{
 const f="items["+i+"]";
 const x=obj(raw,f,["title","description","value","unit","year","percentage",
  "consentConfirmed","latitude","longitude","level"]);
 const out:Record<string,unknown>={
  title:str(x.title,f+".title",140,2),
  description:str(x.description??"",f+".description",450)
 };
 if(x.value!==undefined)out.value=num(x.value,f+".value",0,1e12);
 if(x.unit!==undefined)out.unit=str(x.unit,f+".unit",40,1);
 if(x.year!==undefined){
  out.year=num(x.year,f+".year",1900,new Date().getUTCFullYear());
  if(!Number.isSafeInteger(Number(out.year)))return error(f+".year");
 }
 if(x.percentage!==undefined)out.percentage=num(x.percentage,f+".percentage",0,100);
 if(x.latitude!==undefined||x.longitude!==undefined){
  out.latitude=num(x.latitude,f+".latitude",-90,90);
  out.longitude=num(x.longitude,f+".longitude",-180,180);
  if(group!=="GEOGRAPHY")return error(f+".latitude");
 }
 if(x.level!==undefined){
  if(group!=="GEOGRAPHY")return error(f+".level");
  const level=str(x.level,f+".level",12,3).toUpperCase();
  if(!["HIGH","MEDIUM","EXPANDING"].includes(level))return error(f+".level");
  out.level=level;
 }
 if(group==="STORIES"){
  if(x.consentConfirmed!==true)return error(f+".consentConfirmed");
  out.consentConfirmed=true;
 }else if(x.consentConfirmed!==undefined)return error(f+".consentConfirmed");
 if((group==="STATS"||group==="GROWTH")&&out.value===undefined)
  return error(f+".value");
 if(group==="GROWTH"&&out.year===undefined)return error(f+".year");
 if(group==="BREAKDOWN"&&out.percentage===undefined)
  return error(f+".percentage");
 return out;
};
function allowedSectionFields(kind:string):string[]{
 return kind==="IMPACT_GROUP"?
  ["group","heading","intro","source","asOfDate","items","claimsFullBreakdown","ctaLabel","ctaPath",
   "eyebrow","highlight","quote"]:
  kind==="COMPLIANCE_FACTS"?
  ["heading","summary","issuer","pan","registrationNumber","approvalNumber",
   "validFrom","validUntil","verifiedAsOf","source","verification","disclaimer","documents",
   "badgeText","subtitle","importantNote"]:
  kind==="GALLERY_GRID"?
  ["heading","description","items","videosHeading","videosDescription",
   "publicationsHeading","publicationsDescription","photosEmptyText",
   "videosEmptyText","publicationsEmptyText"]:
  kind==="ARTICLE_BODY"?
  ["heading","category","excerpt","body","authorLabel","source","asOfDate","tags",
   "sourceNoticeRef","publicReleaseConfirmed","sourceEventRef"]:
  kind==="HEALTHCARE_CATEGORIES"?
  ["heading","intro","categories","ctaLabel","ctaPath"]:
  kind==="CONTACT_INFO"?["heroTitle","heroIntro","inquiries","faqs","officeHours",
   "mapUrl","socialLinks"]:
  kind==="PARTNER_CARDS"?["heading","intro","partners"]: [];

}
/**
 * Protected editorial DRAFT only. The same section-kind field allow-lists
 * and finite schema budgets are enforced, but empty/incomplete inputs are
 * allowed so editors can save progress without fabricating data.
 * A separate strict parse is mandatory on SUBMIT, before CG03 review.
 */
export function parseDraftExtendedSection(kind:string,raw:unknown):Record<string,unknown>{
 const x=obj(raw,"fields",allowedSectionFields(kind));
 const walk=(value:unknown,depth:number):unknown=>{
  if(depth>5)return error("fields");
  if(value===null)return null;
  if(typeof value==="string"){
   if(value.length>7000||/[\u0000-\u0009\u000b-\u001f\u007f]/.test(value)||danger.test(value))
    return error("fields");
   return value.trim();
  }
  if(typeof value==="number"){
   if(!Number.isFinite(value)||Math.abs(value)>1e12)return error("fields");
   return value;
  }
  if(typeof value==="boolean")return value;
  if(Array.isArray(value)){
   if(value.length>16)return error("fields");
   return value.map(v=>walk(v,depth+1));
  }
  if(value&&typeof value==="object"){
   const rec=value as Record<string,unknown>,names=Object.keys(rec);
   if(names.length>20||names.some(k=>!/^[A-Za-z][A-Za-z0-9]*$/.test(k)))
    return error("fields");
   return Object.fromEntries(names.map(k=>[k,walk(rec[k],depth+1)]));
  }
  return error("fields");
 };
 return walk(x,0) as Record<string,unknown>;
}

export function parseExtendedSection(kind:string,raw:unknown):Record<string,unknown>{
 const allowed=allowedSectionFields(kind);
 const x=obj(raw,"fields",allowed);
 if(kind==="PARTNER_CARDS"){
  if(!Array.isArray(x.partners)||x.partners.length>12)return error("partners");
  const partners=x.partners.map((raw,i)=>{
   const v=obj(raw,"partners["+i+"]",["sourceRef","rightsVersion"]);
   const sourceRef=str(v.sourceRef,"sourceRef",36,36);
   if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sourceRef))return error("sourceRef");
   if(!Number.isSafeInteger(v.rightsVersion)||Number(v.rightsVersion)<1||Number(v.rightsVersion)>2147483647)return error("rightsVersion");
   return {sourceRef,rightsVersion:v.rightsVersion as number};
  });
  if(new Set(partners.map(v=>v.sourceRef)).size!==partners.length)return error("partners");
  return {heading:str(x.heading,"heading",180,3),intro:str(x.intro??"","intro",700),partners};
 }
 if(kind==="IMPACT_GROUP"){
  const group=str(x.group,"group",32,3);
  if(!impactGroups.includes(group as typeof impactGroups[number]))
   return error("group");
  if(!Array.isArray(x.items)||x.items.length>16)return error("items");
  const items=x.items.map((v,i)=>groupItem(v,i,group));
  const out:Record<string,unknown>={
   group,heading:str(x.heading,"heading",180,3),
   intro:str(x.intro??"","intro",1000),
   // Empty collections are a legitimate published state; actual items still require provenance.
   source:str(x.source??"","source",180,items.length?3:0),
   asOfDate:date(x.asOfDate,"asOfDate"),items
  };
  if(String(out.asOfDate)>new Date().toISOString().slice(0,10))return error("asOfDate");
  if(group==="HERO"){
   if(x.eyebrow!==undefined)out.eyebrow=str(x.eyebrow,"eyebrow",100);
   if(x.highlight!==undefined)out.highlight=str(x.highlight,"highlight",120);
   if(x.quote!==undefined)out.quote=str(x.quote,"quote",500);
  }else if(x.eyebrow!==undefined||x.highlight!==undefined||x.quote!==undefined)
   return error("group");
  if(x.claimsFullBreakdown!==undefined){
   if(group!=="BREAKDOWN"||typeof x.claimsFullBreakdown!=="boolean")
    return error("claimsFullBreakdown");
   out.claimsFullBreakdown=x.claimsFullBreakdown;
   if(x.claimsFullBreakdown){
    const total=items.reduce((n,v)=>n+Number(v.percentage??0),0);
    if(Math.abs(total-100)>0.001)return error("items.percentage");
   }
  }
  if(x.ctaLabel!==undefined||x.ctaPath!==undefined){
   if(group!=="CTA"&&group!=="HERO")return error("ctaLabel");
   out.ctaLabel=str(x.ctaLabel,"ctaLabel",60,2);
   out.ctaPath=local(x.ctaPath,"ctaPath");
  }
  return out;
 }
 if(kind==="COMPLIANCE_FACTS"){
  const verification=str(x.verification,"verification",24,8);
  if(!["VERIFIED","NOT_VERIFIED"].includes(verification))return error("verification");
  const start=x.validFrom?date(x.validFrom,"validFrom"):"";
  const end=x.validUntil?date(x.validUntil,"validUntil"):"";
  if(start&&end&&end<start)return error("validUntil");
  const pan=x.pan?str(x.pan,"pan",12,10).toUpperCase():"";
  if(pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))return error("pan");
  const out={
   heading:str(x.heading,"heading",180,3),
   summary:str(x.summary??"","summary",2000),
   badgeText:str(x.badgeText??"","badgeText",70),
   subtitle:str(x.subtitle??"","subtitle",180),
   importantNote:str(x.importantNote??"","importantNote",650),
   issuer:str(x.issuer??"","issuer",160),
   pan,registrationNumber:str(x.registrationNumber??"","registrationNumber",100),
   approvalNumber:str(x.approvalNumber??"","approvalNumber",100),
   validFrom:start,validUntil:end,
   verifiedAsOf:date(x.verifiedAsOf,"verifiedAsOf"),
   source:str(x.source??"","source",180,verification==="VERIFIED"||x.pan||x.registrationNumber||x.approvalNumber||(Array.isArray(x.documents)&&x.documents.length)?3:0),verification,
   disclaimer:str(x.disclaimer??"Check current official records before claiming a tax benefit.",
    "disclaimer",400,10),
   documents:(()=>{
    if(x.documents===undefined)return [];
    if(!Array.isArray(x.documents)||x.documents.length>6)return error("documents");
    return x.documents.map((raw:unknown,i:number)=>{
     const field="documents["+i+"]",v=obj(raw,field,["type","title","asOfDate"]);
     const type=str(v.type,field+".type",18,3);
     if(!["80G","REGISTRATION","ANNUAL_REPORT","OTHER"].includes(type))
      return error(field+".type");
     const asOfDate=date(v.asOfDate,field+".asOfDate");
     if(asOfDate>new Date().toISOString().slice(0,10))return error(field+".asOfDate");
     return {type,title:str(v.title,field+".title",140,3),asOfDate};
    });
   })()
  };
  if(out.verifiedAsOf>new Date().toISOString().slice(0,10))
   return error("verifiedAsOf");
  if(verification==="VERIFIED"&&(!out.issuer||!out.approvalNumber||
     !start||!end||end<new Date().toISOString().slice(0,10)))
   return error("verification");
  return out;
 }
 if(kind==="GALLERY_GRID"){
  if(!Array.isArray(x.items)||x.items.length>12)return error("items");
  return {
   heading:str(x.heading,"heading",180,3),
   description:str(x.description??"","description",900),
   videosHeading:str(x.videosHeading??"","videosHeading",180),
   videosDescription:str(x.videosDescription??"","videosDescription",900),
   publicationsHeading:str(x.publicationsHeading??"","publicationsHeading",180),
   publicationsDescription:str(x.publicationsDescription??"","publicationsDescription",900),
   photosEmptyText:str(x.photosEmptyText??"","photosEmptyText",300),
   videosEmptyText:str(x.videosEmptyText??"","videosEmptyText",300),
   publicationsEmptyText:str(x.publicationsEmptyText??"","publicationsEmptyText",300),
   items:x.items.map((v,i)=>{
    const f="items["+i+"]",item=obj(v,f,
     ["title","caption","category","mediaType","source","asOfDate","visible"]);
    const mediaType=str(item.mediaType,f+".mediaType",12,3);
    if(!["PHOTO","VIDEO","PUBLICATION"].includes(mediaType))
     return error(f+".mediaType");
    const asOfDate=date(item.asOfDate,f+".asOfDate");
    if(asOfDate>new Date().toISOString().slice(0,10))return error(f+".asOfDate");
    if(item.visible!==undefined&&typeof item.visible!=="boolean")
     return error(f+".visible");
    return {title:str(item.title,f+".title",150,3),
     caption:str(item.caption??"",f+".caption",500),
     category:str(item.category,f+".category",80,2),mediaType,
     source:str(item.source,f+".source",160,3),asOfDate,
     visible:item.visible!==false};
   })
  };
 }
 if(kind==="ARTICLE_BODY"){
  if(!Array.isArray(x.tags)||x.tags.length>8)return error("tags");
  const asOfDate=date(x.asOfDate,"asOfDate");
  if(asOfDate>new Date().toISOString().slice(0,10))return error("asOfDate");
  const notice=x.sourceNoticeRef===undefined?null:(()=>{
   if(typeof x.sourceNoticeRef!=="string"||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x.sourceNoticeRef)||
    x.publicReleaseConfirmed!==true)return error("sourceNoticeRef");
   return x.sourceNoticeRef;
  })();
  const event=x.sourceEventRef===undefined?null:(()=>{if(typeof x.sourceEventRef!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x.sourceEventRef)||notice!==null)return error("sourceEventRef");return x.sourceEventRef.toLowerCase();})();
   if(notice===null&&x.publicReleaseConfirmed!==undefined)
   return error("publicReleaseConfirmed");
  return {...(event?{sourceEventRef:event}:{}),...(notice?{sourceNoticeRef:notice,publicReleaseConfirmed:true}:{}),
   heading:str(x.heading,"heading",180,event?2:3),
   category:str(x.category,"category",80,event?1:2),
   excerpt:str(x.excerpt,"excerpt",400,event?3:10),
   body:str(x.body,"body",7000,event?3:20),
   authorLabel:str(x.authorLabel,"authorLabel",100,2),
   source:str(x.source,"source",160,3),asOfDate,
   tags:x.tags.map((v,i)=>str(v,"tags["+i+"]",40,2))};
 }
 if(kind==="CONTACT_INFO"){
  if(!Array.isArray(x.inquiries)||x.inquiries.length>3||
     !Array.isArray(x.faqs)||x.faqs.length>8||
     !Array.isArray(x.socialLinks)||x.socialLinks.length>3)
   return error("contactDetails");
  const inquiries=x.inquiries.map((v,i)=>{
   const item=obj(v,"inquiries["+i+"]",["title","description"]);
   return {title:str(item.title,"inquiries.title",100,3),
    description:str(item.description,"inquiries.description",350,3)};
  });
  const faqs=x.faqs.map((v,i)=>{
   const item=obj(v,"faqs["+i+"]",["question","answer"]);
   return {question:str(item.question,"faqs.question",180,5),
    answer:str(item.answer,"faqs.answer",1200,10)};
  });
  const approvedUrl=(raw:unknown,field:string,hosts:string[])=>{
   if(raw===""||raw===null||raw===undefined)return "";
   const value=str(raw,field,500,12);
   try{
    const url=new URL(value);
    if(url.protocol!=="https:"||url.username||url.password||
      url.port||url.hash||!hosts.includes(url.hostname.toLowerCase()))
      return error(field);
    return value;
   }catch{return error(field);}
  };
  const socialLinks=x.socialLinks.map((v,i)=>{
   const item=obj(v,"socialLinks["+i+"]",["network","url"]);
   const network=str(item.network,"socialLinks.network",20,3);
   const allowed:Record<string,string[]>={
    Facebook:["facebook.com","www.facebook.com"],
    Instagram:["instagram.com","www.instagram.com"],
    YouTube:["youtube.com","www.youtube.com"]
   };
   if(!allowed[network])return error("socialLinks.network");
   return {network,url:approvedUrl(item.url,"socialLinks.url",allowed[network])};
  });
  const heroTitle=str(x.heroTitle??"","heroTitle",180);
  const heroIntro=str(x.heroIntro??"","heroIntro",800);
  const officeHours=str(x.officeHours??"","officeHours",160);
  // Do not publish an unverified always-staffed chat/hours promise.
  if(/24[ ]*[/]?[ ]*7|24.hours|always.available/i.test(
   [heroTitle,heroIntro,officeHours].join(" ")))return error("officeHours");
  return {heroTitle,heroIntro,inquiries,faqs,officeHours,
   mapUrl:approvedUrl(x.mapUrl,"mapUrl",
    ["www.google.com","google.com","maps.google.com"]),
   socialLinks};
 }
 if(kind==="HEALTHCARE_CATEGORIES"){
  if(!Array.isArray(x.categories)||x.categories.length<1||
    x.categories.length>12)return error("categories");
  const categories=x.categories.map((raw,i)=>{
   const f="categories["+i+"]",v=obj(raw,f,["title","description"]);
   return {title:str(v.title,f+".title",120,3),
    description:str(v.description,f+".description",500,10)};
  });
  const all=[x.heading,x.intro,
   ...categories.flatMap(v=>[v.title,v.description])].join(" ");
  // The neutral CG-18 landing is not permitted to quote unverified provider,
  // pricing, eligibility, subsidies or appointment availability.
  if(/₹|\b(?:rs\.?|inr|discount|subsidy|book now|available slots|rating|hospital charges)\b|%/i.test(all))
   return error("healthcareClaims");
  const out:Record<string,unknown>={
   heading:str(x.heading,"heading",180,3),intro:str(x.intro,"intro",1800,15),
   categories
  };
  if(x.ctaLabel!==undefined||x.ctaPath!==undefined){
   out.ctaLabel=str(x.ctaLabel,"ctaLabel",60,2);
   out.ctaPath=local(x.ctaPath,"ctaPath");
   if(out.ctaPath!=="/contact")return error("ctaPath");
  }
  return out;
 }
 return error("sectionKind");
}

/** CG18 editorial fields must not assert a financial rate/discount.
 * Actual current healthcare assistance is a separate CG17-owned public
 * source, inserted at the app composition level, not CMS author text.
 * This content-only guard has NO dependency on CG17 tables or services.
 */
export function healthcareEditorialClaimsSafe(sections:readonly EditorialSection[],metadata:string[]=[]):boolean{
 const text=JSON.stringify([...metadata,...sections.map(s=>s.fields)]);
 return !/(?:\d{1,3}(?:\.\d{1,2})?\s*%|₹\s*[\d,.]+|\b(?:rs\.?|inr)\s*[\d,.]+|\b(?:discount|subsidy|waiver)\s*(?:of|up to)?\s*\d+)/i.test(text);
}
export function validateExtendedPage(kind:string,sections:readonly EditorialSection[],
 assets:readonly {role:string;order:number}[],requireMedia=false){
 const types=sections.map(x=>x.kind);
 const permitted:Record<string,string[]>={
  IMPACT:["IMPACT_GROUP"],
  COMPLIANCE:["COMPLIANCE_FACTS"],
  GALLERY:["GALLERY_GRID"],
  ARTICLE:["ARTICLE_BODY"],
  CONTACT:["RICH_TEXT","CTA","CONTACT_INFO"],
  HEALTHCARE:["HERO","RICH_TEXT","HEALTHCARE_CATEGORIES","CTA"],
  POLICY:["RICH_TEXT"],
  PARTNERS:["HERO","RICH_TEXT","CTA","PARTNER_CARDS"]
 };
 const whitelist=permitted[kind];
 if(!whitelist||types.some(v=>!whitelist.includes(v)))
  return error("sections");
 if(kind==="PARTNERS"&&(types.filter(k=>k==="PARTNER_CARDS").length!==1||
  sections.length>8))return error("sections");
 if(kind==="IMPACT"){
  const entries=sections.map(s=>s.fields.group);
  if(entries.length!==10||new Set(entries).size!==10||
    impactGroups.some(v=>!entries.includes(v)))return error("impactGroups");
 }
 if(kind==="COMPLIANCE"){
  if(types.length!==1||types[0]!=="COMPLIANCE_FACTS")return error("sections");
  const fact=sections[0].fields;
  // A claim of currently verified 80G has to show an independently scanned
  // public-rights validated document placement, not merely unchecked fields.
  const docs=Array.isArray(fact.documents)?fact.documents:[];
   if(requireMedia&&docs.some((_,i)=>
     !assets.some(a=>a.role==="DOCUMENT"&&a.order===i)))return error("documents");
   if(requireMedia&&fact.verification==="VERIFIED"&&
     (docs.length===0||(docs[0] as Record<string,unknown>).type!=="80G"||
      !assets.some(a=>a.role==="DOCUMENT"&&a.order===0)))
   return error("document");
 }
 if(kind==="GALLERY"&&(types.length!==1||types[0]!=="GALLERY_GRID"||
   (requireMedia&&(sections[0].fields.items as Record<string,unknown>[]).some((entry,i)=>
    entry.visible!==false&&!assets.some(a=>a.role==="GALLERY"&&a.order===i)))))
  return error("galleryMedia");
 if(kind==="ARTICLE"&&(types.length!==1||types[0]!=="ARTICLE_BODY"))
  return error("sections");
 if(kind==="HEALTHCARE"&&!types.includes("HEALTHCARE_CATEGORIES"))
  return error("categories");
 if(kind==="HEALTHCARE"&&!healthcareEditorialClaimsSafe(sections))
  return error("healthcareFinancialClaims");
 if(kind==="CONTACT"&&!types.some(v=>v==="RICH_TEXT"))
  return error("sections");
 if(kind==="POLICY"&&(sections.length<1||sections.length>12||
  types.some(t=>t!=="RICH_TEXT")||assets.length>0))
  return error("sections");
}
