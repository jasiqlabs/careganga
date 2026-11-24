"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CmsPublicPage,type PublicCmsPage} from "./cms-public-page";
import {isCmsCtaRoute} from "./cms-cta-route";
import {clientScreenshotHome} from "./cms-client-screenshot-reference";
type Kind="HOME"|"ABOUT";
type ProjectSource={sourceRef:string;title:string;category:string;summary:string;area:string;launch:string|null;status:string};
type CampaignSource={sourceRef:string;title:string;category:string;summary:string;area:string;status?:string};
type Team={name:string;designation:string;bio:string;consentConfirmed:boolean};
type Asset={fileRef:string;version:number;role:"HERO"|"MOBILE_HERO"|"TEAM"|"ABOUT"|"PROMO"|"FEATURE";altText:string;order:number};
type NavDesired={loginDesired:boolean;memberJoinDesired:boolean;volunteerJoinDesired:boolean};
type PageItem={pageRef:string;kind:Kind;slug:string;title:string;version:string;draftStatus:string;publicStatus:string|null};
type PageDetail={pageRef:string;kind:Kind;slug:string;version:number;revisionRef:string;
 revisionNo:number;status:string;approvalCaseRef:string|null;
 title:string;seoTitle:string;seoDescription:string;canonicalPath:string;
 sections:{kind:string;order:number;fields:Record<string,unknown>}[];
 assets:Asset[];navigation:NavDesired|null;publicationStatus:string;scheduledAt:string|null};
type Review={caseRef:string;number:string;title:string;status:string;revision:number};
type ReviewDetail={caseNumber:string;caseRef:string;status:string;revision:number;
 source:{title:string;slug:string;kind:string;seoTitle:string;
 seoDescription:string;navigation:NavDesired|null;sections:{kind:string;order:number;fields:Record<string,unknown>}[];
 assets:{fileRef:string;role:string;altText:string;order:number;current:boolean;mime:string|null}[]}};
type Command={label:string;path:string;method:"POST"|"PUT";body:Record<string,unknown>};
type Slide={heading:string;subtitle:string;description:string;eyebrow:string;tags:string;visible:boolean;
 headingFont:"SERIF"|"SANS";headingWeight:"REGULAR"|"BOLD";headingSize:"STANDARD"|"LARGE";
 headingColor:string;subtitleColor:string;
 primaryLabel:string;primaryPath:string;secondaryLabel:string;secondaryPath:string};
type FeatureCard={label:string;title:string;body:string};
type Draft={kind:Kind;title:string;seoTitle:string;seoDescription:string;
 slides:Slide[];bodyHeading:string;body:string;bodyEyebrow:string;
 bodyVariant:"STANDARD"|"SPLIT";highlights:string;
 promoEyebrow:string;promoHeading:string;promoBody:string;promoLabel:string;promoPath:string;
 featuresEyebrow:string;featuresHeading:string;featuresBody:string;featureCards:FeatureCard[];
 volunteerTitle:string;volunteerBody:string;volunteerBenefits:string;
 memberTitle:string;memberBody:string;memberBenefits:string;
 footerMission:string;footerAddress:string;footerPhone:string;footerWhatsappNumber:string;footerEmail:string;
 footerNewsletterText:string;teamHeading:string;team:Team[];assets:Asset[];projectSources:string[];projectHeading:string;campaignSources:string[];campaignHeading:string;
 loginDesired:boolean;memberJoinDesired:boolean;volunteerJoinDesired:boolean};
const blankSlide=():Slide=>({heading:"",subtitle:"",description:"",eyebrow:"",tags:"",visible:true,
 headingFont:"SERIF",headingWeight:"BOLD",headingSize:"LARGE",
 headingColor:"#FFE34A",subtitleColor:"#8CF442",primaryLabel:"",primaryPath:"",secondaryLabel:"",secondaryPath:""});
const blank=(kind:Kind):Draft=>({kind,title:"",seoTitle:"",seoDescription:"",
 slides:kind==="HOME"?[blankSlide()]:[],bodyHeading:"",body:"",bodyEyebrow:"",
 bodyVariant:kind==="HOME"?"SPLIT":"STANDARD",highlights:"",
 promoEyebrow:"",promoHeading:"",promoBody:"",promoLabel:"",promoPath:"",
 featuresEyebrow:"",featuresHeading:"",featuresBody:"",featureCards:[],
 volunteerTitle:"",volunteerBody:"",volunteerBenefits:"",
 memberTitle:"",memberBody:"",memberBenefits:"",
 footerMission:"",footerAddress:"",footerPhone:"",footerWhatsappNumber:"",footerEmail:"",footerNewsletterText:"",
 teamHeading:"Our team",team:[],assets:[],projectSources:[],projectHeading:"Our Projects",campaignSources:[],campaignHeading:"Campaigns",loginDesired:true,
 memberJoinDesired:false,volunteerJoinDesired:false});
function val(v:unknown):string{return typeof v==="string"?v:"";}
function words(v:unknown){return Array.isArray(v)?v.filter(x=>typeof x==="string").join("\n"):"";}
function section(d:PageDetail,kind:string){
 return d.sections.find(x=>x.kind===kind)?.fields??{};
}
function fromPage(p:PageDetail):Draft{
 const draft=blank(p.kind),body=section(p,"RICH_TEXT"),team=section(p,"TEAM");
 const promo=section(p,"CTA"),features=section(p,"FEATURE_CARDS");
 const join=section(p,"JOIN_CARDS"),footer=section(p,"SITE_FOOTER");
 return {...draft,title:p.title,seoTitle:p.seoTitle,seoDescription:p.seoDescription,
  slides:p.sections.filter(x=>x.kind==="HERO").sort((a,b)=>a.order-b.order)
   .map(x=>({heading:val(x.fields.heading),subtitle:val(x.fields.subtitle),
    description:val(x.fields.description),eyebrow:val(x.fields.eyebrow),visible:x.fields.visible!==false,
    tags:Array.isArray(x.fields.tags)?x.fields.tags.filter(y=>typeof y==="string").join(", "):"",
    headingFont:(x.fields.headingFont==="SANS"?"SANS":"SERIF") as Slide["headingFont"],
    headingWeight:(x.fields.headingWeight==="REGULAR"?"REGULAR":"BOLD") as Slide["headingWeight"],
    headingSize:(x.fields.headingSize==="STANDARD"?"STANDARD":"LARGE") as Slide["headingSize"],
    headingColor:val(x.fields.headingColor)||"#FFE34A",
    subtitleColor:val(x.fields.subtitleColor)||"#8CF442",
    primaryLabel:val(x.fields.primaryLabel),primaryPath:val(x.fields.primaryPath),
    secondaryLabel:val(x.fields.secondaryLabel),secondaryPath:val(x.fields.secondaryPath)})),
  bodyHeading:val(body.heading),body:val(body.body),
  bodyEyebrow:val(body.eyebrow),bodyVariant:body.variant==="SPLIT"?"SPLIT":"STANDARD",
  highlights:words(body.highlights),
  promoEyebrow:val(promo.eyebrow),promoHeading:val(promo.heading),
  promoBody:val(promo.body),promoLabel:val(promo.label),promoPath:val(promo.path),
  featuresEyebrow:val(features.eyebrow),featuresHeading:val(features.heading),
  featuresBody:val(features.body),
  featureCards:Array.isArray(features.cards)?features.cards
   .filter(x=>x&&typeof x==="object").map(x=>{const y=x as Record<string,unknown>;
    return {label:val(y.label),title:val(y.title),body:val(y.body)}}):[],
  volunteerTitle:val(join.volunteerTitle),volunteerBody:val(join.volunteerBody),
  volunteerBenefits:words(join.volunteerBenefits),memberTitle:val(join.memberTitle),
  memberBody:val(join.memberBody),memberBenefits:words(join.memberBenefits),
  footerMission:val(footer.mission),footerAddress:val(footer.address),
  footerPhone:val(footer.phone),footerWhatsappNumber:val(footer.whatsappNumber),footerEmail:val(footer.email),
  footerNewsletterText:val(footer.newsletterText),
  teamHeading:val(team.heading)||"Our team",
  team:Array.isArray(team.members)?team.members.filter(v=>v&&typeof v==="object")
   .map(v=>{const person=v as Record<string,unknown>;return {
    name:val(person.name),designation:val(person.designation),bio:val(person.bio),
    consentConfirmed:person.consentConfirmed===true};}):[],
  assets:p.assets,projectSources:Array.isArray(section(p,"PROJECT_TEASER").sourceRefs)?(section(p,"PROJECT_TEASER").sourceRefs as unknown[]).filter((x):x is string=>typeof x==="string"):[],projectHeading:val(section(p,"PROJECT_TEASER").heading)||"Our Projects",campaignSources:Array.isArray(section(p,"CAMPAIGN_TEASER").sourceRefs)?(section(p,"CAMPAIGN_TEASER").sourceRefs as unknown[]).filter((x):x is string=>typeof x==="string"):[],campaignHeading:val(section(p,"CAMPAIGN_TEASER").heading)||"Campaigns",loginDesired:p.navigation?.loginDesired??true,
  memberJoinDesired:p.navigation?.memberJoinDesired??false,
  volunteerJoinDesired:p.navigation?.volunteerJoinDesired??false};
}
function lines(s:string){return s.split("\n").map(v=>v.trim()).filter(Boolean).slice(0,4);}
function payload(d:Draft){
 const sections:{kind:string;order:number;fields:Record<string,unknown>}[]=[];
 d.slides.forEach((slide,index)=>{
  const fields:Record<string,unknown>={heading:slide.heading,subtitle:slide.subtitle,
   description:slide.description,eyebrow:slide.eyebrow,visible:slide.visible,
   headingFont:slide.headingFont,headingWeight:slide.headingWeight,
   headingSize:slide.headingSize,headingColor:slide.headingColor,
   subtitleColor:slide.subtitleColor,
   tags:slide.tags.split(",").map(x=>x.trim()).filter(Boolean).slice(0,4)};
  // Never discard a half-entered CTA. Backend validation and the authorized
  // error-copy catalogue explain which label or real destination is missing.
  if(slide.primaryLabel.trim())fields.primaryLabel=slide.primaryLabel;
  if(slide.primaryPath.trim())fields.primaryPath=slide.primaryPath;
  if(slide.secondaryLabel.trim())fields.secondaryLabel=slide.secondaryLabel;
  if(slide.secondaryPath.trim())fields.secondaryPath=slide.secondaryPath;
  sections.push({kind:"HERO",order:index,fields});
 });
 if(d.body.trim())sections.push({kind:"RICH_TEXT",order:20,
  fields:{heading:d.bodyHeading||"About the Foundation",body:d.body,
   eyebrow:d.bodyEyebrow,variant:d.bodyVariant,highlights:lines(d.highlights)}});
 if(d.promoHeading.trim())sections.push({kind:"CTA",order:30,
  fields:{heading:d.promoHeading,eyebrow:d.promoEyebrow,body:d.promoBody,
   ...(d.promoLabel.trim()?{label:d.promoLabel}:{}),
   ...(d.promoPath.trim()?{path:d.promoPath}:{})}});
 if(d.featuresHeading.trim()&&d.featureCards.length)sections.push({
  kind:"FEATURE_CARDS",order:40,
  fields:{heading:d.featuresHeading,eyebrow:d.featuresEyebrow,
   body:d.featuresBody,cards:d.featureCards}});
 if(d.volunteerTitle.trim()&&d.memberTitle.trim())sections.push({
  kind:"JOIN_CARDS",order:50,
  fields:{volunteerTitle:d.volunteerTitle,volunteerBody:d.volunteerBody,
   volunteerBenefits:lines(d.volunteerBenefits),
   memberTitle:d.memberTitle,memberBody:d.memberBody,
   memberBenefits:lines(d.memberBenefits)}});
 if(d.projectSources.length)sections.push({kind:"PROJECT_TEASER",order:60,fields:{heading:d.projectHeading,sourceRefs:d.projectSources}});
 if(d.campaignSources.length)sections.push({kind:"CAMPAIGN_TEASER",order:61,fields:{heading:d.campaignHeading,sourceRefs:d.campaignSources}});
 if(d.team.length)sections.push({kind:"TEAM",order:70,
  fields:{heading:d.teamHeading||"Our team",members:d.team}});
 if(d.kind==="HOME"&&(d.footerMission||d.footerAddress||d.footerEmail||d.footerPhone||d.footerWhatsappNumber))
  sections.push({kind:"SITE_FOOTER",order:90,
   fields:{mission:d.footerMission,address:d.footerAddress,
    phone:d.footerPhone,whatsappNumber:d.footerWhatsappNumber,email:d.footerEmail,newsletterText:d.footerNewsletterText}});
 if(!sections.length)sections.push({kind:"RICH_TEXT",order:20,
  fields:{heading:d.title||"About the Foundation",body:d.body,variant:"STANDARD"}});
 return {kind:d.kind,slug:d.kind==="HOME"?"home":"about",title:d.title,
  seoTitle:d.seoTitle||d.title,seoDescription:d.seoDescription,
  canonicalPath:d.kind==="HOME"?"/":"/about",sections,assets:d.assets,
  ...(d.kind==="HOME"?{navigation:{loginDesired:d.loginDesired,
   memberJoinDesired:d.memberJoinDesired,volunteerJoinDesired:d.volunteerJoinDesired}}:{})};
}
function CmsReviewSection({kind,fields}:{kind:string;fields:Record<string,unknown>}){
 const heading=val(fields.heading);
 const labels=kind==="HERO"?
  [["Eyebrow",fields.eyebrow],
   ["Badges",Array.isArray(fields.tags)?fields.tags.join(", "):""],
   ["Description",fields.description],["Subtitle",fields.subtitle],
   ["Heading font",fields.headingFont],["Weight",fields.headingWeight],
   ["Size",fields.headingSize],["Visible on website",fields.visible===false?"No":"Yes"],["Heading colour",fields.headingColor],
   ["Subtitle colour",fields.subtitleColor],
   ["Primary button",fields.primaryLabel],["Primary destination",fields.primaryPath],
   ["Secondary button",fields.secondaryLabel],["Secondary destination",fields.secondaryPath]]:
  kind==="RICH_TEXT"?[["Eyebrow",fields.eyebrow],["Page text",fields.body],
   ["Highlights",Array.isArray(fields.highlights)?fields.highlights.join("; "):""]]:
  kind==="CTA"?[["Heading",fields.heading],["Eyebrow",fields.eyebrow],
   ["Description",fields.body],["Button",fields.label],["Destination",fields.path]]:[];
 return <div className="cg-cms-review-text">
  {!!heading&&<h5>{heading}</h5>}
  {labels.filter(([,value])=>val(value)).map(([label,value],i)=>
   <p key={i}><strong>{val(label)}:</strong> {val(value)}</p>)}
  {["FEATURE_CARDS","JOIN_CARDS","SITE_FOOTER","IMPACT_GROUP",
    "COMPLIANCE_FACTS","GALLERY_GRID","ARTICLE_BODY","HEALTHCARE_CATEGORIES"].includes(kind)&&
   <pre className="cg-cms-review-text">{JSON.stringify(fields,null,2).slice(0,7000)}</pre>}
  {kind==="TEAM"&&Array.isArray(fields.members)&&fields.members.map((member,i)=>{
   const x=member as Record<string,unknown>;
   return <p key={i}><strong>{val(x.name)}</strong> · {val(x.designation)}
    {val(x.bio)?": "+val(x.bio):""}
    {x.consentConfirmed===true?" · Public-use consent confirmed":""}</p>;
  })}
 </div>;
}
async function serverMessage(r:Response){
 const result:unknown=await r.json().catch(()=>null);
 if(result&&typeof result==="object"&&"message" in result&&
  typeof result.message==="string")return result.message.slice(0,240);
 return r.status===403?"Your role does not allow this website change.":
  r.status===409?"Someone changed this page. Refresh before continuing.":
  "The request could not be confirmed. Check its status before retrying.";
}
// Rejected 4xx actions never committed. For network/5xx uncertainty,
// retain the original idempotency key until the action is reconciled.
class CmsRequestRejected extends Error {
 constructor(readonly status:number,message:string){super(message);this.name="CmsRequestRejected";}
}
async function read<T>(path:string,init?:RequestInit):Promise<T>{
 const r=await fetch("/api/cms/"+path,{cache:"no-store",...init});
 if(!r.ok){
  const message=await serverMessage(r);
  if(r.status>=400&&r.status<500)throw new CmsRequestRejected(r.status,message);
  throw Error(message);
 }
 return r.json() as Promise<T>;
}
export function CmsAdminWorkspace({canManage,canPublish,canReview}:{
 canManage:boolean;canPublish:boolean;canReview:boolean}){
 const [pages,setPages]=useState<PageItem[]>([]),[projectChoices,setProjectChoices]=useState<ProjectSource[]>([]),[projectError,setProjectError]=useState("");
 const [campaignChoices,setCampaignChoices]=useState<CampaignSource[]>([]),[campaignError,setCampaignError]=useState("");
 const refreshProjects=()=>{setProjectError("");void read<{sources:ProjectSource[]}>("project-sources").then(v=>setProjectChoices(v.sources)).catch(()=>setProjectError("Current approved project sources unavailable."));};
 const refreshCampaigns=()=>{setCampaignError("");void read<{sources:CampaignSource[]}>("campaign-sources").then(v=>setCampaignChoices(v.sources)).catch(()=>setCampaignError("Approved campaigns are unavailable. Refresh after CG-03 review."));};
 useEffect(()=>{if(canManage){refreshProjects();refreshCampaigns();}},[canManage]);
 const [selected,setSelected]=useState<PageDetail|null>(null);
 const [draft,setDraft]=useState<Draft>(blank("HOME"));
 const [preview,setPreview]=useState(false),[reviewing,setReviewing]=useState(false);
 const [reviews,setReviews]=useState<Review[]>([]);
 const [review,setReview]=useState<ReviewDetail|null>(null);
 const [reviewPassword,setReviewPassword]=useState("");
 const [remark,setRemark]=useState("");
 const [withdrawReason,setWithdrawReason]=useState("");
 const [publishWhen,setPublishWhen]=useState("");
 const [heroEditorTab,setHeroEditorTab]=useState<"BASIC"|"IMAGES"|"BUTTONS"|"PREVIEW">("BASIC");
 const [activeHeroIndex,setActiveHeroIndex]=useState(0);
 const [teamEditorTab,setTeamEditorTab]=useState<"BASIC"|"DETAILS"|"PREVIEW">("BASIC");
 const [uploadRole,setUploadRole]=useState<Asset["role"]>("HERO");
 const [uploadOrder,setUploadOrder]=useState(0);
 const [uploadAlt,setUploadAlt]=useState(""),[rights,setRights]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [pending,setPending]=useState<Command|null>(null);
 // CG19 is the only media-intent owner. Retain the same intent identity
 // after an uncertain network/storage response instead of creating a
 // second key when the editor selects the same original file again.
 const mediaAttempt=useRef<{fingerprint:string;key:string;uploadRef:string|null}|null>(null);
 const refresh=useCallback(async()=>{
  try{const x=await read<{pages:PageItem[]}>("pages");
   setPages(x.pages.filter(p=>p.kind==="HOME"||p.kind==="ABOUT"));}
  catch(e){setError(e instanceof Error?e.message:"Could not load website pages.");}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function open(ref:string){
  if(busy)return;
  if(pending||mediaAttempt.current){
   setError("An earlier CMS request may have committed. Retry the original "+
    "key before switching pages.");
   return;
  }
  setBusy(true);setError("");setNotice("");
  try{const x=await read<PageDetail>("pages/"+ref);setSelected(x);setDraft(fromPage(x));
   setReviewing(false);setReview(null);setPreview(false);setPublishWhen("");}
  catch(e){setError(e instanceof Error?e.message:"Page detail unavailable.");}
  finally{setBusy(false);}
 }
 function edit<K extends keyof Draft>(field:K,value:Draft[K]){
  setDraft(x=>({...x,[field]:value}));
 }
 function moveSlide(index:number,delta:number){
  const target=index+delta;if(target<0||target>=draft.slides.length)return;
  const slides=[...draft.slides];[slides[index],slides[target]]=[slides[target],slides[index]];
  const assets=draft.assets.map(a=>{
   if(a.role!=="HERO"&&a.role!=="MOBILE_HERO")return a;
   return a.order===index?{...a,order:target}:
    a.order===target?{...a,order:index}:a;
  });
  setDraft(v=>({...v,slides,assets}));
  setActiveHeroIndex(target);
 }
 function removeIndexedContent(role:"TEAM"|"FEATURE",index:number){
  setDraft(current=>({
   ...current,
   ...(role==="TEAM"?{team:current.team.filter((_,i)=>i!==index)}:
     {featureCards:current.featureCards.filter((_,i)=>i!==index)}),
   assets:current.assets.filter(asset=>asset.role!==role||asset.order!==index)
    .map(asset=>asset.role===role&&asset.order>index?
     {...asset,order:asset.order-1}:asset)
  }));
 }
 function removeSlide(index:number){
  const slides=draft.slides.filter((_,i)=>i!==index);
  const assets=draft.assets.filter(a=>!["HERO","MOBILE_HERO"].includes(a.role)||
   a.order!==index).map(a=>["HERO","MOBILE_HERO"].includes(a.role)&&a.order>index?
    {...a,order:a.order-1}:a);
  setDraft(v=>({...v,slides,assets}));
  setActiveHeroIndex(v=>Math.min(v,Math.max(0,slides.length-1)));
 }
 const unsaved=selected!==null&&
  JSON.stringify(payload(draft))!==JSON.stringify(payload(fromPage(selected)));
 const heroPhotoMissing=draft.kind==="HOME"&&(
  !draft.slides.some(slide=>slide.visible)||draft.slides.some((slide,index)=>
  slide.visible&&
  !draft.assets.some(asset=>asset.role==="HERO"&&asset.order===index)));
 const okay=draft.title.trim().length>=3&&
  (draft.kind!=="HOME"||draft.slides.length>0)&&
  draft.slides.length<=6&&draft.slides.every(x=>x.heading.trim().length>=3)&&
  draft.slides.every(x=>
   Boolean(x.primaryLabel.trim())===Boolean(x.primaryPath.trim())&&
   Boolean(x.secondaryLabel.trim())===Boolean(x.secondaryPath.trim())&&
   (!x.primaryPath.trim()||isCmsCtaRoute(x.primaryPath.trim()))&&
   (!x.secondaryPath.trim()||isCmsCtaRoute(x.secondaryPath.trim())))&&
  (!draft.promoHeading||Boolean(draft.promoLabel.trim())===Boolean(draft.promoPath.trim())&&(!draft.promoPath.trim()||isCmsCtaRoute(draft.promoPath.trim())))&&
  (!draft.featureCards.length||draft.featuresHeading.trim().length>=3)&&
  (!draft.featuresHeading||draft.featureCards.length>0&&draft.featureCards.every(x=>
    x.label.trim().length>=2&&x.title.trim().length>=3&&x.body.trim().length>=5))&&
  ((![draft.volunteerTitle,draft.volunteerBody,draft.memberTitle,
    draft.memberBody].some(Boolean))||
    [draft.volunteerTitle,draft.volunteerBody,draft.memberTitle,
     draft.memberBody].every(x=>x.trim().length>=3))&&
  draft.body.trim().length>=5&&
  draft.team.length===0;
 const draftIssue=draft.title.trim().length<3?
  "Enter a website page title of at least 3 characters.":
  draft.body.trim().length<5?
  "Add the Foundation story or introduction, using at least 5 characters.":
  draft.kind==="HOME"&&!draft.slides.length?
  "Add at least one homepage banner.":
  draft.slides.some(slide=>slide.heading.trim().length<3)?
  "Enter a heading of at least 3 characters for every banner.":
  draft.slides.some(slide=>
    Boolean(slide.primaryLabel.trim())!==Boolean(slide.primaryPath.trim())||
    Boolean(slide.secondaryLabel.trim())!==Boolean(slide.secondaryPath.trim())||
    [slide.primaryPath,slide.secondaryPath].some(v=>v.trim()&&
      !isCmsCtaRoute(v.trim())))?
  "Every banner button needs a label and a supported public page destination.":
  Boolean(draft.promoLabel.trim())!==Boolean(draft.promoPath.trim())||(!!draft.promoPath.trim()&&!isCmsCtaRoute(draft.promoPath.trim()))?
  "Enter both a promotional button label and a working page destination.":
  draft.featuresHeading.trim()&&!draft.featureCards.length?
  "Add a solution card or clear the unused section heading.":
  draft.featureCards.some(card=>card.label.trim().length<2||
    card.title.trim().length<3||card.body.trim().length<5)?
  "Complete each solution card's category, title and description.":
  draft.team.length>0?
  "Remove manually entered team profiles. Public profiles need verified CG-10/CG-04 source and revocable consent before publication.":
  !okay?"Complete the remaining website content before saving.":null;
 async function send(c:Command){
  if(busy)return;
  setBusy(true);setError("");setNotice("");setPending(c);
  try{
   const outcome=await read<{confirmed:boolean;pageRef?:string;status?:string}>(c.path,{
    method:c.method,headers:{"Content-Type":"application/json"},body:JSON.stringify(c.body)});
   if(!outcome.confirmed)throw Error("Publication action was not confirmed. Check the original record.");
   setPending(null);setNotice(c.label+" confirmed. "+val(outcome.status).replaceAll("_"," "));
   // A confirmed write stays confirmed even if the subsequent refresh fails.
   // Never invite a duplicate save after the server has acknowledged it.
   await refresh();
   try{
    if(c.path.startsWith("pages/")&&selected){
     const x=await read<PageDetail>("pages/"+selected.pageRef);
     setSelected(x);setDraft(fromPage(x));
    }else if(outcome.pageRef){
     const x=await read<PageDetail>("pages/"+outcome.pageRef);
     setSelected(x);setDraft(fromPage(x));
    }
   }catch{
    setSelected(null);setDraft(blank("HOME"));
     setError("This CMS action is CONFIRMED, but the latest page "+
      "could not be loaded. Refresh before editing again.");
   }
  }catch(e){
   if(e instanceof CmsRequestRejected)setPending(null);
   setError(e instanceof Error?e.message:"Action not confirmed. Retry the same request key.");
  }
  finally{setBusy(false);}
 }
 const command=(label:string,path:string,method:"POST"|"PUT",body:Record<string,unknown>)=>{
  if(busy||pending||mediaAttempt.current){
   setError("Resolve the previous original CMS request using its existing "+
    "retry key before creating another action.");
   return;
  }
  void send({label,path,method,body:{requestKey:crypto.randomUUID(),...body}});
 };
 async function showInbox(afterConfirmedDecision=false){
  // The only allowed busy caller is our own already-confirmed reviewer
  // decision, whose list refresh is a READ, not a second CG03 mutation.
  if(busy&&!afterConfirmedDecision)return;
  if((pending||mediaAttempt.current)&&!afterConfirmedDecision){
   setError("Resolve the original uncertain CMS request before switching to reviews.");
   return;
  }
  setBusy(true);setError("");setReviewing(true);setPreview(false);
  try{const x=await read<{cases:Review[]}>("reviews");setReviews(x.cases);setReview(null);}
  catch(e){setError(e instanceof Error?e.message:"Review inbox unavailable.");}
  finally{setBusy(false);}
 }
 async function openReview(ref:string){
  if(busy||pending)return;
  setBusy(true);setError("");
  try{setReview(await read<ReviewDetail>("reviews/"+ref));setRemark("");setReviewPassword("");}
  catch(e){setError(e instanceof Error?e.message:"Reviewer source unavailable.");}
  finally{setBusy(false);}
 }
 async function decide(action:"APPROVE"|"RETURN"|"REJECT"){
  if(busy||pending||!review||reviewPassword.length<8)return;
  if(action==="APPROVE"&&review.source.assets.some(asset=>!asset.current)){
   setError("One or more images are no longer approved. Return this page to its editor.");
   return;
  }
  setBusy(true);setError("");
  const c:Command={label:"Reviewer decision",path:"reviews/"+review.caseRef+"/decide",
   method:"POST",body:{requestKey:crypto.randomUUID(),
    expectedRevision:review.revision,action,remarks:remark,currentPassword:reviewPassword}};
  setPending(c);
  try{
   const result=await read<{confirmed:boolean;status:string}>(c.path,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(c.body)});
   if(!result.confirmed)throw Error("Decision could not be confirmed.");
   setPending(null);setReview(null);setReviewPassword("");
   setNotice(action==="APPROVE"?"The page is approved. A publisher must still publish it.":
    "The author can now correct or review this page.");
   await showInbox(true);await refresh();
  }catch(e){
   if(e instanceof CmsRequestRejected)setPending(null);
   setError(e instanceof Error?e.message:"Review was not confirmed.");
  }
  finally{setBusy(false);}
 }
 async function upload(file:File,placement?:{role:Asset["role"];order:number}){
  if(!selected||selected.status!=="DRAFT"||busy||pending)return;
  if(!rights){setError("Confirm that the Foundation may publish this image.");return;}
  if(!uploadAlt.trim()||file.size<1||file.size>10485760||
   !["image/jpeg","image/png","image/webp"].includes(file.type)){
   setError("Choose a JPG, PNG or WebP under 10 MB and describe the image.");return;
  }
  setBusy(true);setError("");setNotice("");
  try{
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())))
    .map(x=>x.toString(16).padStart(2,"0")).join("");
   const role=placement?.role??uploadRole,rawOrder=placement?.order??uploadOrder;
   const order=role==="ABOUT"?20:role==="PROMO"?30:rawOrder;
   const fingerprint=JSON.stringify([selected.pageRef,selected.revisionRef,
    file.type,file.size,sha,role,order,uploadAlt.trim()]);
   const old=mediaAttempt.current;
   if(old&&old.fingerprint!==fingerprint)
    throw Error("An earlier private upload is not resolved. Re-select the SAME "+
     "original file, placement and description to verify it first.");
   const attempt:{fingerprint:string;key:string;uploadRef:string|null}=
    old??{fingerprint,key:crypto.randomUUID(),uploadRef:null};
   mediaAttempt.current=attempt;
   const attach=(fileRef:string,version:number)=>{
    const item:Asset={fileRef,version,role,altText:uploadAlt.trim(),order};
    setDraft(current=>({...current,assets:[...current.assets.filter(x=>
     x.role!==role||x.order!==order),item]}));
    mediaAttempt.current=null;setUploadAlt("");setRights(false);
    setNotice("Original CG19 scanned image is verified. Save the current draft "+
     "before submitting it for independent review.");
   };
   if(attempt.uploadRef){
    const prior=await read<{status:string;cleanVerified:boolean;
     fileRef:string|null;validatedVersion:number|null}>(
      "media/"+encodeURIComponent(attempt.uploadRef));
    if(prior.cleanVerified&&prior.fileRef&&prior.validatedVersion){
     attach(prior.fileRef,prior.validatedVersion);return;
    }
    if(["REJECTED","EXPIRED","EXPIRED_OR_REJECTED"].includes(prior.status)){
     mediaAttempt.current=null;
     throw Error("The original private upload is confirmed rejected or expired. "+
      "Choose the file again and start a fresh verified upload.");
    }
   }
   const initiated=await read<{uploadRef:string;status:string;uploadUrl?:string;
    uploadHeaders?:Record<string,string>}>("media/initiate",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({pageRef:selected.pageRef,revisionRef:selected.revisionRef,
     requestKey:attempt.key,mime:file.type,sizeBytes:file.size,
     sha256:sha,rightsConfirmed:true})});
   if(!initiated.uploadRef)
    throw Error("Original CG19 media intent could not be confirmed.");
   attempt.uploadRef=initiated.uploadRef;
   if(initiated.status==="VALIDATED"){
    const prior=await read<{cleanVerified:boolean;fileRef:string|null;
     validatedVersion:number|null}>("media/"+encodeURIComponent(initiated.uploadRef));
    if(prior.cleanVerified&&prior.fileRef&&prior.validatedVersion){
     attach(prior.fileRef,prior.validatedVersion);return;
    }
   }
   if(initiated.status!=="UPLOAD_READY"||!initiated.uploadUrl||
    !initiated.uploadHeaders)
    throw Error("Original CG19 media upload is not yet ready. Choose the SAME "+
     "file to check its existing intent; no image has been attached.");
   const target=new URL(initiated.uploadUrl);
   if(target.protocol!=="https:"||target.username||target.password||target.hash||
    initiated.uploadHeaders["Content-Type"]!==file.type)
    throw Error("The signed private upload permission is invalid.");
   const put=await fetch(initiated.uploadUrl,{method:"PUT",
    headers:initiated.uploadHeaders,body:file,cache:"no-store"});
   if(!put.ok)throw Error("Original image transfer is unconfirmed. "+
    "Choose the same file to check its prior CG19 intent.");
   const confirmed=await read<{cleanVerified:boolean;fileRef:string|null;
    validatedVersion:number|null}>(
     "media/"+encodeURIComponent(initiated.uploadRef)+"/confirm",{
     method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
   if(!confirmed.cleanVerified||!confirmed.fileRef||!confirmed.validatedVersion)
    throw Error("Original private image scan or storage verification is pending. "+
     "Choose the same file and check its original intent before another upload.");
   attach(confirmed.fileRef,confirmed.validatedVersion);
  }catch(e){setError(e instanceof Error?e.message:"Original CG19 upload unconfirmed.");}
  finally{setBusy(false);}
 }
 const previewData=payload(draft);
 const previewPage:PublicCmsPage={schemaVersion:1,effectiveGeneration:"DRAFT_PREVIEW",
  kind:draft.kind,slug:previewData.slug,title:draft.title,
  seoTitle:draft.seoTitle||draft.title,seoDescription:draft.seoDescription,
  canonicalPath:previewData.canonicalPath,lastPublishedAt:"",
  sections:previewData.sections,assets:selected?draft.assets.map(a=>({
   role:a.role,order:a.order,altText:a.altText,
   src:"/api/cms-image-preview/"+a.fileRef})):[]};
 return <div className="cg-cms-workspace">
  <header className="cg-cms-toolbar"><div>
   <h1>Website content</h1><p>Draft → independent approval → publish. Public visitors see only approved pages.</p>
  </div><div className="cg-cms-actions">
   <button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh</button>
   {canReview&&<button type="button" onClick={()=>void showInbox()} disabled={busy}>
    Review approvals</button>}
   {canManage&&<button className="primary" type="button" disabled={busy||!!pending||!!mediaAttempt.current}
    onClick={()=>{setSelected(null);setReviewing(false);
    setDraft(blank("HOME"));setPreview(false);}}>New page</button>}
   {canManage&&!selected&&!reviewing&&<button type="button" disabled={busy||!!mediaAttempt.current}
    onClick={()=>{setDraft({...blank("HOME"),...clientScreenshotHome});setPreview(false);}}>
    Start with reference content</button>}
  </div></header>
  {!reviewing&&<section className="cg-cms-dashboard" aria-label="Current website publishing summary">
   <div><span>Website pages</span><strong>{pages.length}</strong></div>
   <div><span>Published</span><strong>{pages.filter(p=>p.publicStatus==="EFFECTIVE").length}</strong></div>
   <div><span>Working drafts</span><strong>{pages.filter(p=>p.draftStatus==="DRAFT").length}</strong></div>
   <div><span>Submitted for review</span><strong>{pages.filter(p=>p.draftStatus==="SUBMITTED").length}</strong></div>
  </section>}
  {!!error&&<p role="alert" className="cg-cms-error">{error}</p>}
  {!!notice&&<p role="status" className="cg-cms-notice">{notice}</p>}
  {pending&&<div className="cg-cms-notice" role="status"><p>Result not confirmed.
   Refresh the record first; retry only the original request.</p>
   <button type="button" disabled={busy} onClick={()=>void send(pending)}>Retry original action</button>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Check current records</button>
  </div>}
  {reviewing?<section className="cg-cms-card">
   <h3>Website publication approvals</h3>
   <div className="cg-cms-list">{reviews.map(v=><button type="button" key={v.caseRef}
    aria-pressed={review?.caseRef===v.caseRef} disabled={busy}
    onClick={()=>void openReview(v.caseRef)}>
    <strong>{v.title}</strong><span>{v.number} · {v.status.replaceAll("_"," ")}</span>
   </button>)}</div>
   {!reviews.length&&<p>No submitted pages are awaiting an editorial decision.</p>}
   {review&&<section className="cg-cms-form" aria-label="Review original page">
    <h4>{review.source.title} — original draft</h4>
    <p>{review.source.kind==="HOME"?"Homepage":"About page"} · {review.status}</p>
    {review.source.navigation&&<div className="cg-cms-notice">
     <p>Reviewed navigation: Staff login {review.source.navigation.loginDesired?"requested":"hidden"};
      member registration {review.source.navigation.memberJoinDesired?"requested, unavailable until delivered":"hidden"};
      volunteer registration {review.source.navigation.volunteerJoinDesired?"requested, unavailable until delivered":"hidden"}.</p>
    </div>}
    {review.source.sections.map((sec,i)=><article key={i}><strong>{sec.kind.replaceAll("_"," ")}</strong>
     <CmsReviewSection kind={sec.kind} fields={sec.fields}/>
    </article>)}
    <h5>Approved image placements</h5>
     {!review.source.assets.length?<p>No images attached.</p>:
      <ul>{review.source.assets.map((asset,i)=><li key={i}>
       {asset.role.replaceAll("_"," ")}: {asset.altText} (position {asset.order+1})
       {asset.current?" — verified":" — source no longer verified; do not approve"}
       {asset.current&&asset.mime?.startsWith("image/")&&
        <img src={"/api/cms-image-preview/"+asset.fileRef}
         alt={asset.altText} loading="lazy" className="cg-cms-review-image"/>}
       {asset.current&&asset.mime==="video/mp4"&&
        <video controls preload="none" aria-label={asset.altText}
         className="cg-cms-review-image"
         src={"/api/cms-file-preview/"+asset.fileRef}/>}
       {asset.current&&asset.mime==="application/pdf"&&
        <a href={"/api/cms-file-preview/"+asset.fileRef} download>
         Review original scanned PDF proof</a>}
      </li>)}</ul>}
     {["SUBMITTED","IN_REVIEW"].includes(review.status)&&<>
     <label>Review comments<textarea value={remark} maxLength={500}
      onChange={e=>setRemark(e.target.value)}/></label>
     <label>Current reviewer password<input type="password" autoComplete="current-password"
      value={reviewPassword} onChange={e=>setReviewPassword(e.target.value)}/></label>
     <div className="cg-cms-actions">
      <button disabled={busy||reviewPassword.length<8||
       review.source.assets.some(asset=>!asset.current)} onClick={()=>void decide("APPROVE")}>
       Approve original content</button>
      <button disabled={busy||reviewPassword.length<8} onClick={()=>void decide("RETURN")}>
       Return for changes</button>
      <button disabled={busy||reviewPassword.length<8} onClick={()=>void decide("REJECT")}>
       Reject</button>
     </div>
    </>}
   </section>}
   <button type="button" disabled={busy||!!pending}
     onClick={()=>setReviewing(false)}>Back to pages</button>
  </section>:<>
   <section className="cg-cms-list" aria-label="Foundation website pages">
    {pages.map(v=><button type="button" key={v.pageRef} disabled={busy}
     aria-pressed={selected?.pageRef===v.pageRef} onClick={()=>void open(v.pageRef)}>
     <strong>{v.title}</strong><span>{v.kind==="HOME"?"Homepage":"About"} · {v.draftStatus.replaceAll("_"," ")}
      {v.publicStatus?" · "+v.publicStatus.replaceAll("_"," "):""}</span></button>)}
    {!pages.length&&<p>No Foundation website pages have been created.</p>}
   </section>
   {(canManage||selected)&&<section className="cg-cms-card">
    <div className="cg-cms-toolbar"><h3>{selected?"Edit original website page":"Create website page"}</h3>
     <button type="button" onClick={()=>setPreview(v=>!v)}>
      {preview?"Back to editor":"Preview draft"}</button></div>
    {preview?<div className="cg-cms-preview">
     <p>Private draft preview — not published. Verified images load only for authorized Foundation staff; live visitors never see this draft.</p>
     <CmsPublicPage page={previewPage}/>
    </div>:<div className="cg-cms-form">
     <p>The original site's visible words are a drafting reference. Confirm all
        impact, tax and partnership claims, link destinations and photo rights before publication.</p>
      <label>Page<select disabled={!!selected||!canManage} value={draft.kind}
      onChange={e=>setDraft(blank(e.target.value as Kind))}>
      <option value="HOME">Homepage</option><option value="ABOUT">About the Foundation</option>
     </select></label>
     <label>Page title<input disabled={!canManage} value={draft.title} maxLength={180}
      onChange={e=>edit("title",e.target.value)} placeholder="Enter the actual page title"/></label>
     <label>Search title<input disabled={!canManage} value={draft.seoTitle} maxLength={180}
      onChange={e=>edit("seoTitle",e.target.value)} placeholder="Optional — uses page title"/></label>
     <label>Search description<textarea disabled={!canManage} value={draft.seoDescription}
      maxLength={300} onChange={e=>edit("seoDescription",e.target.value)}/></label>
     {draft.kind==="HOME"&&<fieldset><legend>Public navigation (original C50)</legend>
      <p>These choices are reviewed with the homepage. Member and volunteer links
       remain hidden until registration is genuinely delivered.</p>
      <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
       checked={draft.loginDesired} onChange={e=>edit("loginDesired",e.target.checked)}/>
       Show Foundation staff login</label>
      <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
       checked={draft.memberJoinDesired} onChange={e=>edit("memberJoinDesired",e.target.checked)}/>
       Request member registration link when available</label>
      <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
       checked={draft.volunteerJoinDesired} onChange={e=>edit("volunteerJoinDesired",e.target.checked)}/>
       Request volunteer registration link when available</label>
     </fieldset>}
     <fieldset><legend>Approved operational projects</legend><p>Select current CG-05 reviewed sources. Saving or submitting does not publish them.</p>
      <label>Heading<input maxLength={160} value={draft.projectHeading} disabled={!canManage||busy||!!pending} onChange={e=>edit("projectHeading",e.target.value)}/></label>
      <button type="button" disabled={!canManage||busy||!!pending} onClick={refreshProjects}>Refresh approved projects</button>
      {projectError&&<p role="alert">{projectError}</p>}{!projectChoices.length&&!projectError&&<p>No current eligible projects.</p>}
      {projectChoices.map(p=><label className="cg-cms-consent" key={p.sourceRef}><input type="checkbox" disabled={!canManage||busy||!!pending||(!draft.projectSources.includes(p.sourceRef)&&draft.projectSources.length>=12)} checked={draft.projectSources.includes(p.sourceRef)} onChange={e=>edit("projectSources",e.target.checked?[...draft.projectSources,p.sourceRef]:draft.projectSources.filter(x=>x!==p.sourceRef))}/>{p.title} · {p.category} · {p.area}</label>)}
      {draft.projectSources.filter(x=>!projectChoices.some(p=>p.sourceRef===x)).map(x=><button key={x} type="button" disabled={!canManage||busy||!!pending} onClick={()=>edit("projectSources",draft.projectSources.filter(y=>y!==x))}>Remove unavailable project selection</button>)}
     </fieldset>
     <fieldset><legend>Independent campaign publication (CG-07)</legend>
      <p>Only actual CG-03-approved campaigns can be selected. Saving the page does not make them public: a different reviewer must approve this CG-18 editorial revision, then a publisher must make it effective.</p>
      <label>Heading<input maxLength={160} value={draft.campaignHeading} disabled={!canManage||busy||!!pending}
       onChange={e=>edit("campaignHeading",e.target.value)}/></label>
      <button type="button" disabled={!canManage||busy||!!pending} onClick={refreshCampaigns}>Refresh currently approved campaigns</button>
      {campaignError&&<p role="alert">{campaignError}</p>}
      {!campaignChoices.length&&!campaignError&&<p>No independently approved campaign is eligible yet.</p>}
      {campaignChoices.map(c=><label className="cg-cms-consent" key={c.sourceRef}>
       <input type="checkbox" disabled={!canManage||busy||!!pending||(!draft.campaignSources.includes(c.sourceRef)&&draft.campaignSources.length>=12)}
        checked={draft.campaignSources.includes(c.sourceRef)}
        onChange={e=>edit("campaignSources",e.target.checked?[...draft.campaignSources,c.sourceRef]:draft.campaignSources.filter(x=>x!==c.sourceRef))}/>
       {c.title} · {c.category} · {c.area||"Foundation-wide"}
      </label>)}
      {draft.campaignSources.filter(x=>!campaignChoices.some(c=>c.sourceRef===x)).map(x=>
       <button type="button" key={x} disabled={!canManage||busy||!!pending}
        onClick={()=>edit("campaignSources",draft.campaignSources.filter(v=>v!==x))}>Remove unavailable campaign selection</button>)}
     </fieldset>
     <div className="cg-cms-editor-grid">
      <fieldset><legend>Hero banners — original C22–C24</legend>
        <p>Each slide has independent text, buttons and approved desktop/mobile images.
         The current slide order is saved with the draft and subject to independent review.</p>
        <div className="cg-cms-banner-summary" aria-label="Homepage banner list">
         {draft.slides.map((slide,index)=>{
          const desktop=draft.assets.find(asset=>asset.role==="HERO"&&asset.order===index);
          const mobile=draft.assets.some(asset=>asset.role==="MOBILE_HERO"&&asset.order===index);
          const active=index===Math.min(activeHeroIndex,draft.slides.length-1);
          return <button type="button" key={index} className="cg-cms-banner-row"
           aria-pressed={active} onClick={()=>setActiveHeroIndex(index)}>
           {desktop?<img alt={desktop.altText} loading="lazy"
            src={"/api/cms-image-preview/"+desktop.fileRef}/>:
            <span className="cg-cms-banner-no-image">Add image</span>}
           <span className="cg-cms-banner-description"><strong>{slide.heading||"Untitled banner"}</strong>
            <small>Banner {index+1} · {slide.visible?"Visible":"Hidden"} ·
             {mobile?"Mobile image":"No mobile image"}</small></span>
           <span className="cg-cms-banner-edit">{active?"Editing":"Edit"}</span>
          </button>;
         })}
        </div>
        <div className="cg-cms-tabs" role="tablist" aria-label="Hero banner editor">
         {([["BASIC","Basic Information"],["IMAGES","Images"],
           ["BUTTONS","Button Settings"],["PREVIEW","Preview"]] as const)
          .map(([value,label])=><button key={value} type="button" role="tab"
           aria-selected={heroEditorTab===value} className={heroEditorTab===value?"is-active":""}
           onClick={()=>setHeroEditorTab(value)}>{label}</button>)}
        </div>
        {heroEditorTab==="PREVIEW"&&<div className="cg-cms-preview">
         <CmsPublicPage page={previewPage}/>
        </div>}
        {heroEditorTab!=="PREVIEW"&&draft.slides.map((slide,index)=>
         index===Math.min(activeHeroIndex,draft.slides.length-1)?<div className="cg-cms-team" key={index}>
         <h4>Slide {index+1}</h4>
         {heroEditorTab==="BASIC"&&<>
         <label className="cg-cms-consent"><input type="checkbox"
          disabled={!canManage} checked={slide.visible}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>
           i===index?{...x,visible:e.target.checked}:x))}/>
          Show this banner on the public website and Android app</label>
         <label>Eyebrow<input disabled={!canManage} maxLength={100} value={slide.eyebrow}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,eyebrow:e.target.value}:x))}/></label>
         <label>Heading<input disabled={!canManage} maxLength={180} value={slide.heading}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,heading:e.target.value}:x))}/></label>
         <label>Highlighted subtitle<textarea disabled={!canManage} maxLength={700} value={slide.subtitle}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,subtitle:e.target.value}:x))}/></label>
         <label>Supporting paragraph<textarea disabled={!canManage} maxLength={400} value={slide.description}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,description:e.target.value}:x))}/></label>
         <label>Badges (up to four, comma-separated)<input disabled={!canManage} value={slide.tags}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,tags:e.target.value}:x))}/></label>
         <label>Heading typeface<select disabled={!canManage} value={slide.headingFont}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,headingFont:e.target.value as Slide["headingFont"]}:x))}>
          <option value="SERIF">Original serif heading</option>
          <option value="SANS">Sans-serif heading</option>
         </select></label>
         <label>Heading weight<select disabled={!canManage} value={slide.headingWeight}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,headingWeight:e.target.value as Slide["headingWeight"]}:x))}>
          <option value="BOLD">Bold</option><option value="REGULAR">Regular</option>
         </select></label>
         <label>Heading size<select disabled={!canManage} value={slide.headingSize}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,headingSize:e.target.value as Slide["headingSize"]}:x))}>
          <option value="LARGE">Original large heading</option><option value="STANDARD">Standard</option>
         </select></label>
         <label>Heading colour<input disabled={!canManage} type="color" value={slide.headingColor}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,headingColor:e.target.value.toUpperCase()}:x))}/></label>
         <label>Subtitle colour<input disabled={!canManage} type="color" value={slide.subtitleColor}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,subtitleColor:e.target.value.toUpperCase()}:x))}/></label>
         </>}
         {heroEditorTab==="BUTTONS"&&<>
         <label>Primary button label<input disabled={!canManage} maxLength={60} value={slide.primaryLabel}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,primaryLabel:e.target.value}:x))}/></label>
         <label>Primary route<input disabled={!canManage} value={slide.primaryPath} placeholder="/about"
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,primaryPath:e.target.value}:x))}/></label>
         <label>Secondary button label<input disabled={!canManage} maxLength={60} value={slide.secondaryLabel}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,secondaryLabel:e.target.value}:x))}/></label>
         <label>Secondary route<input disabled={!canManage} value={slide.secondaryPath} placeholder="/contact"
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,secondaryPath:e.target.value}:x))}/></label>
         </>}
         {heroEditorTab==="IMAGES"&&<>
          <p>Upload an approved desktop image and optionally a separate mobile image for this banner.
           Both images use the Foundation's existing secure file scanner.</p>
          {draft.assets.filter(asset=>
           (asset.role==="HERO"||asset.role==="MOBILE_HERO")&&asset.order===index)
           .map(asset=><div className="cg-cms-asset" key={asset.fileRef}>
            <strong>{asset.role==="HERO"?"Desktop":"Mobile"} image:</strong> {asset.altText}
            <img loading="lazy" className="cg-cms-review-image"
             src={"/api/cms-image-preview/"+asset.fileRef} alt={asset.altText}/>
           </div>)}
          {selected?.status==="DRAFT"&&canManage&&<>
           <label>Image description<input maxLength={300} value={uploadAlt}
            onChange={e=>setUploadAlt(e.target.value)}/></label>
           <label className="cg-cms-consent"><input type="checkbox"
            checked={rights} onChange={e=>setRights(e.target.checked)}/>
            The Foundation has permission to publish this photograph</label>
           <label>Desktop banner image<input type="file" accept="image/jpeg,image/png,image/webp"
            disabled={busy||!rights||uploadAlt.trim().length<3}
            onChange={e=>{const file=e.target.files?.[0];
             if(file)void upload(file,{role:"HERO",order:index});
             e.currentTarget.value="";}}/></label>
           <label>Optional mobile image<input type="file" accept="image/jpeg,image/png,image/webp"
            disabled={busy||!rights||uploadAlt.trim().length<3}
            onChange={e=>{const file=e.target.files?.[0];
             if(file)void upload(file,{role:"MOBILE_HERO",order:index});
             e.currentTarget.value="";}}/></label>
          </>}
          {!selected&&<p>Save a draft first to attach validated photographs.</p>}
         </>}
         {canManage&&<div className="cg-cms-actions">
          <button type="button" disabled={index===0} onClick={()=>moveSlide(index,-1)}>Move up</button>
          <button type="button" disabled={index===draft.slides.length-1}
           onClick={()=>moveSlide(index,1)}>Move down</button>
          <button type="button" disabled={draft.kind==="HOME"&&draft.slides.length===1}
           onClick={()=>removeSlide(index)}>Remove slide</button>
         </div>}
        </div>:null)}
        {canManage&&draft.slides.length<6&&<button type="button"
         onClick={()=>{setActiveHeroIndex(draft.slides.length);
          edit("slides",[...draft.slides,blankSlide()]);setHeroEditorTab("BASIC");}}>
         Add new banner</button>}
       </fieldset>      <fieldset><legend>Foundation About / story</legend>
       <label>Eyebrow<input disabled={!canManage} value={draft.bodyEyebrow} maxLength={100}
        onChange={e=>edit("bodyEyebrow",e.target.value)}/></label>
       <label>Section heading<input disabled={!canManage} value={draft.bodyHeading}
        maxLength={160} onChange={e=>edit("bodyHeading",e.target.value)}/></label>
       <label>Layout<select disabled={!canManage} value={draft.bodyVariant}
        onChange={e=>edit("bodyVariant",e.target.value as Draft["bodyVariant"])}>
        <option value="SPLIT">Original photo / text split</option>
        <option value="STANDARD">Plain text</option></select></label>
       <label>Foundation information<textarea disabled={!canManage} rows={9}
        value={draft.body} maxLength={4000}
        onChange={e=>edit("body",e.target.value)}/></label>
       <label>Highlights (one per line)<textarea disabled={!canManage} rows={4}
        value={draft.highlights} maxLength={800}
        onChange={e=>edit("highlights",e.target.value)}/></label>
      </fieldset>     </div>
     {draft.kind==="HOME"&&<>
     <fieldset><legend>Volunteer photo banner</legend>
      <label>Eyebrow<input disabled={!canManage} value={draft.promoEyebrow}
       maxLength={80} onChange={e=>edit("promoEyebrow",e.target.value)}/></label>
      <label>Heading<input disabled={!canManage} value={draft.promoHeading}
       maxLength={160} onChange={e=>edit("promoHeading",e.target.value)}/></label>
      <label>Description<textarea disabled={!canManage} value={draft.promoBody}
       maxLength={400} onChange={e=>edit("promoBody",e.target.value)}/></label>
      <label>Button label<input disabled={!canManage} value={draft.promoLabel}
       maxLength={80} onChange={e=>edit("promoLabel",e.target.value)}/></label>
      <label>Button route<input disabled={!canManage} value={draft.promoPath}
       placeholder="/contact" onChange={e=>edit("promoPath",e.target.value)}/></label>
     </fieldset>
     <fieldset><legend>How We Help — solution cards</legend>
      <label>Eyebrow<input disabled={!canManage} value={draft.featuresEyebrow}
       maxLength={80} onChange={e=>edit("featuresEyebrow",e.target.value)}/></label>
      <label>Heading<input disabled={!canManage} value={draft.featuresHeading}
       maxLength={160} onChange={e=>edit("featuresHeading",e.target.value)}/></label>
      <label>Description<textarea disabled={!canManage} value={draft.featuresBody}
       maxLength={500} onChange={e=>edit("featuresBody",e.target.value)}/></label>
      {draft.featureCards.map((card,index)=><div className="cg-cms-team" key={index}>
       <h4>Card {index+1}</h4>
       {(["label","title","body"] as const).map(field=><label key={field}>
        {field==="label"?"Category":field==="title"?"Title":"Description"}
        <input disabled={!canManage} value={card[field]}
         onChange={e=>edit("featureCards",draft.featureCards.map((x,i)=>
          i===index?{...x,[field]:e.target.value}:x))}/>
       </label>)}
       {canManage&&<button type="button"
        onClick={()=>removeIndexedContent("FEATURE",index)}>
        Remove card</button>}
      </div>)}
      {canManage&&draft.featureCards.length<3&&<button type="button"
       onClick={()=>edit("featureCards",[...draft.featureCards,{label:"",title:"",body:""}])}>
       Add solution card</button>}
     </fieldset>
     <fieldset><legend>Member and volunteer editorial cards</legend>
      <p>Real Join links only appear after CG-04 registration routes are operational.</p>
      <label>Volunteer heading<input disabled={!canManage} maxLength={120}
       value={draft.volunteerTitle} onChange={e=>edit("volunteerTitle",e.target.value)}/></label>
      <label>Volunteer description<textarea disabled={!canManage} maxLength={500}
       value={draft.volunteerBody} onChange={e=>edit("volunteerBody",e.target.value)}/></label>
      <label>Volunteer benefits (one per line)<textarea disabled={!canManage}
       value={draft.volunteerBenefits} onChange={e=>edit("volunteerBenefits",e.target.value)}/></label>
      <label>Member heading<input disabled={!canManage} maxLength={120}
       value={draft.memberTitle} onChange={e=>edit("memberTitle",e.target.value)}/></label>
      <label>Member description<textarea disabled={!canManage} maxLength={500}
       value={draft.memberBody} onChange={e=>edit("memberBody",e.target.value)}/></label>
      <label>Member benefits (one per line)<textarea disabled={!canManage}
       value={draft.memberBenefits} onChange={e=>edit("memberBenefits",e.target.value)}/></label>
     </fieldset>
     <fieldset><legend>Website header / footer content</legend>
      <p>Published site contact information is reused on Home and About.</p>
      <label>Mission<textarea disabled={!canManage} maxLength={600}
       value={draft.footerMission} onChange={e=>edit("footerMission",e.target.value)}/></label>
      <label>Public address<input disabled={!canManage} maxLength={300}
       value={draft.footerAddress} onChange={e=>edit("footerAddress",e.target.value)}/></label>
      <label>Phone<input disabled={!canManage} maxLength={32}
       value={draft.footerPhone} onChange={e=>edit("footerPhone",e.target.value)}/></label>
      <label>Approved WhatsApp number (country code + number; leave blank to hide the WhatsApp button)<input disabled={!canManage} maxLength={16}
       value={draft.footerWhatsappNumber} onChange={e=>edit("footerWhatsappNumber",e.target.value)}
       placeholder="+919876543210"/></label>
      <p>Confirm the WhatsApp destination with the client before publishing. The normal phone is not automatically a WhatsApp number.</p>
      <label>Email<input disabled={!canManage} maxLength={150}
       value={draft.footerEmail} onChange={e=>edit("footerEmail",e.target.value)}/></label>
      <label>Newsletter description<textarea disabled={!canManage} maxLength={250}
       value={draft.footerNewsletterText}
       onChange={e=>edit("footerNewsletterText",e.target.value)}/></label>
     </fieldset>
    </>}
    <fieldset><legend>Public team directory — pending verified people source</legend>
      <p role="status">Team names, photos and biographies will become publishable only through approved CG-10 staff or CG-04 volunteer/member records with revocable display consent. Existing manually entered profiles can be removed; a checkbox alone does not grant publication permission.</p>
      <label>Section heading<input disabled={!canManage} value={draft.teamHeading}
       onChange={e=>edit("teamHeading",e.target.value)}/></label>
      <p>{draft.team.length} public profile{draft.team.length===1?"":"s"} in this draft</p>
      <div className="cg-cms-tabs" role="tablist" aria-label="Team profile editor">
       {([["BASIC","Basic Information"],["DETAILS","Additional Details"],
         ["PREVIEW","Preview"]] as const).map(([value,label])=>
        <button type="button" key={value} role="tab"
         className={teamEditorTab===value?"is-active":""}
         aria-selected={teamEditorTab===value}
         onClick={()=>setTeamEditorTab(value)}>{label}</button>)}
      </div>
      {draft.team.map((member,index)=><div className="cg-cms-team" key={index}>
       <h4>{member.name||"Team profile "+(index+1)}</h4>
       {teamEditorTab==="BASIC"&&<>
        <label>Public name<input disabled={!canManage} maxLength={100} value={member.name}
         onChange={e=>edit("team",draft.team.map((v,i)=>i===index?{...v,name:e.target.value}:v))}/></label>
        <label>Designation<input disabled={!canManage} maxLength={100} value={member.designation}
         onChange={e=>edit("team",draft.team.map((v,i)=>i===index?{...v,designation:e.target.value}:v))}/></label>
       </>}
       {teamEditorTab==="DETAILS"&&<>
        <label>Public biography<textarea disabled={!canManage} maxLength={600} value={member.bio}
         onChange={e=>edit("team",draft.team.map((v,i)=>i===index?{...v,bio:e.target.value}:v))}/></label>
        <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
         checked={member.consentConfirmed} onChange={e=>
          edit("team",draft.team.map((v,i)=>i===index?{...v,consentConfirmed:e.target.checked}:v))}/>
         The Foundation confirms this person's permission for public display</label>
       </>}
       {teamEditorTab==="PREVIEW"&&<div className="cg-cms-team-preview">
        {draft.assets.filter(asset=>asset.role==="TEAM"&&asset.order===index)
         .map(asset=><img key={asset.fileRef} className="cg-cms-review-image"
          alt={asset.altText} src={"/api/cms-image-preview/"+asset.fileRef} loading="lazy"/>)}
        <strong>{member.name||"Name not entered"}</strong>
        <span>{member.designation||"Designation not entered"}</span>
        {!!member.bio&&<p>{member.bio}</p>}
        <small>{member.consentConfirmed?"Editor consent claim (not source-verified)":
         "Permission required before publication"}</small>
       </div>}
       {canManage&&<button type="button" onClick={()=>removeIndexedContent("TEAM",index)}>
        Remove profile</button>}
      </div>)}
     </fieldset>
     {!!selected&&selected.status==="DRAFT"&&canManage&&<fieldset>
      <legend>Page photographs</legend>
      <p>Upload only an original image the Foundation is authorized to publish.
       It must pass the private file scan before saving the draft.</p>
      <label>Placement<select value={uploadRole}
        onChange={e=>{setUploadRole(e.target.value as Asset["role"]);setUploadOrder(0)}}>
        <option value="HERO">Desktop hero slide photo</option>
        <option value="MOBILE_HERO">Mobile hero slide photo</option>
        <option value="ABOUT">About / story photograph</option>
        <option value="PROMO">Volunteer promotional photograph</option>
        <option value="FEATURE">How We Help card photograph</option>
        </select></label>
       {(["HERO","MOBILE_HERO","TEAM","FEATURE"] as string[]).includes(uploadRole)&&
        <label>{uploadRole==="TEAM"?"Team member":uploadRole==="FEATURE"?"Solution card":"Hero slide"}
         <select value={String(uploadOrder)} onChange={e=>setUploadOrder(Number(e.target.value))}>
          {(uploadRole==="TEAM"?draft.team:
            uploadRole==="FEATURE"?draft.featureCards:draft.slides).map((value,index)=>
            <option key={index} value={index}>{uploadRole==="TEAM"?
             (value as Team).name||"Member "+(index+1):uploadRole==="FEATURE"?
             (value as FeatureCard).title||"Card "+(index+1):
             (value as Slide).heading||"Slide "+(index+1)}</option>)}
         </select></label>}
       <label>Describe the image<input value={uploadAlt} maxLength={300}
       onChange={e=>setUploadAlt(e.target.value)}/></label>
      <label className="cg-cms-consent"><input type="checkbox" checked={rights}
       onChange={e=>setRights(e.target.checked)}/>I confirm public image rights and consent</label>
      <label>Select original image<input type="file" accept="image/png,image/jpeg,image/webp"
       disabled={busy||!rights||uploadAlt.trim().length<3||
         (uploadRole==="TEAM"&&draft.team.length===0)||
         (uploadRole==="FEATURE"&&draft.featureCards.length===0)||
         (["HERO","MOBILE_HERO"].includes(uploadRole)&&draft.slides.length===0)}
       onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.currentTarget.value="";}}/></label>
      {draft.assets.map(x=><div className="cg-cms-asset" key={x.fileRef}>
       <span>{x.role==="TEAM"?(draft.team[x.order]?.name||"Team member "+(x.order+1)):
        x.role.replaceAll("_"," ")} · {x.altText}</span>
       <button type="button" onClick={()=>edit("assets",draft.assets.filter(v=>v!==x))}>
        Remove from draft</button></div>)}
     </fieldset>}
    </div>}
    {canManage&&draftIssue&&<p className="cg-cms-error" role="status">{draftIssue}</p>}
    {selected?.status==="DRAFT"&&unsaved&&<p role="status">
     Save your changes before sending this page for approval.</p>}
    {selected?.status==="DRAFT"&&heroPhotoMissing&&<p role="status">
     Add and save a verified desktop image for each homepage banner before review.</p>}
    <div className="cg-cms-actions">
     {!selected&&canManage&&<button disabled={busy||!okay||!!pending} type="button"
      onClick={()=>command("Draft created","pages","POST",{content:payload(draft)})}>Create draft</button>}
     {selected&&canManage&&<button disabled={busy||!okay||!!pending} type="button"
      onClick={()=>command(selected.status==="DRAFT"?"Draft saved":
       "New draft revision created","pages/"+selected.pageRef+"/draft","PUT",
       {content:payload(draft),expectedVersion:selected.version})}>
       {selected.status==="DRAFT"?"Save draft":"Create next draft revision"}</button>}
     {selected&&selected.status==="DRAFT"&&canManage&&<button
      disabled={busy||!!pending||unsaved||heroPhotoMissing} type="button"
      onClick={()=>command("Submitted for approval","pages/"+selected.pageRef+"/submit","POST",
       {expectedVersion:selected.version})}>Send for review</button>}
     {selected&&selected.status==="SUBMITTED"&&selected.approvalCaseRef&&canPublish&&
      !selected.scheduledAt&&<>
      <label>Publish later (optional, local date and time)
       <input type="datetime-local" value={publishWhen}
        onChange={e=>setPublishWhen(e.target.value)}/></label>
      <button type="button" disabled={busy||!!pending||
        (Boolean(publishWhen)&&(!Number.isFinite(Date.parse(publishWhen))||
         Date.parse(publishWhen)-Date.now()<60000))}
       onClick={()=>{
        const publishAt=publishWhen?new Date(publishWhen).toISOString():undefined;
        command(publishAt?"Scheduled publication":"Page publication",
         "pages/"+selected.pageRef+"/publish","POST",
         {expectedVersion:selected.version,caseRef:selected.approvalCaseRef,
          ...(publishAt?{publishAt}:{})});
       }}>
       {publishWhen?"Schedule approved page":"Publish approved page now"}</button></>}
     {selected&&(selected.publicationStatus==="EFFECTIVE"||selected.scheduledAt)&&canPublish&&<>
      <label>Why hide this page?<input value={withdrawReason} maxLength={300}
       onChange={e=>setWithdrawReason(e.target.value)}/></label>
      <button type="button" disabled={busy||!!pending||withdrawReason.trim().length<8}
       onClick={()=>command("Publication withdrawal","pages/"+selected.pageRef+"/withdraw","POST",
        {expectedVersion:selected.version,reason:withdrawReason})}>
       {selected.scheduledAt?"Cancel scheduled publication / hide page":"Hide from public website"}</button>
     </>}
    </div>
    {selected&&<p className="cg-cms-muted">Current draft: {selected.status.replaceAll("_"," ")}.
     Public page: {selected.publicationStatus.replaceAll("_"," ")}.
     {selected.scheduledAt&&" Scheduled for "+new Date(selected.scheduledAt).toLocaleString()+"."}
     {selected.status==="SUBMITTED"&&" A different authorized reviewer must approve the exact draft."}</p>}
   </section>}
  </>}
 </div>;
}
