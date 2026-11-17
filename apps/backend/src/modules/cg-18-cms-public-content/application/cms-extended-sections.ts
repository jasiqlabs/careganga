import {BadRequestException} from "@nestjs/common";

/** Typed CG-18 editorial payloads. This is content, never a source-of-truth
 * project, patient, finance, event, approval or CG-19 file master.
 * No executable HTML, arbitrary URL, recipient or internal record reference.
 */
export const extendedKinds=new Set([
 "IMPACT_GROUP","COMPLIANCE_FACTS","GALLERY_GRID",
 "ARTICLE_BODY","HEALTHCARE_CATEGORIES"
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
  /[\u0000-\u001f\u007f]/.test(v)||danger.test(v))return error(field);
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
 if(!["/","/about","/contact","/impact","/gallery","/healthcare","/80g"].includes(x))
  return error(field);
 return x;
};
const groupItem=(raw:unknown,i:number,group:string)=>{
 const f="items["+i+"]";
 const x=obj(raw,f,["title","description","value","unit","year","percentage",
  "consentConfirmed","latitude","longitude"]);
 const out:Record<string,unknown>={
  title:str(x.title,f+".title",140,2),
  description:str(x.description??"",f+".description",450)
 };
 if(x.value!==undefined)out.value=num(x.value,f+".value",0,1e12);
 if(x.unit!==undefined)out.unit=str(x.unit,f+".unit",40,1);
 if(x.year!==undefined){
  out.year=num(x.year,f+".year",1900,new Date().getUTCFullYear());
  if(!Number.isSafeInteger(out.year))return error(f+".year");
 }
 if(x.percentage!==undefined)out.percentage=num(x.percentage,f+".percentage",0,100);
 if(x.latitude!==undefined||x.longitude!==undefined){
  out.latitude=num(x.latitude,f+".latitude",-90,90);
  out.longitude=num(x.longitude,f+".longitude",-180,180);
  if(group!=="GEOGRAPHY")return error(f+".latitude");
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
export function parseExtendedSection(kind:string,raw:unknown):Record<string,unknown>{
 const allowed=kind==="IMPACT_GROUP"?
  ["group","heading","intro","source","asOfDate","items","claimsFullBreakdown","ctaLabel","ctaPath"]:
  kind==="COMPLIANCE_FACTS"?
  ["heading","summary","issuer","pan","registrationNumber","approvalNumber",
   "validFrom","validUntil","verifiedAsOf","source","verification","disclaimer"]:
  kind==="GALLERY_GRID"?
  ["heading","description","items"]:
  kind==="ARTICLE_BODY"?
  ["heading","category","excerpt","body","authorLabel","source","asOfDate","tags"]:
  kind==="HEALTHCARE_CATEGORIES"?
  ["heading","intro","categories","ctaLabel","ctaPath"]: [];
 const x=obj(raw,"fields",allowed);
 if(kind==="IMPACT_GROUP"){
  const group=str(x.group,"group",32,3);
  if(!impactGroups.includes(group as typeof impactGroups[number]))
   return error("group");
  if(!Array.isArray(x.items)||x.items.length>16||
    (!x.items.length&&!["HERO","CTA"].includes(group)))return error("items");
  const items=x.items.map((v,i)=>groupItem(v,i,group));
  const out:Record<string,unknown>={
   group,heading:str(x.heading,"heading",180,3),
   intro:str(x.intro??"","intro",1000),
   source:str(x.source,"source",180,3),
   asOfDate:date(x.asOfDate,"asOfDate"),items
  };
  if(out.asOfDate>new Date().toISOString().slice(0,10))return error("asOfDate");
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
   if(group!=="CTA")return error("ctaLabel");
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
   issuer:str(x.issuer??"","issuer",160),
   pan,registrationNumber:str(x.registrationNumber??"","registrationNumber",100),
   approvalNumber:str(x.approvalNumber??"","approvalNumber",100),
   validFrom:start,validUntil:end,
   verifiedAsOf:date(x.verifiedAsOf,"verifiedAsOf"),
   source:str(x.source,"source",180,3),verification,
   disclaimer:str(x.disclaimer??"Check current official records before claiming a tax benefit.",
    "disclaimer",400,10)
  };
  if(out.verifiedAsOf>new Date().toISOString().slice(0,10))
   return error("verifiedAsOf");
  if(verification==="VERIFIED"&&(!out.issuer||!out.approvalNumber||
     !start||!end||end<new Date().toISOString().slice(0,10)))
   return error("verification");
  return out;
 }
 if(kind==="GALLERY_GRID"){
  if(!Array.isArray(x.items)||x.items.length<1||x.items.length>12)return error("items");
  return {
   heading:str(x.heading,"heading",180,3),
   description:str(x.description??"","description",900),
   items:x.items.map((v,i)=>{
    const f="items["+i+"]",item=obj(v,f,
     ["title","caption","category","mediaType","source","asOfDate"]);
    const mediaType=str(item.mediaType,f+".mediaType",12,3);
    if(!["PHOTO","VIDEO","PUBLICATION"].includes(mediaType))
     return error(f+".mediaType");
    const asOfDate=date(item.asOfDate,f+".asOfDate");
    if(asOfDate>new Date().toISOString().slice(0,10))return error(f+".asOfDate");
    return {title:str(item.title,f+".title",150,3),
     caption:str(item.caption??"",f+".caption",500),
     category:str(item.category,f+".category",80,2),mediaType,
     source:str(item.source,f+".source",160,3),asOfDate};
   })
  };
 }
 if(kind==="ARTICLE_BODY"){
  if(!Array.isArray(x.tags)||x.tags.length>8)return error("tags");
  const asOfDate=date(x.asOfDate,"asOfDate");
  if(asOfDate>new Date().toISOString().slice(0,10))return error("asOfDate");
  return {heading:str(x.heading,"heading",180,3),
   category:str(x.category,"category",80,2),
   excerpt:str(x.excerpt,"excerpt",400,10),
   body:str(x.body,"body",7000,20),
   authorLabel:str(x.authorLabel,"authorLabel",100,2),
   source:str(x.source,"source",160,3),asOfDate,
   tags:x.tags.map((v,i)=>str(v,"tags["+i+"]",40,2))};
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

export function validateExtendedPage(kind:string,sections:readonly EditorialSection[],
 assets:readonly {role:string;order:number}[],requireMedia=false){
 const types=sections.map(x=>x.kind);
 const permitted:Record<string,string[]>={
  IMPACT:["IMPACT_GROUP"],
  COMPLIANCE:["COMPLIANCE_FACTS"],
  GALLERY:["GALLERY_GRID"],
  ARTICLE:["ARTICLE_BODY"],
  CONTACT:["RICH_TEXT","CTA"],
  HEALTHCARE:["HERO","RICH_TEXT","HEALTHCARE_CATEGORIES","CTA"]
 };
 const whitelist=permitted[kind];
 if(!whitelist||types.some(v=>!whitelist.includes(v)))
  return error("sections");
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
  if(requireMedia&&fact.verification==="VERIFIED"&&!assets.some(a=>a.role==="DOCUMENT"))
   return error("document");
 }
 if(kind==="GALLERY"&&(types.length!==1||types[0]!=="GALLERY_GRID"||
   (requireMedia&&(sections[0].fields.items as unknown[]).some((_,i)=>
    !assets.some(a=>a.role==="GALLERY"&&a.order===i)))))
  return error("galleryMedia");
 if(kind==="ARTICLE"&&(types.length!==1||types[0]!=="ARTICLE_BODY"))
  return error("sections");
 if(kind==="HEALTHCARE"&&!types.includes("HEALTHCARE_CATEGORIES"))
  return error("categories");
 if(kind==="CONTACT"&&!types.some(v=>v==="RICH_TEXT"))
  return error("sections");
}
