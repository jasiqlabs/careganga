"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CmsPublicPage,type PublicCmsPage} from "./cms-public-page";

type Kind="IMPACT"|"COMPLIANCE"|"GALLERY"|"ARTICLE"|"CONTACT"|"HEALTHCARE"|"POLICY"|"PARTNERS";
type PartnerOption={sourceRef:string;rightsVersion:number;name:string;summary:string};
type Section={kind:string;order:number;fields:Record<string,unknown>};
type Asset={fileRef:string;version:number;role:string;altText:string;order:number};
type Draft={kind:Kind;slug:string;title:string;seoTitle:string;seoDescription:string;
 sections:Section[];assets:Asset[]};
type EventSource={sourceRef:string;slug:string;title:string;category:string;summary:string;area:string;scheduledStart:string;scheduledEnd:string;status:string};
type NoticeSource={noticeRef:string;title:string;body:string;expiresAt:string;asOfDate:string};
type Item={pageRef:string;kind:string;slug:string;title:string;version:string;
 draftStatus:string;publicStatus:string|null};
type Detail={pageRef:string;kind:Kind;slug:string;version:number;revisionRef:string;
 status:string;approvalCaseRef:string|null;title:string;seoTitle:string;
 seoDescription:string;sections:Section[];assets:Asset[];
 publicationStatus:string;scheduledAt:string|null};
type Command={path:string;method:"POST"|"PUT";body:Record<string,unknown>};
const kinds:Kind[]=["IMPACT","COMPLIANCE","GALLERY","ARTICLE","CONTACT","HEALTHCARE","POLICY","PARTNERS"];
const legalPages=[
 ["terms-and-conditions","Terms & Conditions"],["privacy-policy","Privacy Policy"],
 ["cookie-policy","Cookie Policy"],["disclaimer","Disclaimer"],
 ["refund-and-cancellation","Refund & Cancellation"],
 ["grievance-redressal","Grievance Redressal"],
 ["copyright-and-intellectual-property","Copyright & Intellectual Property"]
] as const;
const groups=["HERO","PILLARS","STATS","GROWTH","GEOGRAPHY","BREAKDOWN",
 "FOCUS","STORIES","UPDATES","CTA"];
const today=()=>new Date().toISOString().slice(0,10);
const str=(v:unknown)=>typeof v==="string"?v:"";
const items=(v:unknown)=>Array.isArray(v)?v as Record<string,unknown>[]:[];
const pathFor=(kind:Kind,slug:string)=>kind==="COMPLIANCE"?"/ngo-information":
 kind==="ARTICLE"?"/blog/"+slug:kind==="POLICY"?"/policies/"+slug:"/"+slug;
const slugFor=(kind:Kind)=>kind==="PARTNERS"?"collaboration":kind==="COMPLIANCE"?"80g":
 kind==="IMPACT"?"our-impact":
 kind==="POLICY"?legalPages[0][0]:kind.toLowerCase();
const group=(key:string,i:number):Section=>({kind:"IMPACT_GROUP",order:i,
 fields:{group:key,heading:"",intro:"",source:"",asOfDate:today(),items:[]}});
function initial(kind:Kind):Draft{
 const sections:Section[]=kind==="IMPACT"?groups.map(group):
  kind==="COMPLIANCE"?[{kind:"COMPLIANCE_FACTS",order:0,fields:{
   heading:"",summary:"",badgeText:"",subtitle:"",importantNote:"",
   issuer:"",pan:"",registrationNumber:"",
   approvalNumber:"",validFrom:"",validUntil:"",verifiedAsOf:today(),
   source:"",verification:"NOT_VERIFIED",
   disclaimer:"Check current official records before claiming a tax benefit.",documents:[]
  }}]:
  kind==="GALLERY"?[{kind:"GALLERY_GRID",order:0,
   fields:{heading:"",description:"",videosHeading:"Stories in Motion",
    videosDescription:"",publicationsHeading:"Publications & Reports",
    publicationsDescription:"",photosEmptyText:"",videosEmptyText:"",
    publicationsEmptyText:"",items:[]}}]:
  kind==="ARTICLE"?[{kind:"ARTICLE_BODY",order:0,fields:{
   heading:"",category:"",excerpt:"",body:"",authorLabel:"",
   source:"",asOfDate:today(),tags:[]}}]:
  kind==="CONTACT"?[{kind:"CONTACT_INFO",order:0,fields:{
    heroTitle:"Get In Touch",heroIntro:"",officeHours:"",mapUrl:"",
    inquiries:[{title:"General Inquiries",description:""},
     {title:"Volunteer With Us",description:""},
     {title:"CSR Partnerships",description:""}],faqs:[],socialLinks:[]}},
   {kind:"RICH_TEXT",order:1,fields:{
    heading:"Contact the Foundation",body:"Send a private message to CareGanga Foundation for general information.",
    eyebrow:"",variant:"STANDARD",highlights:[]}}]:
  kind==="PARTNERS"?[
   {kind:"HERO",order:0,fields:{heading:"Corporate Partners",
    subtitle:"Make a meaningful difference through responsible partnerships.",
    description:"We welcome genuine corporate social responsibility discussions, service collaborations and long-term support.",
    eyebrow:"CareGanga Foundation · Collaboration",tags:[],visible:true,
    primaryLabel:"Partner With Us",primaryPath:"/contact"}},
   {kind:"PARTNER_CARDS",order:1,fields:{
    heading:"Meet Our Partners",intro:"Only currently verified partnerships are listed.",partners:[]}},
   {kind:"CTA",order:2,fields:{heading:"Let's Collaborate",
    eyebrow:"WORK WITH CAREGANGA",
    body:"Share your organization's interest and we will help direct your enquiry to the right Foundation team.",
    label:"Get in Touch",path:"/contact"}}
  ]:
  kind==="POLICY"?[{kind:"RICH_TEXT",order:0,fields:{
   heading:legalPages[0][1],body:"",eyebrow:"",variant:"STANDARD",highlights:[]}}]:
  [{kind:"HERO",order:0,fields:{heading:"Healthcare Assistance",subtitle:"",description:"",eyebrow:"",
    tags:[],visible:true,headingFont:"SERIF",headingWeight:"BOLD",headingSize:"LARGE",
    headingColor:"#FFE34A",subtitleColor:"#8CF442"}},
   {kind:"HEALTHCARE_CATEGORIES",order:10,fields:{
    heading:"",intro:"",categories:[]}}];
 return {kind,slug:slugFor(kind),title:kind==="POLICY"?legalPages[0][1]:"",
  seoTitle:"",seoDescription:"",sections,assets:[]};
}
function content(d:Draft){return {kind:d.kind,slug:d.slug,title:d.title,
 seoTitle:d.seoTitle||d.title,seoDescription:d.seoDescription,
 canonicalPath:pathFor(d.kind,d.slug),sections:d.sections,assets:d.assets};}
class Rejected extends Error{constructor(message:string){super(message);this.name="Rejected";}}
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch("/api/cms/"+path,{cache:"no-store",...init});
 if(!response.ok){
  const data:unknown=await response.json().catch(()=>null);
  const message=data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"?data.message:
   response.status===409?"The record changed. Refresh before retrying.":
   "The website operation could not be confirmed.";
  if(response.status>=400&&response.status<500)throw new Rejected(message);
  throw Error(message);
 }
 return response.json() as Promise<T>;
}
const json=(value:object):RequestInit=>({method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify(value)});
function Field({name,value,onChange,large=false,type="text"}:{
 name:string;value:unknown;onChange:(s:string)=>void;large?:boolean;type?:string}){
 const current=str(value);
 return <label>{name}{large?<textarea value={current} rows={4} onChange={e=>onChange(e.target.value)}/>:
  <input type={type} value={current} onChange={e=>onChange(e.target.value)}/>}</label>;
}
function NumberField({name,value,onChange,max}:{name:string;value:unknown;
 onChange:(n:number)=>void;max?:number}){
 return <label>{name}<input type="number" min={0} max={max} step="any"
  value={typeof value==="number"?String(value):""}
  onChange={e=>onChange(e.target.value===""?0:Number(e.target.value))}/></label>;
}
/** Reuses the ONE CG18 revision/CG03 independent approval/CG19 scanned media.
 * These are separate editorial forms for US-002–US-004, NOT a second CMS.
 */
export function CmsExtendedWorkspace({canManage,canPublish,canViewNoticeSources}:{
 canManage:boolean;canPublish:boolean;canViewNoticeSources:boolean}){
 const [kind,setKind]=useState<Kind>("IMPACT");
 const [pages,setPages]=useState<Item[]>([]);
 const [listSearch,setListSearch]=useState("");
 const [listKind,setListKind]=useState<Kind|"ALL">("ALL");
 const [listStatus,setListStatus]=useState("ALL");
 const [galleryCategory,setGalleryCategory]=useState("ALL");
 const [galleryVisibility,setGalleryVisibility]=useState("ALL");
 const [editorOpen,setEditorOpen]=useState(false);
 const [closePrompt,setClosePrompt]=useState(false);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [draft,setDraft]=useState<Draft>(initial("IMPACT"));
 const [busy,setBusy]=useState(false),[preview,setPreview]=useState(false);
 const [previewMediaScope,setPreviewMediaScope]=useState<"PHOTO"|"VIDEO"|"PUBLICATION">("PHOTO");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [pending,setPending]=useState<Command|null>(null);
 // Original CG19 intent stays associated with one file, authored position
 // and source revision until verified, or source-confirmed rejected/expired.
 const mediaAttempt=useRef<{fingerprint:string;key:string;uploadRef:string|null}|null>(null);
 const [eventSources,setEventSources]=useState<EventSource[]>([]),[eventSourceError,setEventSourceError]=useState("");
 const [noticeSources,setNoticeSources]=useState<NoticeSource[]>([]);
 const [noticeSourceError,setNoticeSourceError]=useState("");
 const [partnerSources,setPartnerSources]=useState<PartnerOption[]>([]),[partnerSourceError,setPartnerSourceError]=useState("");
 const [uploadRole,setUploadRole]=useState("IMPACT"),[uploadOrder,setUploadOrder]=useState(0);
 const [uploadAlt,setUploadAlt]=useState(""),[rights,setRights]=useState(false);
 const [withdrawReason,setWithdrawReason]=useState("");
 const [publishWhen,setPublishWhen]=useState("");
 const refresh=useCallback(async()=>{
  const data=await api<{pages:Item[]}>("pages");
  setPages(data.pages.filter(p=>kinds.includes(p.kind as Kind)));
 },[]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[refresh]);
 const open=async(p:Item)=>{
  if(pending||mediaAttempt.current){
   setError("Your last original CMS action may have committed. "+
    "Retry the same request before opening another page.");
   return;
  }
  setBusy(true);setError("");setNotice("");
  try{
   const detail=await api<Detail>("pages/"+p.pageRef);
   setSelected(detail);setKind(detail.kind);
   setEditorOpen(true);setClosePrompt(false);
   setPreviewMediaScope("PHOTO");setGalleryCategory("ALL");setGalleryVisibility("ALL");
   setUploadRole(detail.kind==="PARTNERS"?"FEATURE":detail.kind==="IMPACT"?"IMPACT":detail.kind==="GALLERY"?"GALLERY":
    detail.kind==="COMPLIANCE"?"DOCUMENT":detail.kind==="ARTICLE"?"ARTICLE":
    detail.kind==="CONTACT"?"CONTACT":"HERO");
   setUploadOrder(0);setRights(false);setUploadAlt("");
   setDraft({kind:detail.kind,slug:detail.slug,title:detail.title,
    seoTitle:detail.seoTitle,seoDescription:detail.seoDescription,
    sections:detail.sections,assets:detail.assets});
   setPreview(!canManage);setPending(null);
  }catch(e){setError(e instanceof Error?e.message:"Page could not be loaded.")}
  finally{setBusy(false);}
 };
 const begin=(k:Kind)=>{
  if(pending||mediaAttempt.current){
   setError("Resolve the original uncertain CMS request before a new page.");
   return;
  }
  setKind(k);setSelected(null);setDraft(initial(k));setPreview(false);
  setPreviewMediaScope("PHOTO");
  setEditorOpen(true);setClosePrompt(false);
  setPending(null);setError("");setNotice("");
  setUploadRole(k==="PARTNERS"?"FEATURE":k==="IMPACT"?"IMPACT":k==="GALLERY"?"GALLERY":
   k==="COMPLIANCE"?"DOCUMENT":k==="ARTICLE"?"ARTICLE":
   k==="CONTACT"?"CONTACT":"HERO");
 };
 const edit=(index:number,fields:Record<string,unknown>)=>{
  setDraft(d=>({...d,sections:d.sections.map((v,i)=>i===index?{...v,fields}:v)}));
 };
 const setField=(index:number,key:string,value:unknown)=>{
  const fields={...draft.sections[index].fields,[key]:value};
  edit(index,fields);
 };
 const changeItem=(sectionIndex:number,itemIndex:number,patch:Record<string,unknown>,
  key="items")=>{
  const current=items(draft.sections[sectionIndex].fields[key]);
  edit(sectionIndex,{...draft.sections[sectionIndex].fields,
   [key]:current.map((v,i)=>i===itemIndex?{...v,...patch}:v)});
 };
 const addItem=(sectionIndex:number,key:string,starter:Record<string,unknown>)=>{
  edit(sectionIndex,{...draft.sections[sectionIndex].fields,
   [key]:[...items(draft.sections[sectionIndex].fields[key]),starter]});
 };
 const removeItem=(sectionIndex:number,key:string,itemIndex:number,role?:string)=>{
  const current=items(draft.sections[sectionIndex].fields[key]);
  setDraft(d=>({...d,sections:d.sections.map((v,i)=>i===sectionIndex?
   {...v,fields:{...v.fields,[key]:current.filter((_,j)=>j!==itemIndex)}}:v),
   assets:role?d.assets.filter(a=>a.role!==role||a.order!==itemIndex)
    .map(a=>a.role===role&&a.order>itemIndex?{...a,order:a.order-1}:a):d.assets}));
 };
 const moveImpact=(index:number,shift:number)=>{
  const newIndex=index+shift;
  if(newIndex<0||newIndex>=draft.sections.length)return;
  const changed=[...draft.sections];
  [changed[index],changed[newIndex]]=[changed[newIndex],changed[index]];
  const sections=changed.map((v,i)=>({...v,order:i}));
  setDraft(d=>({...d,sections,assets:d.assets.map(a=>a.role==="IMPACT"?
   {...a,order:a.order===index?newIndex:a.order===newIndex?index:a.order}:a)}));
 };
 async function command(c:Command){
  setBusy(true);setPending(c);setError("");setNotice("");
  try{
   const outcome=await api<{confirmed:boolean;pageRef?:string;status?:string}>(
    c.path,{method:c.method,headers:{"Content-Type":"application/json"},
     body:JSON.stringify(c.body)});
   if(!outcome.confirmed)throw Error("Server did not confirm this change.");
   // A positively acknowledged original write is never made uncertain by
   // an unrelated list/detail GET failing after the actual commit.
   setPending(null);setNotice("Confirmed: "+str(outcome.status).replaceAll("_"," "));
   try{
    await refresh();
    const ref=outcome.pageRef??selected?.pageRef;
    if(ref){
     const detail=await api<Detail>("pages/"+ref);
     setSelected(detail);
     setDraft({kind:detail.kind,slug:detail.slug,title:detail.title,
      seoTitle:detail.seoTitle,seoDescription:detail.seoDescription,
      sections:detail.sections,assets:detail.assets});
    }
   }catch{
    // Do not leave an old CREATE/EDIT drawer active after a confirmed write.
    // Without the current revision the same text could be submitted again
    // under a different request key, despite the original action succeeding.
    setSelected(null);setEditorOpen(false);setClosePrompt(false);
    setError("Your original CMS action was CONFIRMED, but its latest page "+
     "could not be refreshed. Refresh the list before editing again.");
   }
  }catch(e){
   if(e instanceof Rejected)setPending(null);
   setError(e instanceof Error?e.message:"Check the original action before retrying.");
  }finally{setBusy(false);}
 }
 const act=(path:string,method:"POST"|"PUT",body:Record<string,unknown>)=>{
  if(busy||pending||mediaAttempt.current){
   setError("Resolve the previous original request before another change.");
   return;
  }
  void command({path,method,body:{requestKey:crypto.randomUUID(),...body}});
 };
 const allowedForCurrentPlacement=()=>{
  const image=["image/jpeg","image/png","image/webp"];
  if(uploadRole==="GALLERY"){
   const media=items(draft.sections.find(s=>s.kind==="GALLERY_GRID")?.fields.items)
    [uploadOrder]?.mediaType;
   return media==="PHOTO"?image:media==="VIDEO"?["video/mp4"]:
    media==="PUBLICATION"?["application/pdf"]:[];
  }
  return uploadRole==="DOCUMENT"?[...image,"application/pdf"]:image;
 };
 async function upload(file:File){
  if(!selected||selected.status!=="DRAFT"||busy||pending)return;
  if(!rights||uploadAlt.trim().length<3){
   setError("Confirm publication rights and original media description.");return;
  }
  const cap=file.type==="video/mp4"?26214400:10485760;
  const allowed=allowedForCurrentPlacement();
  if(!allowed.includes(file.type)||file.size<1||file.size>cap){
   setError("Select an allowed original image/PDF (10 MB) or video (25 MB).");
   return;
  }
  setBusy(true);setError("");setNotice("");
  try{
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",
    await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,"0")).join("");
   const fingerprint=JSON.stringify([selected.pageRef,selected.revisionRef,
    file.type,file.size,sha,uploadRole,uploadOrder,uploadAlt.trim()]);
   const old=mediaAttempt.current;
   if(old&&old.fingerprint!==fingerprint)
    throw Error("Earlier original media may have reached CG19. Choose the "+
     "SAME original file and placement to check that upload before another.");
   const attempt:{fingerprint:string;key:string;uploadRef:string|null}=
    old??{fingerprint,key:crypto.randomUUID(),uploadRef:null};
   mediaAttempt.current=attempt;
   const attach=(fileRef:string,version:number)=>{
    const placement={fileRef,version,role:uploadRole,order:uploadOrder,
     altText:uploadAlt.trim()};
    setDraft(d=>({...d,assets:[...d.assets.filter(a=>
     a.role!==uploadRole||a.order!==uploadOrder),placement]}));
    mediaAttempt.current=null;setUploadAlt("");setRights(false);
    setNotice("Original CG19 scanned file is verified and attached to "+
     "your unsaved draft. Save before submitting.");
   };
   if(attempt.uploadRef){
    const status=await api<{status:string;cleanVerified:boolean;
     fileRef:string|null;validatedVersion:number|null}>(
     "media/"+encodeURIComponent(attempt.uploadRef));
    if(status.cleanVerified&&status.fileRef&&status.validatedVersion){
     attach(status.fileRef,status.validatedVersion);return;
    }
    if(["REJECTED","EXPIRED","EXPIRED_OR_REJECTED"].includes(status.status)){
     mediaAttempt.current=null;
     throw Error("The prior original media is confirmed rejected or expired. "+
      "Select the file again to begin a new verified upload.");
    }
   }
   const started=await api<{status:string;uploadUrl?:string;
    uploadHeaders?:Record<string,string>;uploadRef:string}>(
    "media/initiate",json({pageRef:selected.pageRef,
     revisionRef:selected.revisionRef,requestKey:attempt.key,mime:file.type,
     sizeBytes:file.size,sha256:sha,rightsConfirmed:true}));
   if(!started.uploadRef)throw Error("Original CG19 upload intent was not recorded.");
   attempt.uploadRef=started.uploadRef;
   if(started.status==="VALIDATED"){
    const status=await api<{cleanVerified:boolean;fileRef:string|null;
     validatedVersion:number|null}>(
     "media/"+encodeURIComponent(started.uploadRef));
    if(status.cleanVerified&&status.fileRef&&status.validatedVersion){
     attach(status.fileRef,status.validatedVersion);return;
    }
   }
   if(started.status!=="UPLOAD_READY"||!started.uploadUrl||
    !started.uploadHeaders)
    throw Error("Original private upload is pending. Select the same source "+
     "file to recheck the original CG19 intent.");
   const target=new URL(started.uploadUrl);
   if(target.protocol!=="https:"||target.username||target.password||
    target.hash||started.uploadHeaders["Content-Type"]!==file.type)
    throw Error("CG19 signed private upload permission is not valid.");
   const written=await fetch(started.uploadUrl,{method:"PUT",body:file,
    headers:started.uploadHeaders,cache:"no-store"});
   if(!written.ok)throw Error("Original media transfer was not confirmed. "+
    "Choose the same file to recheck its previous upload.");
   const confirmed=await api<{cleanVerified:boolean;fileRef:string|null;
    validatedVersion:number|null}>(
    "media/"+encodeURIComponent(started.uploadRef)+"/confirm",json({}));
   if(!confirmed.cleanVerified||!confirmed.fileRef||!confirmed.validatedVersion)
    throw Error("CG19 scan or storage verification is still pending. "+
     "Choose the SAME original file to check this intent before retry.");
   attach(confirmed.fileRef,confirmed.validatedVersion);
  }catch(e){setError(e instanceof Error?e.message:"Original CG19 media upload uncertain.");}
  finally{setBusy(false);}
 }
 const galleryItems=items(draft.sections.find(section=>section.kind==="GALLERY_GRID")?.fields.items);
 const previewPage:PublicCmsPage={schemaVersion:1,effectiveGeneration:"PRIVATE_DRAFT",
  kind:draft.kind,slug:draft.slug,title:draft.title,seoTitle:draft.seoTitle,
  seoDescription:draft.seoDescription,canonicalPath:pathFor(draft.kind,draft.slug),
  lastPublishedAt:"",sections:draft.sections.map(section=>section.kind==="PARTNER_CARDS"?
   {...section,fields:{heading:section.fields.heading,intro:section.fields.intro,
    cards:items(section.fields.partners).flatMap((source,index)=>{
     const partner=partnerSources.find(p=>p.sourceRef===source.sourceRef&&p.rightsVersion===source.rightsVersion);
     return partner?[{name:partner.name,summary:partner.summary,originalIndex:index}]:[];
    })}}:section.kind==="GALLERY_GRID"?
   {...section,fields:{...section.fields,items:items(section.fields.items)
     .flatMap((entry,index)=>entry.visible===false?[]:[{...entry,originalIndex:index}])}}:
   section),
  assets:draft.assets.filter(a=>a.role!=="GALLERY"||
    galleryItems[a.order]?.visible!==false).map(a=>({...a,
   src:(a.role==="GALLERY"||a.role==="DOCUMENT"?
    "/api/cms-file-preview/":"/api/cms-image-preview/")+a.fileRef}))};
 const unsaved=selected&&JSON.stringify(content(draft))!==JSON.stringify({
  kind:selected.kind,slug:selected.slug,title:selected.title,seoTitle:selected.seoTitle,
  seoDescription:selected.seoDescription,canonicalPath:pathFor(selected.kind,selected.slug),
  sections:selected.sections,assets:selected.assets
 });
 const dirty=selected?Boolean(unsaved):
  JSON.stringify(draft)!==JSON.stringify(initial(draft.kind));
 const visible=pages.filter(p=>
  (listKind==="ALL"||p.kind===listKind)&&
  (listStatus==="ALL"||
   (listStatus==="PUBLISHED"?p.publicStatus==="EFFECTIVE":
    listStatus==="SCHEDULED"?p.publicStatus==="SCHEDULED":
    p.draftStatus===listStatus))&&
  (!listSearch.trim()||[p.title,p.slug,p.kind].some(v=>
   v.toLocaleLowerCase().includes(listSearch.trim().toLocaleLowerCase()))));
 const published=pages.filter(p=>p.publicStatus==="EFFECTIVE").length;
 const scheduled=pages.filter(p=>p.publicStatus==="SCHEDULED").length;
 const inReview=pages.filter(p=>p.draftStatus==="SUBMITTED").length;
 const close=useCallback(()=>{
  if(busy)return;
  if(pending||dirty||mediaAttempt.current){setClosePrompt(true);return;}
  setEditorOpen(false);
 },[busy,pending,dirty]);
 useEffect(()=>{
  if(!editorOpen)return;
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==="Escape"&&!event.defaultPrevented){event.preventDefault();close();}
  };
  document.addEventListener("keydown",onKey);
  return()=>document.removeEventListener("keydown",onKey);
 },[editorOpen,close]);
 return <section className="cg-cms-workspace" aria-label="Impact, media and healthcare editor">
  <div className="cg-cms-toolbar"><div><h2>Impact, media & healthcare content</h2>
   <p>Editable original content. One private draft, independent review and public publication.</p>
  </div><div className="cg-cms-actions">
   <button disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>Refresh pages</button>
   {canManage&&<button type="button" className="primary" disabled={busy} onClick={()=>begin(kind)}>New editorial page</button>}
  </div></div>
  {error&&<p className="cg-cms-error" role="alert">{error}</p>}
  {notice&&<p className="cg-cms-notice" role="status">{notice}</p>}
  {pending&&<div className="cg-cms-notice" role="status">
   <p>The outcome is not confirmed. Refresh before retrying the same request.</p>
   <button disabled={busy} onClick={()=>void command(pending)}>Retry original request</button>
  </div>}
  <div className="cg-cms-dashboard" aria-label="Actual editorial page counts">
   <div><span>Editorial pages</span><strong>{pages.length}</strong></div>
   <div><span>Currently public</span><strong>{published}</strong></div>
   <div><span>Scheduled</span><strong>{scheduled}</strong></div>
   <div><span>Awaiting independent review</span><strong>{inReview}</strong></div>
  </div>
  <div className="cg-cms-list-controls" aria-label="Find original editorial content">
   <label>Content type
    <select value={listKind} onChange={e=>setListKind(e.target.value as Kind|"ALL")}>
     <option value="ALL">All editorial content</option>
     {kinds.map(k=><option value={k} key={k}>{k==="COMPLIANCE"?"80G / Reports":k}</option>)}
    </select>
   </label>
   <label>Publication status
    <select value={listStatus} onChange={e=>setListStatus(e.target.value)}>
     <option value="ALL">All statuses</option>
     <option value="DRAFT">Draft</option>
     <option value="SUBMITTED">Submitted for review</option>
     <option value="PUBLISHED">Currently public</option>
     <option value="SCHEDULED">Scheduled</option>
    </select>
   </label>
   <label>Search by title
    <input type="search" maxLength={80} placeholder="Search original pages"
     value={listSearch} onChange={e=>setListSearch(e.target.value)}/>
   </label>
  </div>
  <div className="cg-cms-table-wrap"><table className="cg-cms-editorial-table">
   <caption>Current Foundation editorial pages ({visible.length})</caption>
   <thead><tr><th scope="col">Page title</th><th scope="col">Content type</th>
    <th scope="col">Editing status</th><th scope="col">Publication</th>
    <th scope="col">Action</th></tr></thead>
   <tbody>{visible.map(p=><tr key={p.pageRef}>
    <th scope="row"><strong>{p.title}</strong></th>
    <td>{p.kind==="COMPLIANCE"?"80G / Reports":p.kind}</td>
    <td>{p.draftStatus.replaceAll("_"," ")}</td>
    <td>{p.publicStatus?p.publicStatus.replaceAll("_"," "):"Not published"}</td>
    <td><button type="button" disabled={busy} onClick={()=>void open(p)}>
     {canManage?"Open editor":"View source"}</button></td>
   </tr>)}</tbody>
  </table>
  {visible.length===0&&<p role="status" className="cg-module-empty">
   No actual editorial pages match. Change the filters or create a new page.</p>}
  </div>
  {editorOpen&&(canManage||selected)&&<>
   <button type="button" className="cg-cms-drawer-backdrop" disabled={busy}
    aria-label="Close editorial drawer" onClick={close}/>
   <section className="cg-cms-card cg-cms-drawer" role="dialog" aria-modal="true"
    aria-label={selected?"Edit Foundation editorial content":"Create Foundation editorial content"}>
   <div className="cg-cms-toolbar"><h3>{selected?"Edit source draft":"Create editorial page"}</h3>
    <div className="cg-cms-actions">
     {canManage&&<button type="button" disabled={busy} onClick={()=>setPreview(x=>!x)}>
      {preview?"Edit":"Preview"}</button>}
     <button type="button" autoFocus disabled={busy} onClick={close}
      aria-label="Close editorial editor">Close</button>
    </div>
   </div>
   {error&&<p className="cg-cms-error" role="alert">{error}</p>}
   {notice&&<p className="cg-cms-notice" role="status">{notice}</p>}
   {pending&&<div className="cg-cms-notice" role="alert">
    <p>The previous server action is not confirmed. Retry the same request key
     or check the actual saved/public status before starting another edit.</p>
    <button type="button" disabled={busy}
     onClick={()=>void command(pending)}>Retry original request</button>
   </div>}
   {closePrompt&&<div className="cg-cms-notice" role="alert">
    <p>{pending?"The previous action may have reached the server. Closing will abandon its retry key. Verify actual status before any new attempt.":
     "This draft contains unsaved changes. Closing will discard only edits on this screen; the published version is unchanged."}</p>
    <div className="cg-cms-actions"><button type="button"
     onClick={()=>setClosePrompt(false)}>Keep editing</button>
     <button type="button" disabled={!!mediaAttempt.current}
     onClick={()=>{setClosePrompt(false);setEditorOpen(false);setPending(null);}}>
      Discard edits and close</button></div>
   </div>}
   {preview?<div className="cg-cms-preview">
    <p>Private preview; no publication or public media URL is implied.</p>
    {draft.kind==="GALLERY"&&<div className="cg-cms-actions" role="group"
      aria-label="Preview the three original public media URLs">
     {([["PHOTO","Gallery /gallery"],["VIDEO","Videos /videos"],
       ["PUBLICATION","Publications /publications"]] as const)
      .map(([mode,label])=><button type="button" key={mode}
       aria-pressed={previewMediaScope===mode}
       onClick={()=>setPreviewMediaScope(mode)}>{label}</button>)}
    </div>}
    <CmsPublicPage page={previewPage} mediaScope={
     draft.kind==="GALLERY"?previewMediaScope:undefined}/></div>:<div className="cg-cms-form">
    {draft.kind==="IMPACT"&&<section className="cg-cms-impact-facts"
     aria-label="Original U23 Page Facts, from current unsaved editorial draft">
      <h4>Page Facts</h4>
      <dl>{([
       ["Stat cards","STATS"],["Key impact areas","FOCUS"],
       ["Success stories","STORIES"],["Latest updates","UPDATES"],
       ["Map pins","GEOGRAPHY"]
      ] as const).map(([title,key])=>{
       const entries=items(draft.sections.find(section=>
        section.kind==="IMPACT_GROUP"&&section.fields.group===key)?.fields.items);
       const count=key==="GEOGRAPHY"?entries.filter(x=>
        typeof x.latitude==="number"&&typeof x.longitude==="number").length:
        entries.length;
       return <div key={key}><dt>{title}</dt><dd>{count}</dd></div>;
      })}</dl>
      <p>These are your actual draft entries, not audited project counts or
       a claimed public publication. Release requires separate CMS approval.</p>
     </section>}
    <label>Content type<select disabled={!!selected||!canManage} value={draft.kind}
     onChange={e=>begin(e.target.value as Kind)}>
     {kinds.map(k=><option key={k} value={k}>{k==="COMPLIANCE"?"80G / registration":k.replaceAll("_"," ")}</option>)}
    </select></label>
    {draft.kind==="POLICY"&&<>
     <p>Only Foundation-approved original legal wording may be published.
      This editor does not generate or assume any policy text.</p>
     <label>Original footer policy<select disabled={!!selected||!canManage}
      value={draft.slug} onChange={e=>{
       const slug=e.target.value,label=legalPages.find(p=>p[0]===slug)?.[1]??"";
       setDraft(d=>({...d,slug,title:label,
        sections:d.sections.map((sec,i)=>i===0?{...sec,
         fields:{...sec.fields,heading:label}}:sec)}));
      }}>
      {legalPages.map(([slug,label])=><option key={slug} value={slug}>{label}</option>)}
     </select></label>
    </>}
    {draft.kind==="ARTICLE"&&<Field name="Article URL name (lowercase letters, digits, hyphens)"
     value={draft.slug} onChange={v=>setDraft(d=>({...d,slug:v}))}/>}
    <Field name="Page title" value={draft.title}
     onChange={v=>setDraft(d=>({...d,title:v}))}/>
    <Field name="Search title" value={draft.seoTitle}
     onChange={v=>setDraft(d=>({...d,seoTitle:v}))}/>
    <Field name="Search description" value={draft.seoDescription} large
     onChange={v=>setDraft(d=>({...d,seoDescription:v}))}/>
    {draft.sections.map((section,index)=>{
     const f=section.fields,groupName=str(f.group);
     const change=(key:string,value:unknown)=>setField(index,key,value);
     return <fieldset key={section.kind+"-"+index}>
      <legend>{section.kind==="IMPACT_GROUP"?"Impact: "+groupName.replaceAll("_"," "):
       section.kind.replaceAll("_"," ")}</legend>
      {typeof f.sourceEventRef==="string"?<p><strong>{str(f.heading)}</strong> · {str(f.category)}<br/>{str(f.body)}</p>:<Field name="Heading" value={f.heading} onChange={v=>change("heading",v)}/>}
      {section.kind==="HERO"&&<>
       <Field name={draft.kind==="PARTNERS"?"Corporate partnership hero subtitle":"Healthcare hero subtitle"} value={f.subtitle}
        onChange={v=>change("subtitle",v)}/>
       <Field name="Short hero description" large value={f.description}
        onChange={v=>change("description",v)}/>
       <Field name="Section label" value={f.eyebrow}
        onChange={v=>change("eyebrow",v)}/>
       {draft.kind==="PARTNERS"&&<>
        <Field name="Hero contact button label" value={f.primaryLabel}
         onChange={v=>{change("primaryLabel",v);}}/>
        <p>The original Partner With Us destination is the Foundation contact page.</p>
       </>}
      </>}
      {section.kind==="IMPACT_GROUP"&&<>
       {groupName==="HERO"&&<>
        <Field name="Eyebrow (original U23 header)" value={f.eyebrow}
         onChange={v=>change("eyebrow",v)}/>
        <Field name="Highlighted words (green)" value={f.highlight}
         onChange={v=>change("highlight",v)}/>
        <Field name="Optional handwritten quote" value={f.quote} large
         onChange={v=>change("quote",v)}/>
       </>}
       <Field name="Explanation" value={f.intro} large onChange={v=>change("intro",v)}/>
       {groupName==="STATS"&&canManage&&<button type="button" disabled={busy||!!pending} onClick={()=>void api<{fields:Record<string,unknown>|null}>("beneficiary-impact-source").then(v=>{if(!v.fields){setError("No publishable beneficiary aggregate for the last completed year.");return;}edit(index,v.fields);}).catch(()=>setError("Current role or source cannot provide beneficiary impact."))}>Use verified beneficiary impact</button>}
       <Field name="Data or editorial source" value={f.source} onChange={v=>change("source",v)}/>
       <Field name="Source date" type="date" value={f.asOfDate}
        onChange={v=>change("asOfDate",v)}/>
       <div className="cg-cms-actions">
        <button type="button" disabled={index===0} onClick={()=>moveImpact(index,-1)}>Move earlier</button>
        <button type="button" disabled={index===draft.sections.length-1}
         onClick={()=>moveImpact(index,1)}>Move later</button>
       </div>
       {groupName==="BREAKDOWN"&&<label className="cg-cms-consent">
        <input type="checkbox" checked={f.claimsFullBreakdown===true}
         onChange={e=>change("claimsFullBreakdown",e.target.checked)}/>
        This is a complete 100% breakdown (percentages must total exactly 100)
       </label>}
       {["HERO","CTA"].includes(groupName)&&<><Field name="Button label (optional)" value={f.ctaLabel}
        onChange={v=>change("ctaLabel",v)}/>
        <Field name="Existing public destination" value={f.ctaPath}
         onChange={v=>change("ctaPath",v)}/></>}
       {items(f.items).map((v,j)=><div className="cg-cms-team" key={j}>
        <Field name="Label" value={v.title} onChange={x=>changeItem(index,j,{title:x})}/>
        <Field name="Description" value={v.description}
         onChange={x=>changeItem(index,j,{description:x})}/>
        {["STATS","GROWTH"].includes(groupName)&&<>
         <NumberField name="Value" value={v.value}
          onChange={x=>changeItem(index,j,{value:x})}/>
         <Field name="Unit (if applicable)" value={v.unit}
          onChange={x=>changeItem(index,j,{unit:x})}/>
        </>}
        {groupName==="GROWTH"&&<NumberField name="Year" value={v.year}
         onChange={x=>changeItem(index,j,{year:x})}/>}
        {groupName==="BREAKDOWN"&&<NumberField name="Percentage" value={v.percentage}
         max={100} onChange={x=>changeItem(index,j,{percentage:x})}/>}
        {groupName==="GEOGRAPHY"&&<>
         <label>State / region impact level<select value={str(v.level)||"EXPANDING"}
          onChange={e=>changeItem(index,j,{level:e.target.value})}>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="EXPANDING">Expanding</option>
         </select></label>
         <p className="cg-cms-muted">Label actual state reach from a dated source;
          the level is editorial, not a verified geographic survey.</p>
         {(["latitude","longitude"] as const).map(key=><label key={key}>
          Optional map pin {key}
          <input type="number" step="0.000001"
           min={key==="latitude"?-90:-180} max={key==="latitude"?90:180}
           value={typeof v[key]==="number"?String(v[key]):""}
           onChange={e=>changeItem(index,j,{[key]:
            e.target.value===""?undefined:Number(e.target.value)})}/>
         </label>)}
        </>}
        {groupName==="STORIES"&&<label className="cg-cms-consent">
         <input type="checkbox" checked={v.consentConfirmed===true}
          onChange={e=>changeItem(index,j,{consentConfirmed:e.target.checked})}/>
         Written public-story consent confirmed</label>}
        {canManage&&<button type="button" onClick={()=>removeItem(index,"items",j)}>
         Remove item</button>}
       </div>)}
       {canManage&&items(f.items).length<16&&<button type="button"
        onClick={()=>addItem(index,"items",{title:"",description:"",
         ...(["STATS","GROWTH"].includes(groupName)?{value:0}:{}),
         ...(groupName==="GROWTH"?{year:new Date().getUTCFullYear()}:{}),
         ...(groupName==="BREAKDOWN"?{percentage:0}:{}),
         ...(groupName==="GEOGRAPHY"?{level:"EXPANDING"}:{}),
         ...(groupName==="STORIES"?{consentConfirmed:false}:{})})}>
        Add {groupName.toLowerCase()} item</button>}
      </>}
      {section.kind==="COMPLIANCE_FACTS"&&<>
       <Field name="Client-approved status badge (shown only with valid proof)"
        value={f.badgeText} onChange={v=>change("badgeText",v)}/>
       <Field name="Original orange subheading" value={f.subtitle}
        onChange={v=>change("subtitle",v)}/>
       <Field name="Original Important note (subject to legal review)" large
        value={f.importantNote} onChange={v=>change("importantNote",v)}/>
       <Field name="Public summary (no unverified tax promises)" value={f.summary} large
        onChange={v=>change("summary",v)}/>
       {(["issuer","pan","registrationNumber","approvalNumber","source"] as const)
        .map(key=><Field key={key} name={key.replace(/([A-Z])/g," $1")}
         value={f[key]} onChange={v=>change(key,v)}/>)}
       <Field name="Source reviewed on" type="date" value={f.verifiedAsOf}
        onChange={v=>change("verifiedAsOf",v)}/>
       <Field name="Valid from" type="date" value={f.validFrom}
        onChange={v=>change("validFrom",v)}/>
       <Field name="Valid until" type="date" value={f.validUntil}
        onChange={v=>change("validUntil",v)}/>
       <label>Public verification status<select value={str(f.verification)}
        onChange={e=>change("verification",e.target.value)}>
        <option value="NOT_VERIFIED">Not verified — no active tax benefit promised</option>
        <option value="VERIFIED">Verified against actual current official proof</option>
       </select></label>
       <Field name="Required disclaimer" value={f.disclaimer} large
        onChange={v=>change("disclaimer",v)}/>
       <p>Verified 80G claims require a current approved 80G document in the first position.
        Registration certificates and annual reports may be added as separate scanned documents.</p>
       {items(f.documents).map((document,j)=><div className="cg-cms-team" key={j}>
        <label>Document kind<select value={str(document.type)} onChange={e=>
         changeItem(index,j,{type:e.target.value},"documents")}>
         <option value="80G">80G approval</option>
         <option value="REGISTRATION">Registration</option>
         <option value="ANNUAL_REPORT">Annual report</option>
         <option value="OTHER">Other published document</option>
        </select></label>
        <Field name="Official document title" value={document.title}
         onChange={v=>changeItem(index,j,{title:v},"documents")}/>
        <Field name="Document date" type="date" value={document.asOfDate}
         onChange={v=>changeItem(index,j,{asOfDate:v},"documents")}/>
        {canManage&&<button type="button"
         onClick={()=>removeItem(index,"documents",j,"DOCUMENT")}>Remove document</button>}
       </div>)}
       {canManage&&items(f.documents).length<6&&<button type="button"
        onClick={()=>addItem(index,"documents",{
         type:items(f.documents).length===0?"80G":"ANNUAL_REPORT",
         title:"",asOfDate:today()})}>Add 80G / report document</button>}
      </>}
      {section.kind==="GALLERY_GRID"&&<>
       <Field name="Intro" value={f.description} large onChange={v=>change("description",v)}/>
       <fieldset><legend>Original separate media pages</legend>
        <p>One approved Gallery and CG-19 media source serves three original URLs: Gallery, Videos and Publications. Edit their headings and empty states here.</p>
        <Field name="Videos page heading" value={f.videosHeading} onChange={v=>change("videosHeading",v)}/>
        <Field name="Videos page description" value={f.videosDescription} large onChange={v=>change("videosDescription",v)}/>
        <Field name="Videos empty result message" value={f.videosEmptyText} onChange={v=>change("videosEmptyText",v)}/>
        <Field name="Publications page heading" value={f.publicationsHeading} onChange={v=>change("publicationsHeading",v)}/>
        <Field name="Publications page description" value={f.publicationsDescription} large onChange={v=>change("publicationsDescription",v)}/>
        <Field name="Publications empty result message" value={f.publicationsEmptyText} onChange={v=>change("publicationsEmptyText",v)}/>
        <Field name="Gallery empty result message" value={f.photosEmptyText} onChange={v=>change("photosEmptyText",v)}/>
       </fieldset>
       <div className="cg-cms-actions" role="group" aria-label="Original gallery category filters">
        <button type="button" aria-pressed={galleryCategory==="ALL"}
         onClick={()=>setGalleryCategory("ALL")}>All ({items(f.items).length})</button>
        {Array.from(new Set(items(f.items).map(item=>str(item.category)).filter(Boolean)))
         .sort().map(name=><button key={name} type="button"
          aria-pressed={galleryCategory===name}
          onClick={()=>setGalleryCategory(name)}>{name} ({items(f.items)
           .filter(item=>item.category===name).length})</button>)}
       </div>
       <div className="cg-cms-actions" role="group" aria-label="Original gallery publication filters">
        {([["ALL","All"],["VISIBLE","Published after approval"],
         ["HIDDEN","Hidden"]] as const).map(([value,label])=>
         <button type="button" key={value} aria-pressed={galleryVisibility===value}
          onClick={()=>setGalleryVisibility(value)}>{label}</button>)}
       </div>
       {items(f.items).map((item,j)=>({item,j})).filter(({item})=>
        (galleryCategory==="ALL"||item.category===galleryCategory)&&
        (galleryVisibility==="ALL"||(galleryVisibility==="VISIBLE"?
         item.visible!==false:item.visible===false)))
        .map(({item,j})=><div className="cg-cms-team" key={j}>
        <span className="cg-cms-muted">Gallery item {j+1} ·
         {item.visible===false?" Hidden from public":" Visible after approval"}</span>
        {item.mediaType==="PHOTO"&&
         draft.assets.find(a=>a.role==="GALLERY"&&a.order===j)&&
         <img className="cg-cms-review-image" loading="lazy"
          alt={str(draft.assets.find(a=>a.role==="GALLERY"&&a.order===j)?.altText)}
          src={"/api/cms-image-preview/"+
           draft.assets.find(a=>a.role==="GALLERY"&&a.order===j)?.fileRef}/>}
        <label className="cg-cms-consent">
         <input type="checkbox" checked={item.visible!==false}
          onChange={e=>changeItem(index,j,{visible:e.target.checked})}/>
         Show this item on the public site after independent approval and publication
        </label>
        {(["title","caption","category","source"] as const).map(key=>
         <Field key={key} name={key} value={item[key]}
          onChange={v=>changeItem(index,j,{[key]:v})}/>)}
        <Field name="Media source date" type="date" value={item.asOfDate}
         onChange={v=>changeItem(index,j,{asOfDate:v})}/>
        <label>Media type<select value={str(item.mediaType)} onChange={e=>
         changeItem(index,j,{mediaType:e.target.value})}>
          <option value="PHOTO">Photo</option><option value="VIDEO">Video</option>
          <option value="PUBLICATION">Publication PDF</option>
         </select></label>
        {canManage&&<button type="button"
         onClick={()=>removeItem(index,"items",j,"GALLERY")}>Remove item</button>}
       </div>)}
       {canManage&&items(f.items).length<12&&<button type="button"
        onClick={()=>addItem(index,"items",{title:"",caption:"",category:"",
         source:"",asOfDate:today(),mediaType:"PHOTO",visible:true})}>Add gallery item</button>}
      </>}
      {section.kind==="ARTICLE_BODY"&&<>
       {canManage&&<details className="cg-cms-card" open={typeof f.sourceEventRef==="string"}><summary>Approved Foundation event</summary><p>Select a current reviewed event to publish as an article. The original event stays the operational record. CMS approval is still required.</p><button type="button" disabled={busy||!!pending} onClick={()=>{setEventSourceError("");void api<{sources:EventSource[]}>("event-sources").then(v=>setEventSources(v.sources)).catch(()=>{setEventSources([]);setEventSourceError("Approved event sources unavailable.");});}}>Refresh approved events</button>{eventSourceError&&<p role="alert">{eventSourceError}</p>}<label>Approved event<select disabled={busy||!!pending||!!mediaAttempt.current} value={str(f.sourceEventRef)} onChange={e=>{const chosen=eventSources.find(x=>x.sourceRef===e.target.value);if(!chosen)return;setDraft(d=>({...d,slug:selected?d.slug:chosen.slug.slice(0,70),title:chosen.title,seoTitle:(chosen.title+" | CareGanga Foundation").slice(0,180),seoDescription:chosen.summary.slice(0,300),assets:[],sections:d.sections.map((s,i)=>i===index?{...s,fields:{heading:chosen.title,category:chosen.category,excerpt:chosen.summary.slice(0,400).trim(),body:chosen.summary,authorLabel:"CareGanga Foundation",source:"Approved Foundation event",asOfDate:today(),tags:[],sourceEventRef:chosen.sourceRef}}:s)}));}}><option value="">Choose approved event</option>{typeof f.sourceEventRef==="string"&&!eventSources.some(x=>x.sourceRef===f.sourceEventRef)&&<option value={str(f.sourceEventRef)}>Current selection — refresh to verify</option>}{eventSources.map(v=><option key={v.sourceRef} value={v.sourceRef}>{v.title} · {v.category} · {new Date(v.scheduledStart).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</option>)}</select></label>{typeof f.sourceEventRef==="string"&&<p>Event title, category, summary and consented image are locked to the reviewed source. To update, select its latest eligible revision. Withdrawal or cancellation hides the article.</p>}</details>}
       {canViewNoticeSources&&typeof f.sourceEventRef!=="string"&&<details className="cg-cms-card">
        <summary>Optional: publish an eligible original Foundation notice as an article</summary>
        <p>Only an active, already approved CG-19 all-staff notice can be selected.
         This makes an explicit public copy subject to separate CG-03 CMS approval.
         Private recipients and delivery records are never included.</p>
        <button type="button" disabled={busy||!canManage} onClick={()=>{
         void api<{sources:NoticeSource[]}>("notice-sources").then(res=>{
          setNoticeSources(res.sources);setNoticeSourceError("");
         }).catch(()=>setNoticeSourceError(
          "Original notices are unavailable or your role cannot view them."));
        }}>Load eligible approved notices</button>
        {noticeSourceError&&<p role="status">{noticeSourceError}</p>}
        <label>Original notice to copy<select value={str(f.sourceNoticeRef)}
         onChange={e=>{
          const chosen=noticeSources.find(x=>x.noticeRef===e.target.value);
          if(!chosen){const {sourceNoticeRef,publicReleaseConfirmed,...plain}=f;
           edit(index,plain);return;}
          edit(index,{...f,sourceNoticeRef:chosen.noticeRef,publicReleaseConfirmed:false,
           heading:chosen.title,body:chosen.body,excerpt:chosen.body.slice(0,300),
           category:"Official Notice",authorLabel:"CareGanga Foundation",
           source:"CG-19 approved Foundation notice",asOfDate:chosen.asOfDate});
         }}>
         <option value="">Independent editorial article (not a notice)</option>
         {noticeSources.map(item=><option key={item.noticeRef} value={item.noticeRef}>
          {item.title} · expires {item.expiresAt.slice(0,10)}</option>)}
        </select></label>
        {typeof f.sourceNoticeRef==="string"&&<label className="cg-cms-consent">
         <input type="checkbox" checked={f.publicReleaseConfirmed===true}
          onChange={e=>change("publicReleaseConfirmed",e.target.checked)}/>
         I confirm that this exact notice title and body are safe for publication
         to everyone; an independent CMS reviewer must approve the original copy.
        </label>}
        {typeof f.sourceNoticeRef==="string"&&<p>Do not rewrite the original
         notice heading/body. Its cancellation or expiry will automatically hide
         this article from both public channels.</p>}
       </details>}
       {typeof f.sourceEventRef!=="string"&&<>{(["category","authorLabel","source"] as const).map(key=><Field key={key}
        name={key.replace(/([A-Z])/g," $1")} value={f[key]}
        onChange={v=>change(key,v)}/>)}
       <Field name="Original source date" type="date" value={f.asOfDate}
        onChange={v=>change("asOfDate",v)}/>
       <Field name="Article summary" large value={f.excerpt}
        onChange={v=>change("excerpt",v)}/>
       <Field name="Article body (plain text, no HTML)" large value={f.body}
        onChange={v=>change("body",v)}/>
       <Field name="Tags (comma-separated)" value={Array.isArray(f.tags)?f.tags.join(", "):""}
        onChange={v=>change("tags",v.split(",").map(x=>x.trim()).filter(Boolean).slice(0,8))}/></>}
      </>}
      {section.kind==="CTA"&&draft.kind==="PARTNERS"&&<>
       <Field name="Final contact section label" value={f.eyebrow}
        onChange={v=>change("eyebrow",v)}/>
       <Field name="Final collaboration explanation" value={f.body} large
        onChange={v=>change("body",v)}/>
       <Field name="Contact button label" value={f.label}
        onChange={v=>change("label",v)}/>
       <p>The final contact button uses the original existing /contact route.</p>
      </>}
      {section.kind==="PARTNER_CARDS"&&<>
       <Field name="Original partner section introduction" value={f.intro} large
        onChange={v=>change("intro",v)}/>
       <p>Only original CG08 partners with active publicity consent and clean
        independent CG03/CG19 evidence are offered. CG18 must approve this
        exact selection separately; revoking rights hides it even after publication.</p>
       <button type="button" disabled={busy||!!pending} onClick={()=>{
        setPartnerSourceError("");
        void api<{partners:PartnerOption[]}>("partner-sources")
         .then(v=>setPartnerSources(v.partners))
         .catch(()=>{setPartnerSources([]);setPartnerSourceError(
          "Current approved CSR partner choices are unavailable. Do not submit.");});
       }}>Refresh currently authorized partners</button>
       {!!partnerSourceError&&<p role="alert">{partnerSourceError}</p>}
       {items(f.partners).map((entry,j)=>{
        const option=partnerSources.find(x=>x.sourceRef===entry.sourceRef&&
         x.rightsVersion===entry.rightsVersion);
        return <div className="cg-cms-team" key={String(entry.sourceRef)+String(j)}>
         <strong>{option?.name??"Previously selected partner — refresh and verify"}</strong>
         <p>{option?.summary??"The original public rights version must still be current."}</p>
         {canManage&&<button type="button" disabled={busy||!!pending}
          onClick={()=>removeItem(index,"partners",j,"FEATURE")}>Remove partner</button>}
        </div>;
       })}
       {canManage&&items(f.partners).length<12&&<label>Choose an original verified partner
        <select value="" disabled={busy||!!pending||!!mediaAttempt.current||!!partnerSourceError}
         onChange={e=>{
          const source=partnerSources.find(x=>x.sourceRef===e.target.value);
          if(!source||items(f.partners).some(v=>v.sourceRef===source.sourceRef))return;
          addItem(index,"partners",{sourceRef:source.sourceRef,rightsVersion:source.rightsVersion});
         }}>
         <option value="">Select current approved partner (no samples)</option>
         {partnerSources.filter(x=>!items(f.partners).some(v=>v.sourceRef===x.sourceRef))
          .map(v=><option value={v.sourceRef} key={v.sourceRef}>{v.name}</option>)}
        </select>
       </label>}
      </>}
      {section.kind==="HEALTHCARE_CATEGORIES"&&<>
       <Field name="General healthcare explanation" large value={f.intro}
        onChange={v=>change("intro",v)}/>
       <p>Describe real service categories only. No invented doctors, fees, discounts, ratings or bookable appointments.</p>
       {items(f.categories).map((v,j)=><div className="cg-cms-team" key={j}>
        <Field name="Category name" value={v.title}
         onChange={x=>changeItem(index,j,{title:x},"categories")}/>
        <Field name="What this category means" large value={v.description}
         onChange={x=>changeItem(index,j,{description:x},"categories")}/>
        {canManage&&<button type="button"
         onClick={()=>removeItem(index,"categories",j,"FEATURE")}>Remove category</button>}
       </div>)}
       {canManage&&items(f.categories).length<12&&<button type="button"
        onClick={()=>addItem(index,"categories",{title:"",description:""})}>Add category</button>}
       <Field name="Optional information button" value={f.ctaLabel}
        onChange={v=>change("ctaLabel",v)}/>
       <label>Destination<select value={str(f.ctaPath)}
        onChange={e=>change("ctaPath",e.target.value)}>
        <option value="">No link</option><option value="/contact">Foundation Contact</option>
       </select></label>
      </>}
      {section.kind==="CONTACT_INFO"&&<>
       <Field name="Contact page hero title" value={f.heroTitle}
        onChange={v=>change("heroTitle",v)}/>
       <Field name="Contact page introduction" large value={f.heroIntro}
        onChange={v=>change("heroIntro",v)}/>
       <p>These are real client-approved public inquiry descriptions, not separate support inboxes.</p>
       {items(f.inquiries).map((v,j)=><div className="cg-cms-team" key={j}>
        <Field name={"Inquiry card "+(j+1)+" title"} value={v.title}
         onChange={x=>changeItem(index,j,{title:x},"inquiries")}/>
        <Field name="Card description" large value={v.description}
         onChange={x=>changeItem(index,j,{description:x},"inquiries")}/>
       </div>)}
       <Field name="Approved office hours (no unverified 24/7 promise)"
        value={f.officeHours} onChange={v=>change("officeHours",v)}/>
       <Field name="Verified Google Maps URL (optional)" value={f.mapUrl}
        onChange={v=>change("mapUrl",v)}/>
       <h4>Original FAQs — client-approved question and answer only</h4>
       {items(f.faqs).map((v,j)=><div className="cg-cms-team" key={j}>
        <Field name="Question" value={v.question}
         onChange={x=>changeItem(index,j,{question:x},"faqs")}/>
        <Field name="Answer" large value={v.answer}
         onChange={x=>changeItem(index,j,{answer:x},"faqs")}/>
        {canManage&&<button type="button"
         onClick={()=>removeItem(index,"faqs",j)}>Remove FAQ</button>}
       </div>)}
       {canManage&&items(f.faqs).length<8&&<button type="button"
        onClick={()=>addItem(index,"faqs",{question:"",answer:""})}>Add FAQ</button>}
       <h4>Verified official social links</h4>
       {items(f.socialLinks).map((v,j)=><div className="cg-cms-team" key={j}>
        <label>Network<select value={str(v.network)}
         onChange={e=>changeItem(index,j,{network:e.target.value},"socialLinks")}>
         <option value="Facebook">Facebook</option>
         <option value="Instagram">Instagram</option>
         <option value="YouTube">YouTube</option>
        </select></label>
        <Field name="Approved HTTPS profile URL" value={v.url}
         onChange={x=>changeItem(index,j,{url:x},"socialLinks")}/>
        {canManage&&<button type="button"
         onClick={()=>removeItem(index,"socialLinks",j)}>Remove link</button>}
       </div>)}
       {canManage&&items(f.socialLinks).length<3&&<button type="button"
        onClick={()=>addItem(index,"socialLinks",{network:"Facebook",url:""})}>
        Add approved social link</button>}
      </>}
      {section.kind==="RICH_TEXT"&&<>
       <Field name={draft.kind==="POLICY"?"Client-approved legal paragraph":"Introduction"} value={f.body} large onChange={v=>change("body",v)}/>
       {draft.kind==="PARTNERS"&&<><Field name="Section label" value={f.eyebrow} onChange={v=>change("eyebrow",v)}/><Field name="Highlights (one per line, up to four)" large value={Array.isArray(f.highlights)?f.highlights.join("\n"):""} onChange={v=>change("highlights",v.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,4))}/></>}
       </>}
      {section.kind==="RICH_TEXT"&&draft.kind==="POLICY"&&canManage&&
       draft.sections.length>1&&<button type="button" onClick={()=>setDraft(d=>({
        ...d,sections:d.sections.filter((_,j)=>j!==index).map((sec,j)=>({...sec,order:j}))
       }))}>Remove this policy section</button>}
     </fieldset>;
    })}
    {draft.kind==="PARTNERS"&&canManage&&draft.sections.length<8&&<button type="button" onClick={()=>setDraft(d=>({...d,sections:[...d.sections,{kind:"RICH_TEXT",order:Math.max(0,...d.sections.map(sec=>sec.order))+1,fields:{heading:"",body:"",eyebrow:"",variant:"STANDARD",highlights:[]}}]}))}>Add partnership text section</button>}
    {draft.kind==="POLICY"&&canManage&&draft.sections.length<12&&
     <button type="button" onClick={()=>setDraft(d=>({...d,sections:[...d.sections,{
      kind:"RICH_TEXT",order:d.sections.length,fields:{heading:"",body:"",
       eyebrow:"",variant:"STANDARD",highlights:[]}}]}))}>
      Add legal text section</button>}
    {selected?.status==="DRAFT"&&draft.kind!=="POLICY"&&!draft.sections.some(s=>typeof s.fields.sourceEventRef==="string")&&
     <fieldset><legend>Verified original media</legend>
      <p>Only original CG-19 scanned, consented media. Attach one per matching section or item.</p>
      <label>Placement<select value={uploadRole} onChange={e=>setUploadRole(e.target.value)}>
       {draft.kind==="PARTNERS"?<option value="FEATURE">Verified corporate partner logo (optional)</option>:
        draft.kind==="IMPACT"?<option value="IMPACT">Impact group photo</option>:
        draft.kind==="GALLERY"?<option value="GALLERY">Gallery item</option>:
        draft.kind==="COMPLIANCE"?<option value="DOCUMENT">Official proof scan or PDF</option>:
        draft.kind==="CONTACT"?<option value="CONTACT">Contact photo strip</option>:
        draft.kind==="HEALTHCARE"?<><option value="HERO">Healthcare hero photograph</option><option value="FEATURE">Healthcare category illustration</option></>:
        <option value="ARTICLE">Article cover photo</option>}
      </select></label>
      {["IMPACT","GALLERY","DOCUMENT","CONTACT","FEATURE"].includes(uploadRole)&&<label>Placement position<select
       value={String(uploadOrder)} onChange={e=>setUploadOrder(Number(e.target.value))}>
       {(draft.kind==="PARTNERS"?items(draft.sections.find(v=>v.kind==="PARTNER_CARDS")?.fields.partners).map(v=>({title:partnerSources.find(p=>p.sourceRef===v.sourceRef)?.name??"Verified partner"})):
        draft.kind==="HEALTHCARE"?items(draft.sections.find(v=>v.kind==="HEALTHCARE_CATEGORIES")?.fields.categories):
        draft.kind==="CONTACT"?[{title:"Original photo 1"},{title:"Original photo 2"},
          {title:"Original photo 3"}]:
        draft.kind==="IMPACT"?draft.sections:draft.kind==="COMPLIANCE"?
         items(draft.sections[0]?.fields.documents):items(draft.sections[0]?.fields.items))
        .map((value,i)=><option value={i} key={i}>{draft.kind==="PARTNERS"?str((value as Record<string,unknown>).title):draft.kind==="CONTACT"?"Original photo "+(i+1):draft.kind==="IMPACT"?
         str((value as Section).fields.group):str((value as Record<string,unknown>).title)||"Item "+(i+1)}</option>)}
      </select></label>}
      <Field name="Accessible image/document description" value={uploadAlt}
       onChange={setUploadAlt}/>
      <label className="cg-cms-consent"><input type="checkbox" checked={rights}
       onChange={e=>setRights(e.target.checked)}/>The Foundation owns the public-use rights</label>
      <input type="file" disabled={busy||!rights||uploadAlt.trim().length<3||
         allowedForCurrentPlacement().length===0||
         (uploadRole==="DOCUMENT"&&items(draft.sections[0]?.fields.documents).length===0)||
         (uploadRole==="FEATURE"&&items(draft.kind==="HEALTHCARE"?draft.sections.find(x=>x.kind==="HEALTHCARE_CATEGORIES")?.fields.categories:draft.sections.find(x=>x.kind==="PARTNER_CARDS")?.fields.partners).length===0)||
         (uploadRole==="GALLERY"&&items(draft.sections[0]?.fields.items).length===0)} accept={
       allowedForCurrentPlacement().join(",")}
       onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);
        e.currentTarget.value="";}}/>
      {draft.assets.map(a=><div className="cg-cms-asset" key={a.fileRef}>
       <span>{a.role} · position {a.order+1} · {a.altText}</span>
       <button type="button" disabled={!canManage} onClick={()=>setDraft(d=>({
        ...d,assets:d.assets.filter(v=>v!==a)}))}>Detach</button></div>)}
     </fieldset>}
    <p className="cg-cms-muted">Contact submissions use the existing CG-19 private support form.
     Publication cannot create a separate inbox, event, provider or patient record.</p>
   </div>}
   <div className="cg-cms-actions">
    {!selected&&canManage&&<button disabled={busy||!!pending}
     onClick={()=>act("pages","POST",{content:content(draft)})}>Create draft</button>}
    {selected?.status==="DRAFT"&&canManage&&<button disabled={busy||!!pending}
     onClick={()=>act("pages/"+selected.pageRef+"/draft","PUT",{
      content:content(draft),expectedVersion:selected.version})}>Save draft</button>}
    {selected&&selected.status!=="DRAFT"&&canManage&&
     <div className="cg-cms-review-edit">
      <p>Start a new unpublished revision of this page. The currently
       published copy stays unchanged until the new revision is independently
       approved and published. Older scheduled drafts may be cancelled.</p>
      <button type="button" disabled={busy||!!pending}
       onClick={()=>act("pages/"+selected.pageRef+"/draft","PUT",{
        content:content(draft),expectedVersion:selected.version})}>
       Create next draft revision</button>
     </div>}
    {selected?.status==="DRAFT"&&canManage&&<button disabled={busy||!!pending||!!unsaved}
     onClick={()=>act("pages/"+selected.pageRef+"/submit","POST",{
      expectedVersion:selected.version})}>Submit to independent review</button>}
    {selected?.status==="SUBMITTED"&&selected.approvalCaseRef&&canPublish&&<>
     <label>Schedule (optional)<input type="datetime-local" value={publishWhen}
      onChange={e=>setPublishWhen(e.target.value)}/></label>
     <button type="button" disabled={busy||!!pending||!!unsaved||
       (Boolean(publishWhen)&&(!Number.isFinite(Date.parse(publishWhen))||
         Date.parse(publishWhen)-Date.now()<60000))}
      onClick={()=>act("pages/"+selected.pageRef+"/publish","POST",{
       expectedVersion:selected.version,caseRef:selected.approvalCaseRef,
       ...(publishWhen?{publishAt:new Date(publishWhen).toISOString()}:{})})}>
      Publish approved version</button></>}
    {selected&&canPublish&&(selected.publicationStatus==="EFFECTIVE"||selected.scheduledAt)&&<>
     <Field name="Withdrawal reason" value={withdrawReason} onChange={setWithdrawReason}/>
     <button disabled={busy||!!pending||withdrawReason.trim().length<8}
      onClick={()=>act("pages/"+selected.pageRef+"/withdraw","POST",{
       expectedVersion:selected.version,reason:withdrawReason})}>Withdraw public page</button>
    </>}
   </div>
   {selected&&<p className="cg-cms-muted">Draft {selected.status.replaceAll("_"," ")} ·
    Publication {selected.publicationStatus.replaceAll("_"," ")}.
    Review through the original Website CMS approval inbox. No draft is public.</p>}
   </section>
  </>}
 </section>;
}
