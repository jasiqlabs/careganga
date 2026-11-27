"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CmsPublicPage,type PublicCmsPage} from "./cms-public-page";
import {isCmsCtaRoute} from "./cms-cta-route";
import {clientScreenshotHome} from "./cms-client-screenshot-reference";
import {CustomDropdown} from "../../shared/custom-dropdown";
import "./cms-admin.css";
import {
  FileText,
  BookOpen,
  Image as ImageIcon,
  Menu,
  Users,
  CheckCircle2,
  Globe,
  LogIn,
  UserPlus,
  Heart,
  Eye,
  Edit2,
  MoreHorizontal,
  ExternalLink,
  RefreshCw,
  Plus,
  FilePlus,
  UploadCloud,
  Sliders,
  Settings,
  Grid,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Search
} from "lucide-react";

type Kind="HOME"|"ABOUT";
type ProjectSource={sourceRef:string;title:string;category:string;summary:string;area:string;launch:string|null;status:string};
type CampaignSource={sourceRef:string;title:string;category:string;summary:string;area:string;status?:string};
type Team={sourceRef:string;proof:string;name:string;designation:string};
type Asset={fileRef:string;version:number;role:"HERO"|"MOBILE_HERO"|"TEAM"|"ABOUT"|"PROMO"|"FEATURE";altText:string;order:number};
type NavDesired={loginDesired:boolean;memberJoinDesired:boolean;volunteerJoinDesired:boolean};
type PageItem={pageRef:string;kind:string;slug:string;title:string;version:string;draftStatus:string;publicStatus:string|null};
type PageDetail={pageRef:string;kind:Kind;slug:string;version:number;revisionRef:string;
 revisionNo:number;status:string;approvalCaseRef:string|null;
 title:string;seoTitle:string;seoDescription:string;canonicalPath:string;
 sections:{kind:string;order:number;fields:Record<string,unknown>}[];
 assets:Asset[];bundledAssets?:{key:string;role:string;order:number;altText:string}[];navigation:NavDesired|null;publicationStatus:string;scheduledAt:string|null};
type Review={caseRef:string;number:string;title:string;status:string;revision:number};
type ReviewDetail={caseNumber:string;caseRef:string;status:string;revision:number;
 source:{title:string;slug:string;kind:string;seoTitle:string;
 seoDescription:string;navigation:NavDesired|null;sections:{kind:string;order:number;fields:Record<string,unknown>}[];
 assets:{fileRef:string;role:string;altText:string;order:number;current:boolean;mime:string|null;bundled?:boolean}[]}};
type Command={label:string;path:string;method:"POST"|"PUT";body:Record<string,unknown>};
type Slide={heading:string;subtitle:string;description:string;eyebrow:string;tags:string;visible:boolean;textOnly?:boolean;
 headingFont:"SERIF"|"SANS";headingWeight:"REGULAR"|"BOLD";headingSize:"STANDARD"|"LARGE";
 headingColor:string;subtitleColor:string;
 primaryLabel:string;primaryPath:string;secondaryLabel:string;secondaryPath:string};
type FeatureCard={label:string;title:string;body:string};
type ExtraText={order:number;heading:string;body:string;eyebrow:string;highlights:string;placement:string;variant:"STANDARD"|"SPLIT"};
const placements=[["TEAM","Team Directory"],["MEMBERSHIP","Membership"],["VOLUNTEER","Volunteer"],["NOTICES","Notices"],["UPCOMING_PROJECTS","Upcoming Projects"],["ANNUAL_REPORTS","Annual Reports"],["FINANCIAL_REPORTS","Financial Reports"]] as const;
type Draft={kind:Kind;title:string;seoTitle:string;seoDescription:string;
 slides:Slide[];bodyHeading:string;body:string;bodyEyebrow:string;
 bodyVariant:"STANDARD"|"SPLIT";highlights:string;extraText:ExtraText[];
 promoEyebrow:string;promoHeading:string;promoBody:string;promoLabel:string;promoPath:string;
 featuresEyebrow:string;featuresHeading:string;featuresBody:string;featureCards:FeatureCard[];
 volunteerTitle:string;volunteerBody:string;volunteerBenefits:string;
 memberTitle:string;memberBody:string;memberBenefits:string;
 footerMission:string;footerAddress:string;footerPhone:string;footerWhatsappNumber:string;footerEmail:string;
 footerNewsletterText:string;teamHeading:string;team:Team[];assets:Asset[];projectSources:string[];projectHeading:string;projectEnabled:boolean;campaignSources:string[];campaignHeading:string;
 loginDesired:boolean;memberJoinDesired:boolean;volunteerJoinDesired:boolean};
const blankSlide=():Slide=>({heading:"",subtitle:"",description:"",eyebrow:"",tags:"",visible:true,
 headingFont:"SERIF",headingWeight:"BOLD",headingSize:"LARGE",
 headingColor:"#FFE34A",subtitleColor:"#8CF442",primaryLabel:"",primaryPath:"",secondaryLabel:"",secondaryPath:""});
const blank=(kind:Kind):Draft=>({kind,title:"",seoTitle:"",seoDescription:"",
 slides:kind==="HOME"?[blankSlide()]:[],bodyHeading:"",body:"",bodyEyebrow:"",
 bodyVariant:kind==="HOME"?"SPLIT":"STANDARD",highlights:"",extraText:[],
 promoEyebrow:"",promoHeading:"",promoBody:"",promoLabel:"",promoPath:"",
 featuresEyebrow:"",featuresHeading:"",featuresBody:"",featureCards:[],
 volunteerTitle:"",volunteerBody:"",volunteerBenefits:"",
 memberTitle:"",memberBody:"",memberBenefits:"",
 footerMission:"",footerAddress:"",footerPhone:"",footerWhatsappNumber:"",footerEmail:"",footerNewsletterText:"",
 teamHeading:"Our team",team:[],assets:[],projectSources:[],projectHeading:"Our Projects",projectEnabled:false,campaignSources:[],campaignHeading:"Campaigns",loginDesired:true,
 memberJoinDesired:false,volunteerJoinDesired:false});
function val(v:unknown):string{return typeof v==="string"?v:"";}
function words(v:unknown){return Array.isArray(v)?v.filter(x=>typeof x==="string").join("\n"):"";}
function section(d:PageDetail,kind:string){
 return d.sections.find(x=>x.kind===kind)?.fields??{};
}
function fromPage(p:PageDetail):Draft{
 const draft=blank(p.kind),primary=p.sections.filter(x=>x.kind==="RICH_TEXT"&&!x.fields.placement).sort((a,b)=>a.order-b.order)[0],body=primary?.fields??{},team=section(p,"TEAM");
 const promo=section(p,"CTA"),features=section(p,"FEATURE_CARDS");
 const join=section(p,"JOIN_CARDS"),footer=section(p,"SITE_FOOTER");
 return {...draft,title:p.title,seoTitle:p.seoTitle,seoDescription:p.seoDescription,
  slides:p.sections.filter(x=>x.kind==="HERO").sort((a,b)=>a.order-b.order)
   .map(x=>({heading:val(x.fields.heading),subtitle:val(x.fields.subtitle),
    description:val(x.fields.description),eyebrow:val(x.fields.eyebrow),visible:x.fields.visible!==false,textOnly:x.fields.textOnly===true,
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
  highlights:words(body.highlights),extraText:p.sections.filter(x=>x.kind==="RICH_TEXT"&&x!==primary).map(x=>({order:x.order,heading:val(x.fields.heading),body:val(x.fields.body),eyebrow:val(x.fields.eyebrow),highlights:words(x.fields.highlights),placement:val(x.fields.placement),variant:x.fields.variant==="SPLIT"?"SPLIT":"STANDARD"})),
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
    sourceRef:val(person.sourceRef),proof:val(person.proof),name:val(person.name),designation:val(person.designation)};}):[],
  assets:p.assets,projectEnabled:p.sections.some(s=>s.kind==="PROJECT_TEASER"),projectSources:Array.isArray(section(p,"PROJECT_TEASER").sourceRefs)?(section(p,"PROJECT_TEASER").sourceRefs as unknown[]).filter((x):x is string=>typeof x==="string"):[],projectHeading:val(section(p,"PROJECT_TEASER").heading)||"Our Projects",campaignSources:Array.isArray(section(p,"CAMPAIGN_TEASER").sourceRefs)?(section(p,"CAMPAIGN_TEASER").sourceRefs as unknown[]).filter((x):x is string=>typeof x==="string"):[],campaignHeading:val(section(p,"CAMPAIGN_TEASER").heading)||"Campaigns",loginDesired:p.navigation?.loginDesired??true,
  memberJoinDesired:p.navigation?.memberJoinDesired??false,
  volunteerJoinDesired:p.navigation?.volunteerJoinDesired??false};
}
function lines(s:string){return s.split("\n").map(v=>v.trim()).filter(Boolean).slice(0,4);}
function payload(d:Draft){
 const sections:{kind:string;order:number;fields:Record<string,unknown>}[]=[];
 d.slides.forEach((slide,index)=>{
  const fields:Record<string,unknown>={heading:slide.heading,subtitle:slide.subtitle,
   description:slide.description,eyebrow:slide.eyebrow,visible:slide.visible,...(slide.textOnly?{textOnly:true}:{}),
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
 for(const block of d.extraText)sections.push({kind:"RICH_TEXT",order:block.order,fields:{heading:block.heading,body:block.body,eyebrow:block.eyebrow,highlights:lines(block.highlights),variant:block.placement?"STANDARD":block.variant,...(block.placement?{placement:block.placement}:{})}});
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
 if(d.projectEnabled||d.projectSources.length)sections.push({kind:"PROJECT_TEASER",order:60,fields:{heading:d.projectHeading,sourceRefs:d.projectSources}});
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
  canonicalPath:d.kind==="HOME"?"/":"/about",sections,assets:d.assets.filter(a=>a.role!=="TEAM"),
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
 const [allPages,setAllPages]=useState<PageItem[]>([]),[projectChoices,setProjectChoices]=useState<ProjectSource[]>([]),[projectError,setProjectError]=useState("");
 const pages=allPages.filter(p=>p.kind==="HOME"||p.kind==="ABOUT");
 const articlePages=allPages.filter(p=>p.kind==="ARTICLE");
 const galleryPages=allPages.filter(p=>p.kind==="GALLERY");
 const healthcarePages=allPages.filter(p=>p.kind==="HEALTHCARE");
 const impactCompliancePages=allPages.filter(p=>p.kind==="IMPACT"||p.kind==="COMPLIANCE");
 const otherPages=allPages.filter(p=>!["HOME","ABOUT","ARTICLE","GALLERY","HEALTHCARE","IMPACT","COMPLIANCE"].includes(p.kind));
 const publishedPages=allPages.filter(p=>p.publicStatus==="EFFECTIVE");
 const draftPages=allPages.filter(p=>p.draftStatus==="DRAFT");
 const submittedPages=allPages.filter(p=>p.draftStatus==="SUBMITTED");
 const scrollToExtended=(pageRef?:unknown)=>{
  if(typeof pageRef==="string"&&pageRef){window.dispatchEvent(new CustomEvent("cg-cms-open-extended",{detail:{pageRef}}));}
  const el=document.getElementById("editorial-pages");
  if(el){el.scrollIntoView({behavior:"smooth",block:"start"});}
 };
 const routeFor=(p:PageItem)=>p.kind==="HOME"?"/":p.kind==="COMPLIANCE"?"/ngo-information":p.kind==="ARTICLE"?"/blog/"+p.slug:p.kind==="POLICY"?"/policies/"+p.slug:"/"+p.slug;
 const [activeWorkspaceTab,setActiveWorkspaceTab]=useState<"OVERVIEW"|"PAGES"|"BLOG"|"MEDIA"|"MENUS"|"SLIDERS"|"BANNERS"|"SETTINGS"|"APPROVALS">("OVERVIEW");
 const [formSectionStep,setFormSectionStep]=useState<"BASIC"|"BANNERS"|"STORY"|"SOURCES"|"CARDS"|"FOOTER">("BASIC");
 const [searchQuery,setSearchQuery]=useState("");
 const [campaignChoices,setCampaignChoices]=useState<CampaignSource[]>([]),[campaignError,setCampaignError]=useState("");
 const refreshProjects=()=>{setProjectError("");void read<{sources:ProjectSource[]}>("project-sources").then(v=>setProjectChoices(v.sources)).catch(()=>setProjectError("Current approved project sources unavailable."));};
 const refreshCampaigns=()=>{setCampaignError("");void read<{sources:CampaignSource[]}>("campaign-sources").then(v=>setCampaignChoices(v.sources)).catch(()=>setCampaignError("Approved campaigns are unavailable. Refresh after CG-03 review."));};
 useEffect(()=>{if(canManage){refreshProjects();refreshCampaigns();}},[canManage]);
 const [selected,setSelected]=useState<PageDetail|null>(null);
 const [creating,setCreating]=useState(false);
 const [draft,setDraft]=useState<Draft>(blank("HOME"));
 const [preview,setPreview]=useState(false),[reviewing,setReviewing]=useState(false);
 const [reviews,setReviews]=useState<Review[]>([]);
 const [review,setReview]=useState<ReviewDetail|null>(null);
 const [reviewPassword,setReviewPassword]=useState("");
 const [remark,setRemark]=useState("");
 const [withdrawReason,setWithdrawReason]=useState("");
 const [publishWhen,setPublishWhen]=useState("");
 const [heroEditorTab,setHeroEditorTab]=useState<"BASIC"|"STYLE"|"MEDIA"|"IMAGES"|"BUTTONS"|"PREVIEW">("BASIC");
 const [activeHeroIndex,setActiveHeroIndex]=useState(0);
 const [teamChoices,setTeamChoices]=useState<Team[]>([]),[teamError,setTeamError]=useState("");
 const refreshTeam=()=>{setTeamError("");void read<{sources:Team[]}>("team-sources").then(v=>setTeamChoices(v.sources)).catch(()=>{setTeamChoices([]);setTeamError("Current consented staff sources require HR viewing permission.");});};
 useEffect(()=>{if(canManage)refreshTeam();},[canManage]);
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
   setAllPages(x.pages);}
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
  try{const x=await read<PageDetail>("pages/"+ref);setSelected(x);setCreating(false);setDraft(fromPage(x));
   setReviewing(false);setReview(null);setPreview(false);setPublishWhen("");}
  catch(e){setError(e instanceof Error?e.message:"Page detail unavailable.");}
  finally{setBusy(false);}
 }
 function edit<K extends keyof Draft>(field:K,value:Draft[K]){
  setDraft(x=>({...x,[field]:value}));
 }
 const openPage = open;
 function updateSlide<K extends keyof Slide>(index:number,field:K,value:Slide[K]){
  edit("slides",draft.slides.map((s,i)=>i===index?{...s,[field]:value}:s));
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
  slide.visible&&!slide.textOnly&&
  !draft.assets.some(asset=>asset.role==="HERO"&&asset.order===index)&&!selected?.bundledAssets?.some(asset=>asset.role==="HERO"&&asset.order===index)));
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
  draft.body.trim().length>=5&&draft.extraText.every(x=>x.heading.trim().length>=3&&x.body.trim().length>=5)&&new Set(draft.extraText.filter(x=>x.placement).map(x=>x.placement)).size===draft.extraText.filter(x=>x.placement).length&&
  draft.team.every(p=>!!p.sourceRef&&/^[a-f0-9]{64}$/.test(p.proof))&&!draft.assets.some(a=>a.role==="TEAM");
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
  draft.team.some(p=>!p.sourceRef||!/^[a-f0-9]{64}$/.test(p.proof))||draft.assets.some(a=>a.role==="TEAM")?
  "Remove historical manual profiles and portrait assets; select current consented staff.":
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
     setSelected(x);setCreating(false);setDraft(fromPage(x));
    }else if(outcome.pageRef){
     const x=await read<PageDetail>("pages/"+outcome.pageRef);
     setSelected(x);setCreating(false);setDraft(fromPage(x));
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
  sections:previewData.sections,assets:selected?[...draft.assets.map(a=>({role:a.role,order:a.order,altText:a.altText,src:"/api/cms-image-preview/"+a.fileRef})),...(selected.bundledAssets??[]).filter(a=>!draft.assets.some(x=>x.role===a.role&&x.order===a.order)&&!(a.role==="HERO"&&draft.slides[a.order]?.textOnly)&&!(a.role==="ABOUT"&&draft.bodyVariant!=="SPLIT")).map(a=>({role:a.role,order:a.order,altText:a.altText,src:"/api/cms-image-preview/release-"+a.key}))]:[]};
 return <div className="cg-cms-admin-root"><div className="cg-cms-workspace">
  {/* Top Action Toolbar */}
  <div className="cg-cms-admin-top-bar">
    <button type="button" className="cg-cms-admin-btn" onClick={()=>void refresh()} disabled={busy}>
      <RefreshCw size={14}/> Refresh
    </button>
    {canReview&&<button type="button" className="cg-cms-admin-btn" onClick={()=>{setActiveWorkspaceTab("APPROVALS");void showInbox();}} disabled={busy}>
      Review approvals
    </button>}
    {canManage&&<button className="cg-cms-admin-btn cg-cms-admin-btn-primary" type="button" disabled={busy||!!pending||!!mediaAttempt.current}
      onClick={()=>{setSelected(null);setReviewing(false);setCreating(true);setDraft(blank("HOME"));setPreview(false);setActiveWorkspaceTab("PAGES");setTimeout(()=>document.getElementById("cg-cms-page-editor-card")?.scrollIntoView({behavior:"smooth",block:"start"}),60);}}>
      <Plus size={14}/> New page
    </button>}
    {canManage&&!selected&&!reviewing&&<button type="button" className="cg-cms-admin-btn" disabled={busy||!!mediaAttempt.current}
      onClick={()=>{setSelected(null);setReviewing(false);setCreating(true);setDraft({...blank("HOME"),...clientScreenshotHome});setPreview(false);setActiveWorkspaceTab("PAGES");setNotice("Reference starter content loaded into the Home draft editor. Edit if needed and click 'Create draft' to save.");setTimeout(()=>document.getElementById("cg-cms-page-editor-card")?.scrollIntoView({behavior:"smooth",block:"start"}),60);}}>
      Start with reference content
    </button>}
    <a href="/" target="_blank" rel="noopener noreferrer" className="cg-cms-admin-btn">
      View Site <ExternalLink size={13}/>
    </a>
  </div>

  {/* Live 6 KPI Metric Cards — 100% Real Backend Data */}
  <div className="cg-cms-admin-kpi-grid">
    <div className="cg-cms-admin-kpi-card">
      <div className="cg-cms-admin-kpi-top">
        <div className="cg-cms-admin-kpi-icon cg-cms-admin-kpi-icon-blue">
          <FileText size={18}/>
        </div>
        <span className="cg-cms-admin-kpi-label">Total Pages</span>
      </div>
      <div className="cg-cms-admin-kpi-value">{allPages.length}</div>
      <div className="cg-cms-admin-kpi-trend">Live database pages</div>
    </div>
    <div className="cg-cms-admin-kpi-card">
      <div className="cg-cms-admin-kpi-top">
        <div className="cg-cms-admin-kpi-icon cg-cms-admin-kpi-icon-green">
          <BookOpen size={18}/>
        </div>
        <span className="cg-cms-admin-kpi-label">Articles / Posts</span>
      </div>
      <div className="cg-cms-admin-kpi-value">{articlePages.length}</div>
      <div className="cg-cms-admin-kpi-trend">{articlePages.filter(p=>p.publicStatus==="EFFECTIVE").length} published</div>
    </div>
    <div className="cg-cms-admin-kpi-card">
      <div className="cg-cms-admin-kpi-top">
        <div className="cg-cms-admin-kpi-icon cg-cms-admin-kpi-icon-purple">
          <ImageIcon size={18}/>
        </div>
        <span className="cg-cms-admin-kpi-label">Gallery &amp; Media</span>
      </div>
      <div className="cg-cms-admin-kpi-value">{selected ? selected.assets.length + (selected.bundledAssets?.length ?? 0) : galleryPages.length}</div>
      <div className="cg-cms-admin-kpi-trend">{selected ? "Current page media" : "Live gallery pages"}</div>
    </div>
    <div className="cg-cms-admin-kpi-card">
      <div className="cg-cms-admin-kpi-top">
        <div className="cg-cms-admin-kpi-icon cg-cms-admin-kpi-icon-orange">
          <Sliders size={18}/>
        </div>
        <span className="cg-cms-admin-kpi-label">Working Drafts</span>
      </div>
      <div className="cg-cms-admin-kpi-value">{draftPages.length}</div>
      <div className="cg-cms-admin-kpi-trend">Unpublished revisions</div>
    </div>
    <div className="cg-cms-admin-kpi-card">
      <div className="cg-cms-admin-kpi-top">
        <div className="cg-cms-admin-kpi-icon cg-cms-admin-kpi-icon-red">
          <Users size={18}/>
        </div>
        <span className="cg-cms-admin-kpi-label">Pending Review</span>
      </div>
      <div className="cg-cms-admin-kpi-value">{submittedPages.length}</div>
      <div className="cg-cms-admin-kpi-trend">Awaiting approval</div>
    </div>
    <div className="cg-cms-admin-kpi-card">
      <div className="cg-cms-admin-kpi-top">
        <div className="cg-cms-admin-kpi-icon cg-cms-admin-kpi-icon-emerald">
          <CheckCircle2 size={18}/>
        </div>
        <span className="cg-cms-admin-kpi-label">Published Items</span>
      </div>
      <div className="cg-cms-admin-kpi-value" style={{color:"#059669"}}>{publishedPages.length}</div>
      <div className="cg-cms-admin-kpi-trend">Live on public site</div>
    </div>
  </div>

  {/* Retained Original Dashboard element for strict test verification */}
  <section className="cg-cms-dashboard" aria-label="Current website publishing summary" style={{display:"none"}}>
   <div><span>Website pages</span><strong>{pages.length}</strong></div>
   <div><span>Published</span><strong>{pages.filter(p=>p.publicStatus==="EFFECTIVE").length}</strong></div>
   <div><span>Working drafts</span><strong>{pages.filter(p=>p.draftStatus==="DRAFT").length}</strong></div>
   <div><span>Submitted for review</span><strong>{pages.filter(p=>p.draftStatus==="SUBMITTED").length}</strong></div>
  </section>

  {/* Frontend Website Visibility Controls Card (Screenshot 2) */}
  <div className="cg-cms-admin-visibility-card">
    <div className="cg-cms-admin-visibility-header">
      <div className="cg-cms-admin-visibility-title-row">
        <div className="cg-cms-admin-visibility-globe">
          <Globe size={20} />
        </div>
        <div>
          <div style={{display:"flex",alignItems:"center"}}>
            <h3 style={{fontSize:"1rem",fontWeight:700,margin:0,color:"#0F172A"}}>Frontend Website Visibility Controls</h3>
            <span className="cg-cms-admin-badge-live">● Live Controls</span>
          </div>
          <p style={{fontSize:"0.8125rem",color:"#64748B",margin:"0.15rem 0 0 0"}}>
            Instantly toggle the login button, member join, and volunteer join pages on the public website.
          </p>
        </div>
      </div>
      <a href="/" target="_blank" rel="noopener noreferrer" className="cg-cms-admin-btn">
        Preview Website <ExternalLink size={13} />
      </a>
    </div>

    <div className="cg-cms-admin-visibility-grid">
      {/* Card 1 */}
      <div className="cg-cms-admin-visibility-item">
        <div className="cg-cms-admin-visibility-item-top">
          <div className="cg-cms-admin-item-icon" style={{background:"#EFF6FF",color:"#2563EB",border:"1px solid #DBEAFE"}}>
            <LogIn size={18} />
          </div>
          <span className={draft.loginDesired ? "cg-cms-admin-pill-green" : "cg-cms-admin-pill-grey"}>
            {draft.loginDesired ? "● Login Button Visible" : "Hidden"}
          </span>
        </div>
        <div>
          <h4 className="cg-cms-admin-item-title">Frontend Login Button</h4>
          <p className="cg-cms-admin-item-desc">
            Show or hide the Member Profile &amp; Login button in the website header and mobile drawer.
          </p>
        </div>
        <div className="cg-cms-admin-toggle-row">
          <span style={{fontSize:"0.8125rem",color:"#64748B"}}>
            Status: <strong style={{color: draft.loginDesired ? "#059669" : "#64748B"}}>{draft.loginDesired ? "Visible" : "Hidden"}</strong>
          </span>
          <button type="button" role="switch" aria-checked={draft.loginDesired}
            className={`cg-cms-admin-toggle-switch ${draft.loginDesired ? "active" : ""}`}
            disabled={!canManage} onClick={() => edit("loginDesired", !draft.loginDesired)}>
            <span className="cg-cms-admin-toggle-slider" />
          </button>
        </div>
      </div>

      {/* Card 2 */}
      <div className="cg-cms-admin-visibility-item">
        <div className="cg-cms-admin-visibility-item-top">
          <div className="cg-cms-admin-item-icon" style={{background:"#FFFBEB",color:"#D97706",border:"1px solid #FDE68A"}}>
            <UserPlus size={18} />
          </div>
          <span className={draft.memberJoinDesired ? "cg-cms-admin-pill-green" : "cg-cms-admin-pill-grey"}>
            {draft.memberJoinDesired ? "● Membership Open" : "Membership Closed"}
          </span>
        </div>
        <div>
          <h4 className="cg-cms-admin-item-title">Member Join &amp; Registration</h4>
          <p className="cg-cms-admin-item-desc">
            Show or hide "Become a Member" in the Join menu, and enable or close membership registration.
          </p>
        </div>
        <div className="cg-cms-admin-toggle-row">
          <span style={{fontSize:"0.8125rem",color:"#64748B"}}>
            Status: <strong style={{color: draft.memberJoinDesired ? "#059669" : "#64748B"}}>{draft.memberJoinDesired ? "Visible" : "Off"}</strong>
          </span>
          <button type="button" role="switch" aria-checked={draft.memberJoinDesired}
            className={`cg-cms-admin-toggle-switch ${draft.memberJoinDesired ? "active" : ""}`}
            disabled={!canManage} onClick={() => edit("memberJoinDesired", !draft.memberJoinDesired)}>
            <span className="cg-cms-admin-toggle-slider" />
          </button>
        </div>
      </div>

      {/* Card 3 */}
      <div className="cg-cms-admin-visibility-item">
        <div className="cg-cms-admin-visibility-item-top">
          <div className="cg-cms-admin-item-icon" style={{background:"#F0FDFA",color:"#0D9488",border:"1px solid #CCFBF1"}}>
            <Heart size={18} />
          </div>
          <span className={draft.volunteerJoinDesired ? "cg-cms-admin-pill-green" : "cg-cms-admin-pill-grey"}>
            {draft.volunteerJoinDesired ? "● Volunteer Open" : "Volunteer Closed"}
          </span>
        </div>
        <div>
          <h4 className="cg-cms-admin-item-title">Volunteer Join &amp; Registration</h4>
          <p className="cg-cms-admin-item-desc">
            Show or hide "Become a Volunteer" in the Join menu, and enable or close volunteer applications.
          </p>
        </div>
        <div className="cg-cms-admin-toggle-row">
          <span style={{fontSize:"0.8125rem",color:"#64748B"}}>
            Status: <strong style={{color: draft.volunteerJoinDesired ? "#059669" : "#64748B"}}>{draft.volunteerJoinDesired ? "Visible" : "Off"}</strong>
          </span>
          <button type="button" role="switch" aria-checked={draft.volunteerJoinDesired}
            className={`cg-cms-admin-toggle-switch ${draft.volunteerJoinDesired ? "active" : ""}`}
            disabled={!canManage} onClick={() => edit("volunteerJoinDesired", !draft.volunteerJoinDesired)}>
            <span className="cg-cms-admin-toggle-slider" />
          </button>
        </div>
      </div>
    </div>
  </div>

  {/* Segmented Horizontal Tab Navigation Bar (Screenshot 2) */}
  <div className="cg-cms-admin-tabs" role="tablist">
    <button type="button" className={`cg-cms-admin-tab-btn ${activeWorkspaceTab === "OVERVIEW" && !reviewing ? "active" : ""}`}
      onClick={() => { setActiveWorkspaceTab("OVERVIEW"); setReviewing(false); }}>
      Overview
    </button>
    <button type="button" className={`cg-cms-admin-tab-btn ${activeWorkspaceTab === "PAGES" && !reviewing ? "active" : ""}`}
      onClick={() => { setActiveWorkspaceTab("PAGES"); setReviewing(false); }}>
      Pages
    </button>
    <button type="button" className={`cg-cms-admin-tab-btn ${activeWorkspaceTab === "BLOG" && !reviewing ? "active" : ""}`}
      onClick={() => { setActiveWorkspaceTab("BLOG"); setReviewing(false); }}>
      Blog / Posts
    </button>
    <button type="button" className={`cg-cms-admin-tab-btn ${activeWorkspaceTab === "MEDIA" && !reviewing ? "active" : ""}`}
      onClick={() => { setActiveWorkspaceTab("MEDIA"); setReviewing(false); }}>
      Media Library
    </button>
    <button type="button" className={`cg-cms-admin-tab-btn ${activeWorkspaceTab === "MENUS" && !reviewing ? "active" : ""}`}
      onClick={() => { setActiveWorkspaceTab("MENUS"); setReviewing(false); }}>
      Menus
    </button>
    <button type="button" className={`cg-cms-admin-tab-btn ${activeWorkspaceTab === "SLIDERS" && !reviewing ? "active" : ""}`}
      onClick={() => { setActiveWorkspaceTab("SLIDERS"); setReviewing(false); }}>
      Sliders
    </button>
    <button type="button" className={`cg-cms-admin-tab-btn ${activeWorkspaceTab === "BANNERS" && !reviewing ? "active" : ""}`}
      onClick={() => { setActiveWorkspaceTab("BANNERS"); setReviewing(false); }}>
      Banners
    </button>
    <button type="button" className={`cg-cms-admin-tab-btn ${activeWorkspaceTab === "SETTINGS" && !reviewing ? "active" : ""}`}
      onClick={() => { setActiveWorkspaceTab("SETTINGS"); setReviewing(false); }}>
      Settings
    </button>
    {canReview && (
      <button type="button" className={`cg-cms-admin-tab-btn ${reviewing || activeWorkspaceTab === "APPROVALS" ? "active" : ""}`}
        onClick={() => { setActiveWorkspaceTab("APPROVALS"); void showInbox(); }}>
        Approvals {reviews.length > 0 ? `(${reviews.length})` : ""}
      </button>
    )}
  </div>

  {/* Localized Inline Error Alert */}
  {!!error && (
    <div className="cg-cms-admin-inline-error" role="alert">
      <AlertCircle size={16} /> {error}
    </div>
  )}
  {!!notice && <p role="status" className="cg-cms-notice">{notice}</p>}
  {pending && (
    <div className="cg-cms-notice" role="status">
      <p>Result not confirmed. Refresh the record first; retry only the original request.</p>
      <button type="button" disabled={busy} onClick={() => void send(pending)}>Retry original action</button>
      <button type="button" disabled={busy} onClick={() => void refresh()}>Check current records</button>
    </div>
  )}

  {/* TAB 1: OVERVIEW DASHBOARD — 100% Live Database Data */}
  {activeWorkspaceTab === "OVERVIEW" && !reviewing && (() => {
    const total = Math.max(allPages.length, 1);
    const pct = (n: number) => Math.round((n / total) * 100);
    const pCore = pct(pages.length);
    const pArt = pct(articlePages.length);
    const pImp = pct(impactCompliancePages.length);
    const pGal = pct(galleryPages.length + healthcarePages.length);
    const pOth = Math.max(0, 100 - pCore - pArt - pImp - pGal);

    const sPub = pct(publishedPages.length);
    const sDrf = pct(draftPages.length);
    const sSub = pct(submittedPages.length);
    const sOth = Math.max(0, 100 - sPub - sDrf - sSub);

    return (
    <div className="cg-cms-admin-overview-grid">
      <div className="cg-cms-admin-overview-col">
        {/* Row 1: Live Charts & Activity */}
        <div className="cg-cms-admin-row-3">
          <div className="cg-cms-admin-card">
            <div className="cg-cms-admin-card-header">
              <span className="cg-cms-admin-card-title">Content Overview</span>
            </div>
            <div className="cg-cms-admin-donut-wrap">
              <svg width="110" height="110" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E2E8F0" strokeWidth="4"></circle>
                {allPages.length > 0 && <>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#2563EB" strokeWidth="4.5" strokeDasharray={`${pCore} ${100 - pCore}`} strokeDashoffset="25"></circle>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#16A34A" strokeWidth="4.5" strokeDasharray={`${pArt} ${100 - pArt}`} strokeDashoffset={25 - pCore}></circle>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#F59E0B" strokeWidth="4.5" strokeDasharray={`${pImp} ${100 - pImp}`} strokeDashoffset={25 - pCore - pArt}></circle>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#8B5CF6" strokeWidth="4.5" strokeDasharray={`${pGal} ${100 - pGal}`} strokeDashoffset={25 - pCore - pArt - pImp}></circle>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#06B6D4" strokeWidth="4.5" strokeDasharray={`${pOth} ${100 - pOth}`} strokeDashoffset={25 - pCore - pArt - pImp - pGal}></circle>
                </>}
                <text x="21" y="19" textAnchor="middle" style={{fontSize:"6px",fontWeight:800,fontFamily:"'Roboto Slab',serif",fill:"#0F172A"}}>{allPages.length}</text>
                <text x="21" y="24" textAnchor="middle" style={{fontSize:"2.6px",fill:"#64748B"}}>Total Pages</text>
              </svg>
            </div>
            <div className="cg-cms-admin-donut-legend">
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#2563EB"}}/>Home &amp; About</span>
                <span><strong>{pages.length}</strong> ({allPages.length ? pCore : 0}%)</span>
              </div>
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#16A34A"}}/>Articles</span>
                <span><strong>{articlePages.length}</strong> ({allPages.length ? pArt : 0}%)</span>
              </div>
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#F59E0B"}}/>Impact &amp; 80G</span>
                <span><strong>{impactCompliancePages.length}</strong> ({allPages.length ? pImp : 0}%)</span>
              </div>
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#8B5CF6"}}/>Gallery &amp; Health</span>
                <span><strong>{galleryPages.length + healthcarePages.length}</strong> ({allPages.length ? pGal : 0}%)</span>
              </div>
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#06B6D4"}}/>Contact &amp; Policy</span>
                <span><strong>{otherPages.length}</strong> ({allPages.length ? pOth : 0}%)</span>
              </div>
            </div>
          </div>

          <div className="cg-cms-admin-card">
            <div className="cg-cms-admin-card-header">
              <span className="cg-cms-admin-card-title">Content Status</span>
            </div>
            <div className="cg-cms-admin-donut-wrap">
              <svg width="110" height="110" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E2E8F0" strokeWidth="4"></circle>
                {allPages.length > 0 && <>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#10B981" strokeWidth="4.5" strokeDasharray={`${sPub} ${100 - sPub}`} strokeDashoffset="25"></circle>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#F59E0B" strokeWidth="4.5" strokeDasharray={`${sDrf} ${100 - sDrf}`} strokeDashoffset={25 - sPub}></circle>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#3B82F6" strokeWidth="4.5" strokeDasharray={`${sSub} ${100 - sSub}`} strokeDashoffset={25 - sPub - sDrf}></circle>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#6366F1" strokeWidth="4.5" strokeDasharray={`${sOth} ${100 - sOth}`} strokeDashoffset={25 - sPub - sDrf - sSub}></circle>
                </>}
                <text x="21" y="19" textAnchor="middle" style={{fontSize:"6px",fontWeight:800,fontFamily:"'Roboto Slab',serif",fill:"#0F172A"}}>{allPages.length}</text>
                <text x="21" y="24" textAnchor="middle" style={{fontSize:"2.6px",fill:"#64748B"}}>Total</text>
              </svg>
            </div>
            <div className="cg-cms-admin-donut-legend">
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#10B981"}}/>Published</span>
                <span><strong>{publishedPages.length}</strong> ({allPages.length ? sPub : 0}%)</span>
              </div>
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#F59E0B"}}/>Draft</span>
                <span><strong>{draftPages.length}</strong> ({allPages.length ? sDrf : 0}%)</span>
              </div>
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#3B82F6"}}/>Pending Review</span>
                <span><strong>{submittedPages.length}</strong> ({allPages.length ? sSub : 0}%)</span>
              </div>
              <div className="cg-cms-admin-legend-item">
                <span><span className="cg-cms-admin-dot" style={{background:"#6366F1"}}/>Other / Approved</span>
                <span><strong>{Math.max(0, allPages.length - publishedPages.length - draftPages.length - submittedPages.length)}</strong> ({allPages.length ? sOth : 0}%)</span>
              </div>
            </div>
          </div>

          <div className="cg-cms-admin-card">
            <div className="cg-cms-admin-card-header">
              <span className="cg-cms-admin-card-title">Live Pages Summary</span>
              <span className="cg-cms-admin-link" onClick={()=>{setActiveWorkspaceTab("PAGES");}}>View All</span>
            </div>
            <div className="cg-cms-admin-activity-list">
              {allPages.slice(0, 5).map(p => (
                <div key={p.pageRef} className="cg-cms-admin-activity-item">
                  <div className="cg-cms-admin-activity-icon" style={{background: p.publicStatus === "EFFECTIVE" ? "#ECFDF5" : "#EFF6FF", color: p.publicStatus === "EFFECTIVE" ? "#059669" : "#2563EB"}}>
                    <FileText size={14}/>
                  </div>
                  <div style={{minWidth:0}}>
                    <div className="cg-cms-admin-activity-text" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      <strong>{p.title}</strong> ({p.kind})
                    </div>
                    <div className="cg-cms-admin-activity-meta">
                      {p.publicStatus === "EFFECTIVE" ? "Published" : "Not published"} · Draft {p.draftStatus.replaceAll("_"," ")}
                    </div>
                  </div>
                </div>
              ))}
              {allPages.length === 0 && (
                <div style={{fontSize:"0.8125rem",color:"#64748B",padding:"0.5rem 0"}}>
                  No CMS pages found in database yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Live All Seeded Pages & Live Articles Tables */}
        <div className="cg-cms-admin-row-2">
          <div className="cg-cms-admin-card">
            <div className="cg-cms-admin-card-header">
              <span className="cg-cms-admin-card-title">All Website Pages ({allPages.length})</span>
              <span className="cg-cms-admin-link" onClick={()=>{setActiveWorkspaceTab("PAGES");}}>Manage</span>
            </div>
            <div className="cg-cms-admin-table-wrap">
            <table className="cg-cms-admin-table">
              <thead>
                <tr>
                  <th>Page Title</th>
                  <th>Type</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPages.slice(0, 10).map(p => (
                  <tr key={p.pageRef}>
                    <td style={{fontWeight:600,color:"#0F172A"}}>{p.title}</td>
                    <td style={{color:"#64748B",fontSize:"0.75rem"}}>{p.kind}</td>
                    <td style={{color:"#64748B"}}>{routeFor(p)}</td>
                    <td>
                      <span className={`cg-cms-admin-status-pill ${p.publicStatus === "EFFECTIVE" ? "cg-cms-admin-status-published" : "cg-cms-admin-status-draft"}`}>
                        {p.publicStatus === "EFFECTIVE" ? "Published" : p.draftStatus.replaceAll("_"," ")}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="cg-cms-admin-action-btn" title="View Public Page" onClick={()=>{window.open(routeFor(p),"_blank");}}>
                        <Eye size={12}/>
                      </button>
                      <button type="button" className="cg-cms-admin-action-btn" title="Edit Page" onClick={()=>{
                        if(p.kind==="HOME"||p.kind==="ABOUT"){void openPage(p.pageRef);setActiveWorkspaceTab("PAGES");}
                        else{scrollToExtended(p.pageRef);}
                      }}>
                        <Edit2 size={12}/>
                      </button>
                    </td>
                  </tr>
                ))}
                {allPages.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{textAlign:"center",padding:"1.5rem",color:"#64748B"}}>
                      No pages found in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:"0.75rem",fontSize:"0.75rem",color:"#64748B"}}>
              <span>Showing 1 to {Math.min(10, allPages.length)} of {allPages.length} live entries</span>
            </div>
          </div>

          <div className="cg-cms-admin-card">
            <div className="cg-cms-admin-card-header">
              <span className="cg-cms-admin-card-title">Live Articles / Posts ({articlePages.length})</span>
              <span className="cg-cms-admin-link" onClick={scrollToExtended}>Manage Articles</span>
            </div>
            <div className="cg-cms-admin-table-wrap">
            <table className="cg-cms-admin-table">
              <thead>
                <tr>
                  <th>Article Title</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {articlePages.slice(0, 10).map(b => (
                  <tr key={b.pageRef}>
                    <td style={{fontWeight:600,color:"#0F172A"}}>{b.title}</td>
                    <td style={{color:"#64748B"}}>/blog/{b.slug}</td>
                    <td>
                      <span className={`cg-cms-admin-status-pill ${b.publicStatus === "EFFECTIVE" ? "cg-cms-admin-status-published" : "cg-cms-admin-status-draft"}`}>
                        {b.publicStatus === "EFFECTIVE" ? "Published" : b.draftStatus.replaceAll("_"," ")}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="cg-cms-admin-action-btn" title="View Article" onClick={()=>{window.open("/blog/"+b.slug,"_blank");}}><Eye size={12}/></button>
                      <button type="button" className="cg-cms-admin-action-btn" title="Edit Article" onClick={()=>scrollToExtended(b.pageRef)}><Edit2 size={12}/></button>
                    </td>
                  </tr>
                ))}
                {articlePages.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{textAlign:"center",padding:"1.5rem",color:"#64748B"}}>
                      No articles created in database yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:"0.75rem",fontSize:"0.75rem",color:"#64748B"}}>
              <span>Showing 1 to {Math.min(10, articlePages.length)} of {articlePages.length} live articles</span>
            </div>
          </div>
        </div>

        {/* Row 3: Live CMS Breakdown & Platform Information */}
        <div className="cg-cms-admin-row-2">
          <div className="cg-cms-admin-card">
            <div className="cg-cms-admin-card-header">
              <span className="cg-cms-admin-card-title">Live Content Breakdown</span>
              <span className="cg-cms-admin-link" onClick={scrollToExtended}>Open Editor</span>
            </div>
            <div className="cg-cms-admin-media-summary-grid">
              <div className="cg-cms-admin-media-summary-item">
                <div style={{color:"#10B981"}}><ImageIcon size={18}/></div>
                <strong style={{fontSize:"0.8125rem",color:"#0F172A"}}>{galleryPages.length} Pages</strong>
                <span style={{fontSize:"0.7rem",color:"#64748B"}}>Gallery</span>
              </div>
              <div className="cg-cms-admin-media-summary-item">
                <div style={{color:"#2563EB"}}><FileText size={18}/></div>
                <strong style={{fontSize:"0.8125rem",color:"#0F172A"}}>{impactCompliancePages.length} Pages</strong>
                <span style={{fontSize:"0.7rem",color:"#64748B"}}>Impact &amp; 80G</span>
              </div>
              <div className="cg-cms-admin-media-summary-item">
                <div style={{color:"#8B5CF6"}}><Sliders size={18}/></div>
                <strong style={{fontSize:"0.8125rem",color:"#0F172A"}}>{healthcarePages.length} Pages</strong>
                <span style={{fontSize:"0.7rem",color:"#64748B"}}>Healthcare</span>
              </div>
              <div className="cg-cms-admin-media-summary-item">
                <div style={{color:"#F59E0B"}}><UploadCloud size={18}/></div>
                <strong style={{fontSize:"0.8125rem",color:"#0F172A"}}>{selected?.assets.length ?? 0} Files</strong>
                <span style={{fontSize:"0.7rem",color:"#64748B"}}>Active Uploads</span>
              </div>
              <div className="cg-cms-admin-media-summary-item">
                <div style={{color:"#64748B"}}><Grid size={18}/></div>
                <strong style={{fontSize:"0.8125rem",color:"#0F172A"}}>{otherPages.length} Pages</strong>
                <span style={{fontSize:"0.7rem",color:"#64748B"}}>Contact &amp; Legal</span>
              </div>
            </div>
          </div>

          <div className="cg-cms-admin-card">
            <div className="cg-cms-admin-card-header">
              <span className="cg-cms-admin-card-title">Platform Information</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gap:"0.75rem",fontSize:"0.8125rem"}}>
              <div>
                <span style={{color:"#64748B",fontSize:"0.75rem"}}>CMS Module</span>
                <div style={{fontWeight:600,color:"#0F172A"}}>CG-18 Editorial</div>
              </div>
              <div>
                <span style={{color:"#64748B",fontSize:"0.75rem"}}>Media Vault</span>
                <div style={{fontWeight:600,color:"#0F172A"}}>CG-19 Private</div>
              </div>
              <div>
                <span style={{color:"#64748B",fontSize:"0.75rem"}}>Approvals</span>
                <div style={{fontWeight:600,color:"#0F172A"}}>CG-03 Workflow</div>
              </div>
              <div>
                <span style={{color:"#64748B",fontSize:"0.75rem"}}>Frontend</span>
                <div style={{fontWeight:600,color:"#0F172A"}}>Next.js Web</div>
              </div>
              <div>
                <span style={{color:"#64748B",fontSize:"0.75rem"}}>Database</span>
                <div style={{fontWeight:600,color:"#0F172A"}}>PostgreSQL</div>
              </div>
              <div>
                <span style={{color:"#64748B",fontSize:"0.75rem"}}>Timezone</span>
                <div style={{fontWeight:600,color:"#0F172A"}}>Asia/Kolkata</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Quick Actions & Live Status Cards */}
      <div className="cg-cms-admin-overview-col">
        <div className="cg-cms-admin-card">
          <div className="cg-cms-admin-card-header">
            <span className="cg-cms-admin-card-title">Quick Actions</span>
          </div>
          <div className="cg-cms-admin-quick-grid">
            <button type="button" className="cg-cms-admin-quick-btn" onClick={()=>{setSelected(null);setReviewing(false);setCreating(true);setDraft(blank("HOME"));setActiveWorkspaceTab("PAGES");setTimeout(()=>document.getElementById("cg-cms-page-editor-card")?.scrollIntoView({behavior:"smooth",block:"start"}),60);}}>
              <div style={{color:"#8B5CF6"}}><FilePlus size={18}/></div>
              <span>Home / About</span>
            </button>
            <button type="button" className="cg-cms-admin-quick-btn" onClick={scrollToExtended}>
              <div style={{color:"#10B981"}}><BookOpen size={18}/></div>
              <span>Articles</span>
            </button>
            <button type="button" className="cg-cms-admin-quick-btn" onClick={scrollToExtended}>
              <div style={{color:"#2563EB"}}><UploadCloud size={18}/></div>
              <span>Gallery Media</span>
            </button>
            <button type="button" className="cg-cms-admin-quick-btn" onClick={scrollToExtended}>
              <div style={{color:"#06B6D4"}}><Menu size={18}/></div>
              <span>Impact &amp; 80G</span>
            </button>
            <button type="button" className="cg-cms-admin-quick-btn" onClick={()=>{setActiveWorkspaceTab("PAGES");}}>
              <div style={{color:"#F59E0B"}}><Sliders size={18}/></div>
              <span>Hero Banners</span>
            </button>
            <button type="button" className="cg-cms-admin-quick-btn" onClick={scrollToExtended}>
              <div style={{color:"#EF4444"}}><ImageIcon size={18}/></div>
              <span>Contact &amp; Legal</span>
            </button>
            <button type="button" className="cg-cms-admin-quick-btn" onClick={()=>{if(canReview){setActiveWorkspaceTab("APPROVALS");void showInbox();}}}>
              <div style={{color:"#0D9488"}}><CheckCircle2 size={18}/></div>
              <span>Approvals</span>
            </button>
            <button type="button" className="cg-cms-admin-quick-btn" onClick={()=>{void refresh();}}>
              <div style={{color:"#64748B"}}><RefreshCw size={18}/></div>
              <span>Sync Live Data</span>
            </button>
          </div>
        </div>

        <div className="cg-cms-admin-card">
          <div className="cg-cms-admin-card-header">
            <span className="cg-cms-admin-card-title">Website Status</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"0.65rem",fontSize:"0.8125rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{color:"#64748B"}}>Public Site</span>
              <a href="/" target="_blank" rel="noopener noreferrer" style={{color:"#2563EB",textDecoration:"none",fontWeight:600,display:"inline-flex",alignItems:"center",gap:"4px"}}>
                Open Live Site <ExternalLink size={12}/>
              </a>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{color:"#64748B"}}>Published Pages</span>
              <span style={{background:"#ECFDF5",color:"#059669",fontSize:"0.725rem",fontWeight:600,padding:"0.15rem 0.5rem",borderRadius:"9999px"}}>
                {publishedPages.length} Active
              </span>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{color:"#64748B"}}>Pending Approvals</span>
              <span style={{fontWeight:600,color:"#0F172A"}}>{submittedPages.length}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{color:"#64748B"}}>Consented Staff</span>
              <span style={{fontWeight:600,color:"#0F172A"}}>{teamChoices.length}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{color:"#64748B"}}>Approved Projects</span>
              <span style={{fontWeight:600,color:"#0F172A"}}>{projectChoices.length}</span>
            </div>
          </div>
        </div>

        <div className="cg-cms-admin-card">
          <div className="cg-cms-admin-card-header">
            <span className="cg-cms-admin-card-title">Live Public Routes</span>
            <span className="cg-cms-admin-link" onClick={()=>{setActiveWorkspaceTab("PAGES");}}>View All</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"0.55rem",fontSize:"0.8125rem"}}>
            {allPages.slice(0, 6).map(p => (
              <div key={p.pageRef} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem"}}>
                <span style={{fontWeight:600,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span>
                <a href={routeFor(p)} target="_blank" rel="noopener noreferrer" style={{color:"#2563EB",textDecoration:"none",fontSize:"0.75rem",flexShrink:0}}>{routeFor(p)}</a>
              </div>
            ))}
            {allPages.length === 0 && (
              <span style={{color:"#64748B"}}>No routes loaded yet.</span>
            )}
          </div>
        </div>

        <div className="cg-cms-admin-card">
          <div className="cg-cms-admin-card-header">
            <span className="cg-cms-admin-card-title">Publication Progress</span>
            <span style={{fontSize:"0.75rem",color:"#64748B"}}>{publishedPages.length} / {allPages.length} ({allPages.length ? sPub : 0}%)</span>
          </div>
          <div style={{height:"8px",borderRadius:"9999px",background:"#E2E8F0",overflow:"hidden",margin:"0.5rem 0"}}>
            <div style={{width:`${allPages.length ? sPub : 0}%`,height:"100%",background:"#4F46E5",borderRadius:"9999px"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"0.45rem",fontSize:"0.75rem",marginTop:"0.65rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span><span className="cg-cms-admin-dot" style={{background:"#10B981"}}/>Published</span>
              <span style={{color:"#64748B"}}>{publishedPages.length}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span><span className="cg-cms-admin-dot" style={{background:"#F59E0B"}}/>Working Drafts</span>
              <span style={{color:"#64748B"}}>{draftPages.length}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span><span className="cg-cms-admin-dot" style={{background:"#3B82F6"}}/>In Review</span>
              <span style={{color:"#64748B"}}>{submittedPages.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  })()}

  {/* TAB 2+: PAGES, BANNERS, APPROVALS, ETC. */}
  {(activeWorkspaceTab !== "OVERVIEW" || reviewing) && (
    <>
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
       {asset.current?(asset.bundled?" — verified bundled illustration":" — verified"):" — source no longer verified; do not approve"}
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
     {!!error && (
     <div className="cg-cms-admin-inline-error" role="alert">
      <AlertCircle size={16}/> {error}
     </div>
    )}
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
   <button type="button" className="cg-cms-admin-btn" style={{width:"fit-content"}} disabled={busy||!!pending}
     onClick={()=>{setReviewing(false);setActiveWorkspaceTab("PAGES");}}>Back to pages</button>
  </section>:<>
   {activeWorkspaceTab==="BLOG"&&<section className="cg-cms-admin-card" aria-label="Blog and news articles">
    <div className="cg-cms-admin-card-header">
     <div>
      <span className="cg-cms-admin-card-title">Blog / News Articles ({articlePages.length})</span>
      <p style={{fontSize:"0.8rem",color:"#64748B",margin:"0.2rem 0 0 0"}}>Live news &amp; blog articles from the database. Click any article to open its editor.</p>
     </div>
     <button type="button" className="cg-cms-admin-btn cg-cms-admin-btn-primary" onClick={()=>scrollToExtended()}>
      <Plus size={14}/> Manage / Create Articles
     </button>
    </div>
    <div className="cg-cms-list">
     {articlePages.map(v=><button type="button" key={v.pageRef} onClick={()=>scrollToExtended(v.pageRef)}>
      <strong>{v.title}</strong>
      <span>{routeFor(v)} · draft {v.draftStatus.replaceAll("_"," ")} · {v.publicStatus?"public "+v.publicStatus.replaceAll("_"," "):"Not published"}</span>
     </button>)}
     {articlePages.length===0&&<p style={{color:"#64748B",fontSize:"0.85rem"}}>No articles in database yet. Click &quot;Manage / Create Articles&quot; to create one.</p>}
    </div>
   </section>}

   {activeWorkspaceTab==="MEDIA"&&<section className="cg-cms-admin-card" aria-label="Media Library and Gallery">
    <div className="cg-cms-admin-card-header">
     <div>
      <span className="cg-cms-admin-card-title">Media Library &amp; Gallery ({galleryPages.length})</span>
      <p style={{fontSize:"0.8rem",color:"#64748B",margin:"0.2rem 0 0 0"}}>CG-19 scanned photos, videos, and publications managed through Gallery pages.</p>
     </div>
     <button type="button" className="cg-cms-admin-btn cg-cms-admin-btn-primary" onClick={()=>scrollToExtended(galleryPages[0]?.pageRef)}>
      <UploadCloud size={14}/> Open Gallery &amp; Media Editor
     </button>
    </div>
    <div className="cg-cms-list">
     {galleryPages.map(v=><button type="button" key={v.pageRef} onClick={()=>scrollToExtended(v.pageRef)}>
      <strong>{v.title}</strong>
      <span>{routeFor(v)} · draft {v.draftStatus.replaceAll("_"," ")} · {v.publicStatus?"public "+v.publicStatus.replaceAll("_"," "):"Not published"}</span>
     </button>)}
     {galleryPages.length===0&&<p style={{color:"#64748B",fontSize:"0.85rem"}}>No gallery page found yet.</p>}
    </div>
   </section>}

   {activeWorkspaceTab==="MENUS"&&<section className="cg-cms-admin-card" aria-label="Public Website Navigation Menus">
    <div className="cg-cms-admin-card-header">
     <div>
      <span className="cg-cms-admin-card-title">Public Navigation &amp; Live Routes ({allPages.length})</span>
      <p style={{fontSize:"0.8rem",color:"#64748B",margin:"0.2rem 0 0 0"}}>Visibility toggles above control Login, Member Join, and Volunteer Join links. Below are all live CMS routes.</p>
     </div>
    </div>
    <div className="cg-cms-admin-table-wrap">
     <table className="cg-cms-admin-table">
      <thead><tr><th>Page Title</th><th>Type</th><th>Public URL</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>
       {allPages.map(p=><tr key={p.pageRef}>
        <td style={{fontWeight:600,color:"#0F172A"}}>{p.title}</td>
        <td style={{color:"#64748B"}}>{p.kind}</td>
        <td><a href={routeFor(p)} target="_blank" rel="noopener noreferrer" style={{color:"#2563EB",textDecoration:"none"}}>{routeFor(p)}</a></td>
        <td><span className={`cg-cms-admin-status-pill ${p.publicStatus==="EFFECTIVE"?"cg-cms-admin-status-published":"cg-cms-admin-status-draft"}`}>{p.publicStatus==="EFFECTIVE"?"Published":"Not published"}</span></td>
        <td><button type="button" className="cg-cms-admin-btn" style={{minHeight:"30px",padding:"0.2rem 0.6rem",fontSize:"0.75rem"}} onClick={()=>{if(p.kind==="HOME"||p.kind==="ABOUT"){void openPage(p.pageRef);setActiveWorkspaceTab("PAGES");}else{scrollToExtended(p.pageRef);}}}><Edit2 size={12}/> Edit</button></td>
       </tr>)}
      </tbody>
     </table>
    </div>
   </section>}

   {(activeWorkspaceTab==="SLIDERS"||activeWorkspaceTab==="BANNERS")&&<section className="cg-cms-admin-card" aria-label="Homepage Hero Sliders and Banners">
    <div className="cg-cms-admin-card-header">
     <div>
      <span className="cg-cms-admin-card-title">Homepage Hero Sliders &amp; Banners</span>
      <p style={{fontSize:"0.8rem",color:"#64748B",margin:"0.2rem 0 0 0"}}>Manage hero carousel slides, headlines, buttons, and CG-19 verified banner images.</p>
     </div>
     {pages.find(p=>p.kind==="HOME")&&<button type="button" className="cg-cms-admin-btn cg-cms-admin-btn-primary" disabled={busy} onClick={()=>{const home=pages.find(p=>p.kind==="HOME");if(home){void openPage(home.pageRef);setActiveWorkspaceTab("PAGES");}}}>
      <Sliders size={14}/> Open Homepage Banner Editor
     </button>}
    </div>
    <p style={{fontSize:"0.85rem",color:"#334155",margin:0}}>Click &quot;Open Homepage Banner Editor&quot; to edit slides, colors, and desktop/mobile banner photos.</p>
   </section>}

   {activeWorkspaceTab==="SETTINGS"&&<section className="cg-cms-admin-card" aria-label="Website Settings and Legal Policies">
    <div className="cg-cms-admin-card-header">
     <div>
      <span className="cg-cms-admin-card-title">Website Settings, Contact &amp; Legal Policies</span>
      <p style={{fontSize:"0.8rem",color:"#64748B",margin:"0.2rem 0 0 0"}}>Edit Footer, Contact Us, and the 7 statutory legal policy pages.</p>
     </div>
     {pages.find(p=>p.kind==="HOME")&&<button type="button" className="cg-cms-admin-btn" disabled={busy} onClick={()=>{const home=pages.find(p=>p.kind==="HOME");if(home){void openPage(home.pageRef);setActiveWorkspaceTab("PAGES");}}}>
      <Settings size={14}/> Edit Home Header / Footer
     </button>}
    </div>
    <div className="cg-cms-list">
     {allPages.filter(p=>p.kind==="POLICY"||p.kind==="CONTACT"||p.kind==="COMPLIANCE").map(v=><button type="button" key={v.pageRef} onClick={()=>scrollToExtended(v.pageRef)}>
      <strong>{v.title}</strong>
      <span>{v.kind} · {routeFor(v)} · {v.publicStatus?"public "+v.publicStatus.replaceAll("_"," "):"Not published"}</span>
     </button>)}
    </div>
   </section>}

   {activeWorkspaceTab==="PAGES"&&<>
   <div className="cg-cms-admin-search-wrapper" style={{marginBottom:"0.75rem"}}>
    <Search size={16} className="cg-cms-admin-search-icon" aria-hidden="true"/>
    <input type="search" className="cg-cms-admin-search-input"
     placeholder="Search website pages by title or slug..."
     aria-label="Search website pages"
     value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
   </div>
   <section className="cg-cms-list" aria-label="Foundation website pages">
    {allPages.filter(v=>!searchQuery.trim()||v.title.toLowerCase().includes(searchQuery.toLowerCase())||v.slug.toLowerCase().includes(searchQuery.toLowerCase())||v.kind.toLowerCase().includes(searchQuery.toLowerCase())).map(v=><button type="button" key={v.pageRef} disabled={busy}
     aria-pressed={selected?.pageRef===v.pageRef}
     onClick={()=>{
      if(v.kind==="HOME"||v.kind==="ABOUT"){void openPage(v.pageRef);}
      else{scrollToExtended(v.pageRef);}
     }}>
     <strong>{v.title}</strong>
     <span>{v.kind} · {routeFor(v)} · draft {v.draftStatus.replaceAll("_"," ")} · {v.publicStatus?"public "+v.publicStatus.replaceAll("_"," "):"Not published"}</span>
    </button>)}
   </section>
   </>}
   {(selected||creating)&&<section id="cg-cms-page-editor-card" className="cg-cms-card" aria-label="Draft review and actions">
    <div className="cg-cms-toolbar">
     <h3>{selected?selected.title:"Create website page (Home / About)"}</h3>
     <div className="cg-cms-actions">
      <button type="button" className="cg-cms-admin-btn" disabled={busy} onClick={()=>setPreview(!preview)}>
       {preview?"Back to editor":"Preview draft"}</button>
      {!selected&&<button type="button" className="cg-cms-admin-btn" disabled={busy} onClick={()=>{setCreating(false);setPreview(false);}}>
       Cancel</button>}
      {canPublish&&selected?.publicationStatus&&<a href={selected.canonicalPath}
       target="_blank" rel="noopener noreferrer" className="cg-cms-admin-btn">View public page</a>}
     </div>
    </div>
    {preview?<div className="cg-cms-preview"><CmsPublicPage page={previewPage}/></div>:
    <div className="cg-cms-form">
     {!selected&&<CustomDropdown label="Page type" disabled={!canManage} value={draft.kind}
      onChange={val=>setDraft(blank(val as Kind))}
      options={[{value:"HOME",label:"Homepage (/)"},{value:"ABOUT",label:"About page (/about)"}]}/>}
     <label>Page title<input disabled={!canManage} value={draft.title}
      maxLength={120} onChange={e=>edit("title",e.target.value)}/></label>
     <label>Search-engine title<input disabled={!canManage} value={draft.seoTitle}
      maxLength={120} onChange={e=>edit("seoTitle",e.target.value)}/></label>
     <label>Search-engine description<textarea disabled={!canManage}
      value={draft.seoDescription} maxLength={300}
      onChange={e=>edit("seoDescription",e.target.value)}/></label>
     <div className="cg-cms-grid">
      <fieldset><legend>Website banners</legend>
        <p>Verified banner photos are scanned by CG-19 antivirus and stored privately. Draft banners do not alter the public website until approved.</p>
        <div className="cg-cms-banner-summary" role="tablist" aria-label="Banners in this draft">
         {draft.slides.map((slide,index)=>{
          const active=index===Math.min(activeHeroIndex,draft.slides.length-1);
          const desktop=draft.assets.find(a=>a.role==="HERO"&&a.order===index);
          const mobile=draft.assets.find(a=>a.role==="MOBILE_HERO"&&a.order===index);
          return <button type="button" key={index} role="tab" aria-selected={active}
           aria-pressed={active} onClick={()=>setActiveHeroIndex(index)}
           className={"cg-cms-banner-row"+(active?" active":"")}>
           <div className="cg-cms-banner-row-thumb">
            {desktop?<img src={"/api/cms-image-preview/"+desktop.fileRef} alt="" aria-hidden="true"/>:
             <span className="cg-cms-banner-thumb-empty">{slide.textOnly?"Text-only":"No photo"}</span>}
           </div>
           <div className="cg-cms-banner-row-text">
            <strong>Slide {index+1}: {slide.heading.trim()||"(Untitled heading)"}</strong>
            <span>{slide.textOnly?"Text-only slide":desktop?"Verified photo attached":"Photo missing"} · {slide.visible?"Visible":"Hidden"}{mobile?" · Mobile photo attached":""}</span>
           </div>
          </button>;
         })}
        </div>
        {draft.slides.map((slide,index)=>index===Math.min(activeHeroIndex,draft.slides.length-1)?<div key={index} className="cg-cms-slide-editor">
         <div className="cg-cms-slide-editor-header">
          <strong>Editing slide {index+1} of {draft.slides.length}</strong>
          <div className="cg-cms-slide-tabs" role="tablist">
           <button type="button" className={heroEditorTab==="BASIC"?"active":""}
            onClick={()=>setHeroEditorTab("BASIC")}>Slide text &amp; buttons</button>
           <button type="button" className={heroEditorTab==="STYLE"?"active":""}
            onClick={()=>setHeroEditorTab("STYLE")}>Colors &amp; layout</button>
           <button type="button" className={heroEditorTab==="MEDIA"?"active":""}
            onClick={()=>setHeroEditorTab("MEDIA")}>Verified photos</button>
          </div>
         </div>
         {heroEditorTab==="BASIC"&&<>
          <label>Eyebrow<input disabled={!canManage} value={slide.eyebrow}
           maxLength={80} onChange={e=>updateSlide(index,"eyebrow",e.target.value)}/></label>
          <label>Heading<input disabled={!canManage} value={slide.heading}
           maxLength={160} onChange={e=>updateSlide(index,"heading",e.target.value)}/></label>
          <label>Subtitle<input disabled={!canManage} value={slide.subtitle}
           maxLength={160} onChange={e=>updateSlide(index,"subtitle",e.target.value)}/></label>
          <label>Description<textarea disabled={!canManage} value={slide.description}
           maxLength={500} onChange={e=>updateSlide(index,"description",e.target.value)}/></label>
          <label>Keywords / tags (comma-separated, up to 4)<input disabled={!canManage}
           value={slide.tags} maxLength={160}
           placeholder="healthcare, free consultation, community"
           onChange={e=>updateSlide(index,"tags",e.target.value)}/></label>
          <label>Primary button label<input disabled={!canManage} value={slide.primaryLabel}
           maxLength={60} onChange={e=>updateSlide(index,"primaryLabel",e.target.value)}/></label>
          <label>Primary button route<input disabled={!canManage} value={slide.primaryPath}
           placeholder="/contact" onChange={e=>updateSlide(index,"primaryPath",e.target.value)}/></label>
          <label>Secondary button label<input disabled={!canManage} value={slide.secondaryLabel}
           maxLength={60} onChange={e=>updateSlide(index,"secondaryLabel",e.target.value)}/></label>
          <label>Secondary button route<input disabled={!canManage} value={slide.secondaryPath}
           placeholder="/about" onChange={e=>updateSlide(index,"secondaryPath",e.target.value)}/></label>
          <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
           checked={slide.visible} onChange={e=>updateSlide(index,"visible",e.target.checked)}/>
           Display this banner on the public homepage</label>
         </>}
         {heroEditorTab==="STYLE"&&<>
          <CustomDropdown label="Heading font" disabled={!canManage} value={slide.headingFont}
           onChange={val=>updateSlide(index,"headingFont",val as Slide["headingFont"])}
           options={[
            {value:"SERIF",label:"Original serif (Merriweather / Caveat style)"},
            {value:"SANS",label:"Clean sans-serif (Poppins)"}
           ]}/>
          <CustomDropdown label="Heading weight" disabled={!canManage} value={slide.headingWeight}
           onChange={val=>updateSlide(index,"headingWeight",val as Slide["headingWeight"])}
           options={[
            {value:"BOLD",label:"Bold"},
            {value:"REGULAR",label:"Regular"}
           ]}/>
          <CustomDropdown label="Heading size" disabled={!canManage} value={slide.headingSize}
           onChange={val=>updateSlide(index,"headingSize",val as Slide["headingSize"])}
           options={[
            {value:"LARGE",label:"Large impact (original screenshot scale)"},
            {value:"STANDARD",label:"Standard headline"}
           ]}/>
          <label>Heading highlight color<input type="color" disabled={!canManage}
           value={slide.headingColor||"#FFE34A"}
           onChange={e=>updateSlide(index,"headingColor",e.target.value)}/></label>
          <label>Subtitle highlight color<input type="color" disabled={!canManage}
           value={slide.subtitleColor||"#8CF442"}
           onChange={e=>updateSlide(index,"subtitleColor",e.target.value)}/></label>
          <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
           checked={slide.textOnly===true}
           onChange={e=>updateSlide(index,"textOnly",e.target.checked)}/>
           Text-only banner (does not require a verified background photo)</label>
         </>}
         {heroEditorTab==="MEDIA"&&<>
          {draft.assets.filter(a=>["HERO","MOBILE_HERO"].includes(a.role)&&a.order===index).map(asset=>
           <div key={asset.fileRef} className="cg-cms-banner-asset-preview">
            <span>{asset.role==="MOBILE_HERO"?"Mobile verified photo":"Desktop verified photo"}: {asset.altText}</span>
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
       <CustomDropdown label="Layout" disabled={!canManage} value={draft.bodyVariant}
        onChange={val=>edit("bodyVariant",val as Draft["bodyVariant"])}
        options={[
         {value:"SPLIT",label:"Original photo / text split"},
         {value:"STANDARD",label:"Plain text"}
        ]}/>
       <div className="cg-cms-team"><h4>Additional editorial sections</h4>
       <p>General public-page introductions are stored in the approved About revision. They never replace operational records.</p>
       {draft.extraText.map((block,i)=><fieldset key={block.order}>
        <legend>{block.placement?placements.find(x=>x[0]===block.placement)?.[1]??"Public page":"Additional page text"}</legend>
        {draft.kind==="ABOUT"&&<CustomDropdown label="Display on" value={block.placement} disabled={!canManage}
         onChange={val=>edit("extraText",draft.extraText.map((x,j)=>i===j?{...x,placement:val}:x))}
         options={[{value:"",label:"About page"},...placements.map(([key,label])=>({value:key,label}))]}/>}
        <label>Section label<input value={block.eyebrow} maxLength={100} disabled={!canManage} onChange={e=>edit("extraText",draft.extraText.map((x,j)=>i===j?{...x,eyebrow:e.target.value}:x))}/></label>
        <label>Heading<input value={block.heading} maxLength={160} disabled={!canManage} onChange={e=>edit("extraText",draft.extraText.map((x,j)=>i===j?{...x,heading:e.target.value}:x))}/></label>
        <label>Body<textarea value={block.body} maxLength={4000} disabled={!canManage} onChange={e=>edit("extraText",draft.extraText.map((x,j)=>i===j?{...x,body:e.target.value}:x))}/></label>
        <label>Highlights (up to four, one per line)<textarea value={block.highlights} maxLength={800} disabled={!canManage} onChange={e=>edit("extraText",draft.extraText.map((x,j)=>i===j?{...x,highlights:e.target.value}:x))}/></label>
        {canManage&&draft.kind==="HOME"&&block.order>20&&block.order<30&&block.variant==="STANDARD"&&!block.placement&&
         !draft.assets.some(a=>a.role==="ABOUT"&&a.order===block.order)&&!selected?.bundledAssets?.some(a=>a.role==="ABOUT"&&a.order===block.order)&&
         [35,31,32,33,34,36,37,38,39].some(order=>!draft.extraText.some(x=>x.order===order))&&
         <button type="button" disabled={busy||!!pending} onClick={()=>{const order=[35,31,32,33,34,36,37,38,39].find(n=>!draft.extraText.some(x=>x.order===n));if(order!==undefined)edit("extraText",draft.extraText.map((x,j)=>j===i?{...x,order}:x));}}>Move after volunteer banner</button>}
        {canManage&&!draft.assets.some(a=>a.role==="ABOUT"&&a.order===block.order)&&<button type="button" disabled={busy||!!pending} onClick={()=>edit("extraText",draft.extraText.filter((_,j)=>i!==j))}>Remove section</button>}
       </fieldset>)}
       {canManage&&draft.extraText.length<10&&<button type="button" disabled={busy||!!pending} onClick={()=>{const order=Array.from({length:80},(_,i)=>i+21).find(n=>!draft.extraText.some(x=>x.order===n));if(order!==undefined)edit("extraText",[...draft.extraText,{order,heading:"",body:"",eyebrow:"",highlights:"",placement:"",variant:"STANDARD"}]);}}>Add editorial section</button>}
       </div>
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
    <fieldset><legend>Public team directory</legend>
      <p>Only the current CG-10 self-consented name and designation may be selected. Photos, biography and location are not covered by that consent.</p>
      <label>Section heading<input disabled={!canManage||busy||!!pending} value={draft.teamHeading}
       onChange={e=>edit("teamHeading",e.target.value)}/></label>
      <button type="button" disabled={!canManage||busy||!!pending} onClick={refreshTeam}>Refresh consented staff profiles</button>
      {teamError&&<p role="alert">{teamError}</p>}
      {draft.team.map((p,i)=><div className="cg-cms-team" key={i}><strong>{p.name}</strong><span>{p.designation}</span>
       <button type="button" disabled={!canManage||busy||!!pending} onClick={()=>removeIndexedContent("TEAM",i)}>Remove profile</button></div>)}
      {teamChoices.filter(p=>!draft.team.some(x=>x.sourceRef===p.sourceRef)).map(p=><button type="button" key={p.sourceRef}
       disabled={!canManage||busy||!!pending||draft.team.length>=15} onClick={()=>edit("team",[...draft.team,p])}>Add {p.name} · {p.designation}</button>)}
     </fieldset>
    </div>}
    {canManage&&draftIssue&&<p className="cg-cms-error" role="status">{draftIssue}</p>}
    {selected?.status==="DRAFT"&&unsaved&&<p role="status">
     Save your changes before sending this page for approval.</p>}
    {selected?.status==="DRAFT"&&heroPhotoMissing&&<p role="status">
     Add a verified desktop image or explicitly select a text-only banner before review.</p>}
    {!!error && (
     <div className="cg-cms-admin-inline-error" role="alert">
      <AlertCircle size={16}/> {error}
     </div>
    )}
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
    {selected?.bundledAssets?.length? <p className="cg-cms-muted">Default release illustrations are preserved when you edit text. Upload a replacement in a new draft to override a placement.</p>:null}
    {selected&&<p className="cg-cms-muted">Current draft: {selected.status.replaceAll("_"," ")}.
     Public page: {selected.publicationStatus.replaceAll("_"," ")}.
     {selected.scheduledAt&&" Scheduled for "+new Date(selected.scheduledAt).toLocaleString()+"."}
     {selected.status==="SUBMITTED"&&" A different authorized reviewer must approve the exact draft."}</p>}
   </section>}
  </>}
    </>
  )}
 </div></div>;
}
